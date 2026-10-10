import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Dataset, Issue, Assessment, PublicIssue } from '../../shared/types.ts'
import { Store, evidenceHash } from './store.ts'
import { prepare } from './runner.ts'
import { RUBRIC_VERSION, MODEL } from './rubric.ts'
import { cleanObject, safeGitHubURL } from './security.ts'
function publicAssessment(a: Assessment): Assessment {
  const out: Assessment = {
    key: a.key,
    inputHash: a.inputHash,
    stage: a.stage,
    rubricVersion: a.rubricVersion,
    model: a.model,
    assessedAt: a.assessedAt,
    answers: a.answers,
    durationMs: a.durationMs,
    usage: a.usage,
    warnings: a.warnings,
  }
  if (a.evidence)
    out.evidence = {
      issue: a.evidence.issue,
      notes: a.evidence.notes,
      sources: a.evidence.sources
        .filter((s) => safeGitHubURL(s.url))
        .map((s) => ({
          url: s.url,
          retrievedAt: s.retrievedAt,
          ref: s.ref,
          excerpt: s.excerpt,
          verification: s.verification,
        })),
    }
  return out
}
export function buildDataset(store: Store, allowPartial = false): Dataset {
  const now = Date.now()
  const issues: PublicIssue[] = store.issues().map((i) => {
    const all = store.results(i.id),
      baseHash = evidenceHash(i)
    let currentKey: string | undefined
    try {
      currentKey = prepare(i).key
    } catch {}
    const firstPass = all.find((a) => a.stage === 'classify' && a.key === currentKey) ?? null
    const investigated = all.find(
      (a) =>
        a.stage === 'investigate' &&
        a.rubricVersion === RUBRIC_VERSION &&
        store.meta(`base:${a.key}`) === baseHash,
    )
    const current = investigated ?? firstPass
    const latest = current ?? all[0] ?? null
    const clean = cleanObject(i)
    const skip = store.meta(`skip:${i.id}`)
    const budgetGap = skip?.baseHash === baseHash ? [skip.reason] : []
    const c = clean.value
    const source: Issue = {
      id: c.id,
      repo: c.repo,
      number: c.number,
      url: c.url,
      title: c.title,
      body: c.body,
      author: c.author,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      state: c.state,
      labels: c.labels,
      thumbsUp: c.thumbsUp,
      commentCount: c.commentCount,
      comments: c.comments,
      prs: c.prs,
      repository: {
        description: c.repository.description,
        archived: c.repository.archived,
        defaultBranch: c.repository.defaultBranch,
      },
      retrievedAt: c.retrievedAt,
      gaps: [
        ...c.gaps,
        ...budgetGap,
        ...(clean.changed ? ['Sensitive-looking content redacted from export'] : []),
      ],
    }
    return {
      ...source,
      comments: source.comments.map((c) => ({
        url: c.url,
        author: c.author,
        association: c.association,
        createdAt: c.createdAt,
        body: c.body,
      })),
      prs: source.prs.filter((p) => safeGitHubURL(p.url)),
      assessment: latest ? publicAssessment(latest) : null,
      firstPass: firstPass ? publicAssessment(firstPass) : null,
      status: current ? 'assessed' : latest ? 'stale' : store.hasFailure(i.id) ? 'failed' : 'unassessed',
      evidenceHash: baseHash,
      eligible: i.createdAt < '2026-10-09T00:00:00Z',
      ageDays: Math.floor((now - Date.parse(i.createdAt)) / 86400000),
    }
  })
  const assessed = issues.filter((i) => i.status === 'assessed').length,
    failed = issues.filter((i) => i.status === 'failed').length
  const collection = store.meta('collection')
  const partial =
    assessed < issues.length || issues.some((i) => i.gaps.length) || collection?.status !== 'complete'
  if (partial && !allowPartial)
    throw new Error(
      'Incomplete collection or classifications. Previous public snapshot preserved; pass --allow-partial to export explicitly.',
    )
  return cleanObject<Dataset>({
    manifest: {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      scope: collection?.scope ?? [],
      issues: issues.length,
      assessed,
      failed,
      partial,
      mode: 'live',
      rubricVersion: RUBRIC_VERSION,
      model: MODEL,
      warnings: [
        ...(partial ? ['Partial dataset: coverage and evidence gaps are shown explicitly.'] : []),
        ...(assessed
          ? [
              'Model suggestions require human verification. Thresholds are provisional until a labelled evaluation is completed.',
            ]
          : ['Real GitHub evidence; no Jev classifications have run yet.']),
      ],
    },
    issues,
  }).value
}
export async function exportDataset(store: Store, path: string, allowPartial = false) {
  const data = buildDataset(store, allowPartial)
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify(data))
  await rename(temporary, path)
  return data.manifest
}
