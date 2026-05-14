<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { breakpointsTailwind, useBreakpoints, useStorage } from '@vueuse/core'
import {
  AlertTriangle,
  Keyboard,
  Menu,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import NodeDetailsDrawer from '@/components/drawer/NodeDetailsDrawer.vue'
import CreateNodeDialog from '@/components/flow/CreateNodeDialog.vue'
import FlowCanvas from '@/components/flow/FlowCanvas.vue'
import ShortcutHelpDialog from '@/components/ShortcutHelpDialog.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useFlowHistory } from '@/composables/useFlowHistory'
import { useNodeKeyboard } from '@/composables/useNodeKeyboard'
import {
  PERSIST_ENABLED_KEY,
  clearCachedNodes,
  enablePersistenceWithSnapshot,
  resetNodes,
} from '@/lib/payload-adapter'
import { useNodesQuery, useRelayoutNodes } from '@/queries/nodes'
import { NODES_QUERY_KEY } from '@/queries/client'
import { useFlowStore } from '@/stores/flow'
import { useHistoryStore } from '@/stores/history'

const route = useRoute()
const router = useRouter()
const store = useFlowStore()
const history = useHistoryStore()
// Serialize as '1' / '' so the payload-adapter's `=== '1'` check keeps working
// across both the SPA and Playwright (which seeds the flag with the literal '1').
const persistEnabled = useStorage(PERSIST_ENABLED_KEY, false, undefined, {
  serializer: {
    read: (raw: string) => raw === '1',
    write: (value: boolean) => (value ? '1' : ''),
  },
})
const queryClient = useQueryClient()

const query = useNodesQuery()
const relayoutMutation = useRelayoutNodes()
const resetConfirmOpen = ref(false)
const helpOpen = ref(false)
const resetting = ref(false)
const seeding = ref(false)
const mobileMenuOpen = ref(false)

const breakpoints = useBreakpoints(breakpointsTailwind)
const isDesktop = breakpoints.greaterOrEqual('md')
watch(isDesktop, (desktop) => {
  if (desktop) mobileMenuOpen.value = false
})

function openHelp(): void {
  mobileMenuOpen.value = false
  helpOpen.value = true
}

function openResetConfirm(): void {
  mobileMenuOpen.value = false
  resetConfirmOpen.value = true
}

async function onMobileRelayout(): Promise<void> {
  mobileMenuOpen.value = false
  await onRelayout()
}

const createDialogOpen = computed({
  get: () => store.createDialog.open,
  set: (next) => {
    if (next) store.openCreateDialog()
    else store.closeCreateDialog()
  },
})

useFlowHistory()
useNodeKeyboard({
  onHelp: () => {
    helpOpen.value = true
  },
})

const drawerNodeId = computed(() => {
  const raw = route.params.id
  if (raw == null) return null
  const value = Array.isArray(raw) ? raw[0] : raw
  return value == null || value === '' ? null : value
})

const showLoading = computed(() => query.isPending.value && store.nodes.length === 0)
const showError = computed(() => query.isError.value && store.nodes.length === 0)
const showEmpty = computed(
  () => !query.isPending.value && !query.isError.value && store.nodes.length === 0,
)

// Post-hydration guard. The router's beforeEnter handles the case when
// localStorage is already seeded; this watcher catches first-visit deep
// links where the store hadn't loaded yet at navigation time. Gating on
// `store.nodes.length` (not `query.isSuccess`) avoids a race where the
// success flag flips before the hydration watcher in useNodesQuery runs.
watch(
  [drawerNodeId, () => store.nodes.length],
  ([id, count]) => {
    if (id == null) return
    if (count === 0) return
    const node = store.getNodeById(id)
    if (node == null) {
      toast.warning(`Node "${id}" not found`)
      void router.replace('/')
      return
    }
    if (node.type === 'dateTimeConnector') {
      toast.info('Connectors are display-only')
      void router.replace('/')
    }
  },
  { immediate: true },
)

function onPersistToggle(next: boolean): void {
  persistEnabled.value = next
  if (next) {
    // Persist the current in-memory state immediately so the user sees the
    // setting take effect without needing to make a change first.
    enablePersistenceWithSnapshot([...store.nodes], { ...store.positions })
    toast.success('Data will be saved across refreshes')
  } else {
    clearCachedNodes()
    toast.success('Saved data cleared')
  }
}

async function restoreDefaultPayload(successMessage: string): Promise<boolean> {
  try {
    const seed = await resetNodes()
    store.hydrate(seed)
    // Drop the layout cache so the watchEffect in FlowCanvas re-computes from
    // the canonical tree — otherwise nodes the user dragged stay where they
    // were instead of snapping back to the original layout.
    store.clearPositions()
    history.clear()
    queryClient.setQueryData(NODES_QUERY_KEY, seed)
    if (drawerNodeId.value != null) {
      void router.push('/')
    }
    toast.success(successMessage)
    return true
  } catch (error) {
    toast.error('Reset failed', {
      description: error instanceof Error ? error.message : undefined,
    })
    return false
  }
}

async function onRetry(): Promise<void> {
  try {
    await query.refetch()
    toast.success('Reloaded')
  } catch (error) {
    toast.error('Reload failed', {
      description: error instanceof Error ? error.message : undefined,
    })
  }
}

async function onSeedDefault(): Promise<void> {
  seeding.value = true
  try {
    await restoreDefaultPayload('Default payload restored')
  } finally {
    seeding.value = false
  }
}

async function onRelayout(): Promise<void> {
  try {
    await relayoutMutation.mutateAsync()
    toast.success('Layout tidied')
  } catch {
    // The mutation owns the failure toast.
  }
}

async function onConfirmReset(): Promise<void> {
  resetting.value = true
  try {
    await restoreDefaultPayload('Flow chart reset')
  } finally {
    resetting.value = false
    resetConfirmOpen.value = false
  }
}
</script>

<template>
  <div class="flex h-screen flex-col bg-background text-foreground">
    <header
      class="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3 md:px-6"
    >
      <div class="flex min-w-0 items-baseline gap-3">
        <h1 class="truncate text-base font-semibold tracking-tight">Flow Chart</h1>
        <span v-if="query.isPending.value" class="text-xs text-muted-foreground">Loading…</span>
        <span v-else-if="query.isError.value" class="hidden text-xs text-destructive sm:inline">
          Failed to load payload
        </span>
        <span v-else class="hidden text-xs text-muted-foreground sm:inline">
          {{ store.nodes.length }} nodes
        </span>
      </div>

      <div class="hidden items-center gap-3 md:flex">
        <div class="flex items-center gap-2">
          <Label
            for="persist-switch"
            class="text-xs font-medium text-foreground"
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
        <div class="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <ThemeToggle variant="icon" align="end" />
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
          title="Keyboard shortcuts (?)"
          aria-label="Show keyboard shortcuts"
          data-testid="help-button"
          @click="helpOpen = true"
        >
          <Keyboard class="size-3" />
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-medium text-destructive shadow-sm hover:bg-destructive/10 disabled:opacity-50"
          :disabled="query.isPending.value || query.isError.value || resetting"
          data-testid="reset-button"
          @click="resetConfirmOpen = true"
        >
          <RotateCcw class="size-3" />
          Reset
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          :disabled="
            query.isPending.value ||
            query.isError.value ||
            resetting ||
            store.nodes.length === 0 ||
            relayoutMutation.isPending.value
          "
          title="Recompute tidy node layout"
          data-testid="relayout-button"
          @click="onRelayout"
        >
          <RefreshCw class="size-3" />
          Re-layout
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          :disabled="query.isPending.value || query.isError.value"
          data-testid="create-node-button"
          @click="store.openCreateDialog()"
        >
          + Create New Node
        </button>
      </div>

      <div class="flex items-center gap-2 md:hidden">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-md bg-primary p-2 text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          :disabled="query.isPending.value || query.isError.value"
          data-testid="create-node-button-mobile"
          aria-label="Create new node"
          title="Create new node"
          @click="store.openCreateDialog()"
        >
          <Plus class="size-4" />
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
          data-testid="menu-button"
          aria-label="Open menu"
          title="Open menu"
          @click="mobileMenuOpen = true"
        >
          <Menu class="size-4" />
        </button>
      </div>
    </header>

    <Sheet :open="mobileMenuOpen" @update:open="(v) => (mobileMenuOpen = v)">
      <SheetContent side="left" class="flex w-72 flex-col gap-0 p-0" data-testid="mobile-menu">
        <SheetHeader class="border-b border-border px-4 py-3">
          <SheetTitle class="text-base font-semibold">Menu</SheetTitle>
          <SheetDescription class="text-xs">
            {{
              query.isPending.value
                ? 'Loading…'
                : query.isError.value
                  ? 'Failed to load payload'
                  : `${store.nodes.length} nodes`
            }}
          </SheetDescription>
        </SheetHeader>

        <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          <div
            class="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5"
          >
            <div class="min-w-0">
              <Label for="persist-switch-mobile" class="text-sm font-medium text-foreground">
                Persist data
              </Label>
              <p class="mt-0.5 text-xs text-muted-foreground">
                Save changes across page refreshes. File uploads are not persisted.
              </p>
            </div>
            <Switch
              id="persist-switch-mobile"
              :model-value="persistEnabled"
              @update:model-value="onPersistToggle"
            />
          </div>

          <ThemeToggle variant="row" align="start" />

          <button
            type="button"
            class="inline-flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            :disabled="
              query.isPending.value ||
              query.isError.value ||
              resetting ||
              store.nodes.length === 0 ||
              relayoutMutation.isPending.value
            "
            @click="onMobileRelayout"
          >
            <RefreshCw class="size-4" />
            Re-layout
          </button>

          <button
            type="button"
            class="inline-flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
            @click="openHelp"
          >
            <Keyboard class="size-4" />
            Keyboard shortcuts
          </button>

          <button
            type="button"
            class="mt-auto inline-flex w-full items-center gap-2 rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm font-medium text-destructive shadow-sm hover:bg-destructive/10 disabled:opacity-50"
            :disabled="query.isPending.value || query.isError.value || resetting"
            @click="openResetConfirm"
          >
            <RotateCcw class="size-4" />
            Reset flow chart
          </button>
        </div>
      </SheetContent>
    </Sheet>

    <main class="relative flex-1 overflow-hidden">
      <FlowCanvas class="absolute inset-0" />
      <NodeDetailsDrawer />

      <div
        v-if="showLoading"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm"
        data-testid="canvas-loading"
        role="status"
        aria-live="polite"
      >
        <div class="flex w-72 flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
          <Skeleton class="h-4 w-24" />
          <Skeleton class="h-16 w-full" />
          <Skeleton class="h-16 w-full" />
          <Skeleton class="h-4 w-32" />
        </div>
        <p class="text-xs text-muted-foreground">Loading flow chart…</p>
      </div>

      <div
        v-else-if="showError"
        class="absolute inset-0 z-10 flex items-center justify-center bg-background/90 backdrop-blur-sm"
        data-testid="canvas-error"
        role="alert"
      >
        <div
          class="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-card p-6 text-center shadow-sm"
        >
          <AlertTriangle class="size-6 text-destructive" aria-hidden="true" />
          <div>
            <p class="text-sm font-semibold">Could not load the flow chart</p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{
                query.error.value instanceof Error
                  ? query.error.value.message
                  : 'The payload failed to load.'
              }}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            :disabled="query.isFetching.value"
            data-testid="canvas-retry"
            @click="onRetry"
          >
            <RefreshCw class="size-3" />
            {{ query.isFetching.value ? 'Retrying…' : 'Retry' }}
          </Button>
        </div>
      </div>

      <div
        v-else-if="showEmpty"
        class="absolute inset-0 z-10 flex items-center justify-center bg-background/90"
        data-testid="canvas-empty"
      >
        <div
          class="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center shadow-sm"
        >
          <Sparkles class="size-6 text-muted-foreground" aria-hidden="true" />
          <div>
            <p class="text-sm font-semibold">The canvas is empty</p>
            <p class="mt-1 text-xs text-muted-foreground">
              Restore the original payload to bring back the seed flow chart.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            :disabled="seeding"
            data-testid="canvas-seed-default"
            @click="onSeedDefault"
          >
            {{ seeding ? 'Restoring…' : 'Reset to default payload' }}
          </Button>
        </div>
      </div>
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
            {{ resetting ? 'Resetting…' : 'Reset' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
