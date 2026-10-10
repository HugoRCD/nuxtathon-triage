import { LIVE_URL, type LiveStatus } from '#shared/live'

/**
 * Live status from the `status` branch: public, cached ~5 min by GitHub, no token.
 * Fetched in the browser only and refreshed every five minutes.
 */
export function useLive() {
  const { data, refresh } = useFetch<LiveStatus | null>(LIVE_URL, {
    key: 'live-status',
    server: false,
    lazy: true,
    default: () => null,
    parseResponse: (text) => {
      const s = JSON.parse(text) as LiveStatus
      return s && typeof s.issues === 'object' ? s : null
    },
  })
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    timer = setInterval(() => refresh(), 5 * 60_000)
  })
  onBeforeUnmount(() => clearInterval(timer))
  return { live: data, refresh }
}
