import { fileURLToPath } from 'node:url'

const SITE = 'https://nuxtathon-triage.vercel.app'
const DESCRIPTION =
  'Open issues across nuxt and nuxt-modules, sorted by how easy they are to close. Also available to coding agents over MCP.'

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
      title: 'Nuxtathon · Issue Explorer',
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      meta: [
        { name: 'description', content: DESCRIPTION },
        { name: 'theme-color', content: '#00DC82' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Nuxtathon' },
        { property: 'og:title', content: 'Nuxtathon · Issue Explorer' },
        { property: 'og:description', content: DESCRIPTION },
        { property: 'og:url', content: SITE },
        { property: 'og:image', content: `${SITE}/og.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Nuxtathon Issue Explorer' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Nuxtathon · Issue Explorer' },
        { name: 'twitter:description', content: DESCRIPTION },
        { name: 'twitter:image', content: `${SITE}/og.png` },
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
  routeRules: {
    '/': { prerender: true },
    // The snapshot only changes with a deploy, so cache each issue until the next one.
    '/*/*/issues/**': { isr: true },
    '/api/issues/**': { isr: true },
  },
  vite: {
    optimizeDeps: {
      include: [
        'comark/plugins/breaks',
        'comark/plugins/html',
        'comark/plugins/security',
        'comark/plugins/task-list',
        'comark/plugins/shiki',
        'comark/utils',
      ],
    },
  },
  nitro: {
    preset: 'vercel',
    serverAssets: [{ baseName: 'triage', dir: fileURLToPath(new URL('./public/data', import.meta.url)) }],
  },
})
