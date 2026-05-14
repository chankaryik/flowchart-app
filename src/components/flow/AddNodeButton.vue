<script setup lang="ts">
import { Plus } from 'lucide-vue-next'

import type { NodeId } from '@/lib/types'
import { useFlowStore } from '@/stores/flow'

const props = defineProps<{ parentId: NodeId }>()
const store = useFlowStore()

// `nodrag` keeps Vue Flow from starting a node-drag on the button.
// stopPropagation keeps the click off the underlying node so we don't
// also navigate to /node/:id from FlowCanvas.onNodeClick.
function onClick(event: MouseEvent): void {
  event.stopPropagation()
  store.openCreateDialog(props.parentId)
}
</script>

<template>
  <button
    type="button"
    class="nodrag add-node-button"
    :data-add-node-parent="String(parentId)"
    data-testid="add-node-button"
    aria-label="Add child node"
    title="Add child node"
    @click="onClick"
    @mousedown.stop
  >
    <span class="add-node-line" aria-hidden="true" />
    <span class="add-node-circle">
      <Plus class="size-3" aria-hidden="true" />
    </span>
  </button>
</template>

<style scoped>
.add-node-button {
  position: absolute;
  left: 50%;
  top: 100%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding: 4px 0 0;
  background: transparent;
  border: 0;
  cursor: pointer;
  z-index: 5;
}

.add-node-line {
  display: block;
  width: 0;
  height: 12px;
  border-left: 1px dashed rgb(148 163 184);
}

.add-node-circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  border: 1px dashed rgb(148 163 184);
  background: white;
  color: rgb(100 116 139);
  transition:
    border-color 120ms ease,
    color 120ms ease,
    transform 120ms ease;
}

.add-node-button:hover .add-node-circle,
.add-node-button:focus-visible .add-node-circle {
  border-style: solid;
  border-color: rgb(59 130 246);
  color: rgb(59 130 246);
  transform: scale(1.08);
}

.add-node-button:focus-visible {
  outline: none;
}

.add-node-button:focus-visible .add-node-circle {
  box-shadow:
    0 0 0 2px white,
    0 0 0 4px rgb(59 130 246 / 0.5);
}
</style>
