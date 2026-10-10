import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import type { Issue, LinkedPR } from '../../shared/types.ts'
import { setTimeout as sleep } from 'node:timers/promises'
const exec = promisify(execFile)
const issueFields = `number title body url createdAt updatedAt state author{login} labels(first:100){nodes{name} pageInfo{hasNextPage}} reactions(content:THUMBS_UP){totalCount} comments{totalCount}`
export async function gh<T>(query: string, variables: Record<string, string | number> = {}): Promise<T> {
  const args = ['api', 'graphql', '-f', `query=${query}`]
  for (const [k, v] of Object.entries(variables)) args.push(typeof v === 'number' ? '-F' : '-f', `${k}=${v}`)
  for (let attempt = 0; ; attempt++) {
    try {
      const { stdout } = await exec('gh', args, { maxBuffer: 32 * 1024 * 1024, timeout: 60000 })
      const result = JSON.parse(stdout)
      if (result.errors?.length) throw new Error(result.errors.map((e: any) => e.message).join('; '))
      return result.data
    } catch (error) {
      const message = String(error)
      if (attempt >= 3 || !/rate limit|secondary rate|502|503|504|timed out|ECONNRESET/i.test(message))
        throw error
      await sleep(Math.min(60000, 2000 * 2 ** attempt))
    }
  }
}
export async function discover(org: string): Promise<string[]> {
  const repos: string[] = []
  let cursor = ''
  do {
    const data: any = await gh(
      `query($org:String!,$cursor:String){organization(login:$org){repositories(first:100,after:$cursor,isFork:false,privacy:PUBLIC){nodes{nameWithOwner isArchived isDisabled hasIssuesEnabled} pageInfo{hasNextPage endCursor}}}}`,
      { org, ...(cursor ? { cursor } : {}) },
    )
    const connection = data.organization.repositories
    for (const r of connection.nodes)
      if (!r.isArchived && !r.isDisabled && r.hasIssuesEnabled) repos.push(r.nameWithOwner)
    cursor = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : ''
  } while (cursor)
  return repos
}
const prFields = 'url title state mergedAt updatedAt'
// Thread context is fetched inline with the issue page; only threads that overflow these windows are enriched separately.
const listFields = issueFields.replace(
  'comments{totalCount}',
  `comments(first:60){totalCount nodes{url body createdAt authorAssociation author{login}} pageInfo{hasNextPage}} closedByPullRequestsReferences(first:20,includeClosedPrs:true){nodes{${prFields}} pageInfo{hasNextPage}} timelineItems(first:30,itemTypes:[CROSS_REFERENCED_EVENT]){nodes{... on CrossReferencedEvent{source{... on PullRequest{${prFields}}}}} pageInfo{hasNextPage}}`,
)
export async function listIssues(repo: string, limit: number): Promise<Issue[]> {
  const [owner, name] = repo.split('/')
  const issues: Issue[] = []
  let cursor = ''
  do {
    const data: any = await gh(
      `query($owner:String!,$name:String!,$cursor:String){repository(owner:$owner,name:$name){description isArchived defaultBranchRef{name} issues(first:25,after:$cursor,states:OPEN,orderBy:{field:UPDATED_AT,direction:DESC}){nodes{${listFields}} pageInfo{hasNextPage endCursor}}}}`,
      { owner: owner!, name: name!, ...(cursor ? { cursor } : {}) },
    )
    const r = data.repository
    for (const i of r.issues.nodes) {
      if (/dependency dashboard/i.test(i.title)) continue
      const base: Issue = {
        id: `${repo}#${i.number}`,
        repo,
        number: i.number,
        url: i.url,
        title: i.title,
        body: i.body ?? '',
        author: i.author?.login ?? 'ghost',
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
        state: i.state,
        labels: i.labels.nodes.map((l: any) => l.name),
        thumbsUp: i.reactions.totalCount,
        commentCount: i.comments.totalCount,
        comments: [],
        prs: [],
        repository: {
          description: r.description ?? '',
          archived: r.isArchived,
          defaultBranch: r.defaultBranchRef?.name ?? 'main',
        },
        retrievedAt: new Date().toISOString(),
        gaps: i.labels.pageInfo.hasNextPage ? ['More than 100 labels; additional labels omitted'] : [],
      }
      const overflow =
        i.comments.pageInfo.hasNextPage ||
        i.closedByPullRequestsReferences.pageInfo.hasNextPage ||
        i.timelineItems.pageInfo.hasNextPage
      if (overflow) issues.push(await enrich(base))
      else {
        base.comments = i.comments.nodes.map((n: any) => ({
          url: n.url,
          body: n.body,
          createdAt: n.createdAt,
          association: n.authorAssociation,
          author: n.author?.login ?? 'ghost',
        }))
        const prs = new Map<string, LinkedPR>()
        for (const p of i.closedByPullRequestsReferences.nodes) prs.set(p.url, { ...p, closing: true })
        for (const n of i.timelineItems.nodes)
          if (n.source?.url && !prs.has(n.source.url)) prs.set(n.source.url, { ...n.source, closing: false })
        base.prs = [...prs.values()].sort((a, b) => a.url.localeCompare(b.url))
        issues.push(base)
      }
      if (issues.length >= limit) return issues
    }
    cursor = r.issues.pageInfo.hasNextPage ? r.issues.pageInfo.endCursor : ''
  } while (cursor)
  return issues
}
export async function pool<T>(
  items: T[],
  size: number,
  work: (item: T) => Promise<void>,
  signal?: AbortSignal,
) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length && !signal?.aborted) await work(items[next++]!)
    }),
  )
}
export type Query = <T>(query: string, variables?: Record<string, string | number>) => Promise<T>
export async function enrich(issue: Issue, query: Query = gh): Promise<Issue> {
  const result: Issue = {
    ...issue,
    comments: [],
    prs: [],
    gaps: issue.gaps.filter((g) => !['Comments not collected', 'PR references not collected'].includes(g)),
    retrievedAt: new Date().toISOString(),
  }
  const [owner, name] = issue.repo.split('/')
  const vars = { owner: owner!, name: name!, number: issue.number }
  let cursor = ''
  try {
    do {
      const data: any = await query(
        `query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){issue(number:$number){comments(first:100,after:$cursor){nodes{url body createdAt authorAssociation author{login}} pageInfo{hasNextPage endCursor}}}}}`,
        { ...vars, ...(cursor ? { cursor } : {}) },
      )
      const c = data.repository.issue.comments
      result.comments.push(
        ...c.nodes.map((n: any) => ({
          url: n.url,
          body: n.body,
          createdAt: n.createdAt,
          association: n.authorAssociation,
          author: n.author?.login ?? 'ghost',
        })),
      )
      cursor = c.pageInfo.hasNextPage ? c.pageInfo.endCursor : ''
    } while (cursor)
    if (result.comments.length !== issue.commentCount)
      result.gaps.push('Comment count changed during collection; refresh before acting')
  } catch {
    result.gaps.push('Comment collection failed or incomplete')
  }
  const prs = new Map<string, LinkedPR>()
  try {
    cursor = ''
    do {
      const data: any = await query(
        `query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){issue(number:$number){closedByPullRequestsReferences(first:100,after:$cursor,includeClosedPrs:true){nodes{${prFields}} pageInfo{hasNextPage endCursor}}}}}`,
        { ...vars, ...(cursor ? { cursor } : {}) },
      )
      const c = data.repository.issue.closedByPullRequestsReferences
      for (const p of c.nodes) prs.set(p.url, { ...p, closing: true })
      cursor = c.pageInfo.hasNextPage ? c.pageInfo.endCursor : ''
    } while (cursor)
    cursor = ''
    do {
      const data: any = await query(
        `query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){issue(number:$number){timelineItems(first:100,after:$cursor,itemTypes:[CROSS_REFERENCED_EVENT]){nodes{... on CrossReferencedEvent{source{... on PullRequest{${prFields}}}}} pageInfo{hasNextPage endCursor}}}}}`,
        { ...vars, ...(cursor ? { cursor } : {}) },
      )
      const c = data.repository.issue.timelineItems
      for (const n of c.nodes)
        if (n.source?.url && !prs.has(n.source.url)) prs.set(n.source.url, { ...n.source, closing: false })
      cursor = c.pageInfo.hasNextPage ? c.pageInfo.endCursor : ''
    } while (cursor)
  } catch {
    result.gaps.push('PR reference collection failed or incomplete')
  }
  result.prs = [...prs.values()].sort((a, b) => a.url.localeCompare(b.url))
  return result
}
export async function refreshIssue(repo: string, number: number): Promise<Issue> {
  const [owner, name] = repo.split('/')
  const data: any = await gh(
    `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){description isArchived defaultBranchRef{name} issue(number:$number){${issueFields}}}}`,
    { owner: owner!, name: name!, number },
  )
  const r = data.repository,
    i = r.issue
  return enrich({
    id: `${repo}#${number}`,
    repo,
    number,
    url: i.url,
    title: i.title,
    body: i.body ?? '',
    author: i.author?.login ?? 'ghost',
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    state: i.state,
    labels: i.labels.nodes.map((l: any) => l.name),
    thumbsUp: i.reactions.totalCount,
    commentCount: i.comments.totalCount,
    comments: [],
    prs: [],
    repository: {
      description: r.description ?? '',
      archived: r.isArchived,
      defaultBranch: r.defaultBranchRef?.name ?? 'main',
    },
    retrievedAt: new Date().toISOString(),
    gaps: i.labels.pageInfo.hasNextPage ? ['More than 100 labels; additional labels omitted'] : [],
  })
}
