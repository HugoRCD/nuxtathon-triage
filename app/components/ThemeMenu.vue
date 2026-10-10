<script setup lang="ts">
const colorMode = useColorMode()

const modes = [
  { value: 'system', label: 'System', icon: 'i-lucide-monitor' },
  { value: 'light', label: 'Light', icon: 'i-lucide-sun' },
  { value: 'dark', label: 'Dark', icon: 'i-lucide-moon' },
] as const

const current = computed(() => modes.find((m) => m.value === colorMode.preference) ?? modes[1])

const items = computed(() =>
  modes.map((m) => ({
    label: m.label,
    icon: m.icon,
    type: 'checkbox' as const,
    checked: colorMode.preference === m.value,
    onSelect: () => {
      colorMode.preference = m.value
    },
  })),
)
</script>

<template>
  <ClientOnly>
    <UDropdownMenu :items="items" :content="{ align: 'end' }">
      <UButton :icon="current.icon" :aria-label="`Theme: ${current.label}`" color="neutral" variant="ghost" />
    </UDropdownMenu>
    <template #fallback>
      <UButton icon="i-lucide-sun" aria-label="Theme" color="neutral" variant="ghost" disabled />
    </template>
  </ClientOnly>
</template>
