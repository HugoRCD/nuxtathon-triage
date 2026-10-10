import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseMarkdown } from 'comark'
import { cleanMarkdown, markdownOptions, markdownPlugins } from '../shared/markdown.ts'

async function render(text: string, ctx?: Parameters<typeof markdownPlugins>[0]) {
  const doc = await parseMarkdown(cleanMarkdown(text), { ...markdownOptions, plugins: markdownPlugins(ctx) })
  return JSON.stringify(doc.nodes)
}

test('hostile HTML is dropped or neutralised', async () => {
  const out = await render(
    [
      '<script>alert(1)</script>',
      '',
      '<iframe src="https://evil.example"></iframe>',
      '',
      '<style>body{display:none}</style>',
      '',
      '<img src="x" onerror="alert(1)">',
      '',
      '<a href="javascript:alert(1)">js</a>',
      '',
      '<p style="position:fixed" id="x" class="evil" onclick="a()">styled</p>',
      '',
      '[bad](javascript:alert(1))',
      '',
      '![d](data:image/png;base64,AAA)',
    ].join('\n'),
  )
  for (const needle of [
    '"script"',
    '"iframe"',
    'display:none',
    '"onerror"',
    '"onclick"',
    '"href":"javascript',
    '"style"',
    '"id"',
    '"class":"evil"',
    'data:image',
  ])
    assert.ok(!out.includes(needle), needle)
  assert.ok(out.includes('styled'))
})

test('GitHub Markdown features render', async () => {
  const out = await render(
    '<!-- template -->\r\n### Steps\r\none\r\ntwo\r\n\r\n> [!WARNING]\r\n> careful\r\n\r\n- [x] done\r\n\r\n| a |\r\n|---|\r\n| 1 |\r\n\r\n```ts\r\nconst x = 1\r\n```\r\n\r\n<details><summary>Logs</summary>\r\n\r\nbody\r\n</details>\r\n\r\nSee https://nuxt.com',
  )
  assert.ok(!out.includes('template'), 'comments removed')
  assert.ok(out.includes('["h5",{},"Steps"]'), 'headings shrink')
  assert.ok(out.includes('"br"'), 'single newlines break like GitHub')
  assert.ok(out.includes('["warning",{},"careful"]'), 'alerts become callouts')
  assert.ok(out.includes('task-list-item-checkbox'))
  assert.ok(out.includes('"table"'))
  assert.ok(out.includes('"language":"ts"'))
  assert.ok(out.includes('["strong",{},"Logs"]'), 'details summary becomes a label')
  assert.ok(out.includes('"href":"https://nuxt.com","target":"_blank","rel":"noopener noreferrer nofollow"'))
})

test('code blocks are highlighted with GitHub themes, after sanitising', async () => {
  const out = await render(
    '```ts\nconst x: number = 1\n```\n\n```notalang\nkept\n```\n\n<pre style="color:red"><span style="x">raw</span></pre>',
  )
  assert.ok(out.includes('github-light github-dark'), 'GitHub themes')
  assert.ok(/"style":"color:#[0-9A-F]{6};--shiki-dark:#[0-9A-F]{6}"/.test(out), 'token colours survive')
  assert.ok(out.includes('kept'), 'unknown language falls back to plain code')
  assert.ok(!out.includes('color:red') && !out.includes('"style":"x"'), 'user styles still stripped')
})

test('GitHub references and thread mentions become links', async () => {
  const out = await render(
    'Fixed in #12 and nuxt/ui#3, thanks @danielroe, not @someone or @nuxt/kit.\n\nhttps://github.com/nuxt/nuxt/issues/99#issuecomment-1\n\n`#7 @danielroe`',
    { repo: 'nuxt/nuxt', people: ['danielroe'] },
  )
  assert.ok(out.includes('["a",{"href":"https://github.com/nuxt/nuxt/issues/12"'))
  assert.ok(out.includes('"nuxt/ui#3"'))
  assert.ok(out.includes('{"href":"https://github.com/danielroe"'))
  assert.ok(!out.includes('github.com/someone') && !out.includes('github.com/nuxt/kit'), 'only participants')
  assert.ok(out.includes('"#99 (comment)"'), 'GitHub URLs read like GitHub')
  assert.ok(out.includes('["code",{},"#7 @danielroe"]'), 'inline code stays literal')
})
