<script setup lang="ts">
withDefaults(defineProps<{ src?: string; size?: 'sm' | 'md' }>(), { size: 'md' })
</script>

<template>
  <!-- Brand marks keep their own colours, so they always sit on white. -->
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-inset ring-black/10 dark:ring-white/10"
    :class="size === 'sm' ? 'size-7 p-1.5' : 'size-10 p-2'"
  >
    <img v-if="src" :src="src" alt="" class="size-full object-contain" />
    <McpIcon v-else class="size-full text-neutral-900" />
  </span>
</template>
