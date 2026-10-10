<script setup lang="ts">
import type { PublicIssue } from '#shared/types'
import { liveEntry } from '#shared/live'
import { SITE, issuePath } from '#shared/links'

const route = useRoute()
const { project } = useAppConfig()
const path = computed(() => `${route.params.owner}/${route.params.repo}/${route.params.number}`)
const { data: issue, error } = await useFetch<PublicIssue>(() => `/api/issues/${path.value}`)
const { live } = useLive()
const entry = computed(() => (issue.value ? liveEntry(live.value, issue.value.id) : undefined))

if (error.value?.statusCode === 404)
  throw createError({ statusCode: 404, statusMessage: 'This issue is not in the snapshot', fatal: true })

useSeoMeta({
  title: () => (issue.value ? `${issue.value.title} · ${issue.value.repo}#${issue.value.number}` : 'Issue'),
  description: () =>
    issue.value
      ? `${issue.value.repo}#${issue.value.number} on the Nuxtathon Issue Explorer: what to do next, how long it may take and the full thread.`
      : undefined,
  ogTitle: () =>
    issue.value ? `${issue.value.repo}#${issue.value.number}: ${issue.value.title}` : undefined,
  ogUrl: () => (issue.value ? `${SITE}${issuePath(issue.value)}` : undefined),
})

/** Return to the list the visitor came from, filters included. */
const listTo = ref('/')
onMounted(() => {
  const back = useRouter().options.history.state.back
  if (typeof back === 'string' && back.split('?')[0] === '/') listTo.value = back
})

const copied = ref(false)
async function share() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    useToast().add({ title: 'Copy this page’s URL to share it', color: 'neutral' })
  }
}
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <header
      class="sticky top-0 z-10 h-14 shrink-0 flex items-center justify-between gap-4 border-b border-default bg-default/90 backdrop-blur px-4 sm:px-6"
    >
      <NuxtLink
        to="/"
        aria-label="Nuxtathon Issue Explorer"
        class="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-primary"
      >
        <img src="/brand/nuxt-icon.svg" width="28" height="28" alt="Nuxt" class="size-7" />
        <span class="font-heading text-lg text-highlighted">Nuxtathon</span>
        <span class="hidden sm:block text-sm text-muted">Issue Explorer</span>
      </NuxtLink>
      <div class="flex items-center gap-1">
        <ThemeMenu />
        <UButton
          :to="project.repo"
          target="_blank"
          rel="noopener noreferrer"
          icon="i-lucide-github"
          aria-label="Source on GitHub"
          color="neutral"
          variant="ghost"
        />
      </div>
    </header>

    <main class="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div class="mb-3 flex items-center justify-between gap-3">
        <UButton :to="listTo" color="neutral" variant="link" icon="i-lucide-arrow-left" class="-ml-2.5"
          >All Issues</UButton
        >
        <UButton
          v-if="issue"
          :icon="copied ? 'i-lucide-check' : 'i-lucide-link'"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="share"
          >{{ copied ? 'Copied' : 'Copy Link' }}</UButton
        >
      </div>

      <template v-if="issue">
        <div class="mb-5 space-y-1">
          <p class="text-sm text-muted">
            <a
              :href="`https://github.com/${issue.repo}`"
              target="_blank"
              rel="noopener noreferrer"
              class="hover:underline"
              >{{ issue.repo }}</a
            >
            <span class="tabular-nums"> #{{ issue.number }}</span>
          </p>
          <h1 class="font-heading text-xl sm:text-2xl leading-tight text-highlighted text-balance">
            {{ issue.title }}
          </h1>
        </div>
        <IssueDetail :issue="issue" :live="entry" split />
      </template>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Couldn’t load this issue"
        :description="error.statusMessage || 'Try again in a moment.'"
      />
    </main>
  </div>
</template>
