/**
 * Safe rendering of GitHub-flavoured Markdown from issues and comments.
 *
 * Issue text is untrusted. Raw HTML is parsed (issue templates are full of
 * `<details>` and comments) but every element goes through a tag allowlist and
 * an attribute allowlist, and links are limited to http(s) and mailto.
 * Comark's component and attribute syntax (MDC) stays off: this is GitHub
 * Markdown, not Nuxt Content.
 *
 * On top of that, two GitHub niceties: `#123` references, participant
 * `@mentions` and GitHub issue URLs become short links, and code blocks are
 * highlighted with Shiki using GitHub's own light and dark themes.
 */
import type { ComarkPlugin, ParserOptions } from 'comark'
import type { ShikiOptions } from 'comark/plugins/shiki'
import breaks from 'comark/plugins/breaks'
import html from 'comark/plugins/html'
import security from 'comark/plugins/security'
import taskList from 'comark/plugins/task-list'
import { visit } from 'comark/utils'

type Element = [string | null, Record<string, unknown>, ...unknown[]]

/** Tags that render as-is. Everything else is unwrapped or dropped. */
export const allowedTags = [
  'p',
  'a',
  'strong',
  'b',
  'em',
  'i',
  'del',
  's',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'input',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'h4',
  'h5',
  'hr',
  'br',
  'img',
  'span',
  'kbd',
  'sup',
  'sub',
]

/** Tags removed with their content. */
export const droppedTags = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'textarea',
  'select',
  'button',
  'svg',
  'math',
  'template',
  'noscript',
  'link',
  'meta',
  'base',
  'video',
  'audio',
  'source',
]

/** GitHub alert markers, mapped to Nuxt UI prose callouts. */
const alerts: Record<string, string> = {
  NOTE: 'note',
  IMPORTANT: 'note',
  TIP: 'tip',
  WARNING: 'warning',
  CAUTION: 'caution',
}
const alertTags = [...new Set(Object.values(alerts))]

const keepClass = /^(?:contains-task-list|task-list-item(?:-checkbox)?|language-[\w-]+)$/
const attributes: Record<string, string[]> = {
  a: ['href', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  input: ['type', ':checked', ':disabled'],
  pre: ['language'],
  ol: ['start'],
  th: ['align'],
  td: ['align'],
}

const isElement = (node: unknown): node is Element =>
  Array.isArray(node) && (typeof node[0] === 'string' || node[0] === null)

/** `> [!NOTE]` blockquotes become callouts, as on GitHub. */
const githubAlerts: ComarkPlugin = {
  name: 'github-alerts',
  post(state) {
    visit(
      state.tree,
      (node) => isElement(node) && node[0] === 'blockquote',
      (node) => {
        const quote = node as unknown as Element
        const holder = isElement(quote[2]) && quote[2][0] === 'p' ? quote[2] : quote
        const first = holder[2]
        if (typeof first !== 'string') return
        const match = first.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\r?\n?/i)
        if (!match) return
        const rest = first.slice(match[0].length)
        if (rest) holder[2] = rest
        else holder.splice(2, 1)
        while (isElement(holder[2]) && holder[2][0] === 'br') holder.splice(2, 1)
        if (holder !== quote && holder.length === 2) quote.splice(2, 1)
        quote[0] = alerts[match[1]!.toUpperCase()]!
        quote[1] = {}
      },
    )
  },
}

/**
 * Last pass: headings shrink to fit the panel, links open in a new tab, and
 * only known attributes survive (no `style`, no `id`, no `on*`).
 */
const tidy: ComarkPlugin = {
  name: 'tidy',
  post(state) {
    visit(
      state.tree,
      (node) => isElement(node) && node[0] !== null,
      (node) => {
        const el = node as unknown as Element
        const tag = el[0] as string
        if (/^h[1-6]$/.test(tag)) el[0] = Number(tag[1]) <= 2 ? 'h4' : 'h5'
        const allowed = attributes[el[0] as string] ?? []
        const next: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(el[1] ?? {})) {
          if (key === '$' || allowed.includes(key)) next[key] = value
          else if (key === 'class' && typeof value === 'string') {
            const kept = value.split(/\s+/).filter((c) => keepClass.test(c))
            if (kept.length) next.class = kept.join(' ')
          }
        }
        if (el[0] === 'a' && typeof next.href === 'string') {
          next.target = '_blank'
          next.rel = 'noopener noreferrer nofollow'
        }
        el[1] = next
      },
    )
  },
}

/** Where text is literal and must not gain links. */
const literal = new Set(['a', 'code', 'pre', 'kbd'])
const ref = /(^|[^\w/#&@.-])(?:([A-Za-z\d][\w.-]*\/[\w.-]+))?#(\d{1,7})\b/g
const mention = /(^|[^\w/@.`-])@([A-Za-z\d](?:[A-Za-z\d]|-(?=[A-Za-z\d])){0,38})(?![\w/-])/g
const githubUrl =
  /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(?:issues|pull|discussions)\/(\d+)(?:\/[\w-]*)?(#[\w-]*)?$/i

export type MarkdownContext = {
  /** `owner/repo` of the issue, so `#123` points at the right repository. */
  repo?: string
  /** Logins taking part in the thread. Only these become `@mention` links. */
  people?: string[]
}

function linkText(text: string, ctx: MarkdownContext, people: Set<string>): unknown[] {
  type Hit = { start: number; end: number; node: Element }
  const hits: Hit[] = []
  for (const m of text.matchAll(ref)) {
    const target = m[2] ?? ctx.repo
    if (!target) continue
    const start = m.index + m[1]!.length
    hits.push({
      start,
      end: m.index + m[0].length,
      node: ['a', { href: `https://github.com/${target}/issues/${m[3]}` }, m[0].slice(m[1]!.length)],
    })
  }
  for (const m of text.matchAll(mention)) {
    if (!people.has(m[2]!.toLowerCase())) continue
    const start = m.index + m[1]!.length
    if (hits.some((h) => start < h.end && h.start < m.index + m[0].length)) continue
    hits.push({
      start,
      end: m.index + m[0].length,
      node: ['a', { href: `https://github.com/${m[2]}` }, `@${m[2]}`],
    })
  }
  if (!hits.length) return [text]
  hits.sort((a, b) => a.start - b.start)
  const out: unknown[] = []
  let at = 0
  for (const h of hits) {
    if (h.start < at) continue
    if (h.start > at) out.push(text.slice(at, h.start))
    out.push(h.node)
    at = h.end
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}

/** `#123`, `owner/repo#123` and thread `@mentions` link to GitHub; bare GitHub issue URLs read like GitHub shows them. */
function githubLinks(ctx: MarkdownContext): ComarkPlugin {
  const people = new Set((ctx.people ?? []).map((p) => p.toLowerCase()))
  const walk = (el: Element) => {
    const tag = el[0]
    if (tag === 'a') {
      const href = el[1]?.href
      const m = typeof href === 'string' && el.length === 3 && el[2] === href ? href.match(githubUrl) : null
      if (m) {
        const short = m[1]!.toLowerCase() === ctx.repo?.toLowerCase() ? `#${m[2]}` : `${m[1]}#${m[2]}`
        el[2] = m[3]?.startsWith('#issuecomment') ? `${short} (comment)` : short
      }
      return
    }
    if (typeof tag === 'string' && literal.has(tag)) return
    for (let i = el.length - 1; i >= 2; i--) {
      const child = el[i]
      if (typeof child === 'string') el.splice(i, 1, ...linkText(child, ctx, people))
      else if (isElement(child)) walk(child)
    }
  }
  return {
    name: 'github-links',
    post(state) {
      const root = [null, {}, ...state.tree.nodes] as Element
      walk(root)
      state.tree.nodes = root.slice(2) as typeof state.tree.nodes
    },
  }
}

/** Grammars for what shows up in Nuxt issues. Loaded on first code block only. */
const languages = () =>
  Promise.all([
    import('shiki/dist/langs/vue.mjs'),
    import('shiki/dist/langs/vue-html.mjs'),
    import('shiki/dist/langs/typescript.mjs'),
    import('shiki/dist/langs/tsx.mjs'),
    import('shiki/dist/langs/javascript.mjs'),
    import('shiki/dist/langs/jsx.mjs'),
    import('shiki/dist/langs/json.mjs'),
    import('shiki/dist/langs/jsonc.mjs'),
    import('shiki/dist/langs/yaml.mjs'),
    import('shiki/dist/langs/shellscript.mjs'),
    import('shiki/dist/langs/shellsession.mjs'),
    import('shiki/dist/langs/diff.mjs'),
    import('shiki/dist/langs/html.mjs'),
    import('shiki/dist/langs/css.mjs'),
    import('shiki/dist/langs/scss.mjs'),
    import('shiki/dist/langs/toml.mjs'),
    import('shiki/dist/langs/log.mjs'),
    import('shiki/dist/langs/xml.mjs'),
    import('shiki/dist/langs/dotenv.mjs'),
    import('shiki/dist/langs/ini.mjs'),
    import('shiki/dist/langs/sql.mjs'),
    import('shiki/dist/langs/graphql.mjs'),
  ]).then((mods) => mods.map((m) => m.default))

let shiki: Promise<{
  highlight: typeof import('comark/plugins/shiki').highlightCodeBlocks
  options: ShikiOptions
}>
function loadShiki() {
  shiki ??= Promise.all([
    import('comark/plugins/shiki'),
    import('shiki/dist/themes/github-light.mjs'),
    import('shiki/dist/themes/github-dark.mjs'),
    languages(),
  ]).then(([plugin, light, dark, langs]) => ({
    highlight: plugin.highlightCodeBlocks,
    options: {
      registerDefaultThemes: false,
      registerDefaultLanguages: false,
      themes: { light: light.default, dark: dark.default },
      languages: langs,
    },
  }))
  return shiki
}

const hasCode = (nodes: unknown[]): boolean =>
  nodes.some((n) => isElement(n) && (n[0] === 'pre' || hasCode(n.slice(2))))

/**
 * Runs after `tidy`: the colours come from the highlighter, not from the issue,
 * so user-supplied `style` is still removed while token colours survive.
 */
const highlight: ComarkPlugin = {
  name: 'github-highlight',
  async post(state) {
    if (!hasCode(state.tree.nodes)) return
    const { highlight, options } = await loadShiki()
    state.tree = await highlight(state.tree, options)
  },
}

const unwrap = (el: Element): Element | false => {
  const tag = String(el[0]).toLowerCase()
  if (droppedTags.includes(tag)) return false
  const children = el.slice(2)
  if (tag === 'summary') return ['p', {}, ['strong', {}, ...children]]
  if (/^h[1-6]$/.test(tag) || alertTags.includes(tag)) return el
  return ['span', {}, ...children]
}

export const markdownOptions: Omit<ParserOptions, 'plugins'> = {
  registerDefaultPlugins: false,
  linkify: true,
}

export function markdownPlugins(ctx: MarkdownContext = {}): ComarkPlugin[] {
  return [
    html(),
    breaks(),
    taskList(),
    githubAlerts,
    security({
      allowedTags: [...allowedTags, ...alertTags, 'h1', 'h2', 'h3', 'h6'],
      tagFallback: unwrap as never,
      allowedProtocols: ['http', 'https', 'mailto'],
      allowDataImages: false,
    }),
    githubLinks(ctx),
    tidy,
    highlight,
  ]
}

/** GitHub bodies use CRLF and template comments; neither should be shown. */
export function cleanMarkdown(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
}
