import type { PublicIssue } from './types.ts'

export const questionLabels: Record<string, string> = {
  workType: 'Work Type',
  nextAction: 'Next Action',
  effortEvidence: 'Scope Clear Enough to Size',
  difficulty: 'Implementation Size',
  investigation: 'Investigation Remaining',
  newcomer: 'Newcomer Fit',
  closure: 'Closure Suggestion',
  hasReproduction: 'Has a Reproduction',
  hasSolution: 'Solution Proposed in Thread',
  maintainerGuidance: 'Maintainer Guidance',
  missingRepro: 'Blocked on Missing Repro',
  upstream: 'Blocked Upstream',
  designDecision: 'Needs a Design Decision',
  contradictoryFixReports: 'Fix Reported Not Working',
}

export const choiceLabels: Record<string, Record<string, string>> = {
  workType: {
    bug: 'Bug',
    feature: 'Feature',
    docs: 'Documentation',
    question: 'Question',
    maintenance: 'Maintenance',
    unclear: 'Unclear',
  },
  nextAction: {
    implement: 'Implement',
    reproduce: 'Reproduce',
    verifyFix: 'Verify Fix',
    answer: 'Answer',
    assessDuplicate: 'Check Duplicate',
    seekDecision: 'Needs Decision',
    unclear: 'Unclear',
  },
  newcomer: { suitable: 'Good First Issue', experienced: 'Needs Experience', unclear: 'Unclear' },
  closure: {
    possibleFix: 'Possibly Fixed',
    answered: 'Answered',
    duplicate: 'Possible Duplicate',
    superseded: 'Superseded',
    unresolved: 'Still Open',
  },
}

export const scoreLabels: Record<string, string[]> = {
  difficulty: ['Local change', 'A few files', 'Cross-package', 'Architectural'],
  investigation: ['Clear next step', 'Some verification', 'Needs reproduction', 'Extensive research'],
}

export const actionIcons: Record<string, string> = {
  implement: 'i-lucide-hammer',
  reproduce: 'i-lucide-flask-conical',
  verifyFix: 'i-lucide-circle-check',
  answer: 'i-lucide-message-circle',
  assessDuplicate: 'i-lucide-copy',
  seekDecision: 'i-lucide-scale',
  unclear: 'i-lucide-circle-help',
}

export const skillKeys = ['vue', 'typescript', 'css', 'server', 'testing', 'documentation', 'tooling']

export function label(key: string, value: string): string {
  return (
    choiceLabels[key]?.[value] ??
    value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

/** Nuxtathon scoring: 1 per closed issue, +1 if older than 12 months, +1 per 5 thumbs-up. */
export function points(issue: Pick<PublicIssue, 'ageDays' | 'thumbsUp'>): number {
  return 1 + (issue.ageDays >= 365 ? 1 : 0) + Math.floor(issue.thumbsUp / 5)
}

export function age(days: number): string {
  if (days < 1) return 'today'
  if (days < 30) return `${Math.round(days)}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${(days / 365).toFixed(days < 3650 ? 1 : 0).replace(/\.0$/, '')}y`
}
