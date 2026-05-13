<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/valibot'
import { useForm } from 'vee-validate'
import * as v from 'valibot'
import { watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { AddCommentNode, FlowNode } from '@/lib/types'
import { commentSchema, titleSchema } from '@/lib/validators'
import { useUpdateNode } from '@/queries/nodes'

const props = defineProps<{ node: AddCommentNode }>()
const emit = defineEmits<{ (e: 'saved'): void }>()

const formSchema = toTypedSchema(
  v.object({
    name: titleSchema,
    comment: commentSchema,
  }),
)

const { defineField, handleSubmit, errors, meta, resetForm } = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: props.node.name,
    comment: props.node.data.comment,
  },
})

const [name, nameProps] = defineField('name')
const [comment, commentProps] = defineField('comment')

watch(
  () => props.node.id,
  () => {
    resetForm({
      values: { name: props.node.name, comment: props.node.data.comment },
    })
  },
)

const mutation = useUpdateNode()

const onSubmit = handleSubmit(async (values) => {
  const patch: Partial<FlowNode> = {
    name: values.name.trim(),
    data: { comment: values.comment },
  } as Partial<FlowNode>
  try {
    await mutation.mutateAsync({ id: props.node.id, patch, label: 'Edit comment' })
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
        <Label for="comment-name">Name</Label>
        <Input
          id="comment-name"
          v-model="name"
          v-bind="nameProps"
          maxlength="80"
          :aria-invalid="errors.name != null"
        />
        <p v-if="errors.name" class="text-xs text-destructive" data-testid="name-error">
          {{ errors.name }}
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

    <footer class="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
      <Button type="submit" :disabled="!meta.valid || mutation.isPending.value">
        {{ mutation.isPending.value ? 'Saving…' : 'Save' }}
      </Button>
    </footer>
  </form>
</template>
