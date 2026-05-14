<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/valibot'
import { Trash2 } from 'lucide-vue-next'
import { useForm } from 'vee-validate'
import * as v from 'valibot'
import { watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { AddCommentNode, FlowNode } from '@/lib/types'
import { commentSchema, descriptionSchema, titleSchema } from '@/lib/validators'
import { useUpdateNode } from '@/queries/nodes'

const props = withDefaults(
  defineProps<{ node: AddCommentNode; canDelete?: boolean; deletePending?: boolean }>(),
  { canDelete: false, deletePending: false },
)
const emit = defineEmits<{ (e: 'saved'): void; (e: 'delete'): void }>()

const formSchema = toTypedSchema(
  v.object({
    name: titleSchema,
    description: descriptionSchema,
    comment: commentSchema,
  }),
)

const { defineField, handleSubmit, errors, meta, resetForm } = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: props.node.name,
    description: props.node.description ?? '',
    comment: props.node.data.comment,
  },
})

const [name, nameProps] = defineField('name')
const [description, descriptionProps] = defineField('description')
const [comment, commentProps] = defineField('comment')

watch(
  () => props.node.id,
  () => {
    resetForm({
      values: {
        name: props.node.name,
        description: props.node.description ?? '',
        comment: props.node.data.comment,
      },
    })
  },
)

const mutation = useUpdateNode()

const onSubmit = handleSubmit(async (values) => {
  const trimmedDescription = (values.description ?? '').trim()
  const patch: Partial<FlowNode> = {
    name: values.name.trim(),
    description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
    data: { comment: values.comment },
  } as Partial<FlowNode>
  try {
    await mutation.mutateAsync({ id: props.node.id, patch })
  } catch {
    return
  }
  toast.success('Comment saved')
  emit('saved')
})
</script>

<template>
  <form class="flex h-full flex-col" novalidate @submit="onSubmit">
    <div class="flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <div class="space-y-1.5">
        <Label for="comment-name">Title</Label>
        <Input
          id="comment-name"
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
        <Label for="comment-description">Description</Label>
        <Textarea
          id="comment-description"
          v-model="description"
          v-bind="descriptionProps"
          rows="3"
          maxlength="500"
          data-testid="comment-description"
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
        <Label for="comment-body">Comment</Label>
        <Textarea
          id="comment-body"
          v-model="comment"
          v-bind="commentProps"
          rows="6"
          maxlength="1000"
          :aria-invalid="errors.comment != null"
        />
        <div class="flex items-center justify-between text-xs">
          <p v-if="errors.comment" class="text-destructive" data-testid="comment-error">
            {{ errors.comment }}
          </p>
          <p v-else class="text-muted-foreground">{{ (comment ?? '').length }} / 1000</p>
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
