import type { Dataset } from '#shared/types'

let cached: Promise<Dataset> | undefined

/** The exported dataset, bundled as a server asset and parsed once per instance. */
export function useDataset(): Promise<Dataset> {
  cached ??= (async () => {
    const raw = await useStorage('assets:triage').getItem<Dataset | string>('index.json')
    if (!raw) throw new Error('The triage dataset is missing from this deployment.')
    return typeof raw === 'string' ? (JSON.parse(raw) as Dataset) : raw
  })().catch((error) => {
    cached = undefined
    throw error
  })
  return cached
}
