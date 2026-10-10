import { z } from 'zod'
import { nextSteps, searchIssues, skills, sorts, times, views, whos, workTypes } from '#shared/agent'

export default defineMcpTool({
  name: 'search_issues',
  title: 'Search Issues',
  description:
    'Find open issues in the nuxt and nuxt-modules GitHub orgs that are worth picking up, using the same filters and order as the Nuxtathon explorer. Returns compact rows; call get_issue for the full thread. By default only issues that count for Nuxtathon are returned, easiest first.',
  inputSchema: {
    query: z.string().max(200).optional().describe('Words to match in the repo, title, labels or body.'),
    repo: z
      .string()
      .max(100)
      .optional()
      .describe('Limit to one repository, e.g. "nuxt/nuxt" or "nuxt-modules/i18n".'),
    view: z
      .enum(views)
      .optional()
      .describe(
        'Shortcut lists: quick (anyone can start, under a few hours, no open PR), newcomer (good first contribution), closure (probably already fixed, duplicated or answered), questions, docs.',
      ),
    type: z.enum(workTypes).optional().describe('Kind of work.'),
    time: z.enum(times).optional().describe('Estimated time to close.'),
    who: z.enum(whos).optional().describe('Who has to act next. Use "anyone" for issues you can start now.'),
    nextStep: z.enum(nextSteps).optional().describe('Suggested next step.'),
    skill: z.enum(skills).optional().describe('Skill the work clearly needs.'),
    includeIneligible: z
      .boolean()
      .optional()
      .describe('Also include issues that do not count for Nuxtathon (created too late or archived repos).'),
    sort: z.enum(sorts).optional().describe('easiest (default), points, oldest or updated.'),
    limit: z.number().int().min(1).max(50).optional().describe('Results per page, 1–50. Default 10.'),
    offset: z.number().int().min(0).optional().describe('Skip this many results, for paging.'),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputExamples: [
    { view: 'quick', limit: 5 },
    { repo: 'nuxt/nuxt', type: 'docs' },
  ],
  async handler(input) {
    return jsonResult(searchIssues(await useDataset(), input), false)
  },
})
