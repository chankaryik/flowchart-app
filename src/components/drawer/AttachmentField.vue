<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import {
  Download,
  File as FileIcon,
  FileText,
  Film,
  Image as ImageIconComp,
  Music,
  Plus,
  Upload,
  X,
} from 'lucide-vue-next'
import { ref } from 'vue'

import { Button } from '@/components/ui/button'

const props = defineProps<{
  modelValue: string[]
  files: File[]
  ariaLabel?: string
  error?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
  (e: 'update:files', files: File[]): void
  (e: 'blur'): void
}>()

const dropRef = ref<HTMLDivElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

function appendFiles(incoming: File[] | FileList | null): void {
  if (incoming == null) return
  const list = Array.from(incoming)
  if (list.length === 0) return
  const nextFiles = [...props.files, ...list]
  const nextNames = [...props.modelValue, ...list.map((f) => f.name)]
  emit('update:files', nextFiles)
  emit('update:modelValue', nextNames)
}

const { isOverDropZone } = useDropZone(dropRef, {
  onDrop: (files) => appendFiles(files),
  multiple: true,
})

function openPicker(): void {
  inputRef.value?.click()
}

function onPickerChange(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  appendFiles(target.files)
  target.value = ''
}

function removeAt(index: number): void {
  const nextFiles = props.files.filter((_, i) => i !== index)
  const nextNames = props.modelValue.filter((_, i) => i !== index)
  emit('update:files', nextFiles)
  emit('update:modelValue', nextNames)
  emit('blur')
}

function download(index: number): void {
  const file = props.files[index]
  if (file == null) return
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = props.modelValue[index] ?? file.name
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function iconFor(name: string): typeof FileIcon {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext))
    return ImageIconComp
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return Film
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return Music
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'csv', 'json'].includes(ext)) return FileText
  return FileIcon
}
</script>

<template>
  <div class="space-y-1.5">
    <input
      ref="inputRef"
      type="file"
      class="hidden"
      multiple
      :aria-label="ariaLabel"
      data-testid="attachment-input"
      @change="onPickerChange"
    />

    <ul v-if="modelValue.length > 0" class="space-y-1" data-testid="attachment-list">
      <li
        v-for="(name, index) in modelValue"
        :key="`${name}-${index}`"
        class="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-2"
        data-testid="attachment-preview"
      >
        <component :is="iconFor(name)" class="size-4 shrink-0 text-muted-foreground" />
        <span class="flex-1 truncate text-sm" :title="name">{{ name }}</span>
        <Button
          v-if="files[index]"
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Download file"
          data-testid="attachment-download"
          @click="download(index)"
        >
          <Download class="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          :aria-label="`Remove ${name}`"
          data-testid="attachment-clear"
          @click="removeAt(index)"
        >
          <X class="size-4" />
        </Button>
      </li>
    </ul>

    <!-- Dropzone has no @blur: clicking it routes through openPicker -> hidden
         input, and a synthetic blur there would mark the row touched and flash
         "Please upload a file" before the user even sees the file dialog. The
         touched state is set on file-change and remove-file instead. -->
    <div
      ref="dropRef"
      role="button"
      tabindex="0"
      :aria-invalid="error != null"
      data-testid="attachment-dropzone"
      class="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-card px-3 py-3 text-center text-xs text-muted-foreground transition-colors hover:border-primary"
      :class="{
        'border-primary bg-primary/5 text-primary': isOverDropZone,
        'border-destructive': error != null && modelValue.length === 0,
        'border-border': error == null || modelValue.length > 0,
      }"
      @click="openPicker"
      @keydown.enter.prevent="openPicker"
      @keydown.space.prevent="openPicker"
    >
      <component :is="modelValue.length > 0 ? Plus : Upload" class="size-4" />
      <span v-if="modelValue.length === 0">
        <span class="font-medium text-foreground">Click to upload</span>
        or drag and drop
      </span>
      <span v-else>
        <span class="font-medium text-foreground">Add more files</span>
        or drag and drop
      </span>
    </div>
  </div>
</template>
