import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enrich, type Query } from '../scripts/lib/github.ts'
import type { Issue } from '../shared/types.ts'
const issue: Issue = {
  id: 'nuxt/test#1',
  repo: 'nuxt/test',
  number: 1,
  url: 'https://github.com/nuxt/test/issues/1',
  title: 'Example',
  body: 'Report',
  author: 'tester',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  state: 'OPEN',
  labels: [],
  thumbsUp: 0,
  commentCount: 2,
  comments: [],
  prs: [],
  repository: { description: '', archived: false, defaultBranch: 'main' },
  retrievedAt: '2026-10-10T00:00:00Z',
  gaps: ['Comments not collected', 'PR references not collected'],
}
const pr = {
  url: 'https://github.com/nuxt/test/pull/2',
  title: 'Fix',
  state: 'MERGED',
  mergedAt: '2026-10-01',
  updatedAt: '2026-10-01',
}
const wrap = (key: string, nodes: unknown[], next = false) => ({
  repository: {
    issue: { [key]: { nodes, pageInfo: { hasNextPage: next, endCursor: next ? 'next' : null } } },
  },
})
test('collector paginates comments, closing PRs and cross-references and deduplicates links', async () => {
  const calls: Record<string, number> = {}
  const cursors: string[] = []
  const query: Query = async <T>(q: string, vars: Record<string, string | number> = {}) => {
    const key = q.includes('comments(first:')
      ? 'comments'
      : q.includes('closedByPullRequestsReferences')
        ? 'closedByPullRequestsReferences'
        : 'timelineItems'
    calls[key] = (calls[key] ?? 0) + 1
    if (vars?.cursor) cursors.push(String(vars.cursor))
    const first = !vars?.cursor
    const nodes =
      key === 'comments'
        ? [
            {
              url: `https://github.com/nuxt/test/issues/1#${first ? 1 : 2}`,
              body: first ? 'Original' : 'Still broken',
              createdAt: '2026-10-01',
              authorAssociation: 'MEMBER',
              author: { login: 'tester' },
            },
          ]
        : key === 'closedByPullRequestsReferences'
          ? first
            ? [pr]
            : []
          : [
              { source: pr },
              {
                source: { ...pr, url: 'https://github.com/nuxt/test/pull/3', state: 'OPEN', mergedAt: null },
              },
            ]
    return wrap(key, nodes, first) as T
  }
  const result = await enrich(issue, query)
  assert.equal(result.comments.length, 2)
  assert.equal(result.prs.length, 2)
  assert.equal(result.prs[0]?.closing, true)
  assert.equal(result.prs[1]?.closing, false)
  assert.deepEqual(result.gaps, [])
  assert.deepEqual(calls, { comments: 2, closedByPullRequestsReferences: 2, timelineItems: 2 })
  assert.equal(cursors.length, 3)
})
test('failed later comment page preserves collected context and marks evidence incomplete', async () => {
  const query: Query = async <T>(q: string, vars: Record<string, string | number> = {}) => {
    if (q.includes('comments(first:')) {
      if (vars?.cursor) throw new Error('Unavailable')
      return wrap(
        'comments',
        [
          {
            url: 'https://github.com/nuxt/test/issues/1#1',
            body: 'First',
            createdAt: '2026-10-01',
            authorAssociation: 'NONE',
            author: null,
          },
        ],
        true,
      ) as T
    }
    return wrap(
      q.includes('closedByPullRequestsReferences') ? 'closedByPullRequestsReferences' : 'timelineItems',
      [],
    ) as T
  }
  const r = await enrich(issue, query)
  assert.equal(r.comments.length, 1)
  assert.equal(r.comments[0]?.author, 'ghost')
  assert(r.gaps.includes('Comment collection failed or incomplete'))
})
