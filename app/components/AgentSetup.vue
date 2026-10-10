<script setup lang="ts">
const { project } = useAppConfig()
const name = project.mcpName

// Use the current origin so previews and local dev point at their own server.
const origin = ref(project.site)
onMounted(() => {
  origin.value = window.location.origin
})
const url = computed(() => `${origin.value}/mcp`)

const clients = [
  { label: 'Claude Code', value: 'claude-code' },
  { label: 'Cursor', value: 'cursor' },
  { label: 'VS Code', value: 'vscode' },
  { label: 'Codex', value: 'codex' },
  { label: 'Other', value: 'other' },
]
const client = ref('claude-code')

const json = (value: unknown) => JSON.stringify(value, null, 2)
const cursorLink = computed(
  () =>
    `cursor://anysphere.cursor-deeplink/mcp/install?name=${name}&config=${encodeURIComponent(btoa(JSON.stringify({ url: url.value })))}`,
)
const vscodeLink = computed(
  () => `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name, type: 'http', url: url.value }))}`,
)

const prompt = `Use the ${name} MCP server to find three easy Nuxt issues that count for Nuxtathon and explain each in a sentence. When I pick one, read the full thread, check on GitHub that nobody has a pull request open, then help me fix it.`
</script>

<template>
  <UModal
    title="Connect Your Coding Agent"
    description="Let your agent search and read these issues for you. Read-only, with no sign-in or API key."
    :ui="{
      content: 'sm:max-w-xl',
      header: 'px-6 py-5',
      body: 'p-6 space-y-6',
      title: 'font-heading text-xl leading-7 text-highlighted',
      description: 'text-sm',
    }"
  >
    <UButton
      label="Connect Your Agent"
      icon="i-lucide-bot"
      color="neutral"
      variant="ghost"
      :ui="{ label: 'hidden sm:inline' }"
      aria-label="Connect Your Coding Agent"
    />

    <template #body>
      <section class="space-y-3">
        <h3 class="text-sm font-medium text-highlighted">1. Add the Server</h3>
        <UTabs
          v-model="client"
          :items="clients"
          :content="false"
          variant="link"
          size="sm"
          :ui="{ list: 'overflow-x-auto gap-5', trigger: 'px-0' }"
        />

        <div v-if="client === 'claude-code'" class="space-y-2">
          <p class="text-sm text-muted">Run this in your terminal:</p>
          <CopyBlock label="Claude Code command" :value="`claude mcp add --transport http ${name} ${url}`" />
        </div>

        <div v-else-if="client === 'cursor'" class="space-y-3">
          <UButton :to="cursorLink" external label="Add to Cursor" trailing-icon="i-lucide-arrow-up-right" />
          <p class="text-sm text-muted">Or add it to <code class="font-mono">.cursor/mcp.json</code>:</p>
          <CopyBlock label="Cursor config" :value="json({ mcpServers: { [name]: { url } } })" />
        </div>

        <div v-else-if="client === 'vscode'" class="space-y-3">
          <UButton :to="vscodeLink" external label="Add to VS Code" trailing-icon="i-lucide-arrow-up-right" />
          <p class="text-sm text-muted">Or add it to <code class="font-mono">.vscode/mcp.json</code>:</p>
          <CopyBlock label="VS Code config" :value="json({ servers: { [name]: { type: 'http', url } } })" />
        </div>

        <div v-else-if="client === 'codex'" class="space-y-2">
          <p class="text-sm text-muted">Run this in your terminal:</p>
          <CopyBlock label="Codex command" :value="`codex mcp add ${name} --url ${url}`" />
        </div>

        <div v-else class="space-y-2">
          <p class="text-sm text-muted">
            Most clients accept a remote server in their MCP config. In apps with connectors, add a custom
            connector with the server URL.
          </p>
          <CopyBlock label="Server URL" :value="url" />
          <CopyBlock label="MCP config" :value="json({ mcpServers: { [name]: { url } } })" />
        </div>
      </section>

      <section class="space-y-2">
        <h3 class="text-sm font-medium text-highlighted">2. Ask Your Agent</h3>
        <CopyBlock label="Prompt" :value="prompt" wrap />
      </section>

      <p class="text-sm text-muted leading-6">
        The agent gets three tools, <code class="font-mono">get_overview</code>,
        <code class="font-mono">search_issues</code> and <code class="font-mono">get_issue</code>, over the
        same snapshot as this page. It can’t change anything on GitHub.
        <ULink
          :to="project.repo"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary hover:underline"
          >Improve the tools on GitHub ↗</ULink
        >
      </p>
    </template>
  </UModal>
</template>
