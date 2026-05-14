<script setup lang="ts">
import { toTypedSchema } from "@vee-validate/valibot";
import { Trash2 } from "lucide-vue-next";
import { useFieldArray, useForm } from "vee-validate";
import * as v from "valibot";
import { computed, watch } from "vue";
import { toast } from "vue-sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { dayLabel } from "@/lib/format";
import { DAYS, type BusinessHoursRow, type DateTimeNode, type FlowNode } from "@/lib/types";
import { businessHoursSchema, descriptionSchema, titleSchema } from "@/lib/validators";
import { useUpdateNode } from "@/queries/nodes";

const TIMEZONES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
  { value: "GMT", label: "Greenwich Mean Time (GMT)" },
  { value: "EST", label: "Eastern Standard Time (EST)" },
  { value: "EDT", label: "Eastern Daylight Time (EDT)" },
  { value: "CST", label: "Central Standard Time (CST)" },
  { value: "MST", label: "Mountain Standard Time (MST)" },
  { value: "PST", label: "Pacific Standard Time (PST)" },
  { value: "PDT", label: "Pacific Daylight Time (PDT)" },
  { value: "CET", label: "Central European Time (CET)" },
  { value: "JST", label: "Japan Standard Time (JST)" },
];

const props = withDefaults(
  defineProps<{ node: DateTimeNode; canDelete?: boolean; deletePending?: boolean }>(),
  { canDelete: false, deletePending: false },
);
const emit = defineEmits<{ (e: "saved"): void; (e: "delete"): void }>();

const formSchema = toTypedSchema(
  v.object({
    name: titleSchema,
    description: descriptionSchema,
    timezone: v.string(),
    times: businessHoursSchema,
  }),
);

// Always show 7 rows in canonical (Mon→Sun) order. If the stored payload is
// missing a day or out of order, fill from defaults so the editor stays stable
// across the type contract that allows arbitrary BusinessHoursRow[].
function normalizeTimes(input: BusinessHoursRow[]): BusinessHoursRow[] {
  const byDay = new Map<string, BusinessHoursRow>();
  for (const row of input) {
    if (!byDay.has(row.day)) byDay.set(row.day, { ...row });
  }
  return DAYS.map((day) => {
    const existing = byDay.get(day);
    if (existing != null) return { ...existing, day };
    return { day, startTime: "09:00", endTime: "17:00", closed: true };
  });
}

const { defineField, handleSubmit, errors, meta, resetForm } = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: props.node.name,
    description: props.node.description ?? "",
    timezone: props.node.data.timezone,
    times: normalizeTimes(props.node.data.times),
  },
  validateOnMount: false,
});

const [name, nameProps] = defineField("name", { validateOnBlur: true });
const [description, descriptionProps] = defineField("description", { validateOnBlur: true });
const [timezone] = defineField("timezone");

const { fields, update } = useFieldArray<BusinessHoursRow>("times");

watch(
  () => props.node.id,
  () => {
    resetForm({
      values: {
        name: props.node.name,
        description: props.node.description ?? "",
        timezone: props.node.data.timezone,
        times: normalizeTimes(props.node.data.times),
      },
    });
  },
);

// Row-level errors (e.g. end < start) attach to `times[N]`; array-level
// errors (empty, overlap) attach to `times`. Surface whichever is present so
// users see a single banner regardless of which valibot check fired.
const timesError = computed(() => {
  const arrayErr = errors.value.times;
  if (arrayErr != null) return arrayErr;
  for (let i = 0; i < fields.value.length; i++) {
    const rowErr = errors.value[`times[${i}]`];
    if (rowErr != null) return rowErr;
  }
  return null;
});

function setRowOpen(index: number, open: boolean): void {
  const field = fields.value[index];
  if (field == null) return;
  update(index, { ...field.value, closed: !open });
}

const mutation = useUpdateNode();

const onSubmit = handleSubmit(async (values) => {
  const trimmedDescription = (values.description ?? "").trim();
  // Preserve connectors and action — the editor only owns name/times/timezone.
  const patch: Partial<FlowNode> = {
    name: values.name.trim(),
    description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
    data: {
      ...props.node.data,
      times: values.times.map((row) => ({ ...row })),
      timezone: values.timezone,
    },
  } as Partial<FlowNode>;
  try {
    await mutation.mutateAsync({ id: props.node.id, patch });
  } catch {
    return;
  }
  toast.success("Business hours saved");
  emit("saved");
});
</script>

<template>
  <form class="flex h-full flex-col" novalidate @submit="onSubmit">
    <div class="flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <div class="space-y-1.5">
        <Label for="dt-name">Title</Label>
        <Input
          id="dt-name"
          v-model="name"
          v-bind="nameProps"
          maxlength="80"
          :aria-invalid="errors.name != null"
        />
        <p v-if="errors.name" class="text-xs text-destructive" data-testid="title-error">
          {{ errors.name }}
        </p>
      </div>

      <div class="space-y-1.5">
        <Label for="dt-description">Description</Label>
        <Textarea
          id="dt-description"
          v-model="description"
          v-bind="descriptionProps"
          rows="3"
          maxlength="500"
          data-testid="dt-description"
          :aria-invalid="errors.description != null"
        />
        <p
          v-if="errors.description"
          class="text-xs text-destructive"
          data-testid="description-error"
        >
          {{ errors.description }}
        </p>
      </div>

      <div class="space-y-1.5">
        <Label for="dt-timezone">Timezone</Label>
        <Select v-model="timezone">
          <SelectTrigger id="dt-timezone" class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="tz in TIMEZONES" :key="tz.value" :value="tz.value">
              {{ tz.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="space-y-4">
        <div class="flex items-baseline justify-between">
          <Label>Schedule</Label>
          <p class="text-xs text-muted-foreground">Toggle a day off to mark it as closed.</p>
        </div>

        <div
          class="hidden sm:grid sm:grid-cols-[3.5rem_6.5rem_1fr_0.5rem_1fr] items-center gap-x-3 px-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          aria-hidden="true"
        >
          <span>Day</span>
          <span>Status</span>
          <span>Open</span>
          <span />
          <span>Close</span>
        </div>

        <div class="space-y-1.5">
          <div
            v-for="(field, index) in fields"
            :key="field.key"
            :class="[
              'flex flex-col gap-2 rounded-md border px-3 py-2 transition-colors sm:grid sm:grid-cols-[3.5rem_6.5rem_1fr_0.5rem_1fr] sm:items-center sm:gap-x-3 sm:gap-y-0',
              field.value.closed === true
                ? 'border-dashed border-border bg-muted/30'
                : 'border-border bg-card',
            ]"
            :data-row-index="index"
            :data-day="field.value.day"
          >
            <div class="flex items-center justify-between gap-3 sm:contents">
              <span
                :class="[
                  'text-sm',
                  field.value.closed === true
                    ? 'text-muted-foreground'
                    : 'font-medium text-foreground',
                ]"
                data-testid="day-label"
              >
                {{ dayLabel(field.value.day) }}
              </span>
              <label
                class="flex items-center gap-2 text-xs"
                :class="field.value.closed === true ? 'text-muted-foreground' : 'text-foreground'"
              >
                <Switch
                  :model-value="field.value.closed !== true"
                  :aria-label="`Mark ${dayLabel(field.value.day)} as open`"
                  data-testid="day-switch"
                  @update:model-value="(open) => setRowOpen(index, open)"
                />
                <span data-testid="day-status">
                  {{ field.value.closed === true ? "Closed" : "Open" }}
                </span>
              </label>
            </div>
            <div class="flex items-center gap-2 sm:contents">
              <Input
                v-model="field.value.startTime"
                type="time"
                class="flex-1 sm:flex-initial"
                :disabled="field.value.closed === true"
                :aria-label="`Start time for ${dayLabel(field.value.day)}`"
              />
              <span class="text-center text-xs text-muted-foreground" aria-hidden="true">–</span>
              <Input
                v-model="field.value.endTime"
                type="time"
                class="flex-1 sm:flex-initial"
                :disabled="field.value.closed === true"
                :aria-label="`End time for ${dayLabel(field.value.day)}`"
              />
            </div>
          </div>
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
        {{ mutation.isPending.value ? "Saving…" : "Save" }}
      </Button>
    </footer>
  </form>
</template>
