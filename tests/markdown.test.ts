import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseMarkdown } from 'comark'
import { cleanMarkdown, markdownOptions, markdownPlugins } from '../shared/markdown.ts'

async function render(text: string) {
  const doc = await parseMarkdown(cleanMarkdown(text), { ...markdownOptions, plugins: markdownPlugins() })
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
