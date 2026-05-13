<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { humanizeKey } from '@/lib/format'
import { DAYS, type BusinessHoursRow, type DateTimeNode, type Day, type FlowNode } from '@/lib/types'
import { validateBusinessHours, validateTitle } from '@/lib/validators'
import { useUpdateNode } from '@/queries/nodes'

const TIMEZONES = ['UTC', 'GMT', 'EST', 'EDT', 'PST', 'PDT', 'CST', 'MST', 'CET', 'JST'] as const

const props = defineProps<{ node: DateTimeNode }>()
const emit = defineEmits<{ (e: 'saved'): void }>()

const name = ref(props.node.name)
const timezone = ref(props.node.data.timezone)
const times = ref<BusinessHoursRow[]>(cloneTimes(props.node.data.times))
const nameTouched = ref(false)
const submitAttempted = ref(false)

function cloneTimes(input: BusinessHoursRow[]): BusinessHoursRow[] {
  return input.map((row) => ({ ...row }))
}

watch(
  () => props.node.id,
  () => {
    name.value = props.node.name
    timezone.value = props.node.data.timezone
    times.value = cloneTimes(props.node.data.times)
    nameTouched.value = false
    submitAttempted.value = false
  },
)

const nameResult = computed(() => validateTitle(name.value))
const timesResult = computed(() => validateBusinessHours(times.value))

const nameError = computed(() =>
  (nameTouched.value || submitAttempted.value) && !nameResult.value.ok
    ? nameResult.value.message
    : null,
)
const timesError = computed(() =>
  submitAttempted.value && !timesResult.value.ok ? timesResult.value.message : null,
)

const isValid = computed(() => nameResult.value.ok && timesResult.value.ok)

function addRow(): void {
  times.value.push({ day: 'mon', startTime: '09:00', endTime: '17:00' })
}
function removeRow(index: number): void {
  times.value.splice(index, 1)
}
function setRowDay(index: number, day: Day): void {
  const row = times.value[index]
  if (row != null) row.day = day
}

const mutation = useUpdateNode()

async function onSubmit(): Promise<void> {
  submitAttempted.value = true
  if (!isValid.value) return
  // Preserve connectors and action — the editor only owns name/times/timezone.
  const patch: Partial<FlowNode> = {
    name: name.value.trim(),
    data: {
      ...props.node.data,
      times: cloneTimes(times.value),
      timezone: timezone.value,
    },
  } as Partial<FlowNode>
  await mutation.mutateAsync({ id: props.node.id, patch, label: 'Edit business hours' })
  emit('saved')
}
</script>

<template>
  <form class="flex h-full flex-col" novalidate @submit.prevent="onSubmit">
    <div class="flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <div class="space-y-1.5">
        <Label for="dt-name">Name</Label>
        <Input
          id="dt-name"
          v-model="name"
          maxlength="80"
          :aria-invalid="nameError != null"
          @blur="nameTouched = true"
        />
        <p v-if="nameError" class="text-xs text-destructive" data-testid="name-error">
          {{ nameError }}
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1.5">
          <Label for="dt-timezone">Timezone</Label>
          <Select v-model="timezone">
            <SelectTrigger id="dt-timezone" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="tz in TIMEZONES" :key="tz" :value="tz">{{ tz }}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-1.5">
          <Label>Action</Label>
          <div
            class="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
            data-testid="action-readonly"
          >
            {{ humanizeKey(props.node.data.action) }}
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label>Schedule</Label>
          <Button type="button" variant="outline" size="sm" @click="addRow">
            <Plus class="size-3" /> Row
          </Button>
        </div>

        <p
          v-if="times.length === 0"
          class="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground"
        >
          No schedule rows yet.
        </p>

        <div
          v-for="(row, index) in times"
          :key="index"
          class="grid grid-cols-[6.5rem_1fr_1fr_auto] items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
          :data-row-index="index"
        >
          <Select :model-value="row.day" @update:model-value="(d) => setRowDay(index, d as Day)">
            <SelectTrigger class="w-full" :aria-label="`Day for row ${index + 1}`">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="d in DAYS" :key="d" :value="d">{{ humanizeKey(d) }}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            v-model="row.startTime"
            type="time"
            :aria-label="`Start time for row ${index + 1}`"
          />
          <Input
            v-model="row.endTime"
            type="time"
            :aria-label="`End time for row ${index + 1}`"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            :aria-label="`Remove row ${index + 1}`"
            @click="removeRow(index)"
          >
            <Trash2 class="size-4" />
          </Button>
        </div>

        <p v-if="timesError" class="text-xs text-destructive" data-testid="times-error">
          {{ timesError }}
        </p>
      </div>
    </div>

    <footer class="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
      <Button type="submit" :disabled="!isValid || mutation.isPending.value">
        {{ mutation.isPending.value ? 'Saving…' : 'Save' }}
      </Button>
    </footer>
  </form>
</template>
