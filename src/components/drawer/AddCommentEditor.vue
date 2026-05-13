<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { AddCommentNode, FlowNode } from '@/lib/types'
import { validateComment, validateTitle } from '@/lib/validators'
import { useUpdateNode } from '@/queries/nodes'

const props = defineProps<{ node: AddCommentNode }>()
const emit = defineEmits<{ (e: 'saved'): void }>()

const name = ref(props.node.name)
const comment = ref(props.node.data.comment)
const nameTouched = ref(false)
const commentTouched = ref(false)
const submitAttempted = ref(false)

// Re-sync local form state when the underlying node id changes (e.g. user
// navigates between /node/:id targets while the drawer is still mounted).
watch(
  () => props.node.id,
  () => {
    name.value = props.node.name
    comment.value = props.node.data.comment
    nameTouched.value = false
    commentTouched.value = false
    submitAttempted.value = false
  },
)

const nameResult = computed(() => validateTitle(name.value))
const commentResult = computed(() => validateComment(comment.value))

const nameError = computed(() =>
  (nameTouched.value || submitAttempted.value) && !nameResult.value.ok
    ? nameResult.value.message
    : null,
)
const commentError = computed(() =>
  (commentTouched.value || submitAttempted.value) && !commentResult.value.ok
    ? commentResult.value.message
    : null,
)

const isValid = computed(() => nameResult.value.ok && commentResult.value.ok)

const mutation = useUpdateNode()

async function onSubmit(): Promise<void> {
  submitAttempted.value = true
  if (!isValid.value) return
  const patch: Partial<FlowNode> = {
    name: name.value.trim(),
    data: { comment: comment.value },
  } as Partial<FlowNode>
  try {
    await mutation.mutateAsync({ id: props.node.id, patch, label: 'Edit comment' })
  } catch {
    return
  }
  toast.success('Comment saved')
  emit('saved')
}
</script>

<template>
  <form class="flex h-full flex-col" novalidate @submit.prevent="onSubmit">
    <div class="flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <div class="space-y-1.5">
        <Label for="comment-name">Name</Label>
        <Input
          id="comment-name"
          v-model="name"
          maxlength="80"
          :aria-invalid="nameError != null"
          @blur="nameTouched = true"
        />
        <p v-if="nameError" class="text-xs text-destructive" data-testid="name-error">
          {{ nameError }}
        </p>
      </div>

      <div class="space-y-1.5">
        <Label for="comment-body">Comment</Label>
        <Textarea
          id="comment-body"
          v-model="comment"
          rows="6"
          maxlength="1000"
          :aria-invalid="commentError != null"
          @blur="commentTouched = true"
        />
        <div class="flex items-center justify-between text-xs">
          <p v-if="commentError" class="text-destructive" data-testid="comment-error">
            {{ commentError }}
          </p>
          <p v-else class="text-muted-foreground">{{ comment.length }} / 1000</p>
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
