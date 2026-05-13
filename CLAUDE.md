# CLAUDE.md — Respondio Flow Chart App

Project-specific guidance for Claude Code sessions working in this repo. Read this **before** touching any code; it captures the contract from [REQUIREMENTS.md](REQUIREMENTS.md) plus the scaffolding state and the directional decisions already made with the user. If anything here conflicts with REQUIREMENTS.md, REQUIREMENTS.md wins — surface the conflict and ask.

## 1. Project overview

A Flow Chart editor built on Vue Flow. It loads a workflow graph from [public/payload.json](public/payload.json) (served at the site root so `fetch('/payload.json')` resolves), renders it on a draggable canvas, and lets the user create, edit, drag, and delete nodes. Each node has a details drawer that opens via URL (`/node/:id`), so drawer state is shareable and back-button-friendly. The graph mixes editable nodes (`trigger`, `sendMessage`, `addComment`, `dateTime`) with display-only branch labels (`dateTimeConnector` — success/failure markers under a `dateTime` node).

## 2. Tech stack

### Installed and used as-is
| Library | Version | Notes |
| --- | --- | --- |
| Vue | 3.5 | `<script setup lang="ts">` only |
| Vue Router | 5.0 | Drawer state lives in the URL |
| Pinia | 3.0 | Live canvas state |
| TanStack Vue Query | 5.100 | Fetch + mutations against `payload.json` |
| Vue Flow | 1.48 (`@vue-flow/core`) | Canvas engine |
| TypeScript | 6.0 strict | `noUncheckedIndexedAccess: true` |
| Vitest | 4.1 | Unit tests, jsdom env |
| Playwright | 1.59 | E2E across chromium/firefox/webkit |
| oxlint + ESLint + oxfmt | latest | Run before declaring done |

### Needs installation (first task of the implementation session)
- **`tailwindcss@4` + `@tailwindcss/vite`** — register the Vite plugin in [vite.config.ts](vite.config.ts) and `@import "tailwindcss";` in a new `src/assets/main.css`. No `tailwind.config.ts` needed for v4; theme tokens go in CSS.
- **Shadcn Vue** — `npx shadcn-vue@latest init`. Add components per-need; expected set: `button`, `input`, `textarea`, `label`, `select`, `dialog`, `sheet` (for the drawer), `toast`, `card`, `tooltip`, `kbd`.
- **Vue Flow extras** — `@vue-flow/background`, `@vue-flow/controls`, `@vue-flow/minimap` for canvas polish.
- **Date/time picker** — recommend a shadcn `Calendar` + a small custom day-time-range editor (Business Hours is a list of `{ day, startTime, endTime }`, not a single datetime).
- **`nanoid`** — generate 6-char IDs that match payload.json's existing shape.

Do **not** install: `axios` (use `fetch`), Vuex (use Pinia), Day.js until proven needed, a drag-and-drop component library — a minimal `<input type="file" multiple>` wrapper is sufficient for the attachment uploader.

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

```
src/
├── App.vue                          # router-view + global providers
├── main.ts                          # pinia, router, vue-query, mount
├── assets/
│   └── main.css                     # @import "tailwindcss"; shadcn tokens
├── router/
│   └── index.ts                     # /, /node/:id
├── views/
│   └── FlowChartView.vue            # canvas + create-node trigger
├── components/
│   ├── flow/
│   │   ├── FlowCanvas.vue           # Vue Flow wrapper; edges derived
│   │   ├── nodes/                   # one component per node type
│   │   │   ├── TriggerNode.vue
│   │   │   ├── SendMessageNode.vue
│   │   │   ├── DateTimeNode.vue
│   │   │   ├── DateTimeConnectorNode.vue   # display-only
│   │   │   └── AddCommentNode.vue
│   │   └── CreateNodeDialog.vue
│   ├── drawer/
│   │   ├── NodeDetailsDrawer.vue    # shadcn Sheet, URL-driven
│   │   ├── SendMessageEditor.vue
│   │   ├── AddCommentEditor.vue
│   │   └── BusinessHoursEditor.vue
│   └── ui/                          # shadcn-generated; do not hand-edit
├── stores/
│   ├── flow.ts                      # nodes[], selection, drawer, drag
│   └── history.ts                   # undo/redo command stack
├── queries/
│   ├── client.ts                    # QueryClient w/ requirements-mandated config
│   └── nodes.ts                     # useNodesQuery + mutations
├── composables/
│   ├── useNodeKeyboard.ts           # arrow keys + Enter to open drawer
│   ├── useNodeEdges.ts              # parentId → edges projection
│   └── useFlowHistory.ts            # Ctrl+Z / Ctrl+Shift+Z bindings
├── lib/
│   ├── payload-adapter.ts           # fetch payload.json, persist to localStorage
│   ├── node-factory.ts              # createNode(type, partialData)
│   ├── validators.ts                # title/url/time-range/etc.
│   └── types.ts                     # FlowNode union, NodeType, Day
└── __tests__/                       # mirrors src/ layout
e2e/
└── *.spec.ts
```

## 5. Domain model

`payload.json` does **not** store edges; edges are derived from `parentId` chains and from the `dateTime` node's `data.connectors[]`. Node IDs may be `string | number` (the seed `trigger` uses numeric `1`). Treat the canonical shape as:

```ts
type NodeId = string | number;
type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

type FlowNode =
  | { id: NodeId; parentId: NodeId; type: 'trigger';
      data: { type: string; oncePerContact: boolean } }
  | { id: NodeId; parentId: NodeId; type: 'sendMessage'; name: string;
      data: { payload: Array<
        | { type: 'text'; text: string }
        | { type: 'attachment'; attachment: string }
      > } }
  | { id: NodeId; parentId: NodeId; type: 'dateTime'; name: string;
      data: { times: Array<{ day: Day; startTime: string; endTime: string }>;
              connectors: NodeId[]; timezone: string; action: string } }
  | { id: NodeId; parentId: NodeId; type: 'dateTimeConnector'; name: string;
      data: { connectorType: 'success' | 'failure' } }
  | { id: NodeId; parentId: NodeId; type: 'addComment'; name: string;
      data: { comment: string } };
```

Keep this union in [src/lib/types.ts](src/lib/types.ts) and re-export from there only.

## 6. Source-of-truth model

- **Pinia (`stores/flow.ts`)** is the live truth for the canvas. All UI binds here. Vue Flow's internal node store is hydrated from Pinia and resynced on `onNodesChange` (positions, selection).
- **TanStack Query (`queries/nodes.ts`)** does the initial load via `queryFn` and exposes mutations (`createNode`, `updateNode`, `deleteNode`, `moveNode`). Mutations update Pinia optimistically in `onMutate`, then persist via the adapter in `mutationFn`.
- **`lib/payload-adapter.ts`** is the only boundary that touches `payload.json`. On first load it reads the static `public/payload.json` via `fetch('/payload.json')` (Vite serves `public/` at the root); subsequent reads and all writes go through `localStorage` (key `payload-v1`). This satisfies REQUIREMENTS.md's "data fetching and mutation updates involving payload.json" without needing a backend.
- **QueryClient config** must match REQUIREMENTS.md exactly:

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
- `/node/:id` — canvas with the details drawer open for that node ID. The drawer **opens and closes by navigation**, not by local state, so it's deep-linkable and back-button-friendly. Invalid IDs (or attempts to open `/node/<connector-id>`) redirect to `/` with a toast.

## 8. Hard rules (non-negotiable)

These come from REQUIREMENTS.md and from the directional decisions agreed with the user. Treat them as gates; future Claude sessions must satisfy them before declaring a feature done.

1. **`dateTimeConnector` nodes are display-only.** Never wire click/keyboard handlers, never route to `/node/<connector-id>`, never offer them in Create Node.
2. **Every input field validates** on blur AND on submit. Submit is disabled while invalid. Concrete rules in [src/lib/validators.ts](src/lib/validators.ts):
   - Title: required, 1–80 chars.
   - Description: ≤ 500 chars.
   - Attachment: must parse via `new URL()`; surface a clear error if not.
   - Business hours: each row needs `endTime > startTime`; days may repeat but not overlap within a day.
   - Comment: ≤ 1000 chars.
3. **Edits flow through TanStack mutations**, not direct Pinia writes from components. This keeps undo/redo, persistence, and optimistic updates consistent.
4. **Undo/Redo (Ctrl+Z / Ctrl+Shift+Z, Cmd on macOS)** covers: create, delete, drag-end position change (one stack entry per drag-end, not per pixel), and field edits committed on blur. Implemented as a command stack in [src/stores/history.ts](src/stores/history.ts).
5. **Keyboard accessibility (REQUIREMENTS.md requirement):**
   - Tab cycles focus through nodes in graph order.
   - Arrow keys move selection between graph-adjacent nodes.
   - Enter opens the drawer for the focused node.
   - Esc closes the drawer.
   - `?` opens a shortcut help dialog.
   - `dateTimeConnector` nodes are skipped by keyboard navigation.
6. **Buttery-smooth canvas/drawer transitions:** drawer uses CSS `transform: translateX(...)` (no width animations that thrash layout); node drag listeners are throttled where they update Pinia, with the undo entry pushed only on drag-end.
7. **Tests are gates, not afterthoughts:**
   - Every component in `src/components/` ships with a `*.spec.ts` next to it (or under `__tests__/`).
   - Every utility in `src/lib/` ships with a spec.
   - E2E covers (one Playwright spec per): load canvas, create node, edit via drawer, delete node, drag a node, undo/redo, deep-link to `/node/:id`, keyboard navigation.
   - Tests must run green before the work is "done."
8. **Utility/business logic lives in `src/lib/` or `src/composables/`** — `.vue` files do binding and presentation only.

## 9. Conventions

- **TypeScript:** `noUncheckedIndexedAccess` is on. Treat `array[i]` as `T | undefined`; narrow with a guard or `if (item == null) throw …`. Avoid `as` casts.
- **Vue:** `<script setup lang="ts">` only; no Options API, no mixins. Use `defineProps<T>()` (no runtime declaration). Use `defineModel` for two-way binding inside form fields.
- **Naming:** `PascalCase.vue` for components, `useThing.ts` for composables, `kebab-case.ts` for everything else. Pinia store files are lowercase singular (`flow.ts`, `history.ts`) and export `useXxxStore`.
- **Tailwind/Shadcn:** prefer semantic shadcn tokens (`bg-background`, `text-foreground`, `border-input`) over raw colors. Custom utilities go in `assets/main.css` `@layer utilities`. Don't hand-edit anything under `src/components/ui/` — regenerate it via the CLI instead.
- **Imports:** use the `@/` alias; no relative `../../`.
- **Comments:** none that restate code. Only WHY comments for non-obvious constraints (the display-only rule for connectors from REQUIREMENTS.md is a classic case worth a comment at the node component).

## 10. Open items to settle on day one

Resolve these with the user before building far beyond the canvas:

1. **Persistence:** plan is `localStorage` write-through; REQUIREMENTS.md says "data fetching and mutation updates involving payload.json" which is ambiguous. If the user wants real disk writes, build a tiny Vite dev plugin to PUT the JSON; otherwise stick with localStorage.
2. **Trigger node:** REQUIREMENTS.md never says whether `trigger` is deletable or creatable. Default: not deletable, not in Create Node options (a flow needs exactly one trigger).
3. **Edge style:** Vue Flow default is bezier; `smoothstep` looks more like an org chart. Pick one and stick with it across all edges.

## 11. Things to ignore from the scaffold

- [src/stores/counter.ts](src/stores/counter.ts) — placeholder, delete it on first store-related change.
- The "You did it!" content in [src/App.vue](src/App.vue) — replace with `<RouterView />`.
- The starter [src/__tests__/App.spec.ts](src/__tests__/App.spec.ts) — replace with real specs once App.vue has real content.

## 12. Reference

- Requirements: [REQUIREMENTS.md](REQUIREMENTS.md) at the repo root.
- Vue Flow docs: https://vueflow.dev/
- TanStack Query (Vue): https://tanstack.com/query/latest/docs/framework/vue/overview
- Shadcn Vue: https://www.shadcn-vue.com/
- Tailwind v4: https://tailwindcss.com/docs/v4-beta
