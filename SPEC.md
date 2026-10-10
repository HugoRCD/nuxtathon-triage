# Nuxtathon issue triage

## Status

Implementation requested on 10 October 2026. Proceed with the documented Nuxt + Nuxt UI, TypeScript and local SQLite defaults. A temporary Gateway credential is configured locally; a bounded ten-request live pilot has completed. Deployment and an unlimited paid batch remain out of scope.

This is the living product specification. **Agreed** sections record user decisions; **proposed defaults** are recommendations, not additional approved requirements.

## Purpose — agreed

Help Nuxtathon participants find worthwhile issues across the Nuxt ecosystem: approachable implementation work, newcomer-friendly tasks, documentation improvements and evidence-backed closure candidates.

Use Jev intensively through Vercel AI Gateway for multidimensional classification, with reliable, resumable processing. The output supports human triage, not autonomous issue closure.

## First-version scope — agreed

- Classify all issues in the chosen inventory before deeply investigating the promising shortlist.
- Broad classification uses issue bodies, comments and linked-PR metadata. Targeted follow-up gathers stronger evidence, including relevant PR changes and current source code where useful, before reassessment.
- Publish a shared, read-only site for Nuxtathon participants, backed by batch-generated data.
- Run collection, classification and investigation separately from the public site.
- Preserve first-pass and deeper assessments separately.
- Work in a standalone project at `~/Dev/nuxtathon-triage`.

No visitor-triggered model calls, user accounts, public editing, automated GitHub comments, label changes, assignment, issue closures or PR merges. No autonomous research agent is required for version one.

## Inventory and eligibility — proposed defaults

Start with public open issues in `nuxt/*` and `nuxt-modules/*`, excluding PRs and dependency dashboards. Use live GitHub pagination rather than assuming a fixed issue count or relying on search's maximum result window. Record repository archived status. Show archived issues separately from actionable work; do not spend initial classification calls on them by default.

Collect new and old issues independently of event eligibility. For the current event, the referenced event page states issues must have been created before `2026-10-09T00:00:00Z`. Display ineligible issues as such; exclude them in the default Nuxtathon view rather than discarding them.

The earlier `/tmp/nuxtathon-data/issues.jsonl` export may bootstrap identifiers and metadata if it still exists. It is not a complete thread dataset, durable storage or authoritative evidence of current status.

The event also includes modules listed on nuxt.com. Expanding beyond the two organisations is a subsequent inventory extension, not an implicit first-run requirement. Put inventory scope and collection timestamps in the published manifest.

Calculate age, reactions, eligibility and configured event points deterministically, outside Jev. Verify current event rules before enabling numerical points: do not hard-code earlier chat estimates as authoritative. Self-maintained-repository eligibility cannot be inferred reliably from author activity; let users filter or exclude repositories without claiming a points guarantee.

## Primary workflows

### 1. Collect evidence

An operator selects the inventory and collects repository metadata, issue title/body/labels, all accessible thread comments with authors and dates, and linked-PR state and merge metadata. Store canonical source URLs, retrieval timestamps and a stable content hash. Capture enough provenance to distinguish a maintainer statement from an unverified user report.

Keep collection and classification separate so a rubric change can reuse collected evidence. Paginate comments and PR references; record missing pages, inaccessible resources and omitted content explicitly. Resolve likely duplicates only against actual fetched candidates, not imagined issue numbers.

Treat GitHub content as untrusted evidence, never as instructions to the runner. Do not execute issue-provided commands or code, automatically fetch arbitrary external URLs or expose local credentials. External reproduction repositories are research inputs, not executable fixtures by default.

### 2. Classify broadly

Send one issue's evidence as one Jev state and ask multiple independent typed questions. Retain native answers and probability distributions where supplied. Preserve GitHub labels separately from model suggestions; a `good first issue` label alone is not evidence of low complexity.

### 3. Review and investigate a shortlist

An operator picks issue URLs/IDs from the explorer or a local candidate list. Fetch and inspect relevant linked PR changes and current code, and optionally reproduce behaviour in an explicitly chosen environment. Record sources, repository commit SHA/ref, dates and what was actually tested.

For the smallest version, accept operator-prepared evidence files and run Jev reassessment on them. Do not assume Jev browses GitHub, calls tools, runs tests or generates research prose. A verified source excerpt is different from an executed reproduction.

Keep both assessment stages. A merged PR, old age, inactivity or a maintainer's tentative comment is not sufficient alone to declare an issue fixed. Conflicting post-fix reports must remain visible. No assessment closes an issue automatically.

### 4. Export and browse

Export only validated results and a manifest to the public app. Visitors search, combine filters and sorts, and open an issue detail panel to compare suggestions with evidence and source links. Filtering never calls Jev.

Publishing is an explicit operator action. Write a complete snapshot atomically; a failed run must not replace the last published dataset with an accidental partial dataset. An intentional partial export is allowed only with clear coverage and failure counts.

## Classification rubric — proposed defaults

Version the rubric and keep question definitions in source control. Start with the dimensions below and adjust against labelled examples; do not make a giant taxonomy before testing useful filters.

| Dimension                 | Proposed answers or interpretation                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Primary work type         | Bug, feature, documentation, question, maintenance, other/unclear                                                    |
| Next action               | Implement, reproduce, verify existing fix, answer, assess duplicate, seek design decision, unknown                   |
| Time to close             | Under an hour, a few hours, a day or more, unclear (rubric `2026-10-10.2`)                                           |
| Who can act               | Anyone, reporter, maintainer, upstream, unclear (rubric `2026-10-10.2`)                                              |
| Implementation difficulty | Ordered rubric: local/self-contained, moderate, cross-package, architectural; separate evidence-sufficiency decision |
| Investigation effort      | Ordered rubric: clear repro/cause through substantial research; separate evidence-sufficiency decision               |
| Newcomer suitability      | Self-contained scope, accessible prerequisites, clear expected result and testability; unknown when unsupported      |
| Evidence flags            | Reproduction supplied, proposed solution, maintainer guidance, linked candidate fix; separate boolean questions      |
| Closure candidates        | Potentially fixed, answered, duplicate or superseded; unsupported/contradictory evidence stays unresolved            |
| Blockers                  | Missing repro, upstream dependency, design decision, existing work; independent boolean questions                    |
| Skills                    | Independent tags such as Vue, TypeScript/types, CSS, Nitro/server, testing, documentation                            |

Each question must describe its criteria and uncertainty handling explicitly. Choice options must be meaningfully distinct; boolean probabilities express P(true), not generic confidence. Scores are ordinal judgments, not estimated hours or promises of ease. Suppress difficulty labels when evidence is insufficient.

No generated explanations are expected from Jev. Explain UI labels with their rubric definitions and show source evidence. If evidence snippets are selected algorithmically, do not describe them as model-authored rationales or verified causal explanations.

## Public interface — proposed defaults

A searchable issue table/list with combinable filters, sort controls, URL-encoded view state and an issue detail panel. Filters: search, repository, time to close, who can act; under More Filters: work type, next step, skill, eligibility and assessment status (including Jev Unsure).
Distinguish missing results from uncertain results.

Useful views:

- Newcomer-friendly, no known open linked PR.
- Small implementation with a supplied reproduction.
- Possibly already fixed, needing verification.
- Documentation work.
- High configured event points with low estimated investigation effort.

Show GitHub source labels, dates and links beside model suggestions, assessment stage, rubric version, assessment time, evidence gaps and staleness. Only show probabilities or confidence with accurate meanings. An existing PR is a coordination signal, not proof an issue is claimed.

Meaningful states: no filter matches; inventory empty; issue not assessed; classification failed; partial/inaccessible evidence; stale assessment; known closed issue. A closed issue disappears from the default actionable view on the next refresh without deleting its local provenance.

The public export contains an allowlisted subset of necessary public evidence, not a dump of raw API responses. Do not publish tokens, headers, environment values, internal request metadata or accidentally copied secrets. Link to GitHub rather than automatically embedding attachments or external resources. Exclude/redact sensitive-looking content and mark affected evidence incomplete.

## Jev contract — documented and smoke-tested integration

- Model ID: `typesafe-ai/jev`, through Vercel AI Gateway.
- AI SDK: `experimental_decide`; Gateway documents `ai` version 7.0.128 or later. Pin an exact tested SDK version because the experimental contract may change in patch releases.
- One shared state per call; multiple choice, score and boolean questions. Separate calls for unrelated issues. No streaming or free-form research output.
- Choice/score distributions may be present; boolean probability is required. Scores can be fractional. The SDK validates missing/malformed answers; it does not guarantee correct judgments or probability calibration.
- TypeSafe accepts text/JSON evidence, not screenshots as native image input. Flag image-only reports as insufficient unless a separate, explicitly scoped transcription step supplies evidence.
- Public Gateway model metadata, checked 10 October 2026, states 64,000 tokens total per request and 32,000 for state plus longest question. Treat these as runtime-checked input constraints, not a reason to silently truncate.
- SDK default transient retries are 2; refusals are not retried. Choose one retry owner to avoid multiplying SDK and runner retries.
- Results expose usage, warnings, provider metadata and response information. Token fields may be absent. Gateway documents routing and cost metadata; preserve it locally when returned rather than inventing missing usage/cost.
- Authenticate server-side via `AI_GATEWAY_API_KEY` or configured Vercel OIDC. GitHub credentials stay local to the batch runner. Never request or store credentials in planning docs or the public bundle.

References:

- [Jev model page](https://vercel.com/ai-gateway/models/jev)
- [AI SDK Decisions contract](https://ai-sdk.dev/docs/ai-sdk-core/decisions)
- [Gateway decision API](https://vercel.com/docs/ai-gateway/modalities/decision)
- [Public model catalogue](https://ai-gateway.vercel.sh/v1/models)
- [Nuxtathon event](https://nuxtathon.live/)

A ten-request live integration pilot completed with ten successes and reported usage/cost metadata. No sustained throughput benchmark, human-labelled classification evaluation or account-limit inspection has been performed. Account-specific request limits, context-token accounting across multiple questions and observed billing must be measured during implementation. Do not promise a fixed throughput or full-run price from a documentation example.

## Reliable batch processing — proposed defaults

Use a single operator-run process with bounded concurrent network work and durable local checkpoints. Proposed storage: local SQLite for atomic result/status writes; generated JSON remains the public interface, not the working database. This is a technical default, not an agreed dependency.

- Track pending, running, succeeded, retryable-failed and terminal-failed work. Interrupted running work becomes eligible on restart.
- Cache by issue identity + canonical evidence hash + rubric version + requested model ID + assessment stage. Hash all classifier inputs, including linked-PR data, repository context and missing/truncated-evidence markers, not only `issue.updatedAt`.
- Persist each validated success immediately, retaining input snapshot, raw typed answers, provenance, rubric/model/run identifiers, warnings, attempts, timing and usage/cost when available. Record the resolved model/version where exposed; a stable alias is not a promise of a frozen backend model.
- No configured cross-model fallback. If Jev is unavailable, pause or leave retryable failures; never silently substitute another model.
- Use per-request timeouts and bounded retries with jitter for transient errors. Honour Retry-After when available, reduce concurrency on throttling and stop on authentication failures or configured usage limits. Do not endlessly retry invalid input, refusals or schema failures.
- Set configurable concurrency, maximum attempts and run-level request/token/spend limits. Unknown usage is unknown, not zero. Start with conservative concurrency and pilot measurements, not invented account limits.
- GitHub and Gateway have separate throttling/backoff controls. Print progress, completion/failure counts, latency distribution and available usage totals.
- Avoid duplicate local results, but do not claim exactly-once paid inference: an ambiguous timeout or crash after the provider processed a request can cause a billed retry.
- Budget long threads against verified model limits. Preserve full evidence locally; if selecting excerpts, record exactly what was omitted, retain early context and later contradictory/fix reports, and mark the assessment partial. Where a safe budget cannot be established, skip with a visible reason.
- Never overwrite a valid result with a failed attempt. Changed evidence creates a new assessment version and makes older results visibly stale.

## Quality gate before scale — proposed defaults

Review a varied pilot of roughly 30–50 issues: old/new, docs/bugs/features, existing fixes, regressions, conflicting comments, image-only reports, unfamiliar repositories and missing repros. Include the issues discussed in this conversation as candidates for review, not pre-labelled ground truth: several earlier closure suggestions were tentative.

Write human reference labels and evidence notes, revise the rubric, and evaluate on held-out examples before classifying the inventory. Report per-dimension errors and coverage; favour precision for closure candidates over forcing an answer for every issue. Check repeat-run stability on a sample without assuming determinism. Set probability thresholds from these results, with explicit uncertain bands.

Run a small real Gateway load test to verify request shape, token budgeting, latency, billing, retries, restart and throttling behaviour. Save the tested SDK version and results. Intensive usage means broad, useful coverage with bounded load, not duplicate calls for their own sake.

## Acceptance scenarios

1. An operator interrupts a batch after successful items; restart reuses committed successes and resumes unfinished work without losing provenance.
2. Updating only the rubric reclassifies from cached evidence; changing linked-PR state or a later comment invalidates the affected assessment.
3. A 429 produces bounded backoff and lower throughput, not an unbounded retry storm; an authentication error stops the batch with an actionable error.
4. A long thread, inaccessible PR, invalid response or image-only repro appears as partial/failed/uncertain, never as a fully verified result.
5. A merged fix followed by a user report that the problem remains is not represented as confidently fixed solely because the PR merged.
6. Visitors combine newcomer-friendly, documentation and repository filters, share the resulting URL, and see consistent results without an account or any model call.
7. A detail panel distinguishes original labels, first-pass suggestions, deeper reassessment and unexecuted versus executed verification, with source links.
8. A failed export preserves the last published snapshot; intentional partial publication clearly reports its coverage.
9. Public build/output contains no credentials, local checkpoint database or unrestricted raw request/response logs. GitHub remains unchanged by every workflow.
10. A pilot and a throughput/resume test produce explicit measurements and known limitations before a full run is described as reliable.

## Technical direction — implemented first version

Nuxt + Nuxt UI for a read-only explorer (prerendered page, static `/data/index.json`); TypeScript scripts for collection, Jev classification, reassessment and export. No public database, job service or runtime Gateway dependency. Local SQLite is the batch checkpoint store. Deployed on Vercel (scope `hrcd`) with the Nitro `vercel` preset.

Issue bodies and comments render as GitHub-flavoured Markdown via Comark with a tag allowlist, attribute allowlist, http/https/mailto links only and no raw-HTML execution (`shared/markdown.ts`). Evidence excerpts stay plain text.

A public, unauthenticated, read-only MCP endpoint (`/mcp`, `@nuxtjs/mcp-toolkit`) exposes `get_overview`, `search_issues` and `get_issue` over the bundled snapshot, reusing the explorer's filters and wording (`shared/agent.ts`). Tools are annotated read-only, cap output size, never call GitHub or a model, and tell agents the data is a snapshot to re-check on GitHub.

## Implementation sequence

1. Inspect project/runtime conventions; scaffold only once implementation is requested. Confirm inventory defaults and choose the tested SDK/runtime versions.
2. Implement evidence collection and local persistence, including pagination, provenance and incompleteness markers.
3. Implement the Jev adapter, input budgeting, response validation, retries, checkpoint/resume and run limits. Verify with mocks before a bounded real pilot.
4. Label/evaluate the pilot and tune the rubric and uncertainty handling. Measure actual Gateway throughput and usage before the full batch.
5. Build export and read-only explorer against fixture data, then publish real results explicitly.
6. Add operator-prepared shortlist evidence and reassessment; preserve both stages. Automating research is optional future work.

## Explorer layout — decided 10 October 2026

- Theme: light by default; the header menu offers System, Light and Dark. Light mode uses green-700 for primary text to keep AA contrast; dark mode keeps #00DC82.
- Full-height workspace with a compact 56px header. A 256px sidebar holds the views with counts and the Nuxtathon points rules. The toolbar sticks to the top: search, repository, filters, sort and removable active-filter chips.
- Rows show repository, number, comments, thumbs-up and an open PR, then the title, then one plain line: time needed · who can act, plus "Jev is unsure" when relevant. Columns: What to Do, Points, Age. 50 per page. Sort sits beside the result count.
- Plain language lives in `shared/plain.ts`. Jev returns choices and probabilities only; all wording is ours. A choice is stated only when Jev leans that way (p ≥ 0.6). Sureness is the weakest of time, who and next step: Confident ≥ 0.8, Fairly Sure ≥ 0.6, otherwise Unsure.
- Views: All Issues, Quick Wins (anyone can act, under a few hours, no open PR), Good First Issues, Maybe Already Fixed, Questions to Answer, Documentation. Sorts: Easiest First (default: anyone-can-act first, then time, Unsure sinks), Most Points, Recently Updated, Oldest First.
- The detail panel leads with a What to Do card: next step and how to do it, time needed, who can act, confident reasons (signals with p ≥ 0.8 or ≤ 0.2) and how sure Jev is. The detailed At a Glance grid and Signals bars are folded under "How Jev Scored This". Raw probabilities are hidden. Points follow the event rules: 1, +1 if older than 12 months, +1 per 5 thumbs-up.

## Open decisions and deferred work

- Implemented defaults: Nuxt + Nuxt UI, TypeScript scripts, local SQLite and the two-organisation inventory. Full-org collection remains to be run; the included snapshot is a bounded 30-issue real sample.
- Supply credentials through the operator's environment or normal local secret tooling during implementation; no secrets are needed in these files.
- Set the first real-run budget and concurrency after the pilot. No unlimited paid run has been requested.
- Confirm the rubric and calibrated thresholds through evaluation rather than a field-by-field planning interview.
- Choose public hosting and refresh cadence when publication is requested; first version supports explicit operator refreshes.
- Modules outside the two organisations, autonomous code investigation, a generalized agent framework, participant submissions, accounts and collaborative triage are deferred.

## Implementation checkpoint — 10 October 2026

Implemented the read-only paginated GitHub collector, local SQLite checkpoint store, versioned 21-question Jev adapter, bounded runner and retries, atomic allowlisted export, evidence-file reassessment, basic human-reference evaluator and URL-filtered Nuxt UI explorer. A 30-issue real GitHub sample is exported with no fabricated assessments.

Validated mocked batch failures/resume, pagination, type checks, Markdown sanitisation, MCP tool logic, a production build and an isolated-browser workflow (locally and against the live deployment). Live Jev request/response handling and billing metadata have since been smoke-tested on ten issues (see PILOT.md). Sustained throughput and rubric calibration remain untested. Source is public at https://github.com/HugoRCD/nuxtathon-triage; the Vercel project is Git-connected, so pushes to `main` deploy to production and pull requests get preview deployments.

Implementation deviations and limits: collection restart refetches completed evidence rather than resuming a saved page cursor; token budgeting uses conservative byte upper estimates rather than a provider tokenizer; shortlist research is operator-prepared evidence, not autonomous browsing. A bounded collection is explicitly partial. Numerical event points remain disabled. See README.md for executable commands and run-budget semantics.
