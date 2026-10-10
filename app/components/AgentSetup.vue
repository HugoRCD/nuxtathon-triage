<script setup lang="ts">
const { project } = useAppConfig()
const name = project.mcpName

// Use the current origin so previews and local dev point at their own server.
const origin = ref(project.site)
onMounted(() => {
  origin.value = window.location.origin
})
const url = computed(() => `${origin.value}/mcp`)

const client = ref<AgentClientId>('claude-code')
const current = computed(() => agentClients.find((c) => c.id === client.value)!)

const json = (value: unknown) => JSON.stringify(value, null, 2)
const cursorLink = computed(
  () =>
    `cursor://anysphere.cursor-deeplink/mcp/install?name=${name}&config=${encodeURIComponent(btoa(JSON.stringify({ url: url.value })))}`,
)
const vscodeLink = computed(
  () => `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name, type: 'http', url: url.value }))}`,
)

const install = computed(() => {
  switch (client.value) {
    case 'cursor':
      return {
        link: cursorLink.value,
        file: '.cursor/mcp.json',
        config: json({ mcpServers: { [name]: { url: url.value } } }),
      }
    case 'vscode':
      return {
        link: vscodeLink.value,
        file: '.vscode/mcp.json',
        config: json({ servers: { [name]: { type: 'http', url: url.value } } }),
      }
    default:
      return undefined
  }
})

const command = computed(() => {
  if (client.value === 'claude-code') return `claude mcp add --transport http ${name} ${url.value}`
  if (client.value === 'codex') return `codex mcp add ${name} --url ${url.value}`
  return undefined
})

const prompt = `Use the ${name} MCP server to find three easy Nuxt issues that count for Nuxtathon. When I pick one, read the thread, check on GitHub that nobody has a pull request open, then help me fix it.`
</script>

<template>
  <UModal
    title="Connect Your Coding Agent"
    description="Search these issues and read their threads from your editor or terminal."
    :ui="{
      content: 'sm:max-w-2xl',
      header: 'px-6 pt-6 pb-5',
      body: 'p-6 space-y-7',
      footer: 'px-6 py-4',
      title: 'font-heading text-xl leading-7 text-highlighted',
      description: 'text-sm',
    }"
  >
    <slot />

    <template #body>
      <div
        role="group"
        aria-label="Coding agent"
        class="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0 sm:pb-0"
      >
        <button
          v-for="item in agentClients"
          :key="item.id"
          type="button"
          :aria-pressed="client === item.id"
          class="flex w-26 shrink-0 flex-col items-center gap-2 rounded-lg border px-2 sm:w-auto pt-3 pb-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary"
          :class="
            client === item.id
              ? 'border-primary bg-primary/5 text-highlighted'
              : 'border-default text-toned hover:bg-elevated/50 hover:text-highlighted'
          "
          @click="client = item.id"
        >
          <AgentLogo :src="item.logo" />
          <span class="whitespace-nowrap">{{ item.label }}</span>
        </button>
      </div>

      <section class="space-y-3">
        <h3 class="flex items-center gap-2.5 text-sm font-medium text-highlighted">
          <span class="grid place-items-center size-6 rounded-full bg-elevated text-sm tabular-nums">1</span>
          Add the Server
        </h3>

        <template v-if="command">
          <p class="text-sm text-muted">Run this in your terminal:</p>
          <CopyBlock :label="`${current.label} command`" :value="command" prompt />
        </template>

        <template v-else-if="install">
          <div class="flex flex-wrap items-center gap-3">
            <UButton :to="install.link" external color="neutral" variant="outline" size="lg">
              <template #leading><AgentLogo :src="current.logo" size="sm" class="-ml-1" /></template>
              Add to {{ current.label }}
            </UButton>
            <span class="text-sm text-muted">Opens {{ current.label }} and adds the server.</span>
          </div>
          <UCollapsible :ui="{ content: 'pt-3 space-y-2' }">
            <UButton
              label="Or Add It by Hand"
              trailing-icon="i-lucide-chevron-down"
              color="neutral"
              variant="link"
              class="px-0 text-muted"
              :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform' }"
            />
            <template #content>
              <p class="text-sm text-muted">
                Add this to <code class="font-mono text-highlighted">{{ install.file }}</code
                >:
              </p>
              <CopyBlock :label="`${current.label} config`" :value="install.config" />
            </template>
          </UCollapsible>
        </template>

        <template v-else>
          <p class="text-sm text-muted">
            Add a remote MCP server with this URL. Apps with connectors call it a custom connector.
          </p>
          <CopyBlock label="Server URL" :value="url" />
        </template>
      </section>

      <section class="space-y-3">
        <h3 class="flex items-center gap-2.5 text-sm font-medium text-highlighted">
          <span class="grid place-items-center size-6 rounded-full bg-elevated text-sm tabular-nums">2</span>
          Ask Your Agent
        </h3>
        <CopyBlock label="Prompt" :value="prompt" prose />
      </section>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-muted">
        <span class="flex items-center gap-2">
          <UIcon name="i-lucide-shield-check" class="size-4 text-primary" />
          Read-only. No sign-in or API key.
        </span>
        <ULink
          :to="project.repo"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 hover:text-highlighted"
        >
          Improve the Tools <UIcon name="i-lucide-arrow-up-right" class="size-4" />
        </ULink>
      </div>
    </template>
  </UModal>
</template>
