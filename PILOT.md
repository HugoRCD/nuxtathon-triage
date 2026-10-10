# Jev pilot — 10 October 2026

## Execution

- Model: `typesafe-ai/jev`, routed through Vercel AI Gateway with `ai@7.0.137`.
- Rubric: `2026-10-10.1`; 21 questions per issue; ten issue states.
- Concurrency: 2. Maximum inference attempts: 10. Application-side cost guard: US$0.10.
- Results: **10 successful requests, 0 failed, 0 retried**, 210 typed answers returned and validated.
- Reported input tokens: **33,312**. Output tokens: **5,563**.
- Gateway-reported cost: **US$0.001399104**, consistent with input-only pricing of US$0.042 per million tokens.
- Median end-to-end request latency: **306.5 ms**. Range: **274–1,265 ms**. Nearest-rank p95: **1,265 ms**.
- The first two calls took 1,237 and 1,265 ms; the remaining eight took 274–346 ms. This does not establish why the initial calls were slower or predict sustained throughput.
- Every response reported final provider `typesafe-ai` and one provider attempt. No other model was used.
- A subsequent dry run reported **10 cache hits**, 20 remaining issues and no inference calls.

The selected issues were the first ten sorted identifiers in the existing 30-issue sample, concentrated in `nuxt/nuxters` and `nuxt/starter`. This is an integration smoke test, **not a representative accuracy benchmark or human-labelled evaluation**.

## Qualitative spot-checks

- **Nuxters #9:** work type `feature` (1.00), next action `assessDuplicate` (0.63), closure `unresolved` (0.57). The thread only contains Daniel linking #4; that link does not establish duplication. This is an observed failure mode for a future rubric revision and richer evidence, not grounds to close the issue.
- **Nuxters #4:** `verifyFix` (0.72), possible existing fix (0.79). This is plausible from the maintainer comment, but incomplete third-party-module and discussion scope prevents calling it verified.
- **Starter #134:** possible existing fix (0.75), next action `verifyFix` (0.50). A recent member comment describes the newer wizard, but the residual template request still needs a scope decision. The strict closure preset does not include it.
- **Starter #1305:** closure `unresolved` (0.96) despite a merged linked PR, with later failure reports present. This is a useful conservative outcome; it is not a reproduction result.
- **Starter #1580:** newcomer suitability `suitable` (0.69), low difficulty score (0.57), but evidence sufficiency only 0.69. The strict newcomer preset and displayed-size gate withhold confident recommendations.
- **Nuxters #10/#12/#254 and Starter #247:** generally recognise feature requests needing a design decision rather than declaring them easy fixes. Architectural difficulty scores are often high when evidence sufficiency is low; those scores must remain suppressed in the normal size display.

No thresholds have been calibrated against independent human labels. There were no sufficiently confident newcomer or closure candidates in this first pilot under the current conservative preset rules; avoid lowering thresholds just to fill those views.

## Follow-up before the full inventory

1. Collect a varied sample from the framework, modules, documentation and developer tooling, including clear newcomer issues and known resolved/unresolved cases.
2. Label a small reference set independently of Jev predictions, then compare per-dimension precision and coverage on held-out issues.
3. Refine duplicate guidance: cross-references, parent/roadmap links and overlapping scope are not duplicate evidence by themselves.
4. Measure context usage and throttling across longer threads and higher bounded concurrency. The current result proves ten requests worked, not that a full batch is reliable under sustained load.
5. Choose an explicit full-run request/token/spend envelope before dispatching thousands of paid calls. Preserve the current rubric's results when revising it; changed question definitions intentionally invalidate cache identity.

## Full inventory run — 10 October 2026

- Collection: 2,184 open issues across `nuxt` and `nuxt-modules`, created before 9 October. Fetched 25 per page with inline comments and linked PRs, issues collected 6 at a time (`--collect-concurrency`), with extra queries only when a window overflows.
- Classification, two runs at up to 12 concurrent requests:
  - Run 1: 741 succeeded, US$0.1065. It stopped early because successful requests never released their cost reservation.
  - Run 2: 1,410 succeeded, 8 failed and 13 skipped (oversized), US$0.2074.
- Total: 2,161 of 2,184 assessed for about US$0.31, well under the US$2 cap. 11 terminal failures, where Jev did not select a highest-probability `nextAction`. The rest were skipped for exceeding the token budget.
- Runner fix: after a successful call the budget reservation is replaced by the actual cost and tokens. Failed attempts keep their reservation.

## Rubric 2026-10-10.2 run — 10 October 2026

- Added `timeToClose` and `whoCanAct` to drive the plain-language explorer. Every issue was reclassified because the rubric version is part of the job key.
- Run 3: 2,151 succeeded, 7 cached, 14 failed (Jev did not select a highest-probability option, spread across five choice questions), 10 skipped (oversized). US$0.3488.
- `--retry-failed`: 14 of 14 succeeded, US$0.0022. These failures are transient.
- Coverage: 2,172 of 2,184 assessed; 12 exceed the input limit and stay unassessed rather than truncated.
- Cumulative spend across all runs: about US$0.67 of the US$2 cap.
- Distribution: Jev leans (p ≥ 0.6) on time to close for 45% of issues and on who can act for 64%; 82 issues are "anyone can act".

## Credential handling

The temporary credential lives only in the ignored `.env` with owner-only file permissions. It is not included in this report, the public dataset or checkpoint request metadata. The owner plans to revoke it when the work is complete; removing the local file does not revoke the credential.
