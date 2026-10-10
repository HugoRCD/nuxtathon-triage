import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-10',
  modules: ['@nuxt/ui', '@comark/nuxt', '@nuxtjs/mcp-toolkit'],
  css: ['~/assets/css/main.css'],
  ui: { fonts: false },
  colorMode: { preference: 'light', fallback: 'light' },
  devtools: { enabled: false },
  app: {
    head: {
      htmlAttrs: { lang: 'en-GB' },
      title: 'Nuxtathon · Issue explorer',
      meta: [
        {
          name: 'description',
          content:
            'Find your next contribution to the Nuxt ecosystem. Evidence-led issue triage, classified with Jev.',
        },
      ],
    },
  },
  mcp: {
    name: 'Nuxtathon Issues',
    version: '1.0.0',
    description:
      'Read-only access to open issues in the nuxt and nuxt-modules GitHub orgs, classified by Jev for Nuxtathon.',
    instructions: [
      'Use this server to choose a Nuxt ecosystem issue to work on during Nuxtathon (10–11 October 2026).',
      'Start with get_overview, then search_issues (default: issues that count, easiest first), then get_issue for the thread.',
      'The data is a classified snapshot, not live GitHub state. Before starting, re-read the issue on GitHub and check nobody already has a pull request open.',
      'This server is read-only. Do any GitHub work (comments, pull requests) yourself, following the repository CONTRIBUTING guide.',
    ].join(' '),
    browserRedirect: '/',
  },
  routeRules: { '/': { prerender: true } },
  vite: {
    optimizeDeps: {
      include: [
        'comark/plugins/breaks',
        'comark/plugins/html',
        'comark/plugins/security',
        'comark/plugins/task-list',
        'comark/utils',
      ],
    },
  },
  nitro: {
    preset: 'vercel',
    serverAssets: [{ baseName: 'triage', dir: fileURLToPath(new URL('./public/data', import.meta.url)) }],
  },
})
