const patterns = [
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|vck_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{20,})\b/g,
  /(?:https:\/\/(?:discord(?:app)?\.com)\/api\/webhooks\/)[^\s"'<>]+/gi,
  /\b(?:Authorization\s*:\s*Bearer|(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=])\s*["']?[A-Za-z0-9_./+\-=]{12,}["']?/gi,
  /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
]
export function redact(text: string): { text: string; changed: boolean } {
  let cleaned = text
  for (const pattern of patterns) cleaned = cleaned.replace(pattern, '[REDACTED]')
  return { text: cleaned, changed: cleaned !== text }
}
export function cleanObject<T>(value: T): { value: T; changed: boolean } {
  let changed = false
  const visit = (v: any): any =>
    typeof v === 'string'
      ? (() => {
          const r = redact(v)
          changed ||= r.changed
          return r.text
        })()
      : v instanceof Date
        ? v.toISOString()
        : Array.isArray(v)
          ? v.map(visit)
          : v && typeof v === 'object'
            ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, visit(x)]))
            : v
  return { value: visit(value), changed }
}
export function safeGitHubURL(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'github.com' && !u.username && !u.password
  } catch {
    return false
  }
}
