/** The public deployment. Also in `app.config.ts` for the UI. */
export const SITE = 'https://nuxtathon-triage.vercel.app'

/** Same path as on GitHub, so swapping the host is enough to jump between the two. */
export const issuePath = (issue: { repo: string; number: number }) => `/${issue.repo}/issues/${issue.number}`
