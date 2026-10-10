import { overview } from '#shared/agent'

export default defineMcpTool({
  name: 'get_overview',
  title: 'Get Overview',
  description:
    'Summarise the snapshot: when it was collected, how many issues each shortcut list holds, open and eligible counts per repository, and the Nuxtathon scoring rules. Call this first.',
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler() {
    return jsonResult(overview(await useDataset()), false)
  },
})
