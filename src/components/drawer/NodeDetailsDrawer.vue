<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { humanizeKey } from "@/lib/format";
import type { FlowNode } from "@/lib/types";
import { useDeleteNode } from "@/queries/nodes";
import { useFlowStore } from "@/stores/flow";

import AddCommentEditor from "./AddCommentEditor.vue";
import BusinessHoursEditor from "./BusinessHoursEditor.vue";
import SendMessageEditor from "./SendMessageEditor.vue";
import TriggerDetails from "./TriggerDetails.vue";

const route = useRoute();
const router = useRouter();
const store = useFlowStore();
const deleteMutation = useDeleteNode();

const confirmOpen = ref(false);
const unsavedConfirmOpen = ref(false);
const editorDirty = ref(false);

const drawerId = computed(() => {
  const raw = route.params.id;
  if (raw == null) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value == null || value === "" ? null : value;
});

const node = computed<FlowNode | null>(() => {
  const id = drawerId.value;
  if (id == null) return null;
  const found = store.getNodeById(id);
  if (found == null || found.type === "dateTimeConnector") return null;
  return found;
});

const isOpen = computed(() => node.value != null);

// Reset dirty tracking whenever the drawer points at a different node — each
// editor remounts and will re-emit its dirty state on the next tick, but this
// avoids a brief window where the prior node's dirty value leaks across.
watch(drawerId, () => {
  editorDirty.value = false;
  unsavedConfirmOpen.value = false;
});

function onUpdateOpen(open: boolean): void {
  if (open) return;
  if (editorDirty.value) {
    unsavedConfirmOpen.value = true;
    return;
  }
  close();
}

function close(): void {
  void router.push("/");
}

function onDiscardUnsaved(): void {
  unsavedConfirmOpen.value = false;
  editorDirty.value = false;
  close();
}

function nodeTitle(n: FlowNode): string {
  return "name" in n ? n.name : `Trigger #${n.id}`;
}

function typeLabel(n: FlowNode): string {
  switch (n.type) {
    case "trigger":
      return "Trigger";
    case "sendMessage":
      return "Send Message";
    case "dateTime":
      return "Date / Time";
    case "addComment":
      return "Comment";
    case "dateTimeConnector":
      return "Connector";
    default:
      return humanizeKey((n as { type: string }).type);
  }
}

const canDelete = computed(() => node.value != null && node.value.type !== "trigger");

async function onConfirmDelete(): Promise<void> {
  const target = node.value;
  if (target == null) return;
  confirmOpen.value = false;
  // Await the navigation so the route's `id` param has cleared before the
  // optimistic onMutate removes the node. Without this, router.push() is
  // still in flight when the store changes, the FlowChartView watcher fires
  // with the soon-deleted ID still in the route, and "Node not found" toasts.
  await router.push("/");
  try {
    await deleteMutation.mutateAsync({ id: target.id });
  } catch {
    return;
  }
  toast.success("Node deleted", { description: "Press Ctrl/Cmd+Z to undo" });
}
</script>

<template>
  <Sheet :open="isOpen" @update:open="onUpdateOpen">
    <!-- Sheet slides via CSS translateX per CLAUDE.md §8.6 — no width animations. -->
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      data-testid="node-details-drawer"
    >
      <template v-if="node">
        <SheetHeader class="border-b border-border px-4 py-3">
          <div class="space-y-0.5 pr-10">
            <span class="text-3xs font-semibold uppercase tracking-wide text-muted-foreground">
              {{ typeLabel(node) }}
            </span>
            <SheetTitle class="text-base font-semibold">{{ nodeTitle(node) }}</SheetTitle>
            <SheetDescription class="text-xs">
              ID <code class="font-mono">{{ node.id }}</code>
            </SheetDescription>
          </div>
        </SheetHeader>

        <div class="min-h-0 flex-1">
          <SendMessageEditor
            v-if="node.type === 'sendMessage'"
            v-model:dirty="editorDirty"
            :node="node"
            :can-delete="canDelete"
            :delete-pending="deleteMutation.isPending.value"
            @saved="close"
            @delete="confirmOpen = true"
          />
          <BusinessHoursEditor
            v-else-if="node.type === 'dateTime'"
            v-model:dirty="editorDirty"
            :node="node"
            :can-delete="canDelete"
            :delete-pending="deleteMutation.isPending.value"
            @saved="close"
            @delete="confirmOpen = true"
          />
          <AddCommentEditor
            v-else-if="node.type === 'addComment'"
            v-model:dirty="editorDirty"
            :node="node"
            :can-delete="canDelete"
            :delete-pending="deleteMutation.isPending.value"
            @saved="close"
            @delete="confirmOpen = true"
          />
          <TriggerDetails v-else-if="node.type === 'trigger'" :node="node" />
        </div>
      </template>
    </SheetContent>
  </Sheet>

  <AlertDialog :open="confirmOpen" @update:open="(v) => (confirmOpen = v)">
    <AlertDialogContent data-testid="delete-confirm">
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this node?</AlertDialogTitle>
        <AlertDialogDescription>
          This removes the node and every node below it. You can undo with Ctrl+Z.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel data-testid="delete-cancel">Cancel</AlertDialogCancel>
        <AlertDialogAction
          data-testid="delete-confirm-action"
          :disabled="deleteMutation.isPending.value"
          @click="onConfirmDelete"
        >
          {{ deleteMutation.isPending.value ? "Deleting…" : "Delete" }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog :open="unsavedConfirmOpen" @update:open="(v) => (unsavedConfirmOpen = v)">
    <AlertDialogContent data-testid="unsaved-confirm">
      <AlertDialogHeader>
        <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
        <AlertDialogDescription>
          Your edits to this node have not been saved. Discard them?
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel data-testid="unsaved-cancel">Keep editing</AlertDialogCancel>
        <AlertDialogAction data-testid="unsaved-confirm-action" @click="onDiscardUnsaved">
          Discard
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
