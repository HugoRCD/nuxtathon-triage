<script setup lang="ts">
import { cleanMarkdown, markdownOptions, markdownPlugins } from '#shared/markdown'

const props = defineProps<{
  value: string | null | undefined
  empty?: string
  /** `owner/repo`, so `#123` links to the right repository. */
  repo?: string
  /** Thread participants; only these `@mentions` become links. */
  people?: string[]
}>()
const text = computed(() => cleanMarkdown(props.value))
const plugins = markdownPlugins({ repo: props.repo, people: props.people })
</script>

<template>
  <div class="issue-markdown text-sm leading-6 text-default">
    <p v-if="!text" class="text-muted">{{ empty ?? 'No description provided.' }}</p>
    <Suspense v-else>
      <Markdown :value="text" :options="markdownOptions" :plugins="plugins" />
      <template #fallback>
        <p class="evidence-text">{{ text }}</p>
      </template>
    </Suspense>
  </div>
</template>
