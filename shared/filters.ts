import type { Answers, PublicIssue } from './types.ts'
import { points } from './labels.ts'
import { leans, ease } from './plain.ts'
export function choice(answers: Answers | undefined, key: string): string {
  const a = answers?.[key]
  return a?.type === 'choice' ? a.choice : 'unassessed'
}
export function strongChoice(answers: Answers | undefined, key: string, threshold = 0.8): boolean {
  const a = answers?.[key]
  return a?.type === 'choice' && (a.probabilities?.[a.choice] ?? 0) >= threshold
}
export function probability(answers: Answers | undefined, key: string): number | undefined {
  const a = answers?.[key]
  return a?.type === 'boolean' ? a.probability : undefined
}
export function score(answers: Answers | undefined, key: string): number | undefined {
  const a = answers?.[key]
  return a?.type === 'score' ? a.score : undefined
}
export function difficulty(issue: PublicIssue): string {
  const a = issue.assessment?.answers
  if (issue.status !== 'assessed') return 'unknown'
  if ((probability(a, 'effortEvidence') ?? 0) < 0.8) return 'unknown'
  const n = score(a, 'difficulty')
  return n === undefined ? 'unknown' : n < 0.75 ? 'small' : n < 1.75 ? 'moderate' : 'complex'
}
export function uncertain(issue: PublicIssue): boolean {
  if (!issue.assessment) return true
  return Object.values(issue.assessment.answers).some((a) =>
    a.type === 'choice'
      ? a.choice === 'unclear' || !a.probabilities || (a.probabilities[a.choice] ?? 0) < 0.8
      : a.type === 'boolean'
        ? a.probability > 0.2 && a.probability < 0.8
        : false,
  )
}
export type Filters = {
  q: string
  repo: string
  view: string
  type: string
  time: string
  who: string
  action: string
  skill: string
  eligibility: string
  status: string
  sort: string
}
export const defaultFilters: Filters = {
  q: '',
  repo: 'all',
  view: 'all',
  type: 'all',
  time: 'all',
  who: 'all',
  action: 'all',
  skill: 'all',
  eligibility: 'eligible',
  status: 'all',
  sort: 'easiest',
}
const quick = ['underHour', 'fewHours']
export function inView(i: PublicIssue, view: string): boolean {
  if (view === 'all') return true
  if (i.status !== 'assessed') return false
  const a = i.assessment?.answers
  const hasOpenPR = i.prs.some((p) => p.state === 'OPEN')
  const anyone = leans(a, 'whoCanAct') === 'anyone'
  switch (view) {
    case 'quick':
      return anyone && quick.includes(leans(a, 'timeToClose') ?? '') && !hasOpenPR
    case 'newcomer':
      return leans(a, 'newcomer') === 'suitable' && anyone && !hasOpenPR
    case 'closure':
      return (
        !['unresolved', 'unassessed'].includes(choice(a, 'closure')) &&
        strongChoice(a, 'closure') &&
        (probability(a, 'contradictoryFixReports') ?? 1) <= 0.2
      )
    case 'questions':
      return leans(a, 'workType') === 'question' || leans(a, 'nextAction') === 'answer'
    case 'docs':
      return leans(a, 'workType') === 'docs'
    default:
      return true
  }
}
export function filterIssues(issues: PublicIssue[], f: Filters): PublicIssue[] {
  const q = f.q.toLowerCase()
  const filtered = issues.filter((i) => {
    const a = i.assessment?.answers
    if (i.state !== 'OPEN') return false
    if (q && !`${i.repo} #${i.number} ${i.title} ${i.labels.join(' ')} ${i.body}`.toLowerCase().includes(q))
      return false
    if (f.repo !== 'all' && i.repo !== f.repo) return false
    if (f.eligibility === 'eligible' && (!i.eligible || i.repository.archived)) return false
    if (f.eligibility === 'ineligible' && i.eligible) return false
    if (f.type !== 'all' && choice(a, 'workType') !== f.type) return false
    if (f.time !== 'all' && leans(a, 'timeToClose') !== f.time) return false
    if (f.who !== 'all' && leans(a, 'whoCanAct') !== f.who) return false
    if (f.action !== 'all' && choice(a, 'nextAction') !== f.action) return false
    if (f.status !== 'all' && (f.status === 'uncertain' ? !uncertain(i) : i.status !== f.status)) return false
    if (f.skill !== 'all' && (probability(a, `skill_${f.skill}`) ?? 0) < 0.8) return false
    return inView(i, f.view)
  })
  const byPoints = (a: PublicIssue, b: PublicIssue) => points(b) - points(a) || b.thumbsUp - a.thumbsUp
  return filtered.sort((a, b) =>
    f.sort === 'easiest'
      ? ease(a) - ease(b) || byPoints(a, b)
      : f.sort === 'points'
        ? byPoints(a, b)
        : f.sort === 'oldest'
          ? a.createdAt.localeCompare(b.createdAt)
          : b.updatedAt.localeCompare(a.updatedAt),
  )
}
