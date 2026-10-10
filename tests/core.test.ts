import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { APICallError } from 'ai'
import { Store, evidenceHash } from '../scripts/lib/store.ts'
import { runBatch, prepare, validateAnswers, acquireLock, type RunOptions } from '../scripts/lib/runner.ts'
import { exportDataset, buildDataset } from '../scripts/lib/export.ts'
import { cleanObject } from '../scripts/lib/security.ts'
import { questions, RUBRIC_VERSION, MODEL } from '../scripts/lib/rubric.ts'
import { filterIssues, defaultFilters, difficulty } from '../shared/filters.ts'
import { summary, ease, why } from '../shared/plain.ts'
import type { Issue, Answers, PublicIssue } from '../shared/types.ts'

export function fixture(n = 1): Issue {
  return {
    id: `nuxt/example#${n}`,
    repo: 'nuxt/example',
    number: n,
    url: `https://github.com/nuxt/example/issues/${n}`,
    title: `Example issue ${n}`,
    body: 'A clear report with steps.',
    author: 'tester',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    state: 'OPEN',
    labels: ['bug'],
    thumbsUp: 5,
    commentCount: 0,
    comments: [],
    prs: [],
    repository: { description: 'Example', archived: false, defaultBranch: 'main' },
    retrievedAt: '2026-10-10T00:00:00Z',
    gaps: [],
  }
}
export function answers(): Answers {
  return Object.fromEntries(
    Object.entries(questions).map(([k, q]) => [
      k,
      q.type === 'choice'
        ? {
            type: 'choice',
            choice: Object.keys(q.criteria)[0],
            probabilities: Object.fromEntries(Object.keys(q.criteria).map((x, i) => [x, i === 0 ? 1 : 0])),
          }
        : q.type === 'boolean'
          ? { type: 'boolean', probability: 0.95 }
          : { type: 'score', score: 0.2 },
    ]),
  ) as Answers
}
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'nuxt-triage-test-'))
  const store = new Store(join(dir, 'test.sqlite'))
  return {
    dir,
    store,
    close() {
      store.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
const options: RunOptions = {
  limit: 20,
  maxRequests: 20,
  maxTokens: 1000000,
  maxCost: 1,
  concurrency: 2,
  maxAttempts: 3,
  timeoutMs: 1000,
  log: () => {},
  sleep: async () => {},
  call: async () => ({
    answers: answers(),
    usage: { inputTokens: 100, outputTokens: 10 },
    cost: 0.00001,
    warnings: [],
  }),
}

test('evidence hash excludes retrieval time, includes PR changes and later comments', () => {
  const a = fixture()
  assert.equal(evidenceHash(a), evidenceHash({ ...a, retrievedAt: '2026-10-11T00:00:00Z' }))
  assert.notEqual(evidenceHash(a), evidenceHash({ ...a, body: 'Changed' }))
  assert.notEqual(
    prepare(a).key,
    prepare({
      ...a,
      prs: [
        {
          url: 'https://github.com/nuxt/example/pull/2',
          title: 'fix',
          state: 'MERGED',
          mergedAt: '2026-10-10',
          updatedAt: '2026-10-10',
          closing: true,
        },
      ],
    }).key,
  )
})
test('all rubric answers are required and validated', () => {
  validateAnswers(answers())
  const a = answers()
  delete a.closure
  assert.throws(() => validateAnswers(a), /Missing/)
  const b = answers()
  b.newcomer = { type: 'choice', choice: 'made-up' }
  assert.throws(() => validateAnswers(b), /Unknown/)
  const c = answers()
  c.upstream = { type: 'boolean', probability: NaN }
  assert.throws(() => validateAnswers(c), /Invalid/)
})
test('oversized evidence is skipped rather than truncated', () => {
  assert.throws(() => prepare({ ...fixture(), body: 'X'.repeat(70000) }), /Nothing was truncated/)
})
test('secret-looking material is redacted before inference', () => {
  const token = 'ghp_' + 'a'.repeat(36)
  const p = prepare({ ...fixture(), body: `token ${token}` })
  assert(!JSON.stringify(p.state).includes(token))
  assert.equal(p.warnings.length, 1)
  const clean = cleanObject({ webhook: 'https://discord.com/api/webhooks/123/abc' })
  assert.equal(clean.value.webhook, '[REDACTED]')
})
test('successful batches resume without duplicate calls, interrupted jobs recover', async () => {
  const s = setup()
  try {
    const i = fixture()
    s.store.saveIssue(i)
    let calls = 0
    const o = {
      ...options,
      call: async () => {
        calls++
        return options.call!({} as any, new AbortController().signal)
      },
    }
    await runBatch(s.store, [i], o)
    await runBatch(s.store, [i], o)
    assert.equal(calls, 1)
    const p = prepare(fixture(2))
    s.store.queue(p.key, 'nuxt/example#2', p.inputHash, RUBRIC_VERSION, MODEL, p.stage)
    s.store.start(p.key)
    await runBatch(s.store, [fixture(2)], o)
    assert.equal(s.store.job(p.key).status, 'succeeded')
    assert.equal(calls, 2)
  } finally {
    s.close()
  }
})
test('retry throttling is bounded and succeeds on subsequent call', async () => {
  const s = setup()
  try {
    let calls = 0
    await runBatch(s.store, [fixture()], {
      ...options,
      concurrency: 1,
      call: async () => {
        if (++calls === 1)
          throw new APICallError({
            message: 'limited',
            url: 'https://example.com',
            requestBodyValues: {},
            statusCode: 429,
            responseHeaders: { 'retry-after': '0' },
            isRetryable: true,
          })
        return options.call!({} as any, new AbortController().signal)
      },
    })
    assert.equal(calls, 2)
    assert.equal(s.store.job(prepare(fixture()).key).status, 'succeeded')
  } finally {
    s.close()
  }
})
test('authentication failure stops the queue, no fallback', async () => {
  const s = setup()
  try {
    let calls = 0
    const result = await runBatch(s.store, [fixture(), fixture(2)], {
      ...options,
      concurrency: 1,
      call: async () => {
        calls++
        throw new APICallError({
          message: 'unauthorised',
          url: 'https://example.com',
          requestBodyValues: {},
          statusCode: 401,
        })
      },
    })
    assert.equal(calls, 1)
    assert.equal(result.stopped, 'Gateway authentication failed')
  } finally {
    s.close()
  }
})
test('invalid output is terminal and not endlessly retried', async () => {
  const s = setup()
  try {
    let calls = 0
    await runBatch(s.store, [fixture()], {
      ...options,
      call: async () => {
        calls++
        return { answers: {}, usage: {}, warnings: [] }
      },
    })
    assert.equal(calls, 1)
    assert.equal(s.store.job(prepare(fixture()).key).status, 'terminal-failed')
  } finally {
    s.close()
  }
})
test('request budget includes retries and concurrent requests', async () => {
  const s = setup()
  try {
    let calls = 0
    const r = await runBatch(s.store, [fixture(), fixture(2), fixture(3)], {
      ...options,
      maxRequests: 1,
      call: async () => {
        calls++
        return options.call!({} as any, new AbortController().signal)
      },
    })
    assert.equal(calls, 1)
    assert.equal(r.requests, 1)
  } finally {
    s.close()
  }
})
test('missing cost stops after an unknown-cost successful request', async () => {
  const s = setup()
  try {
    const r = await runBatch(s.store, [fixture(), fixture(2)], {
      ...options,
      concurrency: 1,
      call: async () => ({ answers: answers(), usage: {}, warnings: [] }),
    })
    assert.equal(r.succeeded, 1)
    assert.equal(r.unknownCost, 1)
    assert.match(r.stopped, /Missing cost/)
  } finally {
    s.close()
  }
})
test('failed export preserves previous file, partial export is explicit', async () => {
  const s = setup()
  try {
    s.store.saveIssue(fixture())
    const path = join(s.dir, 'public.json')
    await exportDataset(s.store, path, true)
    const previous = readFileSync(path, 'utf8')
    await assert.rejects(exportDataset(s.store, path), /Previous public snapshot preserved/)
    assert.equal(readFileSync(path, 'utf8'), previous)
    assert.equal(buildDataset(s.store, true).manifest.assessed, 0)
  } finally {
    s.close()
  }
})
test('changed evidence marks old results stale, unchanged data stays assessed', async () => {
  const s = setup()
  try {
    const i = fixture()
    s.store.saveIssue(i)
    await runBatch(s.store, [i], options)
    assert.equal(buildDataset(s.store, true).issues[0]?.status, 'assessed')
    s.store.saveIssue({ ...i, body: 'A later contradictory report' })
    assert.equal(buildDataset(s.store, true).issues[0]?.status, 'stale')
  } finally {
    s.close()
  }
})
test('investigation retains its first pass and source provenance', async () => {
  const s = setup()
  try {
    const i = fixture()
    s.store.saveIssue(i)
    await runBatch(s.store, [i], options)
    const evidence = {
      issue: i.id,
      notes: 'Checked code; not executed',
      sources: [
        {
          url: 'https://github.com/nuxt/example/blob/main/index.ts',
          retrievedAt: '2026-10-10T00:00:00Z',
          excerpt: 'export {}',
          verification: 'source-read' as const,
        },
      ],
    }
    await runBatch(s.store, [i], { ...options, evidence })
    const r = buildDataset(s.store, true).issues[0]!
    assert.equal(r.assessment?.stage, 'investigate')
    assert.equal(r.firstPass?.stage, 'classify')
    assert.equal(s.store.results(i.id).length, 2)
  } finally {
    s.close()
  }
})
test('public export redacts secrets and omits provider metadata', async () => {
  const s = setup()
  try {
    const i = { ...fixture(), body: 'api_key=abcdefghijklmnop123456789' }
    s.store.saveIssue(i)
    await runBatch(s.store, [i], options)
    const text = JSON.stringify(buildDataset(s.store, true))
    assert(!text.includes('abcdefghijklmnop123456789'))
    assert(!text.includes('providerMetadata'))
    assert(text.includes('REDACTED'))
  } finally {
    s.close()
  }
})
test('filters distinguish newcomers from small changes and combine search/repo/type', async () => {
  const s = setup()
  try {
    const i = fixture()
    s.store.saveIssue(i)
    await runBatch(s.store, [i], options)
    const records = buildDataset(s.store, true).issues
    assert.equal(
      filterIssues(records, { ...defaultFilters, q: 'Example', repo: 'nuxt/example', type: 'bug' }).length,
      1,
    )
    assert.equal(filterIssues(records, { ...defaultFilters, repo: 'other/repo' }).length, 0)
    assert.equal(difficulty(records[0]!), 'small')
    assert.equal(filterIssues(records, { ...defaultFilters, view: 'newcomer' }).length, 1)
    const a = records[0]!.assessment!
    a.answers.newcomer = { type: 'choice', choice: 'experienced' }
    assert.equal(difficulty(records[0]!), 'small')
    assert.equal(filterIssues(records, { ...defaultFilters, view: 'newcomer' }).length, 0)
  } finally {
    s.close()
  }
})
test('single-writer lock prevents simultaneous runner processes', async () => {
  const s = setup()
  try {
    const path = join(s.dir, 'lock')
    const release = await acquireLock(path)
    await assert.rejects(acquireLock(path), /Another runner/)
    await release()
    const again = await acquireLock(path)
    await again()
  } finally {
    s.close()
  }
})

test('curated views reject uncertain or stale suggestions and contradictory fix reports', async () => {
  const s = setup()
  try {
    const i = fixture()
    s.store.saveIssue(i)
    await runBatch(s.store, [i], options)
    const records = buildDataset(s.store, true).issues
    const r = records[0]!
    const a = r.assessment!.answers
    a.closure = {
      type: 'choice',
      choice: 'possibleFix',
      probabilities: { possibleFix: 0.95, unresolved: 0.05 },
    }
    a.contradictoryFixReports = { type: 'boolean', probability: 0.05 }
    assert.equal(filterIssues(records, { ...defaultFilters, view: 'closure' }).length, 1)
    a.contradictoryFixReports = { type: 'boolean', probability: 0.9 }
    assert.equal(filterIssues(records, { ...defaultFilters, view: 'closure' }).length, 0)
    a.newcomer = { type: 'choice', choice: 'suitable', probabilities: { suitable: 0.51, experienced: 0.49 } }
    assert.equal(filterIssues(records, { ...defaultFilters, view: 'newcomer' }).length, 0)
    r.status = 'stale'
    assert.equal(difficulty(r), 'unknown')
  } finally {
    s.close()
  }
})

test('plain summary drives quick wins, time and who filters, and the easiest sort', async () => {
  const s = setup()
  try {
    const i = fixture()
    s.store.saveIssue(i)
    await runBatch(s.store, [i], options)
    const records = buildDataset(s.store, true).issues
    const r = records[0]!
    const a = r.assessment!.answers
    const sum = summary(r)!
    assert.equal(sum.time?.short, '< 1 hour')
    assert.equal(sum.who?.open, true)
    assert.equal(sum.sure, 'Confident')
    assert(why(a).some((x) => x.text === 'Has a reproduction' && x.good))
    assert.equal(filterIssues(records, { ...defaultFilters, view: 'quick' }).length, 1)
    assert.equal(filterIssues(records, { ...defaultFilters, time: 'underHour', who: 'anyone' }).length, 1)
    assert.equal(filterIssues(records, { ...defaultFilters, time: 'dayOrMore' }).length, 0)
    const easy = ease(r)
    a.whoCanAct = { type: 'choice', choice: 'anyone', probabilities: { anyone: 0.4, maintainer: 0.35 } }
    assert.equal(summary(r)!.who, null, 'a weak lean is not shown as a claim')
    assert.equal(summary(r)!.sure, 'Unsure')
    assert.equal(filterIssues(records, { ...defaultFilters, view: 'quick' }).length, 0)
    assert(ease(r) > easy)
    r.status = 'stale'
    assert.equal(summary(r), null)
  } finally {
    s.close()
  }
})

test('unknown issue fields never leak through the public export allowlist', () => {
  const s = setup()
  try {
    s.store.saveIssue({ ...fixture(), privateDebugField: 'DO_NOT_EXPORT' } as Issue)
    assert(!JSON.stringify(buildDataset(s.store, true)).includes('DO_NOT_EXPORT'))
  } finally {
    s.close()
  }
})

test('Gateway credentials are redacted and provider timestamps remain serialisable', () => {
  const token = 'vck_' + 'a'.repeat(56)
  const result = cleanObject({ token, timestamp: new Date('2026-10-10T10:00:00Z') })
  assert.equal(result.value.token, '[REDACTED]')
  assert.equal(result.value.timestamp as unknown, '2026-10-10T10:00:00.000Z')
})
