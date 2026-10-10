import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Dataset } from '../shared/types.ts'
import { defaultFilters, filterIssues } from '../shared/filters.ts'
import { searchIssues } from '../shared/agent.ts'
import { deriveLive, hiddenBy, type LiveStatus, type RawIssue } from '../shared/live.ts'

const since = '2026-10-10T00:00:00.000Z'
const before = '2026-10-01T00:00:00.000Z'
const during = '2026-10-10T09:00:00.000Z'

const raw = (patch: Partial<RawIssue> = {}): RawIssue => ({
  state: 'OPEN',
  closedAt: null,
  assignees: { nodes: [] },
  comments: { nodes: [] },
  closedByPullRequestsReferences: { nodes: [] },
  timelineItems: { nodes: [] },
  ...patch,
})

const pr = (p: Record<string, unknown>) =>
  ({
    url: 'https://github.com/nuxt/nuxt/pull/1',
    state: 'OPEN',
    createdAt: during,
    mergedAt: null,
    author: { login: 'ada' },
    ...p,
  }) as never

test('a credit on nuxtathon.live wins over everything else', () => {
  assert.deepEqual(deriveLive(raw({ state: 'CLOSED' }), { since, countedFor: 'ada' }), {
    state: 'counted',
    by: 'ada',
  })
})

test('missing or closed issues are closed', () => {
  assert.equal(deriveLive(null, { since })?.state, 'closed')
  assert.equal(deriveLive(raw({ state: 'CLOSED', closedAt: during }), { since })?.state, 'closed')
})

test('only pull requests opened during the event mark an issue as taken', () => {
  const old = raw({ closedByPullRequestsReferences: { nodes: [pr({ createdAt: before })] } })
  assert.equal(deriveLive(old, { since }), null)
  const fresh = raw({ closedByPullRequestsReferences: { nodes: [pr({})] } })
  assert.deepEqual(deriveLive(fresh, { since }), {
    state: 'prOpen',
    at: during,
    url: 'https://github.com/nuxt/nuxt/pull/1',
    by: 'ada',
  })
  const merged = raw({
    closedByPullRequestsReferences: { nodes: [pr({ state: 'MERGED', mergedAt: during })] },
  })
  assert.equal(deriveLive(merged, { since })?.state, 'fixMerged')
})

test('assignments count only while the assignee is still current', () => {
  const event = { __typename: 'AssignedEvent' as const, createdAt: during, assignee: { login: 'ada' } }
  assert.equal(deriveLive(raw({ timelineItems: { nodes: [event] } }), { since }), null)
  const kept = raw({ timelineItems: { nodes: [event] }, assignees: { nodes: [{ login: 'ada' }] } })
  assert.deepEqual(deriveLive(kept, { since }), { state: 'assigned', at: during, by: 'ada' })
})

test('bot comments are not activity', () => {
  const bot = raw({
    comments: { nodes: [{ createdAt: during, author: { __typename: 'Bot', login: 'renovate' } as never }] },
  })
  assert.equal(deriveLive(bot, { since }), null)
  const human = raw({
    comments: { nodes: [{ createdAt: during, author: { __typename: 'User', login: 'ada' } as never }] },
  })
  assert.equal(deriveLive(human, { since })?.state, 'active')
})

test('availability decides what each state hides', () => {
  const taken = { state: 'prOpen' as const }
  const active = { state: 'active' as const }
  assert.equal(hiddenBy(undefined, 'free'), false)
  assert.equal(hiddenBy(taken, 'free'), true)
  assert.equal(hiddenBy(active, 'free'), false)
  assert.equal(hiddenBy(active, 'quiet'), true)
  assert.equal(hiddenBy(undefined, 'changed'), true)
  assert.equal(hiddenBy(taken, 'changed'), false)
  assert.equal(hiddenBy(taken, 'all'), false)
})

const data = JSON.parse(
  readFileSync(new URL('../public/data/index.json', import.meta.url), 'utf8'),
) as Dataset

test('filters and agent search hide taken issues by default', () => {
  const visible = filterIssues(data.issues, defaultFilters)
  const [first, second] = visible
  assert.ok(first && second)
  const live: LiveStatus = {
    generatedAt: during,
    eventStart: since,
    checked: 2,
    issues: { [first.id.toLowerCase()]: { state: 'prOpen' }, [second.id.toLowerCase()]: { state: 'active' } },
  }
  const ids = filterIssues(data.issues, defaultFilters, live).map((i) => i.id)
  assert.ok(!ids.includes(first.id))
  assert.ok(ids.includes(second.id))
  assert.equal(
    filterIssues(data.issues, { ...defaultFilters, availability: 'all' }, live).length,
    visible.length,
  )

  const search = searchIssues(data, { limit: 50 }, live)
  assert.ok(search.issues.every((i) => i.id !== first.id))
  const changed = searchIssues(data, { availability: 'changed' }, live)
  assert.deepEqual(changed.issues.map((i) => i.id).sort(), [first.id, second.id].sort())
  assert.equal(changed.issues.find((i) => i.id === second.id)?.liveStatus?.state, 'active')
  assert.equal(searchIssues(data, { limit: 1 }).total, visible.length)
})
