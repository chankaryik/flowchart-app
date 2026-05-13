<script setup lang="ts">
import { ImageIcon, Plus, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { FlowNode, SendMessageNode, SendMessagePayloadItem } from '@/lib/types'
import { validateAttachmentUrl, validateTitle } from '@/lib/validators'
import { useUpdateNode } from '@/queries/nodes'

type Row =
  | { kind: 'text'; text: string; touched: boolean }
  | { kind: 'attachment'; url: string; touched: boolean }

const props = defineProps<{ node: SendMessageNode }>()
const emit = defineEmits<{ (e: 'saved'): void }>()

const name = ref(props.node.name)
const rows = ref<Row[]>([])
const nameTouched = ref(false)
const submitAttempted = ref(false)

function rowsFromNode(node: SendMessageNode): Row[] {
  return node.data.payload.map<Row>((item) =>
    item.type === 'text'
      ? { kind: 'text', text: item.text, touched: false }
      : { kind: 'attachment', url: item.attachment, touched: false },
  )
}

watch(
  () => props.node.id,
  () => {
    name.value = props.node.name
    rows.value = rowsFromNode(props.node)
    nameTouched.value = false
    submitAttempted.value = false
  },
  { immediate: true },
)

const nameResult = computed(() => validateTitle(name.value))
const nameError = computed(() =>
  (nameTouched.value || submitAttempted.value) && !nameResult.value.ok
    ? nameResult.value.message
    : null,
)

function attachmentRowError(row: Row, showAll: boolean): string | null {
  if (row.kind !== 'attachment') return null
  if (!row.touched && !showAll) return null
  const result = validateAttachmentUrl(row.url)
  return result.ok ? null : result.message
}

const rowErrors = computed(() =>
  rows.value.map((row) => attachmentRowError(row, submitAttempted.value)),
)

const isValid = computed(() => {
  if (!nameResult.value.ok) return false
  for (const row of rows.value) {
    if (row.kind === 'attachment' && !validateAttachmentUrl(row.url).ok) return false
  }
  return true
})

function addText(): void {
  rows.value.push({ kind: 'text', text: '', touched: false })
}
function addAttachment(): void {
  rows.value.push({ kind: 'attachment', url: '', touched: false })
}
function removeRow(index: number): void {
  rows.value.splice(index, 1)
}

const mutation = useUpdateNode()

async function onSubmit(): Promise<void> {
  submitAttempted.value = true
  if (!isValid.value) return
  const payload: SendMessagePayloadItem[] = rows.value.map((row) =>
    row.kind === 'text'
      ? { type: 'text', text: row.text }
      : { type: 'attachment', attachment: row.url.trim() },
  )
  const patch: Partial<FlowNode> = {
    name: name.value.trim(),
    data: { payload },
  } as Partial<FlowNode>
  try {
    await mutation.mutateAsync({ id: props.node.id, patch, label: 'Edit send message' })
  } catch {
    // mutation onError handler surfaces the toast; swallow to keep drawer open
    return
  }
  toast.success('Send message saved')
  emit('saved')
}
</script>

<template>
  <form class="flex h-full flex-col" novalidate @submit.prevent="onSubmit">
    <div class="flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <div class="space-y-1.5">
        <Label for="sm-name">Name</Label>
        <Input
          id="sm-name"
          v-model="name"
          maxlength="80"
          :aria-invalid="nameError != null"
          @blur="nameTouched = true"
        />
        <p v-if="nameError" class="text-xs text-destructive" data-testid="name-error">
          {{ nameError }}
        </p>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label>Message payload</Label>
          <div class="flex gap-1">
            <Button type="button" variant="outline" size="sm" @click="addText">
              <Plus class="size-3" /> Text
            </Button>
            <Button type="button" variant="outline" size="sm" @click="addAttachment">
              <ImageIcon class="size-3" /> Attachment
            </Button>
          </div>
        </div>

        <p
          v-if="rows.length === 0"
          class="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground"
        >
          No payload items yet. Add a text or attachment row.
        </p>

        <div
          v-for="(row, index) in rows"
          :key="index"
          class="space-y-1.5 rounded-md border border-border bg-card px-3 py-2"
          :data-row-kind="row.kind"
          :data-row-index="index"
        >
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {{ row.kind === 'text' ? 'Text' : 'Attachment' }}
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
            v-if="row.kind === 'text'"
            v-model="row.text"
            rows="3"
            placeholder="Message text"
          />
          <template v-else>
            <Input
              v-model="row.url"
              type="url"
              placeholder="https://example.com/file.png"
              :aria-invalid="rowErrors[index] != null"
              @blur="row.touched = true"
            />
            <p
              v-if="rowErrors[index]"
              class="text-xs text-destructive"
              :data-testid="`attachment-error-${index}`"
            >
              {{ rowErrors[index] }}
            </p>
          </template>
        </div>
      </div>
    </div>

    <footer class="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
      <Button type="submit" :disabled="!isValid || mutation.isPending.value">
        {{ mutation.isPending.value ? 'Saving…' : 'Save' }}
      </Button>
    </footer>
  </form>
</template>
