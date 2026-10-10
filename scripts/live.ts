/**
 * Refreshes the live status of every issue in the snapshot. Read-only: GitHub
 * GraphQL through `gh` (GH_TOKEN in CI) and the public nuxtathon.live API.
 * Runs with plain Node 24, no install: `node scripts/live.ts --out status.json`.
 */
import { parseArgs } from 'node:util'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { deriveLive, EVENT_START, type LiveEntry, type LiveStatus, type RawIssue } from '../shared/live.ts'

const exec = promisify(execFile)
const { values: v } = parseArgs({
  options: {
    dataset: { type: 'string', default: 'public/data/index.json' },
    out: { type: 'string', default: '.data/status.json' },
    batch: { type: 'string', default: '50' },
    concurrency: { type: 'string', default: '4' },
  },
})
const API = 'https://nuxtathon.live/api/v1'
const headers = { 'user-agent': 'nuxtathon-triage (+https://github.com/HugoRCD/nuxtathon-triage)' }

async function event() {
  try {
    const [e, lb] = await Promise.all(
      [`${API}/event`, `${API}/leaderboard?include=contributions`].map(async (url) => {
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) })
        if (!res.ok) throw new Error(`${url}: ${res.status}`)
        return res.json() as Promise<any>
      }),
    )
    const counted = new Map<string, string>()
    for (const c of [...(lb.contributors ?? []), ...(lb.coreTeam ?? [])])
      for (const ref of c.issueRefs ?? []) counted.set(String(ref).toLowerCase(), c.login)
    return { start: e.event?.startsAt ?? EVENT_START, end: e.event?.endsAt as string | undefined, counted }
  } catch (error) {
    console.warn(`nuxtathon.live unavailable, continuing without it: ${error}`)
    return { start: EVENT_START, end: undefined, counted: new Map<string, string>() }
  }
}

const fields = `state closedAt assignees(first:5){nodes{login}} comments(last:5){nodes{createdAt author{login __typename}}} closedByPullRequestsReferences(first:5,includeClosedPrs:true){nodes{url state mergedAt createdAt author{login}}} timelineItems(last:10,itemTypes:[CROSS_REFERENCED_EVENT,ASSIGNED_EVENT]){nodes{__typename ... on AssignedEvent{createdAt assignee{... on User{login}}} ... on CrossReferencedEvent{createdAt willCloseTarget source{... on PullRequest{url state mergedAt createdAt author{login}}}}}}`

/** One aliased query per batch. NOT_FOUND (deleted or transferred issues) comes back as null, not as a failure. */
async function fetchBatch(ids: string[]): Promise<(RawIssue | null)[]> {
  const parts = ids.map((id, n) => {
    const [, owner, name, number] = id.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/)!
    return `i${n}:repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(name)}){issue(number:${number}){${fields}}}`
  })
  for (let attempt = 0; ; attempt++) {
    try {
      const { stdout } = await exec('gh', ['api', 'graphql', '-f', `query=query{${parts.join(' ')}}`], {
        maxBuffer: 64 * 1024 * 1024,
        timeout: 90000,
      }).catch((e) => (e.stdout ? { stdout: e.stdout as string } : Promise.reject(e)))
      const result = JSON.parse(stdout)
      const fatal = (result.errors ?? []).filter((e: any) => e.type !== 'NOT_FOUND')
      if (fatal.length || !result.data) throw new Error(fatal.map((e: any) => e.message).join('; ') || stdout)
      return ids.map((_, n) => result.data[`i${n}`]?.issue ?? null)
    } catch (error) {
      if (attempt >= 3) throw error
      await sleep(3000 * 2 ** attempt)
    }
  }
}

const dataset = JSON.parse(await readFile(v.dataset!, 'utf8')) as { issues: { id: string; state: string }[] }
const ids = dataset.issues.filter((i) => i.state === 'OPEN').map((i) => i.id)
const ev = await event()
if (ev.end && Date.now() > Date.parse(ev.end) + 2 * 86400000) {
  console.log('The event ended more than two days ago; nothing to refresh.')
  process.exit(0)
}
const size = Number(v.batch)
const batches = Array.from({ length: Math.ceil(ids.length / size) }, (_, n) =>
  ids.slice(n * size, (n + 1) * size),
)
const issues: Record<string, LiveEntry> = {}
let next = 0
await Promise.all(
  Array.from({ length: Number(v.concurrency) }, async () => {
    while (next < batches.length) {
      const batch = batches[next++]!
      const raws = await fetchBatch(batch)
      batch.forEach((id, n) => {
        const entry = deriveLive(raws[n]!, { since: ev.start, countedFor: ev.counted.get(id.toLowerCase()) })
        if (entry) issues[id.toLowerCase()] = entry
      })
    }
  }),
)
const status: LiveStatus = {
  generatedAt: new Date().toISOString(),
  eventStart: ev.start,
  checked: ids.length,
  issues,
}
await mkdir(dirname(v.out!), { recursive: true })
await writeFile(v.out!, JSON.stringify(status))
const counts: Record<string, number> = {}
for (const e of Object.values(issues)) counts[e.state] = (counts[e.state] ?? 0) + 1
console.log(`Checked ${ids.length} issues: ${JSON.stringify(counts)}`)
