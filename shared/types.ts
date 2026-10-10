export type ChoiceAnswer = { type: 'choice'; choice: string; probabilities?: Record<string, number> }
export type BooleanAnswer = { type: 'boolean'; probability: number }
export type ScoreAnswer = { type: 'score'; score: number; probabilities?: Record<string, number> }
export type Answers = Record<string, ChoiceAnswer | BooleanAnswer | ScoreAnswer>
export type EvidenceSource = {
  url: string
  retrievedAt: string
  ref?: string
  excerpt: string
  verification: 'source-read' | 'executed-test'
}
export type Investigation = { issue: string; notes: string; sources: EvidenceSource[] }
export type Comment = { url: string; author: string; association: string; createdAt: string; body: string }
export type LinkedPR = {
  url: string
  title: string
  state: string
  mergedAt: string | null
  updatedAt: string
  closing: boolean
}
export type Issue = {
  id: string
  repo: string
  number: number
  url: string
  title: string
  body: string
  author: string
  createdAt: string
  updatedAt: string
  state: string
  labels: string[]
  thumbsUp: number
  commentCount: number
  comments: Comment[]
  prs: LinkedPR[]
  repository: { description: string; archived: boolean; defaultBranch: string }
  retrievedAt: string
  gaps: string[]
}
export type Assessment = {
  key: string
  inputHash: string
  stage: 'classify' | 'investigate'
  rubricVersion: string
  model: string
  assessedAt: string
  answers: Answers
  durationMs: number
  usage: { inputTokens?: number; outputTokens?: number }
  cost?: number
  warnings: string[]
  evidence?: Investigation
}
export type PublicIssue = Issue & {
  assessment: Assessment | null
  firstPass: Assessment | null
  status: 'assessed' | 'unassessed' | 'failed' | 'stale'
  evidenceHash: string
  eligible: boolean
  ageDays: number
}
export type Dataset = {
  manifest: {
    schemaVersion: 1
    generatedAt: string | null
    scope: string[]
    issues: number
    assessed: number
    failed: number
    partial: boolean
    mode: 'empty' | 'live'
    rubricVersion: string | null
    model: string
    warnings: string[]
  }
  issues: PublicIssue[]
}
