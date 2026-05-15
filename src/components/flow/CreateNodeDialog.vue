<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/valibot'
import { useForm } from 'vee-validate'
import * as v from 'valibot'
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChevronDown } from 'lucide-vue-next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { H_GAP, NODE_HEIGHT, NODE_WIDTH, V_GAP } from '@/lib/layout'
import { createNode } from '@/lib/node-factory'
import type { EditableNodeType, FlowNode, NodeId } from '@/lib/types'
import { cn } from '@/lib/utils'
import { descriptionSchema, titleSchema } from '@/lib/validators'
import { useCreateNode } from '@/queries/nodes'
import { nodeKey, type Position, useFlowStore } from '@/stores/flow'

// REQUIREMENTS.md "Create Node" lists three options for the Type select.
// "Business Hours" is the user-facing label for the existing `dateTime` type
// (matches payload.json's seeded node and the existing renderer).
const TYPE_OPTIONS: { value: EditableNodeType; label: string }[] = [
  { value: 'sendMessage', label: 'Send Message' },
  { value: 'addComment', label: 'Add Comments' },
  { value: 'dateTime', label: 'Business Hours' },
]

// Sentinel parent for orphan nodes (matches the seed trigger's parentId).
// Header "Create New Node" creates standalone nodes with no parent edge;
// only the per-node + button supplies a real parent.
const ORPHAN_PARENT_ID: NodeId = -1
const ORPHAN_OFFSET = 80

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const router = useRouter()
const store = useFlowStore()
const mutation = useCreateNode()

const formSchema = toTypedSchema(
  v.object({
    title: titleSchema,
    description: descriptionSchema,
    type: v.picklist(['sendMessage', 'addComment', 'dateTime'], 'Please select a type.'),
  }),
)

const { defineField, handleSubmit, errors, meta, resetForm } = useForm({
  validationSchema: formSchema,
  initialValues: { title: '', description: '', type: undefined as EditableNodeType | undefined },
})

const [title, titleAttrs] = defineField('title', { validateOnBlur: true })
const [description, descriptionAttrs] = defineField('description', { validateOnBlur: true })
const [type, typeAttrs] = defineField('type', { validateOnBlur: true })

// Native <select v-model> shows blank when modelValue matches no option, so map
// undefined → '' to keep the "Select a type…" placeholder option visible until
// the user picks something. The form's source of truth stays undefined|EditableNodeType.
const typeModel = computed<EditableNodeType | ''>({
  get: () => type.value ?? '',
  set: (v) => {
    type.value = v === '' ? undefined : v
  },
})

// meta.valid reports true on mount before any validation has run, so it's not
// enough on its own to gate the submit button. Combine with explicit checks
// for the two required fields so the button starts disabled.
const canSubmit = computed(
  () => meta.value.valid && (title.value ?? '').trim().length > 0 && type.value != null,
)

const presetParent = computed<FlowNode | null>(() => {
  const id = store.createDialog.parentId
  if (id == null) return null
  return store.getNodeById(id) ?? null
})

const presetParentLabel = computed(() => {
  const parent = presetParent.value
  if (parent == null) return null
  return 'name' in parent ? parent.name : `Trigger #${parent.id}`
})

watch(
  () => props.open,
  (next) => {
    if (!next) return
    resetForm({
      values: { title: '', description: '', type: undefined as EditableNodeType | undefined },
    })
  },
)

function setOpen(open: boolean): void {
  emit('update:open', open)
}

function nextOrphanPosition(): Position {
  // Stack new orphan nodes diagonally so successive creates don't overlap.
  const orphanCount = store.nodes.filter(
    (n) => String(n.parentId) === String(ORPHAN_PARENT_ID),
  ).length
  return {
    x: ORPHAN_OFFSET + orphanCount * (NODE_WIDTH + H_GAP),
    y: ORPHAN_OFFSET + orphanCount * (NODE_HEIGHT + V_GAP),
  }
}

function computeChildPositions(newNodes: FlowNode[], parentId: NodeId): Record<string, Position> {
  const parentPos = store.positions[nodeKey(parentId)] ?? { x: 0, y: 0 }
  const result: Record<string, Position> = {}
  if (newNodes.length === 1) {
    const first = newNodes[0]
    if (first == null) return result
    const siblings = store.getChildren(parentId).length
    result[nodeKey(first.id)] = {
      x: parentPos.x + siblings * (NODE_WIDTH + H_GAP),
      y: parentPos.y + NODE_HEIGHT + V_GAP,
    }
    return result
  }
  const [dt, success, failure] = newNodes
  if (dt == null || success == null || failure == null) return result
  const dtY = parentPos.y + NODE_HEIGHT + V_GAP
  const connectorY = dtY + NODE_HEIGHT + V_GAP
  result[nodeKey(dt.id)] = { x: parentPos.x, y: dtY }
  result[nodeKey(success.id)] = {
    x: parentPos.x - (NODE_WIDTH + H_GAP) / 2,
    y: connectorY,
  }
  result[nodeKey(failure.id)] = {
    x: parentPos.x + (NODE_WIDTH + H_GAP) / 2,
    y: connectorY,
  }
  return result
}

function computeOrphanPositions(newNodes: FlowNode[]): Record<string, Position> {
  const origin = nextOrphanPosition()
  const result: Record<string, Position> = {}
  if (newNodes.length === 1) {
    const first = newNodes[0]
    if (first == null) return result
    result[nodeKey(first.id)] = origin
    return result
  }
  const [dt, success, failure] = newNodes
  if (dt == null || success == null || failure == null) return result
  const connectorY = origin.y + NODE_HEIGHT + V_GAP
  result[nodeKey(dt.id)] = origin
  result[nodeKey(success.id)] = {
    x: origin.x - (NODE_WIDTH + H_GAP) / 2,
    y: connectorY,
  }
  result[nodeKey(failure.id)] = {
    x: origin.x + (NODE_WIDTH + H_GAP) / 2,
    y: connectorY,
  }
  return result
}

const onSubmit = handleSubmit(async (values) => {
  const t = values.type
  if (t == null) return

  const parent = presetParent.value
  const parentId: NodeId = parent?.id ?? ORPHAN_PARENT_ID

  const trimmedTitle = values.title.trim()
  const trimmedDescription = values.description.trim()
  const partial = {
    name: trimmedTitle,
    description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
  }

  let nodes: FlowNode[]
  let primaryId: NodeId

  if (t === 'dateTime') {
    const created = createNode('dateTime', parentId, partial)
    nodes = [created.dateTime, created.connectors[0], created.connectors[1]]
    primaryId = created.dateTime.id
  } else if (t === 'sendMessage') {
    const created = createNode('sendMessage', parentId, partial)
    nodes = [created]
    primaryId = created.id
  } else {
    const created = createNode('addComment', parentId, partial)
    nodes = [created]
    primaryId = created.id
  }

  const positions =
    parent != null ? computeChildPositions(nodes, parent.id) : computeOrphanPositions(nodes)

  try {
    await mutation.mutateAsync({ nodes, positions })
  } catch {
    return
  }

  setOpen(false)
  toast.success(`${trimmedTitle} created`)
  void router.push(`/node/${primaryId}`)
})
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent data-testid="create-node-dialog" class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create New Node</DialogTitle>
        <DialogDescription>
          <template v-if="presetParentLabel != null">
            Add a node under <strong>{{ presetParentLabel }}</strong
            >.
          </template>
          <template v-else>Add a new node to the canvas.</template>
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" novalidate @submit="onSubmit">
        <div class="space-y-1.5">
          <Label for="create-title">
            Title <span aria-hidden="true" class="text-destructive">*</span>
          </Label>
          <Input
            id="create-title"
            v-model="title"
            v-bind="titleAttrs"
            maxlength="80"
            data-testid="create-title"
            :aria-invalid="errors.title != null"
          />
          <p v-if="errors.title" class="text-xs text-destructive" data-testid="title-error">
            {{ errors.title }}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="create-description">Description</Label>
          <Textarea
            id="create-description"
            v-model="description"
            v-bind="descriptionAttrs"
            rows="3"
            maxlength="500"
            data-testid="create-description"
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
          <Label for="create-type">
            Type of Node <span aria-hidden="true" class="text-destructive">*</span>
          </Label>
          <!-- Native <select> (not shadcn Select) so macOS Safari includes it in
               Tab navigation. Safari skips button-based custom controls unless
               the user enables Full Keyboard Access; native <select> is always
               tabbable. Keep id/testid/data-type-option for tests. -->
          <div class="relative">
            <select
              id="create-type"
              v-model="typeModel"
              v-bind="typeAttrs"
              data-testid="create-type"
              :aria-invalid="errors.type != null"
              :class="
                cn(
                  'border-input bg-transparent dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex h-9 w-full appearance-none items-center rounded-md border px-3 py-2 pr-9 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
                  typeModel === '' && 'text-muted-foreground',
                )
              "
            >
              <option value="" disabled hidden>Select a type…</option>
              <option
                v-for="opt in TYPE_OPTIONS"
                :key="opt.value"
                :value="opt.value"
                :data-type-option="opt.value"
                class="text-foreground"
              >
                {{ opt.label }}
              </option>
            </select>
            <ChevronDown
              class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground opacity-50"
            />
          </div>
          <p v-if="errors.type" class="text-xs text-destructive" data-testid="type-error">
            {{ errors.type }}
          </p>
        </div>

        <DialogFooter class="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" @click="setOpen(false)">Cancel</Button>
          <Button
            type="submit"
            :disabled="!canSubmit || mutation.isPending.value"
            data-testid="create-submit"
          >
            {{ mutation.isPending.value ? 'Creating…' : 'Create' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
