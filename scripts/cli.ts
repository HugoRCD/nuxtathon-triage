import { parseArgs } from 'node:util'
import { readFile, writeFile } from 'node:fs/promises'
import { Store } from './lib/store.ts'
import { discover, listIssues, refreshIssue, pool } from './lib/github.ts'
import { acquireLock, runBatch, readInvestigation } from './lib/runner.ts'
import { exportDataset } from './lib/export.ts'
const {
  values: v,
  positionals: [command],
} = parseArgs({
  allowPositionals: true,
  options: {
    db: { type: 'string', default: '.data/triage.sqlite' },
    orgs: { type: 'string', default: 'nuxt,nuxt-modules' },
    repos: { type: 'string' },
    issues: { type: 'string' },
    limit: { type: 'string' },
    concurrency: { type: 'string', default: '2' },
    'max-requests': { type: 'string', default: '10' },
    'max-tokens': { type: 'string', default: '300000' },
    'max-cost': { type: 'string', default: '0.10' },
    'collect-concurrency': { type: 'string', default: '6' },
    'max-attempts': { type: 'string', default: '3' },
    timeout: { type: 'string', default: '30000' },
    'dry-run': { type: 'boolean' },
    'allow-partial': { type: 'boolean' },
    'retry-failed': { type: 'boolean' },
    out: { type: 'string', default: 'public/data/index.json' },
    evidence: { type: 'string' },
    labels: { type: 'string' },
  },
})
function number(name: string, value: string | undefined, def: number) {
  const n = value === undefined ? def : Number(value)
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be positive`)
  return n
}
const limit = number(
  'limit',
  v.limit,
  command === 'classify' || command === 'investigate' ? 10 : Number.MAX_SAFE_INTEGER,
)
if (!['collect', 'classify', 'investigate', 'export', 'status', 'evaluate'].includes(command ?? '')) {
  console.log(
    `Nuxtathon triage\n\n  collect --repos nuxt/nuxters,nuxt/telemetry --limit 30\n  collect --issues nuxt/nuxters#9,nuxt/telemetry#134\n  collect                                      # both organisations, all open issues\n  classify --dry-run --limit 30\n  classify --limit 10 --max-requests 10 --max-cost 0.10\n  investigate --evidence evidence/issue.json --limit 1\n  export --allow-partial                         # explicit partial publication\n  evaluate --labels evidence/reference-labels.json\n  status\n\nOptional: --db PATH, --out PATH. Gateway credentials: .env or shell environment.\nA single local writer is enforced. All GitHub access is read-only.`,
  )
  process.exit(command ? 1 : 0)
}
const release = await acquireLock(`${v.db}.lock`)
const store = new Store(v.db)
const controller = new AbortController()
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.once(sig, () => controller.abort())
try {
  if (command === 'collect') {
    const scope = v.issues ? v.issues.split(',') : v.repos ? v.repos.split(',') : v.orgs!.split(',')
    const previous = store.meta('collection')
    store.meta('collection', { scope, status: 'running', startedAt: new Date().toISOString() })
    let count = 0
    const errors: string[] = []
    const save = async (i: Awaited<ReturnType<typeof refreshIssue>>) => {
      store.saveIssue(i)
      count++
      console.log(
        `COLLECT ${i.id} (${i.comments.length} comments, ${i.prs.length} PRs${i.gaps.length ? ', partial' : ''})`,
      )
    }
    if (v.issues) {
      for (const id of scope.slice(0, limit)) {
        if (controller.signal.aborted) break
        const m = /^([\w.-]+\/[\w.-]+)#(\d+)$/.exec(id)
        if (!m) throw new Error(`Invalid issue: ${id}`)
        await save(await refreshIssue(m[1]!, Number(m[2])))
      }
    } else {
      const repos = v.repos ? scope : (await Promise.all(scope.map(discover))).flat()
      console.log(`Collecting ${repos.length} repositories`)
      await pool(
        repos,
        Math.floor(number('collect-concurrency', v['collect-concurrency'], 6)),
        async (repo) => {
          if (count >= limit) return
          try {
            for (const issue of await listIssues(repo, limit - count)) await save(issue)
          } catch (e) {
            errors.push(repo)
            console.error(`Collection failed for ${repo}:`, e instanceof Error ? e.message : 'Unknown error')
          }
        },
        controller.signal,
      )
    }
    // Refresh previously known issues as well, so closures and updated PR references invalidate old results.
    if (!v.issues && !v.repos && !v.limit && !controller.signal.aborted) {
      for (const old of store.issues()) {
        if (controller.signal.aborted) break
        if (old.state === 'OPEN' && old.retrievedAt < store.meta('collection').startedAt)
          try {
            await save(await refreshIssue(old.repo, old.number))
          } catch {
            errors.push(old.id)
          }
      }
    }
    store.meta('collection', {
      scope,
      status: controller.signal.aborted || errors.length || v.limit ? 'partial' : 'complete',
      collected: count,
      errors,
      finishedAt: new Date().toISOString(),
      previousScope: previous?.scope,
    })
    if (errors.length) process.exitCode = 1
  } else if (command === 'classify' || command === 'investigate') {
    if (!v['dry-run'] && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN)
      throw new Error(
        'AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN is missing. Configure .env locally; no model requests were sent.',
      )
    if (command === 'investigate' && !v.evidence) throw new Error('--evidence is required')
    const evidence = v.evidence ? await readInvestigation(v.evidence) : undefined
    if (evidence && !store.issues().some((i) => i.id === evidence.issue))
      throw new Error('Collect the investigation issue first')
    const result = await runBatch(
      store,
      store.issues().filter((i) => i.state === 'OPEN' && !i.repository.archived),
      {
        limit,
        maxRequests: number('max-requests', v['max-requests'], 10),
        maxTokens: number('max-tokens', v['max-tokens'], 300000),
        maxCost: number('max-cost', v['max-cost'], 0.1),
        concurrency: Math.floor(number('concurrency', v.concurrency, 2)),
        maxAttempts: Math.floor(number('max-attempts', v['max-attempts'], 3)),
        timeoutMs: number('timeout', v.timeout, 30000),
        signal: controller.signal,
        evidence,
        dryRun: v['dry-run'],
        retryFailed: v['retry-failed'],
      },
    )
    if (result.failed || result.stopped) process.exitCode = 1
  } else if (command === 'export') console.log(await exportDataset(store, v.out!, v['allow-partial']))
  else if (command === 'status')
    console.log(
      JSON.stringify(
        {
          collection: store.meta('collection'),
          issues: store.issues().length,
          jobs: store.db.prepare('SELECT status,COUNT(*) AS count FROM jobs GROUP BY status').all(),
        },
        null,
        2,
      ),
    )
  else if (command === 'evaluate') {
    if (!v.labels) throw new Error('--labels is required')
    const labels = JSON.parse(await readFile(v.labels, 'utf8')) as {
      issue: string
      answers: Record<string, string | boolean>
    }[]
    const metrics: Record<string, { correct: number; total: number; missing: number }> = {}
    for (const item of labels) {
      const result = store.results(item.issue).find((r) => r.stage === 'classify')
      for (const [key, expected] of Object.entries(item.answers)) {
        const m = (metrics[key] ??= { correct: 0, total: 0, missing: 0 })
        m.total++
        const a = result?.answers[key]
        if (!a) {
          m.missing++
          continue
        }
        const actual =
          a.type === 'choice'
            ? a.choice
            : a.type === 'boolean'
              ? a.probability >= 0.8
                ? true
                : a.probability <= 0.2
                  ? false
                  : 'uncertain'
              : 'unsupported'
        if (actual === expected) m.correct++
      }
    }
    console.log(JSON.stringify({ referenceIssues: labels.length, metrics }, null, 2))
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : 'Unexpected failure')
  process.exitCode = 1
} finally {
  store.close()
  await release()
}
