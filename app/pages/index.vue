<script setup lang="ts">
import type { Dataset, PublicIssue } from '#shared/types'
import { liveEntry } from '#shared/live'
import { issuePath } from '#shared/links'
import { defaultFilters, filterIssues, type Filters } from '#shared/filters'
import { points, age } from '#shared/labels'
import { summary, time, who, steps, types } from '#shared/plain'
const { project } = useAppConfig()
const route = useRoute()
const router = useRouter()
const { data, status, error, refresh } = await useFetch<Dataset>('/data/index.json', { server: false })
const { live } = useLive()
const entry = (i: PublicIssue) => liveEntry(live.value, i.id)
const filters = reactive<Filters>({ ...defaultFilters })
function readQuery() {
  for (const key of Object.keys(defaultFilters) as (keyof Filters)[])
    filters[key] = typeof route.query[key] === 'string' ? (route.query[key] as string) : defaultFilters[key]
}
readQuery()
watch(() => route.query, readQuery)
let updateTimer: ReturnType<typeof setTimeout>
watch(filters, () => {
  clearTimeout(updateTimer)
  updateTimer = setTimeout(() => {
    const query: Record<string, string> = {}
    for (const key of Object.keys(filters) as (keyof Filters)[])
      if (filters[key] !== defaultFilters[key]) query[key] = filters[key]
    if (typeof route.query.issue === 'string') query.issue = route.query.issue
    router.replace({ query })
  }, 120)
})
onBeforeUnmount(() => clearTimeout(updateTimer))
const rows = computed(() => filterIssues(data.value?.issues ?? [], filters, live.value))
const hiddenCount = computed(() =>
  live.value && filters.availability !== 'all'
    ? filterIssues(data.value?.issues ?? [], { ...filters, availability: 'all' }, live.value).length -
      rows.value.length
    : 0,
)
const clock = (s: string) => new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const repos = computed(() => [
  { label: 'All Repositories', value: 'all' },
  ...[...new Set(data.value?.issues.map((i) => i.repo) ?? [])].sort().map((r) => ({ label: r, value: r })),
])
const selected = computed(() => data.value?.issues.find((i) => i.id === route.query.issue) ?? null)
const detailOpen = computed({
  get: () => !!selected.value,
  set: (v: boolean) => {
    if (!v) {
      const { issue, ...query } = route.query
      router.replace({ query })
    }
  },
})
function openIssue(i: PublicIssue) {
  router.replace({ query: { ...route.query, issue: i.id } })
}
const page = ref(1)
watch(rows, () => {
  page.value = 1
})
const perPage = 50
const pageRows = computed(() => rows.value.slice((page.value - 1) * perPage, page.value * perPage))
const main = useTemplateRef<HTMLElement>('main')
watch(page, () => main.value?.scrollTo({ top: 0 }))
const date = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    : 'Not collected'
const views = [
  {
    id: 'all',
    label: 'All Issues',
    icon: 'i-lucide-inbox',
    description: 'Every open issue, easiest first.',
  },
  {
    id: 'quick',
    label: 'Quick Wins',
    icon: 'i-lucide-zap',
    description: 'Anyone can start, a few hours at most, no open PR.',
  },
  {
    id: 'newcomer',
    label: 'Good First Issues',
    icon: 'i-lucide-sprout',
    description: 'Clear scope, no deep internals needed, no open PR.',
  },
  {
    id: 'closure',
    label: 'Maybe Already Fixed',
    icon: 'i-lucide-circle-check',
    description: 'Jev sees a fix, an answer or a duplicate. Check it, then ask a maintainer to close.',
  },
  {
    id: 'questions',
    label: 'Questions to Answer',
    icon: 'i-lucide-message-circle',
    description: 'Usage questions you can answer in the thread.',
  },
  {
    id: 'docs',
    label: 'Documentation',
    icon: 'i-lucide-book-open',
    description: 'Docs and examples to improve.',
  },
]
const activeView = computed(() => views.find((v) => v.id === filters.view) ?? views[0]!)
const viewCounts = computed(() =>
  Object.fromEntries(
    views.map((v) => [
      v.id,
      filterIssues(data.value?.issues ?? [], { ...defaultFilters, view: v.id }, live.value).length,
    ]),
  ),
)
const viewCount = (view: string) => viewCounts.value[view]
const showFilters = ref(false)
const copied = ref(false)
async function share() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1600)
  } catch {
    useToast().add({ title: 'Copy this page’s URL to share the current view', color: 'neutral' })
  }
}
function reset() {
  Object.assign(filters, defaultFilters)
}
const options = (all: string, entries: Record<string, string>) => [
  { label: all, value: 'all' },
  ...Object.entries(entries).map(([value, label]) => ({ label, value })),
]
const timeItems = options('Any Time', Object.fromEntries(Object.entries(time).map(([k, v]) => [k, v.long])))
const whoItems = options(
  'Anyone or Blocked',
  Object.fromEntries(Object.entries(who).map(([k, v]) => [k, v.short])),
)
const moreFilters = [
  { key: 'type' as const, label: 'Work Type', items: options('All', types) },
  {
    key: 'action' as const,
    label: 'Next Step',
    items: options('All', Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, v.label]))),
  },
  {
    key: 'skill' as const,
    label: 'Skill',
    items: options('All', {
      vue: 'Vue',
      typescript: 'TypeScript',
      css: 'CSS',
      server: 'Server',
      testing: 'Testing',
      documentation: 'Documentation',
      tooling: 'Tooling',
    }),
  },
  {
    key: 'availability' as const,
    label: 'Availability',
    items: [
      { label: 'Hide Taken', value: 'free' },
      { label: 'Hide Taken and Active', value: 'quiet' },
      { label: 'Changed During Event', value: 'changed' },
      { label: 'Show Everything', value: 'all' },
    ],
  },
  {
    key: 'eligibility' as const,
    label: 'Event Eligibility',
    items: [
      { label: 'Eligible Only', value: 'eligible' },
      { label: 'All Issues', value: 'all' },
      { label: 'Created After Cutoff', value: 'ineligible' },
    ],
  },
  {
    key: 'status' as const,
    label: 'Assessment',
    items: options('All', {
      assessed: 'Assessed',
      uncertain: 'Jev Unsure',
      unassessed: 'Not Assessed',
      failed: 'Failed',
      stale: 'Outdated',
    }),
  },
]
const filterLabels = Object.fromEntries(
  [
    { key: 'repo', items: repos.value },
    { key: 'time', items: timeItems },
    { key: 'who', items: whoItems },
    ...moreFilters,
  ].map((f) => [f.key, f]),
)
const activeFilters = computed(() =>
  (['repo', 'time', 'who', ...moreFilters.map((f) => f.key)] as (keyof Filters)[])
    .filter((k) => filters[k] !== defaultFilters[k])
    .map((k) => ({
      key: k,
      text:
        k === 'repo'
          ? filters.repo
          : (filterLabels[k]?.items.find((i: { value: string }) => i.value === filters[k])?.label ??
            filters[k]),
    })),
)
const moreCount = computed(() => moreFilters.filter((f) => filters[f.key] !== defaultFilters[f.key]).length)
const sortItems = [
  { label: 'Easiest First', value: 'easiest' },
  { label: 'Most Points', value: 'points' },
  { label: 'Recently Updated', value: 'updated' },
  { label: 'Oldest First', value: 'oldest' },
]
const number = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString('en-GB'))
</script>

<template>
  <div class="h-dvh flex flex-col bg-default text-default">
    <header
      class="h-14 shrink-0 flex items-center justify-between gap-4 border-b border-default px-4 sm:px-6"
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
        <span v-if="data" class="hidden md:block text-sm text-muted mr-3 tabular-nums">
          {{ number(data.manifest.assessed) }} of {{ number(data.manifest.issues) }} classified
        </span>
        <AgentSetup>
          <UButton aria-label="Connect Your Agent" color="neutral" variant="ghost" square class="lg:hidden">
            <template #leading><McpIcon class="size-5" /></template>
          </UButton>
        </AgentSetup>
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
        <UButton
          to="https://nuxtathon.live/"
          target="_blank"
          rel="noopener noreferrer"
          icon="i-lucide-calendar"
          aria-label="View Event"
          color="neutral"
          variant="ghost"
          class="sm:hidden"
        />
        <UButton
          to="https://nuxtathon.live/"
          target="_blank"
          rel="noopener noreferrer"
          label="View Event"
          trailing-icon="i-lucide-arrow-up-right"
          color="neutral"
          variant="ghost"
          class="hidden sm:inline-flex"
        />
      </div>
    </header>

    <div class="flex flex-1 min-h-0">
      <aside class="hidden lg:flex w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-default p-4">
        <nav aria-label="Issue Views" class="space-y-0.5">
          <p class="px-2 pb-2 text-sm font-medium text-highlighted">Views</p>
          <button
            v-for="view in views"
            :key="view.id"
            type="button"
            :aria-current="filters.view === view.id ? 'page' : undefined"
            class="w-full flex items-center gap-2.5 rounded-md px-2 h-9 text-sm text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            :class="
              filters.view === view.id
                ? 'bg-elevated text-highlighted'
                : 'text-toned hover:bg-elevated/50 hover:text-highlighted'
            "
            @click="filters.view = view.id"
          >
            <UIcon
              :name="view.icon"
              class="size-4 shrink-0"
              :class="filters.view === view.id ? 'text-primary' : 'text-dimmed'"
            />
            <span class="flex-1 truncate">{{ view.label }}</span>
            <span class="text-xs tabular-nums text-muted">{{ number(viewCount(view.id)) }}</span>
          </button>
        </nav>
        <section class="space-y-2 border-t border-default pt-5 px-2">
          <p class="text-sm font-medium text-highlighted">Nuxtathon Points</p>
          <ul class="space-y-1.5 text-sm text-muted">
            <li class="flex justify-between"><span>Closed issue</span><span class="tabular-nums">1</span></li>
            <li class="flex justify-between">
              <span>Older than 12 months</span><span class="tabular-nums">+1</span>
            </li>
            <li class="flex justify-between">
              <span>Every 5 thumbs-up</span><span class="tabular-nums">+1</span>
            </li>
          </ul>
          <p class="text-xs text-muted leading-5 pt-1">
            Issues created before 9 October. Repositories you maintain don’t count.
          </p>
        </section>
        <section class="mt-auto space-y-2.5 rounded-lg border border-default bg-elevated/40 p-2.5">
          <div class="flex gap-1">
            <AgentLogo
              v-for="item in agentClients.filter((c) => c.logo)"
              :key="item.id"
              :src="item.logo"
              size="xs"
            />
          </div>
          <p class="text-sm font-medium text-highlighted">Use It From Your Agent</p>
          <AgentSetup>
            <UButton label="Connect Your Agent" color="neutral" variant="outline" size="sm" block>
              <template #leading><McpIcon class="size-4" /></template>
            </UButton>
          </AgentSetup>
        </section>
        <section class="space-y-2 border-t border-default pt-5 px-2">
          <p class="text-sm font-medium text-highlighted">Open Source</p>
          <p class="text-sm text-muted leading-6">
            Spotted a bug or have an idea? Improvements to the app and agent tools are welcome.
          </p>
          <ULink
            :to="project.repo"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <UIcon name="i-lucide-github" class="size-4" />Contribute on GitHub
          </ULink>
        </section>
        <p class="px-2 text-xs text-muted leading-5">
          Suggestions come from Jev and need human verification. Updated
          {{ date(data?.manifest.generatedAt) }}.
        </p>
      </aside>

      <main ref="main" class="flex-1 min-w-0 overflow-y-auto">
        <div class="sticky top-0 z-10 bg-default/95 backdrop-blur border-b border-default">
          <div class="px-4 sm:px-6 pt-5 pb-4 space-y-4">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <h1 class="font-heading text-xl sm:text-2xl text-highlighted">
                  {{ filters.view === 'all' ? 'Find Your Next Contribution' : activeView.label }}
                </h1>
                <p class="mt-1 text-sm text-muted">
                  {{
                    filters.view === 'all'
                      ? 'Open issues across the Nuxt ecosystem, worth fixing, answering or closing.'
                      : activeView.description
                  }}
                </p>
              </div>
              <UButton
                :icon="copied ? 'i-lucide-check' : 'i-lucide-link'"
                :label="copied ? 'Copied' : 'Share View'"
                color="neutral"
                variant="outline"
                class="shrink-0"
                @click="share"
              />
            </div>
            <section aria-label="Issue Filters" class="flex flex-wrap items-center gap-2">
              <UInput
                v-model="filters.q"
                icon="i-lucide-search"
                placeholder="Search titles, bodies, labels…"
                aria-label="Search Issues"
                class="flex-1 min-w-full sm:min-w-64"
              />
              <USelectMenu
                v-model="filters.repo"
                :items="repos"
                value-key="value"
                aria-label="Repository"
                class="w-full sm:w-60"
              />
              <USelect
                v-model="filters.time"
                :items="timeItems"
                aria-label="Time Needed"
                icon="i-lucide-clock"
                class="flex-1 sm:flex-none sm:w-44"
              />
              <USelect
                v-model="filters.who"
                :items="whoItems"
                aria-label="Who Can Act"
                icon="i-lucide-user"
                class="flex-1 sm:flex-none sm:w-52"
              />
              <UButton
                icon="i-lucide-sliders-horizontal"
                label="More Filters"
                color="neutral"
                :variant="showFilters ? 'subtle' : 'outline'"
                :aria-expanded="showFilters"
                aria-controls="advanced-filters"
                @click="showFilters = !showFilters"
              >
                <template #trailing>
                  <UBadge v-if="moreCount" size="sm" color="primary" variant="soft">{{ moreCount }}</UBadge>
                </template>
              </UButton>
            </section>
            <div
              v-if="showFilters"
              id="advanced-filters"
              class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 rounded-lg border border-default bg-muted/40 p-4"
            >
              <UFormField v-for="field in moreFilters" :key="field.key" :label="field.label"
                ><USelect
                  v-model="filters[field.key]"
                  :items="field.items"
                  :aria-label="field.label"
                  class="w-full"
              /></UFormField>
              <div class="flex items-end">
                <UButton
                  label="Reset All"
                  icon="i-lucide-rotate-ccw"
                  variant="ghost"
                  color="neutral"
                  @click="reset"
                />
              </div>
            </div>
            <div v-if="activeFilters.length" class="flex flex-wrap items-center gap-2">
              <UButton
                v-for="f in activeFilters"
                :key="f.key"
                :label="f.text"
                trailing-icon="i-lucide-x"
                size="xs"
                color="neutral"
                variant="soft"
                :aria-label="`Remove filter ${f.text}`"
                @click="filters[f.key] = defaultFilters[f.key]"
              />
            </div>
          </div>
          <nav aria-label="Mobile Issue Views" class="lg:hidden flex gap-1 overflow-x-auto px-4 pb-3">
            <UButton
              v-for="view in views"
              :key="view.id"
              :label="view.label"
              :icon="view.icon"
              size="sm"
              color="neutral"
              :variant="filters.view === view.id ? 'subtle' : 'ghost'"
              class="shrink-0"
              :aria-pressed="filters.view === view.id"
              @click="filters.view = view.id"
            />
          </nav>
        </div>

        <div class="px-4 sm:px-6 py-4 space-y-4">
          <UAlert
            v-if="error"
            title="Unable to Load the Snapshot"
            description="The dataset could not be loaded. Retry to fetch the current snapshot."
            color="error"
            variant="subtle"
          >
            <template #actions
              ><UButton label="Retry Loading" variant="subtle" color="neutral" size="sm" @click="refresh()"
            /></template>
          </UAlert>
          <UAlert
            v-else-if="data && !data.manifest.assessed"
            color="neutral"
            variant="subtle"
            :title="data.manifest.issues ? 'Collected, Not Yet Classified' : 'No Snapshot Yet'"
            :description="
              data.manifest.issues
                ? 'Browse the GitHub evidence now. Model suggestions will appear after the local Jev run.'
                : 'Run the local collector and export a dataset to populate this explorer.'
            "
          />

          <section aria-label="Issue Results">
            <div class="flex items-center justify-between gap-3 pb-3">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                <p aria-live="polite">
                  <span class="text-highlighted tabular-nums">{{ number(rows.length) }}</span>
                  {{ rows.length === 1 ? 'issue' : 'issues' }}
                </p>
                <template v-if="hiddenCount">
                  <span class="text-dimmed" aria-hidden="true">·</span>
                  <span
                    ><span class="tabular-nums">{{ number(hiddenCount) }}</span>
                    {{ filters.availability === 'changed' ? 'unchanged' : 'taken' }} hidden</span
                  >
                  <UButton
                    label="Show"
                    size="xs"
                    color="neutral"
                    variant="link"
                    class="px-0"
                    @click="filters.availability = 'all'"
                  />
                </template>
                <template v-if="live">
                  <span class="text-dimmed" aria-hidden="true">·</span>
                  <UTooltip
                    text="Closed issues, new pull requests, assignees and nuxtathon.live credits, refreshed every 10 minutes."
                  >
                    <span class="flex items-center gap-1.5"
                      ><span class="size-1.5 rounded-full bg-primary" aria-hidden="true" />Live status
                      {{ clock(live.generatedAt) }}</span
                    >
                  </UTooltip>
                </template>
              </div>
              <USelect
                v-model="filters.sort"
                :items="sortItems"
                aria-label="Sort Issues"
                icon="i-lucide-arrow-down-wide-narrow"
                variant="ghost"
                class="w-48"
              />
            </div>
            <div class="rounded-lg border border-default overflow-hidden">
              <div
                class="hidden md:grid grid-cols-[minmax(0,1fr)_11rem_4rem_4rem] gap-4 px-4 py-2.5 bg-muted/40 border-b border-default text-xs font-medium text-muted"
              >
                <span>Issue</span><span>What to Do</span><span class="text-right">Points</span
                ><span class="text-right">Age</span>
              </div>
              <div v-if="status === 'pending' || status === 'idle'" class="divide-y divide-default">
                <div v-for="n in 8" :key="n" class="px-4 py-4 space-y-2">
                  <USkeleton class="h-3 w-40" /><USkeleton class="h-4 w-2/3" />
                </div>
              </div>
              <div v-else-if="pageRows.length" class="divide-y divide-default">
                <article
                  v-for="issue in pageRows"
                  :key="issue.id"
                  class="relative grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_11rem_4rem_4rem] gap-x-4 gap-y-2 px-4 py-3.5 items-center transition-colors hover:bg-elevated/50"
                  :class="route.query.issue === issue.id && 'bg-elevated/60'"
                >
                  <div class="min-w-0 space-y-1.5">
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span class="text-toned"
                        >{{ issue.repo }} <span class="tabular-nums">#{{ issue.number }}</span></span
                      >
                      <span v-if="issue.commentCount" class="flex items-center gap-1"
                        ><UIcon name="i-lucide-message-square" class="size-3.5" />{{ issue.commentCount
                        }}<span class="sr-only">comments</span></span
                      >
                      <span v-if="issue.thumbsUp" class="flex items-center gap-1"
                        ><UIcon name="i-lucide-thumbs-up" class="size-3.5" />{{ issue.thumbsUp
                        }}<span class="sr-only">thumbs-up</span></span
                      >
                      <LiveBadge v-if="entry(issue)" :entry="entry(issue)!" />
                      <span
                        v-else-if="issue.prs.some((p) => p.state === 'OPEN')"
                        class="flex items-center gap-1 text-primary"
                        ><UIcon name="i-lucide-git-pull-request" class="size-3.5" />Open PR</span
                      >
                    </div>
                    <button
                      type="button"
                      class="block text-left text-[15px] leading-6 font-medium text-highlighted line-clamp-2 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-primary focus-visible:after:-outline-offset-2"
                      @click="openIssue(issue)"
                    >
                      {{ issue.title }}
                    </button>
                    <p
                      v-if="summary(issue)"
                      class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-toned"
                    >
                      <span v-if="summary(issue)!.time" class="flex items-center gap-1.5"
                        ><UIcon name="i-lucide-clock" class="size-3.5 text-dimmed" />{{
                          summary(issue)!.time!.short
                        }}</span
                      >
                      <span
                        v-if="summary(issue)!.time && summary(issue)!.who"
                        class="text-dimmed"
                        aria-hidden="true"
                        >·</span
                      >
                      <span
                        v-if="summary(issue)!.who"
                        class="flex items-center gap-1.5"
                        :class="summary(issue)!.who!.open && 'text-primary'"
                        ><UIcon
                          :name="summary(issue)!.who!.open ? 'i-lucide-user-check' : 'i-lucide-hourglass'"
                          class="size-3.5"
                          :class="!summary(issue)!.who!.open && 'text-dimmed'"
                        />{{ summary(issue)!.who!.short }}</span
                      >
                      <span v-if="summary(issue)!.sure === 'Unsure'" class="text-muted">Jev is unsure</span>
                      <span class="md:hidden flex items-center gap-1.5 text-muted"
                        ><span class="text-dimmed" aria-hidden="true">·</span
                        >{{ summary(issue)!.step.label }}</span
                      >
                    </p>
                    <p v-else class="text-sm text-muted">
                      {{ issue.status === 'stale' ? 'Assessment outdated' : 'Not assessed yet' }}
                    </p>
                  </div>
                  <div class="hidden md:flex items-center gap-2 text-sm text-toned">
                    <template v-if="summary(issue)">
                      <UIcon :name="summary(issue)!.step.icon" class="size-4 shrink-0 text-dimmed" />{{
                        summary(issue)!.step.label
                      }}
                    </template>
                    <span v-else class="flex items-center gap-2 text-muted"
                      ><UIcon name="i-lucide-circle-dashed" class="size-4" />Not Assessed</span
                    >
                  </div>
                  <div class="text-right">
                    <span
                      class="inline-flex items-center justify-center min-w-8 h-6 px-1.5 rounded-md text-sm tabular-nums"
                      :class="points(issue) > 1 ? 'bg-primary/10 text-primary' : 'text-muted'"
                      :title="`${points(issue)} Nuxtathon points if closed`"
                      >{{ points(issue) }}<span class="sr-only"> points</span></span
                    >
                  </div>
                  <div
                    class="hidden md:block text-right text-sm text-muted tabular-nums"
                    :title="date(issue.createdAt)"
                  >
                    {{ age(issue.ageDays) }}
                  </div>
                </article>
              </div>
              <div v-else class="py-16 px-6 text-center space-y-3">
                <h2 class="text-lg text-highlighted">
                  {{ data?.issues.length ? 'No Issues Match This View' : 'No Issues Collected Yet' }}
                </h2>
                <p class="text-sm text-muted">
                  {{
                    filters.view !== 'all' && !data?.manifest.assessed
                      ? 'This view needs Jev assessments. Browse all issues while classification is pending.'
                      : 'Try a broader search or reset the filters.'
                  }}
                </p>
                <UButton label="Reset View" color="neutral" variant="subtle" @click="reset" />
              </div>
            </div>
            <div v-if="rows.length > perPage" class="flex justify-center pt-4">
              <UPagination v-model:page="page" :total="rows.length" :items-per-page="perPage" />
            </div>
          </section>
        </div>
      </main>
    </div>

    <USlideover
      v-model:open="detailOpen"
      :title="selected?.title ?? 'Issue Details'"
      :description="selected ? `${selected.repo} #${selected.number}` : ''"
      :ui="{
        content: 'sm:max-w-2xl',
        header: 'px-6 py-5',
        body: 'p-6',
        title: 'font-heading text-xl leading-7 text-highlighted',
        description: 'text-sm',
      }"
    >
      <template #actions>
        <UButton
          v-if="selected"
          :to="issuePath(selected)"
          color="neutral"
          variant="ghost"
          icon="i-lucide-maximize-2"
          aria-label="Open as a Page"
        />
      </template>
      <template #body><IssueDetail v-if="selected" :issue="selected" :live="entry(selected)" /></template>
    </USlideover>
  </div>
</template>
