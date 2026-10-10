import { z } from 'zod'
import { findIssue, issueDetail } from '#shared/agent'

export default defineMcpTool({
  name: 'get_issue',
  title: 'Get Issue',
  description:
    'Get one issue with its report, discussion, linked pull requests, the suggested next step and the signals behind it. Long bodies and comments are truncated and say so.',
  inputSchema: {
    issue: z
      .string()
      .max(300)
      .describe('Issue reference: "owner/repo#123" or "https://github.com/owner/repo/issues/123".'),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputExamples: [{ issue: 'nuxt/nuxt#12345' }],
  async handler({ issue }) {
    const found = findIssue(await useDataset(), issue)
    if (!found)
      return errorResult(
        `No issue matching "${issue}" in this snapshot. Use "owner/repo#123" and check it is an open issue in the nuxt or nuxt-modules orgs.`,
      )
    return jsonResult(issueDetail(found), false)
  },
})
