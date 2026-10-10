import type { Answers, PublicIssue } from './types.ts'

/** Plain-language wording for Jev's structured answers. Jev returns choices and probabilities, never prose. */

export const LEANS = 0.6

export function top(answers: Answers | undefined, key: string): { value: string; p: number } | null {
  const a = answers?.[key]
  if (a?.type !== 'choice') return null
  return { value: a.choice, p: a.probabilities?.[a.choice] ?? 0 }
}

/** Jev's pick for a choice question, only when it leans that way. */
export function leans(answers: Answers | undefined, key: string, threshold = LEANS): string | null {
  const t = top(answers, key)
  return t && t.p >= threshold ? t.value : null
}

export const time: Record<string, { short: string; long: string; rank: number }> = {
  underHour: { short: '< 1 hour', long: 'Under an hour', rank: 0 },
  fewHours: { short: 'A few hours', long: 'A few hours', rank: 1 },
  dayOrMore: { short: '1 day +', long: 'A day or more', rank: 2 },
  unclear: { short: 'Hard to say', long: 'Hard to say', rank: 3 },
}

export const who: Record<string, { short: string; long: string; open: boolean }> = {
  anyone: { short: 'Anyone can start', long: 'Anyone can pick this up now.', open: true },
  reporter: {
    short: 'Waiting on reporter',
    long: 'Waiting on the reporter for details or a reproduction.',
    open: false,
  },
  maintainer: {
    short: 'Waiting on maintainer',
    long: 'Waiting on a maintainer decision or review.',
    open: false,
  },
  upstream: { short: 'Blocked upstream', long: 'Waiting on another project or dependency.', open: false },
  unclear: { short: 'Unclear', long: 'Not clear who should act next.', open: false },
}

export const steps: Record<string, { label: string; icon: string; how: string }> = {
  implement: {
    label: 'Write a Fix',
    icon: 'i-lucide-hammer',
    how: 'The change is clear. Write it, add a test, and open a pull request that references this issue.',
  },
  reproduce: {
    label: 'Reproduce It',
    icon: 'i-lucide-flask-conical',
    how: 'Try it on the latest version. Share a minimal reproduction, or report that it no longer happens.',
  },
  verifyFix: {
    label: 'Check the Fix',
    icon: 'i-lucide-circle-check',
    how: 'A fix may already exist. Check it against the original report on the latest version, then tell a maintainer.',
  },
  answer: {
    label: 'Answer It',
    icon: 'i-lucide-message-circle',
    how: 'This is a question. Answer it in the thread and link to the docs where possible.',
  },
  assessDuplicate: {
    label: 'Check for Duplicate',
    icon: 'i-lucide-copy',
    how: 'Compare it with the issue it references. If they match, point a maintainer to the original.',
  },
  seekDecision: {
    label: 'Needs a Decision',
    icon: 'i-lucide-scale',
    how: 'A maintainer needs to choose a direction first. Skip it unless you maintain this repository.',
  },
  unclear: {
    label: 'Read the Thread',
    icon: 'i-lucide-circle-help',
    how: 'Jev couldn’t tell what’s needed. Read the thread before deciding whether to pick it up.',
  },
}

export const types: Record<string, string> = {
  bug: 'Bug',
  feature: 'Feature',
  docs: 'Docs',
  question: 'Question',
  maintenance: 'Maintenance',
  unclear: 'Unclear',
}

/** Signals worth mentioning, phrased for a contributor. Only shown when Jev is confident either way. */
export const reasons: Record<string, { yes?: [string, boolean]; no?: [string, boolean] }> = {
  hasReproduction: { yes: ['Has a reproduction', true], no: ['No reproduction yet', false] },
  hasSolution: { yes: ['A solution is proposed in the thread', true] },
  maintainerGuidance: {
    yes: ['A maintainer has given guidance', true],
    no: ['No maintainer guidance yet', false],
  },
  missingRepro: { yes: ['Blocked until someone provides a reproduction', false] },
  upstream: { yes: ['Blocked on another project', false] },
  designDecision: { yes: ['Needs a maintainer decision first', false] },
  contradictoryFixReports: { yes: ['People report the fix didn’t work', false] },
}

export function why(answers: Answers | undefined) {
  const out: { text: string; good: boolean }[] = []
  for (const [key, r] of Object.entries(reasons)) {
    const a = answers?.[key]
    if (a?.type !== 'boolean') continue
    if (a.probability >= 0.8 && r.yes) out.push({ text: r.yes[0], good: r.yes[1] })
    if (a.probability <= 0.2 && r.no) out.push({ text: r.no[0], good: r.no[1] })
  }
  return out
}

export type Sureness = 'Confident' | 'Fairly Sure' | 'Unsure'
export function sureness(p: number): Sureness {
  return p >= 0.8 ? 'Confident' : p >= LEANS ? 'Fairly Sure' : 'Unsure'
}

/** One plain summary per issue: what it is, who can act, how long it takes and the next step. */
export function summary(issue: PublicIssue) {
  const a = issue.status === 'assessed' ? issue.assessment?.answers : undefined
  if (!a) return null
  const t = top(a, 'timeToClose'),
    w = top(a, 'whoCanAct'),
    s = top(a, 'nextAction'),
    k = top(a, 'workType')
  const picks = [t, w, s].filter(Boolean) as { p: number }[]
  return {
    type: k ? (types[k.value] ?? k.value) : null,
    time: t && t.p >= LEANS ? (time[t.value] ?? null) : null,
    timeKey: t?.value ?? 'unclear',
    who: w && w.p >= LEANS ? (who[w.value] ?? null) : null,
    whoKey: w?.value ?? 'unclear',
    step: steps[s?.value ?? 'unclear'] ?? steps.unclear!,
    sure: sureness(picks.length ? Math.min(...picks.map((x) => x.p)) : 0),
  }
}

/** Lower is easier: anyone-can-act first, then by estimated time; issues Jev is unsure about sink within each group. */
export function ease(issue: PublicIssue): number {
  const sum = summary(issue)
  if (!sum) return 99
  return (sum.who?.open ? 0 : 8) + (sum.time?.rank ?? 3) + (sum.sure === 'Unsure' ? 4 : 0)
}
