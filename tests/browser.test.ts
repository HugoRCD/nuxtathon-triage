import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const root = join(homedir(), '.agent-browser/browsers')
const fallback = existsSync(root)
  ? readdirSync(root)
      .filter((n) => n.startsWith('chrome-'))
      .sort()
      .reverse()
      .map((n) => join(root, n, 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'))
      .find(existsSync)
  : undefined
const executablePath =
  process.env.TRIAGE_BROWSER_EXECUTABLE ?? (existsSync(chromium.executablePath()) ? undefined : fallback)
const base = process.env.TRIAGE_TEST_URL ?? 'http://127.0.0.1:3000'

test(
  'browser: real data, URL filters, evidence panel, empty view and mobile layout',
  { skip: !process.env.TRIAGE_BROWSER_TEST },
  async () => {
    const browser = await chromium.launch({ headless: true, executablePath })
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(base)
      await page.waitForFunction(() => document.documentElement.classList.contains('light'))
      await page.evaluate(() => document.fonts.ready)
      const brand = await page.evaluate(() => ({
        heading: getComputedStyle(document.querySelector('h1')!).fontFamily,
        body: getComputedStyle(document.body).fontFamily,
        background: getComputedStyle(document.body).backgroundColor,
        primary: getComputedStyle(document.documentElement).getPropertyValue('--ui-primary'),
        fonts: [
          document.fonts.check('500 24px \"Outfit Variable\"'),
          document.fonts.check('400 16px \"Inter Variable\"'),
        ],
      }))
      assert.match(brand.heading, /Outfit/)
      assert.match(brand.body, /Inter/)
      assert(
        ['rgb(255, 255, 255)', 'oklch(1 0 0)', 'oklch(1 0 none)'].includes(brand.background),
        `Light mode is the default (got ${brand.background})`,
      )
      assert.deepEqual(brand.fonts, [true, true])
      assert.equal(await page.locator('img[alt=Nuxt]').getAttribute('src'), '/brand/nuxt-icon.svg')
      await page.locator('article').first().waitFor()
      await page.getByRole('textbox', { name: 'Search Issues' }).fill('discussions activity')
      await page.waitForURL(/q=discussions/)
      assert.equal(await page.locator('article').count(), 1)
      await page.reload()
      await page.getByRole('button', { name: 'Recognize Github discussions activity', exact: true }).waitFor()
      assert.equal(
        await page.getByRole('textbox', { name: 'Search Issues' }).inputValue(),
        'discussions activity',
      )
      await page.getByRole('button', { name: 'Recognize Github discussions activity', exact: true }).click()
      await page.getByRole('dialog').waitFor()
      assert.match(await page.getByRole('dialog').innerText(), /Thread/)
      assert.equal(
        await page.getByRole('link', { name: 'Open as a Page' }).getAttribute('href'),
        '/nuxt/nuxters/issues/9',
      )
      const snapshot = await (await page.request.get(`${base}/data/index.json`)).json()
      const issue = snapshot.issues.find((i: { id: string }) => i.id === 'nuxt/nuxters#9')
      assert.match(
        await page.getByRole('dialog').innerText(),
        issue?.status === 'assessed' ? /What to Do/ : /hasn’t assessed|outdated/,
      )
      assert.match(page.url(), /issue=nuxt/)
      await page.getByRole('dialog').evaluate(async (el) => {
        await Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})))
      })
      const panel = await page.getByRole('dialog').boundingBox()
      assert(panel && panel.x >= 0 && panel.x + panel.width <= 1441, 'Evidence panel stays within viewport')
      await page.screenshot({ path: '/tmp/nuxtathon-triage-detail.png' })
      await page.keyboard.press('Escape')
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      await page.getByRole('textbox', { name: 'Search Issues' }).fill('')
      await page.waitForURL((url) => !url.searchParams.has('q'))
      await page.getByRole('button', { name: 'More Filters', exact: true }).click()
      await page.getByRole('combobox', { name: 'Work Type', exact: true }).click()
      await page.getByRole('option', { name: 'Bug', exact: true }).click()
      await page.getByRole('textbox', { name: 'Search Issues' }).fill('no-such-issue-ui-regression-check')
      await page.getByRole('heading', { name: 'No Issues Match This View' }).waitFor()
      await page.getByRole('button', { name: 'Reset View', exact: true }).click()
      await page.locator('article').first().waitFor()
      await page.screenshot({ path: '/tmp/nuxtathon-triage-light.png' })
      await page.locator('aside').getByRole('button', { name: 'Connect Your Agent' }).click()
      const agent = page.getByRole('dialog')
      assert.match(await agent.innerText(), /claude mcp add --transport http nuxtathon/)
      await agent.getByRole('button', { name: 'Cursor', exact: true }).click()
      await agent.getByRole('link', { name: 'Add to Cursor' }).waitFor()
      await agent.getByRole('button', { name: 'Other', exact: true }).click()
      await agent.getByRole('button', { name: 'Copy Server URL' }).waitFor()
      await page.keyboard.press('Escape')
      await agent.waitFor({ state: 'hidden' })
      const theme = async (name: string) => {
        await page.getByRole('button', { name: /^Theme: / }).click()
        await page.getByRole('menuitemcheckbox', { name, exact: true }).click()
      }
      await page.emulateMedia({ colorScheme: 'dark' })
      await theme('System')
      await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
      await page.emulateMedia({ colorScheme: 'light' })
      await page.waitForFunction(() => !document.documentElement.classList.contains('dark'))
      await theme('Dark')
      await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
      const colours = await page.evaluate(() => ({
        background: getComputedStyle(document.body).backgroundColor,
        text: getComputedStyle(document.body).color,
      }))
      assert.notEqual(
        colours.background,
        'rgb(252, 252, 251)',
        'Dark mode must not retain the light background',
      )
      await page.screenshot({ path: '/tmp/nuxtathon-triage-dark.png' })
      await theme('Light')
      await page.waitForFunction(() => !document.documentElement.classList.contains('dark'))
      await page.getByRole('button', { name: 'More Filters', exact: true }).click()
      await page.setViewportSize({ width: 390, height: 844 })
      await page.screenshot({ path: '/tmp/nuxtathon-triage-mobile.png', fullPage: false })
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }))
      assert(dimensions.scroll <= dimensions.width, `Mobile overflow: ${JSON.stringify(dimensions)}`)
      assert.deepEqual(errors, [])
    } finally {
      await browser.close()
    }
  },
)
