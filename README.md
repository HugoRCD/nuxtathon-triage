# Nuxtathon issue explorer

A read-only Nuxt + Nuxt UI app backed by a local GitHub → Jev → JSON pipeline. Jev suggests independent work types, next actions, implementation size, investigation effort, newcomer suitability, closure candidates, blockers and skills. It never changes GitHub.

Live at <https://nuxtathon-triage.vercel.app>, with a read-only [MCP server](#mcp-server-for-coding-agents) for coding agents. See [SPEC.md](./SPEC.md) for scope and [AGENTS.md](./AGENTS.md) for implementation boundaries.

## Requirements

- Node 24+ and pnpm 12.
- Authenticated GitHub CLI (`gh auth login`). The collector only performs reads.
- Only to collect or classify: a Vercel AI Gateway credential for live Jev classification. The explorer, MCP server and tests need no credentials. Set `AI_GATEWAY_API_KEY` in a local `.env` or shell environment. Do not commit it or paste it into chat. `.env.example` lists the variable; Vercel OIDC is also supported.

## Run the explorer

```sh
pnpm install
pnpm dev --port 3338
```

Open <http://127.0.0.1:3338>. `public/data/index.json` holds the 10 October snapshot: 2,184 open issues, 2,172 assessed by Jev on rubric `2026-10-10.2`. Each row says how long the issue might take, who can act and what to do next; open one for the reasoning and the original GitHub evidence. Everything is a suggestion to verify on GitHub.

## Collect

```sh
# A bounded sample across selected repositories
pnpm triage collect --repos nuxt/nuxters,nuxt/telemetry,nuxt/starter,nuxt/test-utils --limit 30

# Refresh specific issues, including ones that may now be closed
pnpm triage collect --issues 'nuxt/nuxters#9,nuxt/telemetry#134'

# All open issues in active public repositories in both organisations
pnpm triage collect

pnpm triage status
```

Collection paginates issue comments, closing PR links and PR cross-references. It uses per-repository enumeration rather than GitHub search's result window. Missing pages are recorded as evidence gaps. Full collection also refreshes previously known issues to discover closures. The collector is currently sequential; interrupted collection preserves completed issues but a restarted collection refetches evidence rather than resuming a saved page cursor.

## Classify with Jev

Start with a dry run, which requires no Gateway key and sends no inference requests:

```sh
pnpm triage classify --dry-run --limit 30
```

Then, with a credential configured locally, run a small paid pilot:

```sh
pnpm triage classify --limit 10 --concurrency 2 \
  --max-requests 10 --max-tokens 300000 --max-cost 0.10
```

`--max-cost` is denominated in **USD**, matching Gateway metadata, not GBP. The default pilot limits are 10 issues, 10 HTTP inference attempts, concurrency 2, 300,000 conservative input-token units and $0.10. Retries count against request/token/cost reservations. `--max-attempts` defaults to 3 per issue; `--timeout` defaults to 30,000 ms.

A conservative cost reservation uses the verified 64,000-token request ceiling and the catalogue input price of $0.042 per million tokens as checked on 10 October 2026. This is not a provider-enforced billing cap: verify pricing before increasing limits. Ambiguous timeouts may have been billed. Missing successful-call cost metadata stops further dispatch rather than assuming zero spend.

The pinned `ai@7.0.137` decision API routes `typesafe-ai/jev` through Gateway. One issue is shared state for 21 typed questions. No fallback model is configured. The adapter has been type-checked, tested with mocks and verified with a ten-request live Gateway pilot. See [the pilot report](./PILOT.md) for measured performance and observed judgment limitations.

### Resume and evidence limits

Rerunning the same command reuses committed results with matching evidence, question definitions, rubric version, model ID and stage. Changed comments, PR metadata or rubrics produce new assessments. A SQLite WAL store in `.data/triage.sqlite` records results atomically; a PID lock prevents simultaneous local writers. Use `--db PATH` to keep an isolated experiment. Terminal failures are skipped until explicitly retried with `--retry-failed`.

The model catalogue states 32,000 tokens for state plus longest question and 64,000 total per request. Until provider tokenisation is measured, the runner uses UTF-8 byte counts as a deliberately conservative input estimate with headroom. Large threads are skipped, never silently shortened; the skip reason is retained locally and shown after export. No claim of exact token accounting or exactly-once paid requests is made.

Probability thresholds are provisional (0.8 positive / 0.2 negative bands). “Small” is not synonymous with “beginner-friendly”, and a merged PR is not proof of resolution.

## Review and reassess

Copy `evidence/reference-labels.example.json`, replace the placeholder with human-reviewed labels and evaluate a pilot:

```sh
pnpm triage evaluate --labels evidence/reference-labels.json
```

The evaluator reports per-question agreement, missing results and uncertain boolean decisions. It is not a calibration benchmark or proof of causal correctness. Keep held-out examples and inspect closure-candidate false positives before scaling.

For a shortlist, prepare a factual investigation file using `evidence/investigation.example.json` as the format. Include source URLs, inspected refs/SHAs and excerpts. Only mark `executed-test` when a test was actually run. Jev does not fetch sources or run code.

```sh
pnpm triage investigate --evidence evidence/issue.json --limit 1 --max-requests 1
```

The original classification and reassessment remain independently visible. Reproduction execution and automated source research are not implemented in this first version.

## Export and build

```sh
# Explicitly publish the current partial results to the local app
pnpm triage export --allow-partial

# Without --allow-partial, incomplete collection/classification refuses to overwrite the last snapshot
pnpm triage export

pnpm build
```

The export uses an explicit field allowlist and atomic rename. No Gateway credentials, request headers, local database or provider logs are exported. Secret-pattern redaction is defensive, not a guarantee: review public evidence before publishing.

Issue bodies and comments render as GitHub-flavoured Markdown with [Comark](https://comark.dev) (`shared/markdown.ts`): raw scripts, styles, iframes, forms and embeds are dropped, unknown tags are unwrapped, event handlers and `javascript:`/`data:` URLs are stripped, and links open in a new tab with `rel="noopener noreferrer nofollow"`. Evidence excerpts stay plain text.

## Deploy

Live at <https://nuxtathon-triage.vercel.app> (Vercel scope `hrcd`, project `nuxtathon-triage`). The explorer is prerendered; `/data/index.json` is static; `/mcp` is the only server route. Nothing on the deployment calls GitHub or a model, so it needs no environment variables.

```sh
pnpm triage export --allow-partial
pnpm build                                   # Nitro `vercel` preset → .vercel/output
grep -rl "vck_" .vercel/output && exit 1     # leak check
vercel deploy --prebuilt --prod --yes --scope hrcd
```

`--prebuilt` uploads only `.vercel/output`; `.env`, `.env.local` and `.data/` never leave the machine. Refreshes are operator-run, not scheduled. Scope excludes archived repos, dependency dashboards and registry modules outside the two organisations.

## MCP server for coding agents

`https://nuxtathon-triage.vercel.app/mcp` (Streamable HTTP, no auth, read-only) is built with `@nuxtjs/mcp-toolkit` on the same snapshot and filters as the explorer:

| Tool            | Does                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `get_overview`  | Snapshot date, counts per shortcut list and repository, Nuxtathon rules                                                 |
| `search_issues` | Filter by query, repo, view, type, time, who, next step, skill; sorted easiest first; paged (≤ 50)                      |
| `get_issue`     | One issue by `owner/repo#123` or URL: report, discussion, PRs, next step and signals; long text truncated with a marker |

All tools are annotated `readOnlyHint` and never write to GitHub. Results are a classified snapshot: agents are told to re-read the issue on GitHub before starting.

The quickest setup is **Connect Your Agent** in the site header: one-click install for Cursor and VS Code, copyable commands for the rest, and a starter prompt. Or add it yourself:

```sh
# Claude Code
claude mcp add --transport http nuxtathon https://nuxtathon-triage.vercel.app/mcp

# Codex
codex mcp add nuxtathon --url https://nuxtathon-triage.vercel.app/mcp
```

```jsonc
// Cursor: .cursor/mcp.json
{ "mcpServers": { "nuxtathon": { "url": "https://nuxtathon-triage.vercel.app/mcp" } } }

// VS Code: .vscode/mcp.json
{ "servers": { "nuxtathon": { "type": "http", "url": "https://nuxtathon-triage.vercel.app/mcp" } } }
```

Then ask something like: “Use the nuxtathon MCP server to find three easy Nuxt issues that count for Nuxtathon.”

Classify in parallel within a hard spend cap. Budgets apply per run, so subtract earlier spend:

```sh
pnpm triage classify --limit 5000 --concurrency 12 --max-requests 3000 --max-tokens 40000000 --max-cost 1.89
pnpm triage export --allow-partial
```

## Validate

```sh
pnpm test
pnpm typecheck
pnpm format:check
pnpm build

# Against a running local app; uses a Playwright or existing agent-browser Chromium
pnpm test:browser
# Or: TRIAGE_TEST_URL=http://127.0.0.1:PORT pnpm test:browser
```

If no browser is installed, run `pnpm exec playwright install chromium`, or set `TRIAGE_BROWSER_EXECUTABLE` to a test Chromium executable. Browser tests launch an isolated profile and exercise only the local app. They check real data, URL filters, issue evidence, keyboard dismissal, dark mode and mobile overflow. Unit tests use mock decisions, never paid inference.

## Design

The explorer follows [Nuxt’s official design guide](https://nuxt.com/design.md): light mode by default with a System / Light / Dark menu, neutral surfaces, the Nuxt green scale, Outfit medium-weight headings and Inter body/controls. Fonts are bundled locally. The unchanged official icon is stored in `public/brand/nuxt-icon.svg`. Header, page structure and navigation use Nuxt UI primitives, with no hero effects or decorative gradients. Browser checks verify real font loading, both themes and narrow-screen reflow.

## Contributing

Issues and pull requests are welcome, especially UI, wording, filters and MCP tools.

1. `pnpm install && pnpm dev --port 3338`. The committed snapshot in `public/data/index.json` is enough; no keys needed.
2. Keep it read-only: nothing here may write to GitHub, and visitors or MCP clients must never trigger model calls. See [AGENTS.md](./AGENTS.md).
3. Before opening a pull request: `pnpm test && pnpm typecheck && pnpm format:check`, plus `pnpm test:browser` for UI changes.

Pull requests get a Vercel preview. Production deploys from `main`. Data refreshes (collection and Jev classification) are run by the maintainer, so please don't commit a regenerated `public/data/index.json` unless asked.

## License

[MIT](./LICENSE)
