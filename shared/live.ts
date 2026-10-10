/**
 * Live status: what changed on GitHub and on nuxtathon.live since the snapshot.
 * Written every few minutes by `.github/workflows/status.yml` to the `status`
 * branch, read by the explorer and the MCP tools. No token ever reaches the app.
 */
export const LIVE_URL = 'https://raw.githubusercontent.com/HugoRCD/nuxtathon-triage/status/status.json'
export const EVENT_START = '2026-10-10T00:00:00.000Z'

export const liveStates = ['counted', 'closed', 'fixMerged', 'prOpen', 'assigned', 'active'] as const
export type LiveState = (typeof liveStates)[number]
export type LiveEntry = { state: LiveState; by?: string; url?: string; at?: string }
export type LiveStatus = {
  generatedAt: string
  eventStart: string
  checked: number
  issues: Record<string, LiveEntry>
}

/** Someone has already claimed or finished it. */
export const takenStates: LiveState[] = ['counted', 'closed', 'fixMerged', 'prOpen', 'assigned']
/** free: hide taken (default). quiet: also hide new activity. changed: only what moved during the event. */
export const availabilities = ['free', 'quiet', 'changed', 'all'] as const
export type Availability = (typeof availabilities)[number]

export function liveEntry(live: LiveStatus | null | undefined, id: string): LiveEntry | undefined {
  return live?.issues[id.toLowerCase()]
}

export function hiddenBy(entry: LiveEntry | undefined, availability: string): boolean {
  switch (availability) {
    case 'all':
      return false
    case 'changed':
      return !entry
    case 'quiet':
      return !!entry
    default:
      return !!entry && takenStates.includes(entry.state)
  }
}

export const liveLabels: Record<
  LiveState,
  { label: string; icon: string; color: 'primary' | 'warning' | 'neutral'; hint: string }
> = {
  counted: {
    label: 'Counted',
    icon: 'i-lucide-trophy',
    color: 'neutral',
    hint: 'Already counted on nuxtathon.live.',
  },
  closed: {
    label: 'Closed',
    icon: 'i-lucide-circle-check',
    color: 'neutral',
    hint: 'Closed since the snapshot.',
  },
  fixMerged: {
    label: 'Fix Merged',
    icon: 'i-lucide-git-merge',
    color: 'neutral',
    hint: 'A fix was merged during the event; the issue should close soon.',
  },
  prOpen: {
    label: 'PR Open',
    icon: 'i-lucide-git-pull-request',
    color: 'warning',
    hint: 'Someone has a pull request for it.',
  },
  assigned: {
    label: 'Assigned',
    icon: 'i-lucide-user-check',
    color: 'warning',
    hint: 'Assigned to someone during the event.',
  },
  active: {
    label: 'New Activity',
    icon: 'i-lucide-message-circle',
    color: 'neutral',
    hint: 'New comments since the event started. Read them before you start.',
  },
}

export function describeLive(entry: LiveEntry): string {
  const by = entry.by ? ` by @${entry.by}` : ''
  switch (entry.state) {
    case 'counted':
      return `Already counted for @${entry.by ?? 'someone'} on nuxtathon.live.`
    case 'closed':
      return 'Closed since the snapshot.'
    case 'fixMerged':
      return `A fix${by} was merged during the event; the issue should close soon.`
    case 'prOpen':
      return `Pull request open${by}. Coordinate before starting.`
    case 'assigned':
      return `Assigned${by} during the event.`
    case 'active':
      return `New comments${by} since the event started. Read them before you start.`
  }
}

type RawUser = { login: string; __typename?: string } | null
type RawPR = {
  url: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  mergedAt: string | null
  createdAt: string
  author: RawUser
}
export type RawIssue = {
  state: 'OPEN' | 'CLOSED'
  closedAt: string | null
  assignees: { nodes: { login: string }[] }
  comments: { nodes: { createdAt: string; author: RawUser }[] }
  closedByPullRequestsReferences: { nodes: RawPR[] }
  timelineItems: {
    nodes: (
      | { __typename: 'AssignedEvent'; createdAt: string; assignee: { login?: string } | null }
      | {
          __typename: 'CrossReferencedEvent'
          createdAt: string
          willCloseTarget: boolean
          source: Partial<RawPR>
        }
    )[]
  }
}

const human = (u: RawUser) => !!u && u.__typename !== 'Bot' && !u.login.endsWith('[bot]')

/**
 * One state per issue, most decisive first. Only pull requests opened during the
 * event count as taken: older open PRs are already in the snapshot and are often
 * abandoned, so they stay visible as something to finish.
 */
export function deriveLive(
  raw: RawIssue | null,
  ctx: { since: string; countedFor?: string },
): LiveEntry | null {
  if (ctx.countedFor) return { state: 'counted', by: ctx.countedFor }
  if (!raw) return { state: 'closed' }
  if (raw.state === 'CLOSED') return { state: 'closed', ...(raw.closedAt ? { at: raw.closedAt } : {}) }
  const prs: (RawPR & { closing: boolean })[] = raw.closedByPullRequestsReferences.nodes.map((p) => ({
    ...p,
    closing: true,
  }))
  for (const t of raw.timelineItems.nodes)
    if (t.__typename === 'CrossReferencedEvent' && t.source?.url && !prs.some((p) => p.url === t.source.url))
      prs.push({ ...(t.source as RawPR), closing: t.willCloseTarget })
  const pick = (p: RawPR) => ({ url: p.url, ...(p.author ? { by: p.author.login } : {}) })
  const merged = prs.find((p) => p.mergedAt && p.mergedAt >= ctx.since && p.closing)
  if (merged) return { state: 'fixMerged', at: merged.mergedAt!, ...pick(merged) }
  const open = prs
    .filter((p) => p.state === 'OPEN' && p.createdAt >= ctx.since)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (open) return { state: 'prOpen', at: open.createdAt, ...pick(open) }
  const current = new Set(raw.assignees.nodes.map((a) => a.login))
  const assigned = raw.timelineItems.nodes
    .filter(
      (t): t is Extract<RawIssue['timelineItems']['nodes'][number], { __typename: 'AssignedEvent' }> =>
        t.__typename === 'AssignedEvent' && t.createdAt >= ctx.since && current.has(t.assignee?.login ?? ''),
    )
    .at(-1)
  if (assigned) return { state: 'assigned', at: assigned.createdAt, by: assigned.assignee!.login! }
  const comment = raw.comments.nodes.filter((c) => c.createdAt >= ctx.since && human(c.author)).at(-1)
  if (comment) return { state: 'active', at: comment.createdAt, by: comment.author!.login }
  return null
}
