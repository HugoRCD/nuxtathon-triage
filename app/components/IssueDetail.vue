<script setup lang="ts">
import type { PublicIssue, Assessment } from '#shared/types'
import { choice, probability, score, difficulty } from '#shared/filters'
import { questionLabels, label, scoreLabels, skillKeys, points, age } from '#shared/labels'
import { summary, why } from '#shared/plain'
import { describeLive, liveLabels, type LiveEntry } from '#shared/live'
const props = defineProps<{ issue: PublicIssue; live?: LiveEntry }>()
const plain = computed(() => summary(props.issue))
const { project } = useAppConfig()
const reportUrl = computed(() => {
  const ref = `${props.issue.repo}#${props.issue.number}`
  const params = new URLSearchParams({
    title: `Wrong classification: ${ref}`,
    body: `Issue: ${props.issue.url}\n\nWhat looks wrong:\n\nWhat it should say:\n`,
  })
  return `${project.repo}/issues/new?${params}`
})
const reasons = computed(() => why(props.issue.assessment?.answers))
const sureText = {
  Confident: 'Jev is confident about this.',
  'Fairly Sure': 'Jev is fairly sure. Skim the thread to confirm.',
  Unsure: 'Jev is unsure. Read the thread before picking it up.',
}
const assessmentTab = ref('latest')
watch(
  () => props.issue.id,
  () => {
    assessmentTab.value = 'latest'
  },
)
const selected = computed<Assessment | null>(() =>
  assessmentTab.value === 'first' ? props.issue.firstPass : props.issue.assessment,
)
const date = (s: string) =>
  new Date(s).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
const confidence = (key: string) => {
  const a = selected.value?.answers[key]
  return a?.type === 'choice' && a.probabilities
    ? Math.round((a.probabilities[a.choice] ?? 0) * 100)
    : undefined
}
const glance = computed(() => {
  const a = selected.value?.answers
  if (!a) return []
  const scoreText = (key: string) => {
    const n = score(a, key)
    return n === undefined ? 'Unknown' : (scoreLabels[key]?.[Math.min(3, Math.round(n))] ?? n.toFixed(1))
  }
  const size = difficulty(props.issue)
  return [
    { title: 'Work Type', value: label('workType', choice(a, 'workType')), conf: confidence('workType') },
    { title: 'Newcomer Fit', value: label('newcomer', choice(a, 'newcomer')), conf: confidence('newcomer') },
    {
      title: 'Closure Suggestion',
      value: label('closure', choice(a, 'closure')),
      conf: confidence('closure'),
    },
    {
      title: 'Implementation Size',
      value: size === 'unknown' ? 'Not enough evidence' : scoreText('difficulty'),
      conf: undefined,
    },
    { title: 'Investigation Remaining', value: scoreText('investigation'), conf: undefined },
  ]
})
const signalKeys = [
  'hasReproduction',
  'hasSolution',
  'maintainerGuidance',
  'missingRepro',
  'upstream',
  'designDecision',
  'contradictoryFixReports',
]
const signals = computed(() =>
  signalKeys
    .map((key) => ({ key, title: questionLabels[key]!, p: probability(selected.value?.answers, key) }))
    .filter((s) => s.p !== undefined)
    .map((s) => ({
      ...s,
      pct: Math.round(s.p! * 100),
      verdict: s.p! >= 0.8 ? 'Likely' : s.p! <= 0.2 ? 'Unlikely' : 'Unsure',
    })),
)
const skills = computed(() =>
  skillKeys.filter((k) => (probability(selected.value?.answers, `skill_${k}`) ?? 0) >= 0.8),
)
const maintainer = (a: string) => ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(a)

/** Everyone in the thread, so their `@mentions` link to GitHub and nothing else does. */
const people = computed(() => [
  ...new Set([props.issue.author, ...props.issue.comments.map((c) => c.author)]),
])
const avatar = (login: string) => `https://github.com/${encodeURIComponent(login)}.png?size=80`

/** Like GitHub: long threads keep the start and the end and fold the middle. */
const FOLD_AFTER = 8
const KEEP_START = 2
const KEEP_END = 4
const unfolded = ref(false)
watch(
  () => props.issue.id,
  () => (unfolded.value = false),
)
const folded = computed(() =>
  unfolded.value || props.issue.comments.length <= FOLD_AFTER
    ? 0
    : props.issue.comments.length - KEEP_START - KEEP_END,
)
const head = computed(() => (folded.value ? props.issue.comments.slice(0, KEEP_START) : props.issue.comments))
const tail = computed(() => (folded.value ? props.issue.comments.slice(-KEEP_END) : []))
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span>Opened {{ date(issue.createdAt) }} ({{ age(issue.ageDays) }})</span>
        <span>{{ issue.thumbsUp }} thumbs-up</span>
        <span class="text-primary">{{ points(issue) }} {{ points(issue) === 1 ? 'point' : 'points' }}</span>
      </div>
      <UButton
        :to="issue.url"
        target="_blank"
        rel="noopener noreferrer"
        label="Open on GitHub"
        icon="i-lucide-github"
        trailing-icon="i-lucide-arrow-up-right"
        color="neutral"
        variant="outline"
      />
    </div>

    <UAlert
      v-if="live"
      :color="liveLabels[live.state].color"
      variant="subtle"
      :icon="liveLabels[live.state].icon"
      :title="liveLabels[live.state].label"
      :description="describeLive(live)"
      :actions="
        live.url
          ? [
              {
                label: 'View Pull Request',
                to: live.url,
                target: '_blank',
                rel: 'noopener noreferrer',
                trailingIcon: 'i-lucide-arrow-up-right',
                color: 'neutral',
                variant: 'subtle',
              },
            ]
          : undefined
      "
    />

    <UAlert
      v-if="issue.gaps.length"
      color="warning"
      variant="subtle"
      title="Evidence Gaps"
      :description="issue.gaps.join(' · ')"
    />

    <section v-if="plain" aria-labelledby="what-to-do" class="rounded-lg border border-default p-5 space-y-5">
      <div class="flex items-start gap-4">
        <div class="size-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
          <UIcon :name="plain.step.icon" class="size-5 text-primary" />
        </div>
        <div class="min-w-0 space-y-1">
          <p id="what-to-do" class="text-sm text-muted">What to Do</p>
          <h3 class="font-heading text-xl text-highlighted">{{ plain.step.label }}</h3>
          <p class="text-sm leading-6 text-toned">{{ plain.step.how }}</p>
        </div>
      </div>
      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="rounded-md bg-elevated/50 px-4 py-3 space-y-1">
          <dt class="flex items-center gap-1.5 text-sm text-muted">
            <UIcon name="i-lucide-clock" class="size-4" />Time Needed
          </dt>
          <dd class="text-sm font-medium text-highlighted">{{ plain.time?.long ?? 'Hard to say' }}</dd>
        </div>
        <div class="rounded-md bg-elevated/50 px-4 py-3 space-y-1">
          <dt class="flex items-center gap-1.5 text-sm text-muted">
            <UIcon name="i-lucide-user" class="size-4" />Who Can Act
          </dt>
          <dd class="text-sm font-medium" :class="plain.who?.open ? 'text-primary' : 'text-highlighted'">
            {{ plain.who?.long ?? 'Not clear who should act next.' }}
          </dd>
        </div>
      </dl>
      <ul v-if="reasons.length" class="space-y-2" aria-label="Why">
        <li v-for="r in reasons" :key="r.text" class="flex items-start gap-2 text-sm text-toned">
          <UIcon
            :name="r.good ? 'i-lucide-check' : 'i-lucide-triangle-alert'"
            class="mt-0.5 size-4 shrink-0"
            :class="r.good ? 'text-primary' : 'text-warning'"
          />{{ r.text }}
        </li>
      </ul>
      <p class="text-sm text-muted border-t border-default pt-4">
        {{ sureText[plain.sure] }} Check GitHub for recent changes before starting.
      </p>
    </section>
    <p v-else class="rounded-lg border border-default p-4 text-sm text-muted">
      {{
        issue.status === 'stale'
          ? 'This assessment is outdated. Read the thread on GitHub.'
          : 'Jev hasn’t assessed this issue. Everything below is the original GitHub evidence.'
      }}
    </p>

    <details v-if="issue.assessment || issue.firstPass" class="group space-y-4">
      <summary
        class="flex cursor-pointer list-none items-center gap-2 font-heading text-lg text-highlighted rounded-md focus-visible:outline-2 focus-visible:outline-primary"
      >
        <UIcon
          name="i-lucide-chevron-right"
          class="size-5 text-muted transition-transform group-open:rotate-90"
        />
        How Jev Scored This
      </summary>
      <div class="flex items-center justify-end gap-3">
        <div v-if="issue.firstPass && issue.assessment?.stage === 'investigate'" class="flex gap-1">
          <UButton
            label="Reassessed"
            size="sm"
            color="neutral"
            :variant="assessmentTab === 'latest' ? 'soft' : 'ghost'"
            @click="assessmentTab = 'latest'"
          />
          <UButton
            label="First Pass"
            size="sm"
            color="neutral"
            :variant="assessmentTab === 'first' ? 'soft' : 'ghost'"
            @click="assessmentTab = 'first'"
          />
        </div>
      </div>
      <template v-if="selected">
        <dl class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-default bg-(--ui-border)">
          <div v-for="g in glance" :key="g.title" class="bg-default p-4 space-y-1">
            <dt class="text-xs text-muted">{{ g.title }}</dt>
            <dd class="text-sm font-medium text-highlighted">
              {{ g.value
              }}<span v-if="g.conf !== undefined" class="ml-1.5 font-normal text-muted tabular-nums"
                >{{ g.conf }}%</span
              >
            </dd>
          </div>
        </dl>

        <div v-if="signals.length" class="space-y-1">
          <h4 class="text-sm font-medium text-highlighted pb-1">Signals</h4>
          <dl class="divide-y divide-default">
            <div
              v-for="s in signals"
              :key="s.key"
              class="grid grid-cols-[minmax(0,1fr)_5rem_4.5rem] items-center gap-3 py-2.5 text-sm"
            >
              <dt class="text-toned">{{ s.title }}</dt>
              <div class="h-1.5 rounded-full bg-elevated overflow-hidden" aria-hidden="true">
                <div
                  class="h-full rounded-full"
                  :class="
                    s.verdict === 'Likely'
                      ? 'bg-primary'
                      : s.verdict === 'Unsure'
                        ? 'bg-warning'
                        : 'bg-accented'
                  "
                  :style="{ width: `${Math.max(4, s.pct)}%` }"
                />
              </div>
              <dd
                class="text-right tabular-nums"
                :class="s.verdict === 'Likely' ? 'text-highlighted' : 'text-muted'"
              >
                {{ s.verdict }}
              </dd>
            </div>
          </dl>
        </div>

        <div v-if="skills.length" class="flex flex-wrap items-center gap-1.5">
          <span class="text-sm text-muted mr-1">Skills</span>
          <UBadge v-for="k in skills" :key="k" color="neutral" variant="subtle">{{
            label('skill', k)
          }}</UBadge>
        </div>

        <UAlert
          v-if="selected.warnings.length"
          color="warning"
          variant="subtle"
          title="Assessment Notes"
          :description="selected.warnings.join(' · ')"
        />
        <section v-if="selected.evidence" class="space-y-3">
          <h4 class="text-sm font-medium text-highlighted">Investigation Evidence</h4>
          <p class="text-sm text-toned whitespace-pre-wrap">{{ selected.evidence.notes }}</p>
          <div
            v-for="source in selected.evidence.sources"
            :key="source.url"
            class="border border-default rounded-lg p-3 space-y-2"
          >
            <div class="flex items-center gap-2">
              <UBadge size="sm" color="neutral" variant="soft">{{ source.verification }}</UBadge
              ><a
                :href="source.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-primary hover:underline"
                >Source ↗</a
              >
            </div>
            <p v-if="source.ref" class="font-mono text-xs text-muted break-all">{{ source.ref }}</p>
            <p class="evidence-text text-sm leading-6">{{ source.excerpt }}</p>
          </div>
        </section>
        <p class="text-xs text-muted">
          {{
            selected.stage === 'investigate'
              ? 'Evidence-enriched reassessment'
              : 'Issue-thread classification'
          }}
          · {{ date(selected.assessedAt) }} · rubric {{ selected.rubricVersion }}. Suggestions, not verified
          resolutions.
        </p>
      </template>
    </details>

    <section v-if="issue.prs.length" class="space-y-3">
      <h3 class="text-lg text-highlighted">
        Linked Pull Requests <span class="text-muted">{{ issue.prs.length }}</span>
      </h3>
      <div class="divide-y divide-default rounded-lg border border-default">
        <a
          v-for="pr in issue.prs"
          :key="pr.url"
          :href="pr.url"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-start gap-3 p-3 hover:bg-elevated/50"
        >
          <UIcon
            :name="pr.mergedAt ? 'i-lucide-git-merge' : 'i-lucide-git-pull-request'"
            class="mt-0.5 size-4 shrink-0"
            :class="pr.state === 'OPEN' ? 'text-primary' : 'text-muted'"
          />
          <span class="min-w-0">
            <span class="block text-sm text-highlighted">{{ pr.title }}</span>
            <span class="block text-xs text-muted mt-0.5"
              >{{ pr.mergedAt ? 'Merged' : label('state', pr.state.toLowerCase()) }} ·
              {{ pr.closing ? 'Linked as closing' : 'Cross-reference' }}</span
            >
          </span>
        </a>
      </div>
      <p class="text-xs text-muted">A merged PR alone doesn’t prove the issue is resolved.</p>
    </section>

    <section v-if="issue.labels.length" class="space-y-2">
      <h3 class="text-lg text-highlighted">GitHub Labels</h3>
      <div class="flex flex-wrap gap-1.5">
        <UBadge v-for="l in issue.labels" :key="l" variant="outline" color="neutral">{{ l }}</UBadge>
      </div>
    </section>

    <section class="space-y-3">
      <h3 class="text-lg text-highlighted">
        Thread <span class="text-muted">{{ issue.comments.length + 1 }}</span>
      </h3>
      <ol
        class="relative space-y-4 before:absolute before:inset-y-2 before:left-4 before:w-px before:bg-(--ui-border)"
      >
        <li class="relative flex gap-3">
          <UAvatar :src="avatar(issue.author)" :alt="issue.author" size="md" class="ring-4 ring-(--ui-bg)" />
          <article class="min-w-0 flex-1 rounded-lg border border-default bg-default">
            <header
              class="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 border-b border-default bg-elevated/40 text-sm"
            >
              <a
                :href="`https://github.com/${issue.author}`"
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium text-highlighted hover:underline"
                >{{ issue.author }}</a
              >
              <span class="text-muted">opened {{ date(issue.createdAt) }}</span>
              <UBadge size="sm" color="neutral" variant="outline" class="ml-auto">Author</UBadge>
            </header>
            <IssueMarkdown
              :key="issue.id"
              :value="issue.body"
              :repo="issue.repo"
              :people="people"
              class="px-4 py-3 max-h-[32rem] overflow-y-auto"
            />
          </article>
        </li>

        <template v-for="(part, index) in [head, tail]" :key="index">
          <li v-if="index === 1 && folded" class="relative flex justify-center">
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-chevrons-up-down"
              class="bg-default"
              @click="unfolded = true"
              >Show {{ folded }} Hidden Comments</UButton
            >
          </li>
          <li v-for="comment in part" :key="comment.url" class="relative flex gap-3">
            <UAvatar
              :src="avatar(comment.author)"
              :alt="comment.author"
              size="md"
              class="ring-4 ring-(--ui-bg)"
            />
            <article
              class="min-w-0 flex-1 rounded-lg border bg-default"
              :class="maintainer(comment.association) ? 'border-primary/40' : 'border-default'"
            >
              <header
                class="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 border-b text-sm"
                :class="
                  maintainer(comment.association)
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-default bg-elevated/40'
                "
              >
                <a
                  :href="`https://github.com/${comment.author}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-medium text-highlighted hover:underline"
                  >{{ comment.author }}</a
                >
                <a
                  :href="comment.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-muted hover:underline"
                  >{{ date(comment.createdAt) }}</a
                >
                <span class="ml-auto flex gap-1.5">
                  <UBadge v-if="comment.author === issue.author" size="sm" color="neutral" variant="outline"
                    >Author</UBadge
                  >
                  <UBadge v-if="maintainer(comment.association)" size="sm" color="primary" variant="soft">{{
                    label('association', comment.association.toLowerCase())
                  }}</UBadge>
                </span>
              </header>
              <IssueMarkdown
                :value="comment.body"
                :repo="issue.repo"
                :people="people"
                empty="Empty comment."
                class="px-4 py-3"
              />
            </article>
          </li>
        </template>
      </ol>
      <p v-if="!issue.comments.length" class="pl-11 text-sm text-muted">No comments yet.</p>
    </section>

    <footer class="text-xs text-muted border-t border-default pt-4">
      Collected {{ date(issue.retrievedAt) }}. Check GitHub for changes before starting. Markdown is rendered
      safely: raw scripts, styles and embeds are removed and links open in a new tab.
      <ULink :to="reportUrl" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline"
        >Report a wrong classification ↗</ULink
      >
    </footer>
  </div>
</template>
