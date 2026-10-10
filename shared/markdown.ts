/**
 * Safe rendering of GitHub-flavoured Markdown from issues and comments.
 *
 * Issue text is untrusted. Raw HTML is parsed (issue templates are full of
 * `<details>` and comments) but every element goes through a tag allowlist and
 * an attribute allowlist, and links are limited to http(s) and mailto.
 * Comark's component and attribute syntax (MDC) stays off: this is GitHub
 * Markdown, not Nuxt Content.
 */
import type { ComarkPlugin, ParserOptions } from 'comark'
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

export function markdownPlugins(): ComarkPlugin[] {
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
    tidy,
  ]
}

/** GitHub bodies use CRLF and template comments; neither should be shown. */
export function cleanMarkdown(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
}
