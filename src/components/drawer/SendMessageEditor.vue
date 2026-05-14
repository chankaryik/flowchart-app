<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/valibot'
import { ImageIcon, Plus, Trash2 } from 'lucide-vue-next'
import { useFieldArray, useForm } from 'vee-validate'
import * as v from 'valibot'
import { computed, reactive, watch } from 'vue'
import { toast } from 'vue-sonner'

import AttachmentField from '@/components/drawer/AttachmentField.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { FlowNode, SendMessageNode, SendMessagePayloadItem } from '@/lib/types'
import { descriptionSchema, sendMessagePayloadSchema, titleSchema } from '@/lib/validators'
import { useUpdateNode } from '@/queries/nodes'
import { useAttachmentsStore } from '@/stores/attachments'

const props = withDefaults(
  defineProps<{ node: SendMessageNode; canDelete?: boolean; deletePending?: boolean }>(),
  { canDelete: false, deletePending: false },
)
const emit = defineEmits<{ (e: 'saved'): void; (e: 'delete'): void }>()

const formSchema = toTypedSchema(
  v.object({
    name: titleSchema,
    description: descriptionSchema,
    payload: sendMessagePayloadSchema,
  }),
)

function clonePayload(items: SendMessagePayloadItem[]): SendMessagePayloadItem[] {
  return items.map((item) =>
    item.type === 'text'
      ? { type: 'text', text: item.text }
      : { type: 'attachment', attachments: [...item.attachments] },
  )
}

const { defineField, handleSubmit, errors, meta, resetForm, submitCount } = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: props.node.name,
    description: props.node.description ?? '',
    payload: clonePayload(props.node.data.payload),
  },
})

const [name, nameProps] = defineField('name', { validateOnBlur: true })
const [description, descriptionProps] = defineField('description', { validateOnBlur: true })
const { fields, push, remove } = useFieldArray<SendMessagePayloadItem>('payload')

// Files live in a Pinia store so they survive the drawer close/reopen that
// happens after Save. During an editing session we mirror the store into a
// per-field-array-key map so add/remove of rows doesn't require re-keying on
// every keystroke; the store gets a re-keyed snapshot at submit time.
const attachmentsStore = useAttachmentsStore()
const filesByKey = reactive(new Map<number, File[]>())
const touchedKeys = reactive(new Set<number>())

function hydrateFilesFromStore(): void {
  filesByKey.clear()
  fields.value.forEach((field, index) => {
    if (field.value.type !== 'attachment') return
    const stored = attachmentsStore.get(props.node.id, index)
    if (stored.length > 0) filesByKey.set(field.key as number, stored.slice())
  })
}

hydrateFilesFromStore()

watch(
  () => props.node.id,
  () => {
    resetForm({
      values: {
        name: props.node.name,
        description: props.node.description ?? '',
        payload: clonePayload(props.node.data.payload),
      },
    })
    touchedKeys.clear()
    hydrateFilesFromStore()
  },
)

const hasTextRow = computed(() =>
  fields.value.some((field) => field.value.type === 'text'),
)
const hasAttachmentRow = computed(() =>
  fields.value.some((field) => field.value.type === 'attachment'),
)

function addText(): void {
  if (hasTextRow.value) return
  push({ type: 'text', text: '' })
}
function addAttachment(): void {
  if (hasAttachmentRow.value) return
  push({ type: 'attachment', attachments: [] })
}
function removeRow(index: number): void {
  const field = fields.value[index]
  if (field != null) {
    filesByKey.delete(field.key as number)
    touchedKeys.delete(field.key as number)
  }
  remove(index)
}

function attachmentError(index: number): string | null {
  const field = fields.value[index]
  if (field == null) return null
  // Only surface the "Please upload a file" message once the user has
  // interacted with the row, or after they've tried to submit. Otherwise
  // pressing the Attachment button would flash the error immediately.
  const shown = touchedKeys.has(field.key as number) || submitCount.value > 0
  if (!shown) return null
  return errors.value[`payload[${index}].attachments`] ?? null
}

function setAttachmentNames(index: number, value: string[]): void {
  const row = fields.value[index]?.value
  if (row != null && row.type === 'attachment') row.attachments = value
}

function onAttachmentFilesChange(rowKey: number, list: File[]): void {
  if (list.length === 0) filesByKey.delete(rowKey)
  else filesByKey.set(rowKey, list)
  touchedKeys.add(rowKey)
}

function onAttachmentBlur(rowKey: number): void {
  touchedKeys.add(rowKey)
}

const mutation = useUpdateNode()

const onSubmit = handleSubmit(async (values) => {
  const payload: SendMessagePayloadItem[] = values.payload.map((row) =>
    row.type === 'text'
      ? { type: 'text', text: row.text }
      : {
          type: 'attachment',
          attachments: row.attachments.map((a) => a.trim()).filter((a) => a.length > 0),
        },
  )
  const trimmedDescription = (values.description ?? '').trim()
  const patch: Partial<FlowNode> = {
    name: values.name.trim(),
    description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
    data: { payload },
  } as Partial<FlowNode>
  try {
    await mutation.mutateAsync({ id: props.node.id, patch })
  } catch {
    return
  }
  // Commit the in-session files to the store keyed by their final payload
  // index. Done after a successful mutation so a failed save doesn't leave
  // stale entries pointing at a stale array layout.
  const committed = new Map<number, File[]>()
  fields.value.forEach((field, index) => {
    if (field.value.type !== 'attachment') return
    const list = filesByKey.get(field.key as number)
    if (list != null && list.length > 0) committed.set(index, list)
  })
  attachmentsStore.commit(props.node.id, committed)
  toast.success('Send message saved')
  emit('saved')
})
</script>

<template>
  <form class="flex h-full flex-col" novalidate @submit="onSubmit">
    <div class="flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <div class="space-y-1.5">
        <Label for="sm-name">Title</Label>
        <Input
          id="sm-name"
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
        <Label for="sm-description">Description</Label>
        <Textarea
          id="sm-description"
          v-model="description"
          v-bind="descriptionProps"
          rows="3"
          maxlength="500"
          data-testid="sm-description"
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

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label>Message payload</Label>
          <div class="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              :disabled="hasTextRow"
              @click="addText"
            >
              <Plus class="size-3" /> Text
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              :disabled="hasAttachmentRow"
              @click="addAttachment"
            >
              <ImageIcon class="size-3" /> Attachment
            </Button>
          </div>
        </div>

        <p
          v-if="fields.length === 0"
          class="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground"
        >
          No payload items yet. Add a text or attachment row.
        </p>

        <div
          v-for="(field, index) in fields"
          :key="field.key"
          class="space-y-1.5 rounded-md border border-border bg-card px-3 py-2"
          :data-row-kind="field.value.type"
          :data-row-index="index"
        >
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {{ field.value.type === 'text' ? 'Text' : 'Attachment' }}
            </span>
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

          <Textarea
            v-if="field.value.type === 'text'"
            v-model="field.value.text"
            rows="3"
            placeholder="Message text"
          />
          <template v-else>
            <AttachmentField
              :model-value="field.value.type === 'attachment' ? field.value.attachments : []"
              :files="filesByKey.get(field.key as number) ?? []"
              :error="attachmentError(index)"
              :aria-label="`Attachments for row ${index + 1}`"
              @update:model-value="(val) => setAttachmentNames(index, val)"
              @update:files="(f) => onAttachmentFilesChange(field.key as number, f)"
              @blur="onAttachmentBlur(field.key as number)"
            />
            <p
              v-if="attachmentError(index)"
              class="text-xs text-destructive"
              :data-testid="`attachment-error-${index}`"
            >
              {{ attachmentError(index) }}
            </p>
            <p class="text-[11px] text-muted-foreground">
              Uploaded files are kept in memory only — the data persist setting does not support file
              uploads yet, so attachments are lost on refresh.
            </p>
          </template>
        </div>
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
