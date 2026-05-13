<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/valibot'
import { Plus, Trash2 } from 'lucide-vue-next'
import { useFieldArray, useForm } from 'vee-validate'
import * as v from 'valibot'
import { computed, watch } from 'vue'
import { toast } from 'vue-sonner'

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
import { businessHoursSchema, titleSchema } from '@/lib/validators'
import { useUpdateNode } from '@/queries/nodes'

const TIMEZONES = ['UTC', 'GMT', 'EST', 'EDT', 'PST', 'PDT', 'CST', 'MST', 'CET', 'JST'] as const

const props = withDefaults(
  defineProps<{ node: DateTimeNode; canDelete?: boolean; deletePending?: boolean }>(),
  { canDelete: false, deletePending: false },
)
const emit = defineEmits<{ (e: 'saved'): void; (e: 'delete'): void }>()

const formSchema = toTypedSchema(
  v.object({
    name: titleSchema,
    timezone: v.string(),
    times: businessHoursSchema,
  }),
)

function cloneTimes(input: BusinessHoursRow[]): BusinessHoursRow[] {
  return input.map((row) => ({ ...row }))
}

const { defineField, handleSubmit, errors, meta, resetForm } = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: props.node.name,
    timezone: props.node.data.timezone,
    times: cloneTimes(props.node.data.times),
  },
  validateOnMount: false,
})

const [name, nameProps] = defineField('name', { validateOnBlur: true })
const [timezone] = defineField('timezone')

const { fields, push, remove, update } = useFieldArray<BusinessHoursRow>('times')

watch(
  () => props.node.id,
  () => {
    resetForm({
      values: {
        name: props.node.name,
        timezone: props.node.data.timezone,
        times: cloneTimes(props.node.data.times),
      },
    })
  },
)

// Row-level errors (e.g. end < start) attach to `times[N]`; array-level
// errors (empty, overlap) attach to `times`. Surface whichever is present so
// users see a single banner regardless of which valibot check fired.
const timesError = computed(() => {
  const arrayErr = errors.value.times
  if (arrayErr != null) return arrayErr
  for (let i = 0; i < fields.value.length; i++) {
    const rowErr = errors.value[`times[${i}]`]
    if (rowErr != null) return rowErr
  }
  return null
})

function addRow(): void {
  push({ day: 'mon', startTime: '09:00', endTime: '17:00' })
}
function setRowDay(index: number, day: Day): void {
  const field = fields.value[index]
  if (field == null) return
  update(index, { ...field.value, day })
}

const mutation = useUpdateNode()

const onSubmit = handleSubmit(async (values) => {
  // Preserve connectors and action — the editor only owns name/times/timezone.
  const patch: Partial<FlowNode> = {
    name: values.name.trim(),
    data: {
      ...props.node.data,
      times: cloneTimes(values.times),
      timezone: values.timezone,
    },
  } as Partial<FlowNode>
  try {
    await mutation.mutateAsync({ id: props.node.id, patch, label: 'Edit business hours' })
  } catch {
    return
  }
  toast.success('Business hours saved')
  emit('saved')
})
</script>

<template>
  <form class="flex h-full flex-col" novalidate @submit="onSubmit">
    <div class="flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <div class="space-y-1.5">
        <Label for="dt-name">Name</Label>
        <Input
          id="dt-name"
          v-model="name"
          v-bind="nameProps"
          maxlength="80"
          :aria-invalid="errors.name != null"
        />
        <p v-if="errors.name" class="text-xs text-destructive" data-testid="name-error">
          {{ errors.name }}
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
          v-if="fields.length === 0"
          class="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground"
        >
          No schedule rows yet.
        </p>

        <div
          v-for="(field, index) in fields"
          :key="field.key"
          class="grid grid-cols-[6.5rem_1fr_1fr_auto] items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
          :data-row-index="index"
        >
          <Select
            :model-value="field.value.day"
            @update:model-value="(d) => setRowDay(index, d as Day)"
          >
            <SelectTrigger class="w-full" :aria-label="`Day for row ${index + 1}`">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="d in DAYS" :key="d" :value="d">{{ humanizeKey(d) }}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            v-model="field.value.startTime"
            type="time"
            :aria-label="`Start time for row ${index + 1}`"
          />
          <Input
            v-model="field.value.endTime"
            type="time"
            :aria-label="`End time for row ${index + 1}`"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            :aria-label="`Remove row ${index + 1}`"
            @click="remove(index)"
          >
            <Trash2 class="size-4" />
          </Button>
        </div>

        <p v-if="timesError" class="text-xs text-destructive" data-testid="times-error">
          {{ timesError }}
        </p>
      </div>
    </div>

    <footer class="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
      <Button
        v-if="canDelete"
        type="button"
        variant="destructive"
        data-testid="drawer-delete"
        :disabled="deletePending"
        @click="emit('delete')"
      >
        <Trash2 class="size-4" />
        Delete
      </Button>
      <span v-else />
      <Button type="submit" :disabled="!meta.valid || mutation.isPending.value">
        {{ mutation.isPending.value ? 'Saving…' : 'Save' }}
      </Button>
    </footer>
  </form>
</template>
