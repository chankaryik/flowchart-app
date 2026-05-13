<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/valibot'
import { useForm } from 'vee-validate'
import * as v from 'valibot'
import { computed, ref, watch } from 'vue'
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
import { H_GAP, NODE_HEIGHT, NODE_WIDTH, V_GAP } from '@/lib/layout'
import { createNode } from '@/lib/node-factory'
import type { EditableNodeType, FlowNode, NodeId } from '@/lib/types'
import { titleSchema } from '@/lib/validators'
import { useCreateNode } from '@/queries/nodes'
import { nodeKey, type Position, useFlowStore } from '@/stores/flow'

// Trigger and dateTimeConnector are excluded from the type list:
// trigger is locked (Day-0 decision), connectors are display-only (CLAUDE.md §8.1).
const TYPE_OPTIONS: { value: EditableNodeType; label: string; hint: string }[] = [
  { value: 'sendMessage', label: 'Send Message', hint: 'Reply with text or attachments.' },
  { value: 'dateTime', label: 'Date / Time', hint: 'Branch on business hours.' },
  { value: 'addComment', label: 'Comment', hint: 'Add an internal note.' },
]

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const router = useRouter()
const store = useFlowStore()
const mutation = useCreateNode()

type Step = 'type' | 'parent' | 'details'

const step = ref<Step>('type')
const type = ref<EditableNodeType | null>(null)
const parentKey = ref<string | null>(null)

const formSchema = toTypedSchema(v.object({ name: titleSchema }))

const { defineField, handleSubmit, errors, meta, resetForm } = useForm({
  validationSchema: formSchema,
  initialValues: { name: '' },
})

const [name, nameProps] = defineField('name', { validateOnBlur: true })

// When the dialog was opened from a node's plus button, parentId is preset
// and the parent step is skipped (type -> details). When opened from the
// header "Create Node" button, parentId is null and the full picker runs.
const presetParent = computed<FlowNode | null>(() => {
  const id = store.createDialog.parentId
  if (id == null) return null
  return store.getNodeById(id) ?? null
})

watch(
  () => props.open,
  (next) => {
    if (!next) return
    step.value = 'type'
    type.value = null
    parentKey.value = presetParent.value != null ? nodeKey(presetParent.value.id) : null
    resetForm({ values: { name: '' } })
  },
)

const parentOptions = computed(() =>
  store.nodes.map((n) => ({
    key: nodeKey(n.id),
    id: n.id,
    label: 'name' in n ? n.name : `Trigger #${n.id}`,
    type: n.type,
  })),
)

const selectedParent = computed<FlowNode | null>(() => {
  if (presetParent.value != null) return presetParent.value
  const key = parentKey.value
  if (key == null) return null
  return store.nodes.find((n) => nodeKey(n.id) === key) ?? null
})

const parentLabel = computed(() => {
  const parent = selectedParent.value
  if (parent == null) return null
  return 'name' in parent ? parent.name : `Trigger #${parent.id}`
})

function defaultName(t: EditableNodeType): string {
  switch (t) {
    case 'sendMessage':
      return 'Send Message'
    case 'addComment':
      return 'Add Comment'
    case 'dateTime':
      return 'Business Hours'
  }
}

function setOpen(open: boolean): void {
  emit('update:open', open)
}

function selectType(t: EditableNodeType): void {
  type.value = t
}

function goNext(): void {
  if (step.value === 'type') {
    if (type.value == null) return
    if (presetParent.value != null) {
      resetForm({ values: { name: defaultName(type.value) } })
      step.value = 'details'
      return
    }
    step.value = 'parent'
  } else if (step.value === 'parent') {
    if (parentKey.value == null || type.value == null) return
    resetForm({ values: { name: defaultName(type.value) } })
    step.value = 'details'
  }
}

function goBack(): void {
  if (step.value === 'details') {
    // Preset parent: skip back over the (hidden) parent step too.
    step.value = presetParent.value != null ? 'type' : 'parent'
  } else if (step.value === 'parent') step.value = 'type'
}

function computePositions(
  newNodes: FlowNode[],
  parentId: NodeId,
): Record<string, Position> {
  const parentPos = store.positions[nodeKey(parentId)] ?? { x: 0, y: 0 }
  const result: Record<string, Position> = {}
  if (newNodes.length === 1) {
    const first = newNodes[0]
    if (first == null) return result
    // Stagger horizontally based on existing children count so siblings don't overlap.
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

const onSubmit = handleSubmit(async (values) => {
  const t = type.value
  const parent = selectedParent.value
  if (t == null || parent == null) return

  const trimmedName = values.name.trim()
  let nodes: FlowNode[]
  let primaryId: NodeId

  if (t === 'dateTime') {
    const created = createNode('dateTime', parent.id, { name: trimmedName })
    nodes = [created.dateTime, created.connectors[0], created.connectors[1]]
    primaryId = created.dateTime.id
  } else if (t === 'sendMessage') {
    const created = createNode('sendMessage', parent.id, { name: trimmedName })
    nodes = [created]
    primaryId = created.id
  } else {
    const created = createNode('addComment', parent.id, { name: trimmedName })
    nodes = [created]
    primaryId = created.id
  }

  const positions = computePositions(nodes, parent.id)

  try {
    await mutation.mutateAsync({ nodes, positions, label: `Create ${t}` })
  } catch {
    return
  }

  setOpen(false)
  toast.success(`${defaultName(t)} created`)
  void router.push(`/node/${primaryId}`)
})
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent data-testid="create-node-dialog" class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create node</DialogTitle>
        <DialogDescription>
          <template v-if="step === 'type' && parentLabel != null">
            Pick a node type to add under <strong>{{ parentLabel }}</strong>.
          </template>
          <template v-else-if="step === 'type'">Pick a node type to add to the canvas.</template>
          <template v-else-if="step === 'parent'">Choose where this node should attach.</template>
          <template v-else-if="parentLabel != null">
            Name the new node. It will attach under <strong>{{ parentLabel }}</strong>.
          </template>
          <template v-else>Confirm the new node&rsquo;s name.</template>
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" novalidate @submit="onSubmit">
        <div v-if="step === 'type'" class="grid gap-2" data-testid="step-type">
          <button
            v-for="opt in TYPE_OPTIONS"
            :key="opt.value"
            type="button"
            class="flex flex-col items-start gap-0.5 rounded-md border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary"
            :class="{ 'border-primary ring-2 ring-primary/30': type === opt.value }"
            :data-type-option="opt.value"
            @click="selectType(opt.value)"
          >
            <span class="font-medium">{{ opt.label }}</span>
            <span class="text-xs text-muted-foreground">{{ opt.hint }}</span>
          </button>
        </div>

        <div v-else-if="step === 'parent'" class="space-y-1.5" data-testid="step-parent">
          <Label for="create-parent">Parent node</Label>
          <Select v-model="parentKey">
            <SelectTrigger id="create-parent" class="w-full">
              <SelectValue placeholder="Select parent…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in parentOptions" :key="opt.key" :value="opt.key">
                {{ opt.label }} — {{ humanizeKey(opt.type) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">
            Any node can act as a parent, including success/failure connectors.
          </p>
        </div>

        <div v-else class="space-y-1.5" data-testid="step-details">
          <Label for="create-name">Name</Label>
          <Input
            id="create-name"
            v-model="name"
            v-bind="nameProps"
            maxlength="80"
            :aria-invalid="errors.name != null"
          />
          <p v-if="errors.name" class="text-xs text-destructive" data-testid="name-error">
            {{ errors.name }}
          </p>
          <p v-else class="text-xs text-muted-foreground">
            You can edit details after creating.
          </p>
        </div>

        <DialogFooter class="flex items-center justify-between gap-2 sm:justify-between">
          <Button
            v-if="step !== 'type'"
            type="button"
            variant="outline"
            :disabled="mutation.isPending.value"
            @click="goBack"
          >
            Back
          </Button>
          <span v-else />

          <div class="flex items-center gap-2">
            <Button type="button" variant="ghost" @click="setOpen(false)">Cancel</Button>
            <Button
              v-if="step !== 'details'"
              type="button"
              :disabled="
                (step === 'type' && type == null) ||
                (step === 'parent' && parentKey == null)
              "
              data-testid="create-next"
              @click="goNext"
            >
              Next
            </Button>
            <Button
              v-else
              type="submit"
              :disabled="!meta.valid || mutation.isPending.value"
              data-testid="create-submit"
            >
              {{ mutation.isPending.value ? 'Creating…' : 'Create' }}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
