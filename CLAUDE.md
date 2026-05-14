# CLAUDE.md — Respondio Flow Chart App

Project-specific guidance for Claude Code sessions working in this repo. Read this **before** touching any code; it captures the contract from [REQUIREMENTS.md](REQUIREMENTS.md) plus the directional decisions already made with the user. If anything here conflicts with REQUIREMENTS.md, REQUIREMENTS.md wins — surface the conflict and ask.

> A near-identical [AGENTS.md](AGENTS.md) sits next to this file for Codex sessions. When you change one, mirror the change to the other so both agents stay in sync.

## 1. Project overview

A Flow Chart editor built on Vue Flow. It loads a workflow graph from [public/payload.json](public/payload.json) (served at the site root so `fetch('/payload.json')` resolves), renders it on a draggable canvas, and lets the user create, edit, drag, and delete nodes. Each node has a details drawer that opens via URL (`/node/:id`), so drawer state is shareable and back-button-friendly. The graph mixes editable nodes (`sendMessage`, `addComment`, `dateTime`), a read-only `trigger` root, and display-only branch labels (`dateTimeConnector` — success/failure markers under a `dateTime` node).

## 2. Tech stack (all installed)

| Library | Version | Notes |
| --- | --- | --- |
| Vue | 3.5 | `<script setup lang="ts">` only |
| Vue Router | 5.0 | Drawer state lives in the URL |
| Pinia | 3.0 | Live canvas state |
| TanStack Vue Query | 5.100 | Fetch + mutations against `payload.json` |
| Vue Flow | 1.48 (`@vue-flow/core`) + `background`, `controls`, `minimap` | Canvas engine |
| TypeScript | 6.0 strict | `noUncheckedIndexedAccess: true` |
| Tailwind | 4.3 (`@tailwindcss/vite`) | `@import "tailwindcss";` in `src/assets/main.css` |
| Shadcn Vue | reka-ui-based; generated into `src/components/ui/` | Do not hand-edit; regenerate via CLI |
| VeeValidate + `@vee-validate/valibot` | 4.15 | Form validation in dialogs/editors |
| VueUse | 14.3 | `useEventListener`, etc. |
| vue-sonner | 2.0 | Toasts (`Toaster` mounted in App.vue) |
| lucide-vue-next | 1.0 | Icons |
| nanoid | 5.1 | 6-char IDs for new nodes |
| Vitest | 4.1 | Unit tests, jsdom env |
| Playwright | 1.59 | E2E across chromium/firefox/webkit |
| oxlint + ESLint + oxfmt | latest | Run before declaring done |

Do **not** add: `axios` (use `fetch`), Vuex (use Pinia), Day.js, or any drag-and-drop component library — the existing `AttachmentField` wraps `<input type="file" multiple>` natively.

## 3. Commands

```
npm run dev           # vite dev server (port 5173)
npm run build         # type-check + vite build
npm run preview       # serve the production build
npm run type-check    # vue-tsc --build
npm run test:unit     # vitest (jsdom)
npm run test:e2e      # playwright
npm run lint          # oxlint --fix, then eslint --fix --cache
npm run format        # oxfmt src/
```

**Before declaring any change done:** run `npm run type-check`, `npm run lint`, and the relevant `test:unit` (or `test:e2e`) for the surface area touched. UI changes also need a manual smoke in the browser — type checking does not verify feature correctness.

## 4. Architecture

Tests are co-located in `__tests__/` folders next to the code they cover (not a single top-level `src/__tests__/`).

```
src/
├── App.vue                          # <RouterView /> + Toaster + TooltipProvider
├── main.ts                          # pinia, router, vue-query, mount
├── assets/
│   └── main.css                     # @import "tailwindcss"; shadcn tokens
├── router/
│   └── index.ts                     # /, /node/:id (guards reject connectors + invalid IDs)
├── views/
│   └── FlowChartView.vue            # canvas + create-node trigger + shortcut help
├── components/
│   ├── ShortcutHelpDialog.vue       # "?" help modal; macOS/Win-aware key labels
│   ├── flow/
│   │   ├── FlowCanvas.vue           # Vue Flow wrapper; smoothstep edges; auto-layout
│   │   ├── AddNodeButton.vue        # "+" affordance below each node; pre-fills parent
│   │   ├── CreateNodeDialog.vue     # Title/Description/Type form (no `trigger` option)
│   │   └── nodes/                   # one component per node type
│   │       ├── TriggerNode.vue
│   │       ├── SendMessageNode.vue
│   │       ├── DateTimeNode.vue
│   │       ├── DateTimeConnectorNode.vue   # display-only
│   │       └── AddCommentNode.vue
│   ├── drawer/
│   │   ├── NodeDetailsDrawer.vue    # shadcn Sheet, URL-driven
│   │   ├── TriggerDetails.vue       # read-only view (trigger is locked)
│   │   ├── SendMessageEditor.vue
│   │   ├── AddCommentEditor.vue
│   │   ├── BusinessHoursEditor.vue
│   │   └── AttachmentField.vue      # drag-drop file uploader; native <input type="file">
│   └── ui/                          # shadcn-generated; do not hand-edit
├── stores/
│   ├── flow.ts                      # nodes[], positions, create dialog
│   ├── history.ts                   # undo/redo command stack
│   └── attachments.ts               # in-memory Map<"<nodeId>:<index>", File[]>
├── queries/
│   ├── client.ts                    # createQueryClient() with requirements-mandated config
│   └── nodes.ts                     # useNodesQuery + create/update/delete/move mutations
├── composables/
│   ├── useNodeKeyboard.ts           # Tab/Arrow/Enter focus + drawer open
│   ├── useNodeEdges.ts              # parentId + connectors → edges projection
│   └── useFlowHistory.ts            # Ctrl+Z / Ctrl+Shift+Z (Cmd on macOS)
└── lib/
    ├── types.ts                     # FlowNode union, NodeType, Day, helpers
    ├── payload-adapter.ts           # fetch payload.json + opt-in localStorage cache
    ├── node-factory.ts              # createNode(type, partialData)
    ├── validators.ts                # valibot schemas for title/description/etc.
    ├── layout.ts                    # computeLayout() + NODE_WIDTH/HEIGHT/H_GAP/V_GAP
    ├── format.ts                    # humanizeKey, dayLabel, summarizeBusinessHours, previews
    ├── dom.ts                       # isEditableTarget() guard for global key handlers
    └── utils.ts                     # cn() — clsx + tailwind-merge (shadcn pattern)
e2e/
├── helpers.ts
├── load-canvas.spec.ts
├── create-node.spec.ts
├── edit-node.spec.ts
├── delete-node.spec.ts
├── drag-node.spec.ts
├── undo-redo.spec.ts
├── deep-link.spec.ts
└── keyboard-nav.spec.ts
```

## 5. Domain model

`payload.json` does **not** store edges or positions; edges are derived from `parentId` chains and from the `dateTime` node's `data.connectors[]`, and positions are computed by `lib/layout.ts` when the store has none. Node IDs may be `string | number` (the seed `trigger` uses numeric `1`). Use `idKey(id)` / `sameId(a, b)` from [src/lib/types.ts](src/lib/types.ts) for comparisons.

Canonical shape (kept in [src/lib/types.ts](src/lib/types.ts); re-export from there only):

```ts
type NodeId = string | number;
type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type ConnectorType = 'success' | 'failure';
type EditableNodeType = 'sendMessage' | 'dateTime' | 'addComment';

type SendMessagePayloadItem =
  | { type: 'text'; text: string }
  | { type: 'attachment'; attachments: string[] };   // plural — list of filenames

type BusinessHoursRow = {
  day: Day; startTime: string; endTime: string; closed?: boolean;
};

type FlowNode =
  | { id: NodeId; parentId: NodeId; type: 'trigger';
      data: { type: string; oncePerContact: boolean } }
  | { id: NodeId; parentId: NodeId; type: 'sendMessage'; name: string;
      description?: string;                          // only set on user-created nodes
      data: { payload: SendMessagePayloadItem[] } }
  | { id: NodeId; parentId: NodeId; type: 'dateTime'; name: string;
      description?: string;
      data: { times: BusinessHoursRow[]; connectors: NodeId[]; timezone: string; action: string } }
  | { id: NodeId; parentId: NodeId; type: 'dateTimeConnector'; name: string;
      data: { connectorType: ConnectorType } }
  | { id: NodeId; parentId: NodeId; type: 'addComment'; name: string;
      description?: string;
      data: { comment: string } };
```

Note that `attachments` is a string array of filenames. The actual `File` objects live in [`src/stores/attachments.ts`](src/stores/attachments.ts) keyed by `"<nodeId>:<payloadIndex>"` — they cannot be serialized to localStorage.

## 6. Source-of-truth model

- **Pinia (`stores/flow.ts`)** is the live truth for the canvas: `nodes[]`, `positions: Record<string, Position>`, and create-dialog state. Keyboard focus is DOM-driven in `useNodeKeyboard`, and per-drag bookkeeping stays local to `FlowCanvas`.
- **Pinia (`stores/attachments.ts`)** holds uploaded `File[]` per `<nodeId>:<index>` slot — in-memory only.
- **TanStack Query (`queries/nodes.ts`)** does the initial load via `queryFn` and exposes mutations (`useCreateNode`, `useUpdateNode`, `useDeleteNode`, `useMoveNode`). Mutations update Pinia optimistically in `onMutate`, then persist via the adapter in `mutationFn`.
- **`lib/payload-adapter.ts`** is the only boundary that touches the payload. On first load it reads `public/payload.json` via `fetch('/payload.json')`. A user-controlled flag (`localStorage` key `persist-enabled-v1`, checked by `isPersistEnabled()`) gates whether subsequent reads/writes use a `localStorage` cache under key `payload-v1`. With persistence off (default), every refresh reseeds from the canonical JSON; with it on, edits survive reload.
- **QueryClient config** must match REQUIREMENTS.md exactly (`createQueryClient()` in [src/queries/client.ts](src/queries/client.ts)):

  ```ts
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        networkMode: 'always',
        staleTime: Infinity,
        gcTime: 60 * 60 * 1000,
      },
    },
  });
  ```

## 7. Routing

- `/` — canvas only.
- `/node/:id` — canvas with the details drawer open for that node ID. The drawer **opens and closes by navigation**, not by local state, so it's deep-linkable and back-button-friendly. The route guard in [src/router/index.ts](src/router/index.ts) redirects invalid IDs and any attempt to open `/node/<connector-id>` back to `/` with a toast.

## 8. Hard rules (non-negotiable)

These come from REQUIREMENTS.md and from the directional decisions agreed with the user. Treat them as gates; future Claude sessions must satisfy them before declaring a feature done.

1. **`dateTimeConnector` nodes are display-only.** Never wire click/keyboard handlers, never route to `/node/<connector-id>`, never offer them in Create Node.
2. **`trigger` nodes are locked.** Exactly one trigger per flow. Never deletable, never offered in Create New Node, the drawer shows it via [`TriggerDetails.vue`](src/components/drawer/TriggerDetails.vue) as read-only.
3. **Every input field validates** on blur AND on submit. Submit is disabled while invalid. Schemas live in [src/lib/validators.ts](src/lib/validators.ts) (valibot):
   - Title: required, 1–80 chars.
   - Description: ≤ 500 chars.
   - Attachment: must parse via `new URL()`; surface a clear error if not.
   - Business hours: each row needs `endTime > startTime`; days may repeat but not overlap within a day.
   - Comment: ≤ 1000 chars.
4. **Edits flow through TanStack mutations**, not direct Pinia writes from components. This keeps undo/redo, persistence, and optimistic updates consistent.
5. **Undo/Redo (Ctrl+Z / Ctrl+Shift+Z, Cmd on macOS)** covers: create, delete, drag-end position change (one stack entry per drag-end, not per pixel), and field edits committed on blur. Implemented as a command stack in [src/stores/history.ts](src/stores/history.ts).
6. **Keyboard accessibility:**
   - Tab cycles focus through nodes in graph order.
   - Arrow keys move focus through nodes in graph order.
   - Enter opens the drawer for the focused node.
   - Esc closes the drawer.
   - `?` opens [`ShortcutHelpDialog.vue`](src/components/ShortcutHelpDialog.vue).
   - `dateTimeConnector` nodes are skipped by keyboard navigation.
   - Global key handlers must bail out when the target is editable — use `isEditableTarget()` from [src/lib/dom.ts](src/lib/dom.ts).
7. **Smooth canvas/drawer transitions:** drawer uses CSS `transform: translateX(...)` (no width animations that thrash layout); node drag listeners are throttled where they update Pinia, with the undo entry pushed only on drag-end.
8. **Edge style is `smoothstep`** across all edges (configured in [`FlowCanvas.vue`](src/components/flow/FlowCanvas.vue) via `default-edge-options`).
9. **Tests are gates, not afterthoughts:**
   - Every component in `src/components/` ships with a `*.spec.ts` in the adjacent `__tests__/` folder.
   - Every utility in `src/lib/` and every composable in `src/composables/` ships with a spec.
   - E2E covers: load canvas, create node, edit via drawer, delete node, drag a node, undo/redo, deep-link to `/node/:id`, keyboard navigation (one Playwright spec each).
   - Tests must run green before the work is "done."
10. **Utility/business logic lives in `src/lib/` or `src/composables/`** — `.vue` files do binding and presentation only.

## 9. Conventions

- **TypeScript:** `noUncheckedIndexedAccess` is on. Treat `array[i]` as `T | undefined`; narrow with a guard or `if (item == null) throw …`. Avoid `as` casts.
- **Vue:** `<script setup lang="ts">` only; no Options API, no mixins. Use `defineProps<T>()` (no runtime declaration). Use `defineModel` for two-way binding inside form fields.
- **Naming:** `PascalCase.vue` for components, `useThing.ts` for composables, `kebab-case.ts` for everything else. Pinia store files are lowercase singular (`flow.ts`, `history.ts`, `attachments.ts`) and export `useXxxStore`.
- **Tailwind/Shadcn:** prefer semantic shadcn tokens (`bg-background`, `text-foreground`, `border-input`) over raw colors. Custom utilities go in `assets/main.css` `@layer utilities`. Don't hand-edit anything under `src/components/ui/` — regenerate it via the CLI instead. Use `cn()` from [src/lib/utils.ts](src/lib/utils.ts) for conditional classname composition.
- **Imports:** use the `@/` alias; no relative `../../`.
- **Comments:** none that restate code. Only WHY comments for non-obvious constraints — the trigger-locked rule and the connector display-only rule are classic cases.

## 10. Reference

- Requirements: [REQUIREMENTS.md](REQUIREMENTS.md) at the repo root.
- Codex sibling guide: [AGENTS.md](AGENTS.md) — keep in sync with this file.
- Vue Flow docs: https://vueflow.dev/
- TanStack Query (Vue): https://tanstack.com/query/latest/docs/framework/vue/overview
- Shadcn Vue: https://www.shadcn-vue.com/
- Tailwind v4: https://tailwindcss.com/docs/v4-beta
- VeeValidate: https://vee-validate.logaretm.com/v4/guide/overview/
