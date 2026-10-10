# Nuxtathon Issues

Find open issues in the `nuxt` and `nuxt-modules` organisations worth closing during [Nuxtathon](https://nuxtathon.live). [Jev](https://vercel.com/ai-gateway/models/jev) classified each issue: how long it might take, who can pick it up and what to do next.

**Live:** <https://nuxtathon-triage.vercel.app>

Classifications are suggestions from a snapshot. A live status layer hides issues that were closed, credited on nuxtathon.live, or picked up (new PR or assignee) since the event started. It refreshes every 10 minutes, so check the issue on GitHub before you start. The site and MCP server are read-only.

## Use it with your coding agent

Click **Connect Your Agent** on the site, or add the MCP server yourself:

```sh
# Claude Code
claude mcp add --transport http nuxtathon https://nuxtathon-triage.vercel.app/mcp

# Codex
codex mcp add nuxtathon --url https://nuxtathon-triage.vercel.app/mcp
```

Cursor, in `.cursor/mcp.json`:

```json
{ "mcpServers": { "nuxtathon": { "url": "https://nuxtathon-triage.vercel.app/mcp" } } }
```

VS Code, in `.vscode/mcp.json`:

```json
{ "servers": { "nuxtathon": { "type": "http", "url": "https://nuxtathon-triage.vercel.app/mcp" } } }
```

Then ask: “Find three easy Nuxt issues that count for Nuxtathon.” The server has three tools: `get_overview`, `search_issues` and `get_issue`.

Every issue has a shareable page at the GitHub path, so `github.com/nuxt/nuxt/issues/123` becomes `nuxtathon-triage.vercel.app/nuxt/nuxt/issues/123`.

## Run locally

```sh
pnpm install
pnpm dev
```

Open <http://127.0.0.1:3000>. The committed snapshot in `public/data/index.json` is all you need, no keys.

## Contributing

Issues and pull requests are welcome, especially for the UI, wording, filters and MCP tools.

- Keep it read-only: nothing may write to GitHub, and visitors or agents must never trigger model calls. See [AGENTS.md](./AGENTS.md).
- Before opening a pull request, run `pnpm test && pnpm typecheck && pnpm format:check`. For UI changes, also run `pnpm test:browser` while `pnpm dev` is running.
- Don't commit a regenerated `public/data/index.json` unless asked.

Pull requests get a Vercel preview, and `main` deploys to production.

## Refresh the data

For maintainers. Requires `gh auth login` and `AI_GATEWAY_API_KEY` in `.env` (never commit it).

```sh
pnpm triage collect                 # read open issues from GitHub
pnpm triage classify --dry-run      # preview, no model calls
pnpm triage classify --limit 5000 --concurrency 12 \
  --max-requests 3000 --max-tokens 40000000 --max-cost 1.00
pnpm triage export --allow-partial  # write public/data/index.json
```

- `--max-cost` is in USD and applies per run. Without flags, `classify` runs a 10-issue pilot.
- Reruns skip unchanged issues; add `--retry-failed` to retry failures.
- There is no fallback model, and long threads are skipped rather than truncated.

The live status comes from the `Live Status` workflow, which runs `node scripts/live.ts` every 10 minutes with the workflow's own `GITHUB_TOKEN` and pushes `status.json` to the `status` branch. It makes no model calls, and the app reads the file from GitHub, so no token is involved. Run it locally with `node scripts/live.ts --out /tmp/status.json`.

[SPEC.md](./SPEC.md) explains scope and design, and [PILOT.md](./PILOT.md) has measured cost and accuracy.

## License

[MIT](./LICENSE)
