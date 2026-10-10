<script setup lang="ts">
const props = defineProps<{ value: string; label: string; prose?: boolean; prompt?: boolean }>()

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  await navigator.clipboard.writeText(props.value)
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (copied.value = false), 2000)
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="group relative flex items-start rounded-lg border border-default bg-elevated/50">
    <pre
      class="flex-1 min-w-0 py-3 pl-4 pr-1 text-sm leading-6 text-highlighted whitespace-pre-wrap [overflow-wrap:anywhere]"
      :class="prose ? 'font-sans' : 'font-mono'"
    ><span v-if="prompt" class="select-none text-dimmed">$ </span><code class="font-[inherit]">{{ value }}</code></pre>
    <UButton
      :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
      :aria-label="copied ? `${label} copied` : `Copy ${label}`"
      color="neutral"
      variant="ghost"
      size="sm"
      class="shrink-0 m-2"
      :class="copied && 'text-primary'"
      @click="copy"
    />
    <span class="sr-only" aria-live="polite">{{ copied ? `${label} copied` : '' }}</span>
  </div>
</template>
