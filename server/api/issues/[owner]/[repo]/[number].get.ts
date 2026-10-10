import { findIssue } from '#shared/agent'

/** One issue from the bundled snapshot, for the shareable issue page. Read-only. */
export default defineEventHandler(async (event) => {
  const { owner, repo, number } = getRouterParams(event)
  const issue = /^\d{1,7}$/.test(number ?? '')
    ? findIssue(await useDataset(), `${owner}/${repo}#${number}`)
    : null
  if (!issue) throw createError({ statusCode: 404, statusMessage: 'Issue not in this snapshot' })
  return issue
})
