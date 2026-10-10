import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Dataset } from '../shared/types.ts'
import { BODY_LIMIT, MAX_COMMENTS, findIssue, issueDetail, overview, searchIssues } from '../shared/agent.ts'

const data = JSON.parse(
  readFileSync(new URL('../public/data/index.json', import.meta.url), 'utf8'),
) as Dataset

test('search pages through eligible open issues and caps the page size', () => {
  const first = searchIssues(data, { limit: 500 })
  assert.equal(first.issues.length, 50)
  assert.ok(first.issues.every((i) => i.eligible))
  const second = searchIssues(data, { limit: 5, offset: 5 })
  assert.deepEqual(
    second.issues.map((i) => i.id),
    searchIssues(data, { limit: 10 })
      .issues.slice(5)
      .map((i) => i.id),
  )
  assert.ok(searchIssues(data, { includeIneligible: true }).total >= first.total)
})

test('finds issues by reference or URL, and rejects anything else', () => {
  const issue = data.issues.find((i) => i.state === 'OPEN')!
  assert.equal(findIssue(data, issue.id)?.id, issue.id)
  assert.equal(findIssue(data, issue.url)?.id, issue.id)
  assert.equal(findIssue(data, `${issue.url}/`)?.id, issue.id)
  assert.equal(findIssue(data, 'nope'), null)
  assert.equal(findIssue(data, 'https://evil.example/nuxt/nuxt/issues/1'), null)
})

test('issue detail stays bounded and says when it truncates', () => {
  const longest = [...data.issues].sort((a, b) => b.body.length - a.body.length)[0]!
  const detail = issueDetail(longest)
  assert.ok(detail.body.length <= BODY_LIMIT + 100)
  assert.equal(detail.bodyTruncated, longest.body.length > BODY_LIMIT)
  const busiest = [...data.issues].sort((a, b) => b.comments.length - a.comments.length)[0]!
  assert.ok(issueDetail(busiest).comments.length <= MAX_COMMENTS)
  assert.equal(typeof detail.commentCount, 'number')
})

test('overview counts match the search tool', () => {
  const o = overview(data)
  assert.equal(o.views.quick.count, searchIssues(data, { view: 'quick' }).total)
  assert.ok(o.repos.length > 10)
})
