<script setup lang="ts">
const props = defineProps<{ value: string; label: string; wrap?: boolean }>()

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
  <div class="flex items-start gap-1 rounded-md border border-default bg-muted">
    <pre
      class="flex-1 min-w-0 py-2.5 pl-3 text-sm leading-6 text-highlighted"
      :class="wrap ? 'font-sans whitespace-pre-wrap break-words' : 'font-mono overflow-x-auto'"
    ><code class="font-[inherit]">{{ value }}</code></pre>
    <UButton
      :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
      :aria-label="copied ? `${label} copied` : `Copy ${label}`"
      color="neutral"
      variant="ghost"
      size="sm"
      class="shrink-0 m-1.5"
      :class="copied && 'text-primary'"
      @click="copy"
    />
    <span class="sr-only" aria-live="polite">{{ copied ? `${label} copied` : '' }}</span>
  </div>
</template>
