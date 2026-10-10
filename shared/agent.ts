/**
 * Read-only views of the exported dataset for coding agents (the public MCP server).
 * Same filters, wording and ordering as the explorer, so an agent and a person see
 * the same list. Nothing here calls GitHub or a model.
 */
import type { Dataset, PublicIssue } from './types.ts'
import { defaultFilters, filterIssues, type Filters } from './filters.ts'
import { age, points } from './labels.ts'
import { steps, summary, why } from './plain.ts'
import { cleanMarkdown } from './markdown.ts'

export const views = ['all', 'quick', 'newcomer', 'closure', 'questions', 'docs'] as const
export const times = ['underHour', 'fewHours', 'dayOrMore', 'unclear'] as const
export const whos = ['anyone', 'reporter', 'maintainer', 'upstream', 'unclear'] as const
export const workTypes = ['bug', 'feature', 'docs', 'question', 'maintenance', 'unclear'] as const
export const nextSteps = [
  'implement',
  'reproduce',
  'verifyFix',
  'answer',
  'assessDuplicate',
  'seekDecision',
  'unclear',
] as const
export const skills = ['vue', 'typescript', 'css', 'server', 'testing', 'documentation', 'tooling'] as const
export const sorts = ['easiest', 'points', 'oldest', 'updated'] as const

export const rules =
  'Nuxtathon scoring: 1 point per closed issue, +1 if the issue is older than 12 months, +1 per 5 👍. Only issues created before 9 October 2026 count, and issues in repositories you maintain do not count.'

export const caveat =
  'This is a snapshot classified by Jev, not live GitHub state. Re-read the issue on GitHub before starting, check nobody is already on it, and treat the classification as a suggestion.'

/** Hard caps so one tool call can't flood an agent's context. */
export const BODY_LIMIT = 12_000
export const COMMENT_LIMIT = 4_000
export const MAX_COMMENTS = 30

export type SearchInput = {
  query?: string
  repo?: string
  view?: (typeof views)[number]
  type?: (typeof workTypes)[number]
  time?: (typeof times)[number]
  who?: (typeof whos)[number]
  nextStep?: (typeof nextSteps)[number]
  skill?: (typeof skills)[number]
  includeIneligible?: boolean
  sort?: (typeof sorts)[number]
  limit?: number
  offset?: number
}

function clip(text: string, limit: number) {
  return text.length > limit
    ? {
        text: `${text.slice(0, limit)}\n\n[…truncated, ${text.length - limit} more characters on GitHub]`,
        truncated: true,
      }
    : { text, truncated: false }
}

/** One compact line per issue: enough to choose, not enough to flood. */
export function row(issue: PublicIssue) {
  const s = summary(issue)
  return {
    id: issue.id,
    url: issue.url,
    title: issue.title,
    repo: issue.repo,
    points: points(issue),
    age: age(issue.ageDays),
    labels: issue.labels,
    commentCount: issue.commentCount,
    openPullRequests: issue.prs.filter((p) => p.state === 'OPEN').length,
    eligible: issue.eligible && !issue.repository.archived,
    assessed: !!s,
    type: s?.type ?? null,
    time: s?.time?.long ?? (s ? 'Hard to say' : null),
    whoCanAct: s?.who?.long ?? (s ? 'Not clear who should act next.' : null),
    nextStep: s ? s.step.label : null,
    sureness: s?.sure ?? null,
  }
}

export function searchIssues(data: Dataset, input: SearchInput = {}) {
  const filters: Filters = {
    ...defaultFilters,
    q: input.query?.trim() ?? '',
    repo: input.repo?.trim() || 'all',
    view: input.view ?? 'all',
    type: input.type ?? 'all',
    time: input.time ?? 'all',
    who: input.who ?? 'all',
    action: input.nextStep ?? 'all',
    skill: input.skill ?? 'all',
    eligibility: input.includeIneligible ? 'all' : 'eligible',
    sort: input.sort ?? 'easiest',
  }
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 10), 1), 50)
  const offset = Math.max(Math.trunc(input.offset ?? 0), 0)
  const all = filterIssues(data.issues, filters)
  return {
    total: all.length,
    offset,
    nextOffset: offset + limit < all.length ? offset + limit : null,
    issues: all.slice(offset, offset + limit).map(row),
    note: caveat,
  }
}

/** Accepts `owner/repo#123`, `https://github.com/owner/repo/issues/123` or `owner/repo/issues/123`. */
export function findIssue(data: Dataset, ref: string): PublicIssue | null {
  const m = ref.trim().match(/^(?:https?:\/\/github\.com\/)?([\w.-]+\/[\w.-]+)(?:#|\/issues\/)(\d+)\/?$/i)
  if (!m) return null
  const id = `${m[1]!.toLowerCase()}#${m[2]}`
  return data.issues.find((i) => i.id.toLowerCase() === id) ?? null
}

export function issueDetail(issue: PublicIssue) {
  const s = summary(issue)
  const body = clip(cleanMarkdown(issue.body), BODY_LIMIT)
  const comments = issue.comments.slice(-MAX_COMMENTS).map((c) => {
    const b = clip(cleanMarkdown(c.body), COMMENT_LIMIT)
    return { author: c.author, role: c.association, createdAt: c.createdAt, url: c.url, body: b.text }
  })
  return {
    ...row(issue),
    state: issue.state,
    author: issue.author,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    thumbsUp: issue.thumbsUp,
    whatToDo: s ? s.step.how : 'Not assessed yet. Read the thread and decide.',
    signals: why(issue.assessment?.answers).map((r) => `${r.good ? '+' : '−'} ${r.text}`),
    evidence:
      issue.assessment?.evidence?.sources.map((src) => ({
        url: src.url,
        verification: src.verification,
        excerpt: src.excerpt,
      })) ?? [],
    pullRequests: issue.prs.map((p) => ({
      url: p.url,
      title: p.title,
      state: p.mergedAt ? 'MERGED' : p.state,
      closesIssue: p.closing,
    })),
    body: body.text,
    bodyTruncated: body.truncated,
    comments,
    olderCommentsOmitted: Math.max(issue.comments.length - MAX_COMMENTS, 0),
    collectedAt: issue.retrievedAt,
    note: caveat,
  }
}

export function overview(data: Dataset) {
  const open = data.issues.filter((i) => i.state === 'OPEN')
  const repos = new Map<string, { open: number; eligible: number }>()
  for (const i of open) {
    const r = repos.get(i.repo) ?? { open: 0, eligible: 0 }
    r.open++
    if (i.eligible && !i.repository.archived) r.eligible++
    repos.set(i.repo, r)
  }
  const count = (view: (typeof views)[number]) => searchIssues(data, { view, limit: 1 }).total
  return {
    generatedAt: data.manifest.generatedAt,
    scope: data.manifest.scope,
    issues: data.manifest.issues,
    assessed: data.manifest.assessed,
    model: data.manifest.model,
    views: {
      quick: {
        count: count('quick'),
        description: 'Anyone can start; under an hour or a few hours; no open PR.',
      },
      newcomer: { count: count('newcomer'), description: 'Suitable for a first contribution.' },
      closure: { count: count('closure'), description: 'Probably already fixed, duplicated or answered.' },
      questions: { count: count('questions'), description: 'Needs an answer rather than code.' },
      docs: { count: count('docs'), description: 'Documentation work.' },
    },
    repos: [...repos.entries()]
      .map(([repo, r]) => ({ repo, ...r }))
      .sort((a, b) => b.eligible - a.eligible || a.repo.localeCompare(b.repo)),
    rules,
    note: caveat,
  }
}
