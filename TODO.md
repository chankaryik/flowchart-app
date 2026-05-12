# Respondio Flow Chart App — Build Plan

## Context

The repo is a Vite + Vue 3 scaffold with most dependencies already installed (Vue 3.5, Vue Router 5, Pinia 3, TanStack Vue Query 5, `@vue-flow/core` 1.48, Tailwind v4 packages, Vitest 4, Playwright 1.59, oxlint/ESLint/oxfmt) but **wired up to placeholder content**: `App.vue` still renders "You did it!", the router has an empty routes array, `src/stores/counter.ts` is a stub, and the only tests assert the placeholder text. Tailwind v4's Vite plugin is not registered, Shadcn Vue is uninitialized, no domain code exists yet, and `payload.json` sits at the repo root rather than in `public/` (so `fetch('/payload.json')` would 404 today).

This plan turns that scaffold into the full flow-chart editor described in [CLAUDE.md](C:\Users\mryik\Works\Int\respondio\flow-chart-app\CLAUDE.md): a Vue Flow canvas loaded from `payload.json`, URL-driven details drawer at `/node/:id`, full CRUD via TanStack mutations with optimistic Pinia updates and localStorage write-through, undo/redo, keyboard accessibility, and the validation/test gates from CLAUDE.md §8. The plan is **vertically sliced** — Phases 0–4 get a read-only canvas rendering live data end-to-end, then each subsequent phase layers on one feature so every checkpoint is shippable.

## Day-0 decisions (confirmed)

| Decision | Choice |
| --- | --- |
| Persistence | **localStorage write-through** (key `payload-v1`); first load fetches `/payload.json`. |
| Trigger node | **Locked** — not deletable, not in Create Node options. |
| Edge style | **`smoothstep`** for all edges (org-chart look, clearer dateTime branching). |

---

## Phase 0 — Bootstrap & cleanup

Goal: install missing deps, wire Tailwind v4 + Shadcn, move payload.json to where `fetch` can find it, gut the placeholder content. **No feature code yet.**

- [x] **Move `payload.json` → `public/payload.json`** so `fetch('/payload.json')` works in dev and is copied into `dist/` on build.
- [x] **Install missing deps:**
  ```
  npm i @vue-flow/background @vue-flow/controls @vue-flow/minimap nanoid
  npx shadcn-vue@latest init
  ```
  When the init wizard asks: pick TypeScript, `@/` alias, `src/assets/main.css` for global styles, Tailwind v4 mode. Do **not** add components yet — pull each per-need.
- [x] **Wire Tailwind v4 in [vite.config.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\vite.config.ts):** add `import tailwindcss from '@tailwindcss/vite'` and include `tailwindcss()` in the `plugins` array (must come before `vue()` is fine; order doesn't matter for v4).
- [x] **Create [src/assets/main.css](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\assets\main.css):**
  ```css
  @import "tailwindcss";
  @import "@vue-flow/core/dist/style.css";
  @import "@vue-flow/core/dist/theme-default.css";
  ```
  Add shadcn CSS variables as the init step instructs. Import this from [src/main.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\main.ts).
- [x] **Delete `src/stores/counter.ts`** and `src/__tests__/App.spec.ts` (will be replaced by real specs).
- [x] **Gut [src/App.vue](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\App.vue)** down to `<template><RouterView /></template>` with `<script setup lang="ts">` empty. Global providers (toast outlet, dialog portal) are mounted here later.
- [x] **Configure [src/main.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\main.ts)** to install `VueQueryPlugin` with the QueryClient from Phase 2 (placeholder import is fine for now), import `./assets/main.css`, mount `#app`.
- [x] **Delete the placeholder `e2e/vue.spec.ts`** assertion content; keep the file as a scaffold to extend in Phase 12.

**Verify Phase 0:** `npm run dev` boots, the page is blank (no errors in console), `npm run type-check` and `npm run lint` are green.

---

## Phase 1 — Domain foundations (`src/lib/`)

Goal: pure-TS modules with full unit-test coverage. No Vue, no Pinia.

- [x] **[src/lib/types.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\lib\types.ts)** — `NodeId = string | number`, `Day` union, `NodeType` union, and the **`FlowNode` discriminated union** exactly as written in CLAUDE.md §5. Re-export every domain type from here only.
- [x] **[src/lib/validators.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\lib\validators.ts)** — pure functions returning `{ ok: true } | { ok: false; message: string }`:
  - `validateTitle(value)` — required, 1–80 chars.
  - `validateDescription(value)` — ≤ 500 chars.
  - `validateAttachmentUrl(value)` — `new URL()` parse; clear error message on failure.
  - `validateComment(value)` — ≤ 1000 chars.
  - `validateBusinessHours(times: { day, startTime, endTime }[])` — each row `endTime > startTime`; days may repeat but rows within the same day must not overlap. Reuse `validateTimeRange(start, end)` and `rangesOverlap(a, b)` helpers.
- [x] **[src/lib/node-factory.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\lib\node-factory.ts)** — `createNode(type, parentId, partialData?)` using `nanoid(6)` to match payload.json's existing 6-char IDs. One factory branch per editable type (no `trigger`, no `dateTimeConnector` — those are produced internally by the dateTime flow, not via this factory's public surface).
- [x] **[src/lib/payload-adapter.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\lib\payload-adapter.ts)** — the **only** module that touches storage:
  - `loadNodes(): Promise<FlowNode[]>` — read `localStorage['payload-v1']` first; if missing, `fetch('/payload.json')`, seed localStorage, return.
  - `saveNodes(nodes: FlowNode[]): Promise<void>` — write to `localStorage['payload-v1']`.
  - Optional: `resetNodes()` to re-seed from `/payload.json` (used by E2E setup).
- [x] **Unit tests** mirroring the file layout under `src/lib/__tests__/`:
  - `validators.spec.ts` — exhaustive cases including business-hours overlap edge cases.
  - `node-factory.spec.ts` — ID shape, default data per type.
  - `payload-adapter.spec.ts` — localStorage hit, miss-then-fetch, mock `fetch`.

**Verify Phase 1:** `npm run test:unit` passes lib specs; `npm run type-check` and `npm run lint` green.

---

## Phase 2 — State & queries

Goal: Pinia stores and TanStack Query layer with the exact config from CLAUDE.md §6.

- [ ] **[src/queries/client.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\queries\client.ts)** — export a `QueryClient` configured **exactly** as CLAUDE.md §6 prescribes (`refetchOnWindowFocus: false`, `networkMode: 'always'`, `staleTime: Infinity`, `gcTime: 60 * 60 * 1000`). Wire into `main.ts`.
- [ ] **[src/stores/flow.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\stores\flow.ts)** — Pinia store as the **live canvas truth**:
  - State: `nodes: FlowNode[]`, `positions: Record<NodeId, { x: number; y: number }>` (Vue Flow needs positions; derive initial layout from parentId tree using a simple top-down layout in `lib/layout.ts` — see Phase 4), `selectedId: NodeId | null`, `draggingId: NodeId | null`.
  - Actions: `hydrate(nodes)`, `applyPatch(nodeId, patch)`, `addNode(node, position)`, `removeNode(nodeId)` (cascades children + connectors), `setPosition(nodeId, xy)`. Actions are pure mutations — TanStack `onMutate` calls them, components do **not** mutate directly (CLAUDE.md §8.3).
  - Getter: `getNodeById(id)`, `getChildren(parentId)`.
- [ ] **[src/stores/history.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\stores\history.ts)** — command stack:
  - `push(cmd: { undo: () => void; redo: () => void; label: string })`, `undo()`, `redo()`, `canUndo`, `canRedo`.
  - Cap depth at e.g. 100 entries to keep memory bounded.
- [ ] **[src/queries/nodes.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\queries\nodes.ts)** — query + mutations:
  - `useNodesQuery()` — `queryKey: ['nodes']`, `queryFn: loadNodes`, `onSuccess: store.hydrate`.
  - `useCreateNode()`, `useUpdateNode()`, `useDeleteNode()`, `useMoveNode()` — each follows the pattern `onMutate: optimistic Pinia patch + history.push`, `mutationFn: saveNodes(store.nodes)`, `onError: rollback via the history entry's undo`.
- [ ] **Unit tests:** `stores/__tests__/flow.spec.ts`, `stores/__tests__/history.spec.ts`, `queries/__tests__/nodes.spec.ts` (mock `payload-adapter`).

**Verify Phase 2:** unit tests green; manual smoke is N/A since nothing renders yet.

---

## Phase 3 — Router & app shell

Goal: wire routes so `/` and `/node/:id` are reachable; drawer state derived from route, not component state.

- [ ] **[src/router/index.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\router\index.ts)** — two routes:
  - `/` → `FlowChartView`.
  - `/node/:id` → `FlowChartView` (drawer overlays the same view; route param drives drawer open state).
- [ ] **Navigation guard** on `/node/:id`: if `id` is unknown or refers to a `dateTimeConnector`, redirect to `/` and flash a toast (toast plumbing comes in Phase 11; for now, just `console.warn` and redirect).
- [ ] **[src/views/FlowChartView.vue](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\views\FlowChartView.vue)** — page shell: header with title + Create Node button, `<FlowCanvas />`, `<NodeDetailsDrawer />` (drawer renders only when `route.params.id` is set).
- [ ] **App.vue** keeps just `<RouterView />` plus a `<Toaster />` from shadcn and a global `<TooltipProvider />` if applicable.

**Verify Phase 3:** navigating to `/` and `/node/anything` both render the (still empty) FlowChartView; invalid IDs redirect.

---

## Phase 4 — Read-only canvas (first end-to-end slice)

Goal: app loads payload.json on mount and renders nodes + edges. No editing yet, but the full data path Pinia ← TanStack ← adapter is exercised.

- [ ] **[src/lib/layout.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\lib\layout.ts)** — `computeLayout(nodes): Record<NodeId, { x: number; y: number }>`. Top-down tree using parentId; dateTimeConnector children of a dateTime laid out as sibling columns under the dateTime. Spec it.
- [ ] **[src/composables/useNodeEdges.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\composables\useNodeEdges.ts)** — derived edges from the Pinia node list:
  - One edge `parentId → id` for each non-trigger node.
  - The `dateTime.data.connectors[]` is informational; the actual visual edges come from each connector's own `parentId === dateTime.id`. (Double-check this against payload.json; both paths describe the same parent→child, so the parentId chain alone is sufficient.)
  - Edges use `type: 'smoothstep'`.
- [ ] **[src/components/flow/FlowCanvas.vue](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\components\flow\FlowCanvas.vue)** — Vue Flow wrapper:
  - Calls `useNodesQuery()` once for hydration trigger; reads `nodes` and `positions` from `useFlowStore()`.
  - `<VueFlow :nodes :edges :node-types>` with `Background`, `Controls`, `MiniMap` from the v1.48 extras packages.
  - `onNodesChange` updates Pinia `positions` (throttle in Phase 8).
  - Click on a node → `router.push('/node/' + id)` (skip for `dateTimeConnector` — CLAUDE.md §8.1).
- [ ] **Register the five node-type components as stubs** (just render the node name in a card) so Vue Flow's `nodeTypes` map is complete: `TriggerNode`, `SendMessageNode`, `DateTimeNode`, `DateTimeConnectorNode`, `AddCommentNode`. Polish in Phase 5.

**Verify Phase 4:** `npm run dev` shows the seed graph (1 trigger + dateTime with success/failure + two sendMessages + one addComment) wired with smoothstep edges. Refresh keeps the graph. Clicking a non-connector navigates to `/node/:id`. Clicking a connector does nothing.

---

## Phase 5 — Per-type node components

Goal: each node looks like its type and surfaces the right summary on the card.

- [ ] **[src/components/flow/nodes/TriggerNode.vue](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\components\flow\nodes\TriggerNode.vue)** — trigger badge, shows `data.type` (e.g. "Conversation Opened") and `oncePerContact` indicator. No delete affordance (locked per Day-0 decision; add a WHY comment).
- [ ] **[src/components/flow/nodes/SendMessageNode.vue](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\components\flow\nodes\SendMessageNode.vue)** — `name`, preview of first text payload (truncated), attachment count icon.
- [ ] **[src/components/flow/nodes/DateTimeNode.vue](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\components\flow\nodes\DateTimeNode.vue)** — `name`, summary like "Mon–Fri 09:00–17:00 (UTC)", `action` badge.
- [ ] **[src/components/flow/nodes/DateTimeConnectorNode.vue](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\components\flow\nodes\DateTimeConnectorNode.vue)** — `connectorType` pill (green Success / red Failure). **WHY-comment**: display-only per CLAUDE.md §8.1 — no click/keyboard handlers, no router push, no Create Node entry.
- [ ] **[src/components/flow/nodes/AddCommentNode.vue](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\components\flow\nodes\AddCommentNode.vue)** — `name`, truncated comment preview.
- [ ] Each node uses shadcn `Card` for the frame, shadcn `Tooltip` for full content on hover, and exposes Vue Flow `Handle`s on top/bottom (connectors only on top for incoming edges, etc.).
- [ ] **Component specs** for each under `src/components/flow/nodes/__tests__/`: render with seeded props, assert visible content and handle positions, assert connector does NOT emit a click route push.

**Verify Phase 5:** canvas now shows visually distinct nodes; tooltips work; manual smoke shows all five types.

---

## Phase 6 — Drawer & per-type editors (URL-driven mutations)

Goal: opening `/node/:id` slides in a Sheet with the right editor; saves go through TanStack mutations.

- [ ] **Add shadcn components:** `sheet`, `dialog`, `input`, `textarea`, `label`, `select`, `button`, `card`, `tooltip`, `kbd`, `toast`, `calendar`.
- [ ] **[src/components/drawer/NodeDetailsDrawer.vue](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\components\drawer\NodeDetailsDrawer.vue)** — shadcn `Sheet`:
  - `:open="!!route.params.id"`, `@update:open="(v) => v || router.push('/')"`.
  - Reads node from Pinia via `getNodeById(route.params.id)`; passes to the type-specific editor.
  - Header shows node name + type badge; footer has Save (disabled while invalid) + Delete (hidden for trigger).
  - **Transition:** `transform: translateX(100%)` ↔ `translateX(0)` — never animate width. Spec this in CSS at the Sheet level; shadcn's default uses translate so this is mostly a "don't override it" rule.
- [ ] **[src/components/drawer/SendMessageEditor.vue](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\components\drawer\SendMessageEditor.vue)** — name input + payload editor (list of `text` / `attachment` rows with add/remove; URL validator on attachments).
- [ ] **[src/components/drawer/AddCommentEditor.vue](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\components\drawer\AddCommentEditor.vue)** — name input + textarea bound to `data.comment` with `validateComment`.
- [ ] **[src/components/drawer/BusinessHoursEditor.vue](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\components\drawer\BusinessHoursEditor.vue)** — list of `{ day, startTime, endTime }` rows; day select, two `<input type="time">`, add/remove row; surfaces `validateBusinessHours` errors at the row and form level. Timezone select + action select.
- [ ] **Trigger editor**: read-only summary in the drawer (since it's not configurable via the dialog and not deletable; matches Day-0 lock). Or a minimal editor for `oncePerContact` + `data.type` — confirm with user during Phase 12 smoke if scope creep.
- [ ] **Submit flow per editor:** validate on blur (per field) AND on submit (whole form); disable Save while invalid. On submit, call `useUpdateNode().mutate(patch)`; on success, navigate back to `/` and toast "Saved".
- [ ] **Component specs** for each editor: validation triggers, submit-disabled behavior, mutation called with the right patch.

**Verify Phase 6:** open `/node/<some-id>` in a fresh browser, edit a field, save → drawer closes, canvas reflects the change, refresh keeps it (localStorage write-through working end-to-end).

---

## Phase 7 — Create node flow

Goal: a "Create Node" button on the canvas opens a dialog to add a new node attached to a chosen parent.

- [ ] **[src/components/flow/CreateNodeDialog.vue](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\components\flow\CreateNodeDialog.vue)** — shadcn `Dialog`:
  - Step 1: pick a type from `'sendMessage' | 'dateTime' | 'addComment'`. **Trigger and dateTimeConnector are NOT in the list** (Day-0 lock + CLAUDE.md §8.1).
  - Step 2: pick a parent from the existing node list (filter out `dateTimeConnector` if connecting under them is forbidden — actually re-check: `sendMessage` in seed data has `parentId: '28c4b9'` which IS a connector, so connectors CAN be parents; allow them).
  - Step 3: type-specific form using the same editors from Phase 6 (defaults from `createNode(type, parentId)`).
  - On submit: `useCreateNode().mutate(newNode)`; Pinia optimistic insert; layout recomputes (Phase 4's layout). Navigate to `/node/<new-id>` so the user lands in the freshly opened drawer.
- [ ] When the user picks `dateTime`, the mutation **also creates two `dateTimeConnector` children** (Success + Failure) under it automatically — payload.json seed shape requires this. Codify this in `node-factory.ts`'s `dateTime` branch (factory returns a `{ dateTime, connectors: [success, failure] }` shape that the mutation handles).
- [ ] Component spec: type filter excludes trigger/connector; auto-generated connectors appear on dateTime creation.

**Verify Phase 7:** click Create Node → add a sendMessage under the trigger → it appears on canvas wired with a smoothstep edge → drawer auto-opens for editing. Refresh persists it.

---

## Phase 8 — Delete & drag

Goal: nodes can be deleted (with cascade) and dragged; drag pushes exactly one undo entry per drag-end.

- [ ] **Delete:**
  - Drawer footer "Delete" button (hidden for trigger).
  - `useDeleteNode()` mutation cascades children + connectors. For a `dateTime`, delete its two connectors AND any descendants of those connectors. For a `sendMessage`/`addComment`/connector, reparent or detach descendants? **Recommendation:** delete the whole subtree (simpler, matches user mental model of "remove this branch"). Confirm via a shadcn confirm dialog before applying.
  - Mutation pushes a single history entry with the full subtree so undo restores it.
- [ ] **Drag:**
  - Vue Flow emits `onNodeDrag` (continuous) and `onNodeDragStop` (final). Hook **`onNodeDrag`** to a throttled (≈30ms) Pinia `setPosition`. Hook **`onNodeDragStop`** to push one history entry with `before → after` position.
  - Connectors drag with their dateTime parent (Vue Flow's `extent: 'parent'` or by listening for parent moves and translating connectors by the same delta).
- [ ] Specs: delete cascades the right subtree; drag-end produces exactly one history entry regardless of how far the mouse moved.

**Verify Phase 8:** delete a node with children → confirm → subtree disappears → undo restores it whole. Drag a node → position survives refresh → undo returns it to the prior spot.

---

## Phase 9 — Undo/Redo wiring

Goal: keyboard-driven undo/redo across all mutating operations.

- [ ] **[src/composables/useFlowHistory.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\composables\useFlowHistory.ts)** — global keydown listener on `Ctrl/Cmd+Z` → `history.undo()`, `Ctrl/Cmd+Shift+Z` (or `Ctrl+Y` on Windows) → `history.redo()`. Detect mac via `navigator.platform` / `navigator.userAgent`. Ignore when focus is inside a text input/textarea (let the browser handle in-field undo).
- [ ] Mount the composable once in `FlowChartView.vue`.
- [ ] Confirm every mutation pushes a history entry (create / update / delete / drag-end). Field-edit history is at **submit/blur granularity**, not per-keystroke.
- [ ] Spec: full create → undo → redo cycle on each node type via the store directly (unit), then via the UI (E2E in Phase 12).

**Verify Phase 9:** Ctrl+Z reverses last operation across all surfaces; mac Cmd+Z works in browser dev; in-field undo still works inside textareas.

---

## Phase 10 — Keyboard accessibility

Goal: fully driveable from keyboard, including the shortcuts help dialog. Per CLAUDE.md §8.5.

- [ ] **[src/composables/useNodeKeyboard.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\composables\useNodeKeyboard.ts)**:
  - Tab cycles focus through nodes in graph order (use the layout's top-down + left-right order).
  - Arrow keys move selection between graph-adjacent nodes (use `useNodeEdges` adjacency).
  - Enter on a focused node → router-push to `/node/:id`.
  - Esc inside the drawer → `router.push('/')` (cancel edits with a confirm if dirty).
  - `?` opens a shortcut help dialog (shadcn `Dialog` with a list of bindings rendered with `Kbd`).
  - **Skip `dateTimeConnector` nodes** in Tab and Arrow navigation (CLAUDE.md §8.1).
- [ ] Each node component renders with `tabindex="0"` (except connectors with `tabindex="-1"`) and a visible focus ring (shadcn `ring-ring`).
- [ ] Spec the composable's adjacency math; E2E covers the user-visible flow in Phase 12.

**Verify Phase 10:** with mouse hidden, navigate: Tab to a node → Enter opens drawer → Esc closes → Arrow keys to a sibling → Enter → ?` shows help.

---

## Phase 11 — Polish

Goal: production-quality feel: toasts, transitions, redirects with messages.

- [ ] **Toaster** mounted in `App.vue`. Use shadcn `useToast()` from:
  - Router guard for invalid `/node/:id` (CLAUDE.md §7).
  - Mutation `onError` callbacks (rollback + toast).
  - Mutation `onSuccess` for Save/Create/Delete confirmations.
- [ ] **Drawer transition** verified: only `transform`, no width animations (CLAUDE.md §8.6). Confirm with DevTools paint flashing that layout doesn't thrash.
- [ ] **Empty state**: if `nodes.length === 0` (e.g. after deleting the trigger via direct localStorage tampering), show a "Reset to default payload" button calling `payload-adapter.resetNodes()`.
- [ ] **Loading state**: while `useNodesQuery` is pending, render a centered shadcn `Skeleton`.
- [ ] **Error boundary** in `FlowCanvas.vue` for query errors → toast + retry button.
- [ ] **Accessibility audit**: run a quick axe-core dev check on the dev server; resolve any non-trivial warnings.

**Verify Phase 11:** manual smoke covers each toast trigger; transitions feel buttery in Chrome and Firefox.

---

## Phase 12 — Test gates & final verification

Goal: every CLAUDE.md §7 gate green.

- [ ] **Unit specs in place** for every file under `src/components/`, `src/composables/`, `src/lib/`, `src/stores/`, `src/queries/`. Aim for behavior coverage, not line coverage.
- [ ] **E2E specs** under `e2e/` (one per scenario from CLAUDE.md §8.7):
  - `load-canvas.spec.ts` — page loads, all seed nodes render with correct edges.
  - `create-node.spec.ts` — open dialog, create each editable type, persists after refresh.
  - `edit-node.spec.ts` — navigate to `/node/:id` directly, edit, save, value sticks.
  - `delete-node.spec.ts` — delete with cascade; trigger is not deletable (no Delete button).
  - `drag-node.spec.ts` — drag a node, position persists, single undo undoes it.
  - `undo-redo.spec.ts` — create → undo → redo on each type.
  - `deep-link.spec.ts` — `/node/:id` opens drawer; `/node/<connector-id>` redirects with toast; `/node/<bogus>` redirects with toast.
  - `keyboard-nav.spec.ts` — Tab, Arrows, Enter, Esc, `?`; connectors skipped.
  - All specs **reset localStorage** in `beforeEach` so they're independent.
- [ ] **Final pre-flight (run in this order):**
  1. `npm run type-check` — must pass.
  2. `npm run lint` — must pass.
  3. `npm run test:unit` — all green.
  4. `npm run test:e2e` — all green across chromium/firefox/webkit.
  5. Manual browser smoke of the golden path: load → create → edit → drag → delete → undo → redo → keyboard nav → refresh.

---

## Critical files to be created or modified

**Modify:** [vite.config.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\vite.config.ts), [src/App.vue](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\App.vue), [src/main.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\main.ts), [src/router/index.ts](C:\Users\mryik\Works\Int\respondio\flow-chart-app\src\router\index.ts).

**Move:** `payload.json` → `public/payload.json`.

**Delete:** `src/stores/counter.ts`, `src/__tests__/App.spec.ts`, original `e2e/vue.spec.ts` body.

**Create:** `src/assets/main.css`, `src/lib/{types,validators,node-factory,payload-adapter,layout}.ts`, `src/stores/{flow,history}.ts`, `src/queries/{client,nodes}.ts`, `src/composables/{useNodeEdges,useNodeKeyboard,useFlowHistory}.ts`, `src/views/FlowChartView.vue`, `src/components/flow/{FlowCanvas,CreateNodeDialog}.vue`, `src/components/flow/nodes/{Trigger,SendMessage,DateTime,DateTimeConnector,AddComment}Node.vue`, `src/components/drawer/{NodeDetailsDrawer,SendMessageEditor,AddCommentEditor,BusinessHoursEditor}.vue`, shadcn components under `src/components/ui/` (generated, do not hand-edit), full sibling spec files for each, and the eight E2E specs listed in Phase 12.

## Verification (end-to-end)

After Phase 12, the following must all hold:

1. `npm run dev` → canvas renders the seed graph; clicking a node opens `/node/:id` with the correct editor; refresh preserves edits.
2. `npm run build` then `npm run preview` → same behavior on the production build.
3. `npm run type-check`, `npm run lint`, `npm run test:unit`, `npm run test:e2e` → all green.
4. The eight CLAUDE.md §7 E2E scenarios pass on chromium, firefox, and webkit.
5. Keyboard-only operation of the golden path (load → focus → open drawer → edit → save → delete → undo) works without touching the mouse.
6. `localStorage.removeItem('payload-v1')` followed by refresh → canvas re-seeds from `/payload.json` (proves the adapter's miss-then-fetch path).
