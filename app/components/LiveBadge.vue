<script setup lang="ts">
import { describeLive, liveLabels, type LiveEntry } from '#shared/live'
const props = defineProps<{ entry: LiveEntry }>()
const meta = computed(() => liveLabels[props.entry.state])
const by = computed(() => (props.entry.by && props.entry.state !== 'active' ? props.entry.by : ''))
</script>

<template>
  <UTooltip :text="describeLive(entry)">
    <UBadge
      :icon="meta.icon"
      :color="meta.color"
      variant="subtle"
      size="sm"
      class="relative z-[1] cursor-default"
    >
      {{ meta.label }}<template v-if="by"> · @{{ by }}</template>
      <span class="sr-only">. {{ describeLive(entry) }}</span>
    </UBadge>
  </UTooltip>
</template>
