import { LIVE_URL, type LiveStatus } from '#shared/live'

const TTL = 60_000
let cached: { at: number; value: Promise<LiveStatus | null> } | undefined

/**
 * The live status published by the `Live Status` workflow. Cached for a minute per
 * instance; any failure degrades to the plain snapshot instead of breaking a tool.
 */
export function useLiveStatus(): Promise<LiveStatus | null> {
  if (cached && Date.now() - cached.at < TTL) return cached.value
  const value = $fetch<LiveStatus>(LIVE_URL, { responseType: 'json', timeout: 4000, retry: 0 })
    .then((s) => (typeof s === 'string' ? (JSON.parse(s) as LiveStatus) : s))
    .then((s) => (s && typeof s.issues === 'object' ? s : null))
    .catch(() => null)
  cached = { at: Date.now(), value }
  return value
}
