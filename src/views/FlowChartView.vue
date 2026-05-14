<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query";
import { Keyboard, RotateCcw } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";

import NodeDetailsDrawer from "@/components/drawer/NodeDetailsDrawer.vue";
import CreateNodeDialog from "@/components/flow/CreateNodeDialog.vue";
import FlowCanvas from "@/components/flow/FlowCanvas.vue";
import ShortcutHelpDialog from "@/components/ShortcutHelpDialog.vue";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useFlowHistory } from "@/composables/useFlowHistory";
import { useNodeKeyboard } from "@/composables/useNodeKeyboard";
import { usePersistFlag } from "@/composables/usePersistFlag";
import { clearCachedNodes, resetNodes, saveNodes } from "@/lib/payload-adapter";
import { useNodesQuery } from "@/queries/nodes";
import { NODES_QUERY_KEY } from "@/queries/client";
import { useFlowStore } from "@/stores/flow";
import { useHistoryStore } from "@/stores/history";

const route = useRoute();
const router = useRouter();
const store = useFlowStore();
const history = useHistoryStore();
const persistEnabled = usePersistFlag();
const queryClient = useQueryClient();

const query = useNodesQuery();
const resetConfirmOpen = ref(false);
const persistOffConfirmOpen = ref(false);
const helpOpen = ref(false);
const resetting = ref(false);

const createDialogOpen = computed({
  get: () => store.createDialog.open,
  set: (next) => {
    if (next) store.openCreateDialog();
    else store.closeCreateDialog();
  },
});

useFlowHistory();
useNodeKeyboard({
  onHelp: () => {
    helpOpen.value = true;
  },
});

const drawerNodeId = computed(() => {
  const raw = route.params.id;
  if (raw == null) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value == null || value === "" ? null : value;
});

// Post-hydration guard. The router's beforeEnter handles the case when
// localStorage is already seeded; this watcher catches first-visit deep
// links where the store hadn't loaded yet at navigation time. Gating on
// `store.nodes.length` (not `query.isSuccess`) avoids a race where the
// success flag flips before the hydration watcher in useNodesQuery runs.
watch(
  [drawerNodeId, () => store.nodes.length],
  ([id, count]) => {
    if (id == null) return;
    if (count === 0) return;
    const node = store.getNodeById(id);
    if (node == null) {
      toast.warning(`Node "${id}" not found`);
      void router.replace("/");
      return;
    }
    if (node.type === "dateTimeConnector") {
      toast.info("Connectors are display-only");
      void router.replace("/");
    }
  },
  { immediate: true },
);

function onPersistToggle(next: boolean): void {
  if (next) {
    persistEnabled.value = true;
    // Persist the current in-memory state immediately so the user sees the
    // setting take effect without needing to make a change first.
    void saveNodes([...store.nodes]);
    toast.success("Data will be saved across refreshes");
  } else {
    // Confirm before destroying the cached state.
    persistOffConfirmOpen.value = true;
  }
}

function onConfirmPersistOff(): void {
  persistEnabled.value = false;
  clearCachedNodes();
  persistOffConfirmOpen.value = false;
  toast.success("Saved data cleared; a refresh will reset everything");
}

function onCancelPersistOff(): void {
  persistOffConfirmOpen.value = false;
}

async function onConfirmReset(): Promise<void> {
  resetting.value = true;
  try {
    const seed = await resetNodes();
    store.hydrate(seed);
    // Drop the layout cache so the watchEffect in FlowCanvas re-computes from
    // the canonical tree — otherwise nodes the user dragged stay where they
    // were instead of snapping back to the original layout.
    store.clearPositions();
    history.clear();
    queryClient.setQueryData(NODES_QUERY_KEY, seed);
    if (drawerNodeId.value != null) {
      void router.push("/");
    }
    toast.success("Flow chart reset");
  } catch (error) {
    toast.error("Reset failed", {
      description: error instanceof Error ? error.message : undefined,
    });
  } finally {
    resetting.value = false;
    resetConfirmOpen.value = false;
  }
}
</script>

<template>
  <div class="flex h-screen flex-col bg-slate-50 text-slate-900">
    <header class="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div class="flex items-baseline gap-3">
        <h1 class="text-base font-semibold tracking-tight">Flow Chart</h1>
        <span v-if="query.isPending.value" class="text-xs text-slate-500">Loading…</span>
        <span v-else-if="query.isError.value" class="text-xs text-red-600">
          Failed to load payload
        </span>
        <span v-else class="text-xs text-slate-500">{{ store.nodes.length }} nodes</span>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <Label
            for="persist-switch"
            class="text-xs font-medium text-slate-700"
            title="When on, your changes are saved to localStorage and survive page refreshes. File uploads are never persisted."
          >
            Persist data
          </Label>
          <Switch
            id="persist-switch"
            data-testid="persist-switch"
            :model-value="persistEnabled"
            @update:model-value="onPersistToggle"
          />
        </div>
        <div class="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100"
          title="Keyboard shortcuts (?)"
          aria-label="Show keyboard shortcuts"
          data-testid="help-button"
          @click="helpOpen = true"
        >
          <Keyboard class="size-3" />
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-50"
          :disabled="query.isPending.value || query.isError.value || resetting"
          data-testid="reset-button"
          @click="resetConfirmOpen = true"
        >
          <RotateCcw class="size-3" />
          Reset
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
          :disabled="query.isPending.value || query.isError.value"
          data-testid="create-node-button"
          @click="store.openCreateDialog()"
        >
          + Create New Node
        </button>
      </div>
    </header>

    <main class="relative flex-1 overflow-hidden">
      <FlowCanvas class="absolute inset-0" />
      <NodeDetailsDrawer />
    </main>
    <CreateNodeDialog v-model:open="createDialogOpen" />
    <ShortcutHelpDialog v-model:open="helpOpen" />

    <AlertDialog :open="resetConfirmOpen" @update:open="(v) => (resetConfirmOpen = v)">
      <AlertDialogContent data-testid="reset-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>Reset the flow chart?</AlertDialogTitle>
          <AlertDialogDescription>
            This discards every change you have made and restores the original payload.json. Undo
            history is cleared and cannot be recovered.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="reset-cancel" :disabled="resetting">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="reset-confirm-action"
            :disabled="resetting"
            @click="onConfirmReset"
          >
            {{ resetting ? "Resetting…" : "Reset" }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog :open="persistOffConfirmOpen" @update:open="(v) => (persistOffConfirmOpen = v)">
      <AlertDialogContent data-testid="persist-off-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>Turn off data persistence?</AlertDialogTitle>
          <AlertDialogDescription>
            Disabling this setting clears any saved canvas state from this browser. After a refresh
            the canvas will reset to the original payload.json. Continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="persist-off-cancel" @click="onCancelPersistOff">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction data-testid="persist-off-confirm-action" @click="onConfirmPersistOff">
            Turn off
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
