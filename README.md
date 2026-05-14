# Respondio Flow Chart App

A Vue Flow–based workflow editor that loads a graph from `payload.json`, renders it on a draggable canvas, and lets the user create, edit, drag, delete, undo, and redo nodes — all driven through a URL-addressable details drawer.

Built as the frontend take-home for the Respondio frontend role. The spec lives in [REQUIREMENTS.md](REQUIREMENTS.md); detailed engineering decisions are in [CLAUDE.md](CLAUDE.md).

---

## Table of contents

1. [What's in the box](#whats-in-the-box)
2. [Requirements coverage](#requirements-coverage)
3. [AI-assisted workflow disclosure](#ai-assisted-workflow-disclosure)
4. [Tech stack](#tech-stack)
5. [Getting started](#getting-started)
6. [Available scripts](#available-scripts)
7. [Project structure](#project-structure)
8. [Architecture & design decisions](#architecture--design-decisions)
9. [Domain model](#domain-model)
10. [Persistence model](#persistence-model)
11. [Routing & URL contract](#routing--url-contract)
12. [Validation rules](#validation-rules)
13. [Keyboard shortcuts](#keyboard-shortcuts)
14. [Testing strategy](#testing-strategy)
15. [Continuous integration](#continuous-integration)
16. [Trade-offs & future work](#trade-offs--future-work)

---

## What's in the box

- **Vue Flow canvas** with five node types: `trigger`, `sendMessage`, `dateTime`, `dateTimeConnector` (display-only Success/Failure), and `addComment`. Edges are derived from `parentId` chains and rendered with `smoothstep`.
- **URL-driven details drawer** at `/node/:id`. Drawer state lives in the route, so it is deep-linkable, browser-back-button friendly, and survives a refresh.
- **Create / Edit / Delete** for every editable node type, with per-type editors (text payloads, attachments, business-hours grid, comment textarea).
- **Drag-and-drop** with throttled position updates and a single undo entry per drag end. `dateTime` siblings move with their parent.
- **Undo / Redo** via `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`, backed by a command stack. Field edits batch to blur/submit granularity so each user-visible change is a single history entry.
- **Keyboard accessibility**: Tab and arrow keys move focus through nodes in graph order, Enter opens the drawer, Esc closes it, `?` opens a shortcut help dialog. Connector nodes are intentionally skipped.
- **TanStack Query** for fetching and mutating `payload.json` with the exact client config required by the spec; optimistic Pinia updates plus rollback on error.
- **Comprehensive validation** at blur and submit (title, description, attachment uploads, comment length, business-hours overlap detection).
- **Tests**: Vitest coverage for the custom components, stores, queries, composables, and pure utilities; 8 Playwright E2E scenarios covering the golden paths across Chromium and WebKit.
- **Toasts, skeleton loading state, empty-state recovery**, and a tooltip-rich UI built on Shadcn Vue + Tailwind v4.

## Requirements coverage

| [REQUIREMENTS.md](REQUIREMENTS.md) section | Where it lives |
| --- | --- |
| Flow chart canvas (Vue Flow, drag) | `src/components/flow/FlowCanvas.vue`, `src/composables/useNodeEdges.ts` |
| Create Node button + dialog | `src/components/flow/CreateNodeDialog.vue` + `AddNodeButton.vue` |
| Node view (icon / title / truncated description) | `src/components/flow/nodes/*.vue` |
| Details drawer toggled by node click and by URL | `src/components/drawer/NodeDetailsDrawer.vue`, `src/router/index.ts` |
| Send Message attachments (tile preview + upload) | `src/components/drawer/SendMessageEditor.vue` + `AttachmentField.vue` |
| Add Comments editor | `src/components/drawer/AddCommentEditor.vue` |
| Business Hours (time picker, success/failure not interactive) | `src/components/drawer/BusinessHoursEditor.vue`, `DateTimeConnectorNode.vue` |
| TanStack Query for fetch + mutations | `src/queries/client.ts`, `src/queries/nodes.ts` |
| Validation on every field | `src/lib/validators.ts` (+ VeeValidate + Valibot) |
| Pinia + Vue Router | `src/stores/flow.ts`, `src/router/index.ts` |
| Buttery transitions | Drawer uses `transform: translateX(...)`; drag updates throttled, history pushed on drag-end |
| Utility extraction | All pure logic under `src/lib/` and `src/composables/` |
| Unit tests + E2E | `src/**/__tests__/*.spec.ts`, `e2e/*.spec.ts` |
| Undo/Redo | `src/stores/history.ts`, `src/composables/useFlowHistory.ts` |
| Keyboard accessibility | `src/composables/useNodeKeyboard.ts`, `src/components/ShortcutHelpDialog.vue` |
| CI/CD pipeline | `.github/workflows/ci.yml` (manual-dispatch — see [CI section](#continuous-integration)) |

## AI-assisted workflow disclosure

This take-home was built with full assistance from AI coding agents. I am being explicit about this because Respond.io shared that AI agents are already part of the team's development workflow, and I wanted this submission to reflect how I would work in that kind of environment: transparently, quickly, and with review discipline.

The workflow used here was:

- **Claude Code with Claude Opus 4.7, Extra High reasoning** for the main coding tasks: scaffolding features, implementing Vue components/composables/stores, writing tests, and iterating on the requirements.
- **Codex with GPT-5.5, Extra High reasoning** for verification, code review, simplification, and optimization after the main implementation was complete.

The main benefits of using agents on this project were faster iteration, broader test generation, easier exploration of edge cases, and a second-pass review loop that helped remove over-engineering. The agents were used as pair-programming and review tools, not as an unchecked autopilot.

I still treated every AI-produced change as draft code. I reviewed diffs manually, did "eyeball checks" on the implementation and UI behavior, asked the agents to justify suspicious decisions, and verified the final result with the local test suite and browser smoke checks. Any remaining trade-offs in this repository are my responsibility.

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Vue 3.5** + `<script setup lang="ts">` | Required by spec; Composition API gives the cleanest separation between presentation and logic. |
| Router | **Vue Router 5** | Drawer state lives in the URL so it is shareable and back-button-friendly. |
| State (live) | **Pinia 3** | Required; canvas truth lives here, mutations from TanStack patch it optimistically. |
| State (async) | **TanStack Vue Query 5.100** | Required; gives us query cache, optimistic mutations, and rollback on error. |
| Canvas | **`@vue-flow/core` 1.48** + `background` / `controls` / `minimap` | Required; mature, headless, easy to extend with custom node components. |
| UI primitives | **Shadcn Vue** (Reka UI under the hood) + **Tailwind v4** | Required; component-per-file in `src/components/ui/` so we own the markup. |
| Forms / validation | **VeeValidate 4** + **Valibot** | Required; Valibot keeps the bundle small vs. Zod. |
| Toasts | **vue-sonner** | Pairs nicely with Shadcn Vue. |
| Icons | **lucide-vue-next** | Default Shadcn icon set. |
| Misc | **VueUse**, **nanoid** | `nanoid(6)` matches the 6-char ID shape already in `payload.json`. |
| Types | **TypeScript 6 strict** with `noUncheckedIndexedAccess` | Catches the entire class of "array index might be undefined" bugs at compile time. |
| Test (unit) | **Vitest 4** with `jsdom`, **`@vue/test-utils`** | Required. |
| Test (E2E) | **Playwright 1.59** across `chromium` / `webkit` | Firefox is documented in the config but disabled because the bundled browser was unstable for this app. |
| Linting | **oxlint** + **ESLint** + **oxfmt** | oxlint catches the common stuff fast; ESLint covers the Vue-specific rules. |
| Build | **Vite 8** with the official Tailwind v4 plugin | Required. |

## Getting started

### Prerequisites

- **Node.js** `^20.19.0` or `>=22.12.0` (see `engines` in [package.json](package.json)). Node 24 is what CI runs on.
- **npm** (lockfile is `package-lock.json`).
- Modern browser for development (Chromium / Firefox / Safari).

### Install

```sh
npm install
```

### Run the dev server

```sh
npm run dev
```

Open <http://localhost:5173>. The canvas loads the seed graph from `public/payload.json`. Persistence is off by default, so refreshing re-reads the canonical payload. Turn on **Persist data** in the header to save node edits in `localStorage` under `payload-v1` (see [Persistence model](#persistence-model)).

To reset the graph to the seed, use the **Reset** button in the header, or clear the cache in DevTools:

```js
localStorage.removeItem('payload-v1'); location.reload();
```

### Production build & preview

```sh
npm run build      # type-check + vite build
npm run preview    # serves the production build on http://localhost:4173
```

### Run the tests

```sh
npm run test:unit               # Vitest, jsdom env
npx playwright install          # once, to grab browser binaries
npm run test:e2e                # Playwright across chromium/webkit
npm run test:e2e -- --project=chromium       # narrow to one browser
npm run test:e2e -- e2e/create-node.spec.ts  # narrow to one file
```

### Lint & format

```sh
npm run lint        # oxlint --fix, then eslint --fix --cache
npm run format      # oxfmt on src/
npm run type-check  # vue-tsc --build
```

## Available scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on :5173 with HMR + vue-devtools plugin |
| `npm run build` | Parallel `type-check` + `build-only` (Vite production build) |
| `npm run build-only` | Just the Vite build, skipping the type-check (used by CI to parallelise) |
| `npm run preview` | Serves `dist/` for a production smoke test |
| `npm run type-check` | `vue-tsc --build` — Vue-aware TypeScript check |
| `npm run test:unit` | Vitest |
| `npm run test:e2e` | Playwright (dev server in local dev, preview server on CI) |
| `npm run lint` | `oxlint --fix` then `eslint --fix --cache` |
| `npm run format` | `oxfmt src/` |

## Project structure

```
src/
├── App.vue                          router-view + global providers (Toaster, TooltipProvider)
├── main.ts                          pinia, router, vue-query, mount
├── assets/main.css                  @import "tailwindcss"; shadcn tokens; vue-flow theme
├── router/index.ts                  /, /node/:id (with connector + unknown-id redirect)
├── views/
│   └── FlowChartView.vue            page shell (header + canvas + drawer + create button)
├── components/
│   ├── flow/
│   │   ├── FlowCanvas.vue           Vue Flow wrapper; edges derived; drag with secondary moves
│   │   ├── AddNodeButton.vue        floating "Create Node" affordance
│   │   ├── CreateNodeDialog.vue     title / description / type creation flow
│   │   └── nodes/                   one component per node type + connector
│   ├── drawer/
│   │   ├── NodeDetailsDrawer.vue    URL-driven Sheet
│   │   ├── SendMessageEditor.vue    name + text/attachment payload editor
│   │   ├── AttachmentField.vue      tile preview + upload (supports multiple)
│   │   ├── BusinessHoursEditor.vue  schedule rows + timezone, with overlap validation
│   │   ├── AddCommentEditor.vue     name + comment textarea (char counter)
│   │   └── TriggerDetails.vue       read-only (trigger is locked)
│   ├── ShortcutHelpDialog.vue       opens on '?'
│   └── ui/                          shadcn-generated; do not hand-edit
├── stores/
│   ├── flow.ts                      live canvas state (nodes, positions, create dialog)
│   ├── history.ts                   undo/redo command stack
│   └── attachments.ts               in-memory file cache for uploaded files
├── queries/
│   ├── client.ts                    QueryClient with the spec-mandated config
│   └── nodes.ts                     useNodesQuery + create/update/delete/move mutations
├── composables/
│   ├── useNodeEdges.ts              parentId → edges projection
│   ├── useNodeKeyboard.ts           Tab / arrows / Enter / Esc / ? handling
│   └── useFlowHistory.ts            Ctrl+Z / Ctrl+Shift+Z bindings
└── lib/
    ├── types.ts                     FlowNode union, NodeType, Day, NodeId
    ├── validators.ts                title/description/attachment/business-hours/comment
    ├── node-factory.ts              createNode(type, parentId, partialData)
    ├── payload-adapter.ts           the only module that touches storage
    ├── layout.ts                    top-down tree layout for first render
    ├── format.ts                    display-time helpers
    └── utils.ts                     shadcn `cn(...)` helper
e2e/
└── *.spec.ts                        load, create, edit, delete, drag, undo/redo, deep-link, keyboard
public/
└── payload.json                     seed graph served at /payload.json
```

Tests sit alongside the code they cover under `__tests__/` folders, mirroring the source layout — consistent with the spec's "tests are gates, not afterthoughts" stance.

## Architecture & design decisions

### One live source of truth, two async layers

```
   Component ──► useUpdateNode().mutate(patch)
                       │
                       ├─ onMutate: history.push({undo, redo})
                       │            store.applyPatch(...)              <-- optimistic
                       ├─ mutationFn: payload-adapter.saveNodes(store.nodes)
                       └─ onError: history.lastEntry.undo()            <-- rollback
                                   toast.error(...)

   Component ◄── useFlowStore().nodes (reactive)
```

- **`stores/flow.ts`** is the live truth that the canvas binds to. Components route create/edit/delete/move operations through query mutations instead of patching node data directly.
- **`queries/nodes.ts`** holds the mutations. `onMutate` patches the store optimistically and pushes a history entry; `mutationFn` persists; `onError` rolls back through the same history entry.
- **`lib/payload-adapter.ts`** is the only module that talks to storage. Swapping the adapter for a real HTTP backend is a one-file change.
- **`stores/history.ts`** is a plain command stack with `undo`/`redo`/`canUndo`/`canRedo` and a depth cap. It is invoked by `useFlowHistory` (keyboard) and by mutations (each mutation registers its own undo/redo pair).

This split keeps the canvas always-responsive (optimistic Pinia) while preserving the spec's TanStack-mediated mutation flow.

### Drawer as URL state

The drawer opens and closes by navigation, not by component state. `NodeDetailsDrawer.vue` reads `route.params.id`, looks up the node, and renders the right per-type editor. Closing the drawer pushes `/`. The router has a navigation guard that:

- Redirects to `/` if the id is unknown.
- Redirects to `/` if the id resolves to a `dateTimeConnector` (display-only per spec).

This makes every drawer state shareable and back-button-friendly with no extra work.

### Edges are derived, never stored

`payload.json` only stores `parentId` (and a `connectors[]` array on `dateTime` nodes that mirrors the same parent–child relationship). Edges are computed in `composables/useNodeEdges.ts` from the parent chain. That keeps the persisted shape small and prevents "ghost edge" bugs where the edge list and node list disagree.

### Day-0 decisions confirmed with the spec author

| Decision | Choice | Reason |
| --- | --- | --- |
| Persistence | Optional `localStorage` cache under `payload-v1` | The spec says "data fetching and mutation updates involving payload.json" without prescribing a backend. The static file is served by Vite at `/payload.json` for the initial seed; mutations stay client-side when persistence is enabled. The adapter is a clean swap point. |
| Trigger node | Locked: not deletable, not in Create Node | A flow needs exactly one trigger; the spec never says otherwise. The trigger's drawer is read-only. |
| Edge style | `smoothstep` everywhere | Looks like an org chart, which makes the `dateTime → success/failure → next-action` branching legible at a glance. |

### Buttery transitions

- Drawer slides via CSS `transform: translateX(...)`, not by animating `width` (which would thrash layout).
- Drag listeners are throttled (~30ms, trailing edge) and only push a single history entry on `onNodeDragStop`, not per pixel.
- Dragging a `dateTime` node translates its `success`/`failure` connector children by the same delta in the same mutation, so the branching shape stays intact.

## Domain model

`src/lib/types.ts` is the single source of truth for the wire format. Node IDs may be `string | number` (the seed `trigger` is the numeric `1`):

```ts
type NodeId = string | number;
type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

type FlowNode =
  | { id: NodeId; parentId: NodeId; type: 'trigger';
      data: { type: string; oncePerContact: boolean } }
  | { id: NodeId; parentId: NodeId; type: 'sendMessage'; name: string;
      data: { payload: Array<
        | { type: 'text'; text: string }
        | { type: 'attachment'; attachments: string[] }
      > } }
  | { id: NodeId; parentId: NodeId; type: 'dateTime'; name: string;
      data: { times: Array<{ day: Day; startTime: string; endTime: string }>;
              connectors: NodeId[]; timezone: string; action: string } }
  | { id: NodeId; parentId: NodeId; type: 'dateTimeConnector'; name: string;
      data: { connectorType: 'success' | 'failure' } }
  | { id: NodeId; parentId: NodeId; type: 'addComment'; name: string;
      data: { comment: string } };
```

The discriminated union flows through every layer — components, stores, validators, and the adapter all narrow on `type` instead of casting.

## Persistence model

- **Default mode:** `payload-adapter.loadNodes()` fetches `/payload.json` on every refresh. This keeps the take-home easy to review because a reload always returns to the canonical seed.
- **Persist data mode:** when the header switch is on, `loadNodes()` reads `localStorage['payload-v1']` first, and node mutations write the full node list back through `saveNodes(store.nodes)`.
- **Resetting:** the header **Reset** button clears cached nodes, re-fetches `/payload.json`, clears undo history, and recomputes layout.
- **E2E setup:** Playwright enables the persistence flag per test so create/edit/delete scenarios can assert reload behavior inside an isolated browser context.

Why localStorage and not a real backend: the spec is explicit about TanStack Query but ambiguous about where mutations land. Going through a single `payload-adapter` module means swapping to a real backend is a one-file change — the rest of the app already speaks "send a list of nodes to be saved."

## Routing & URL contract

| Path | Behaviour |
| --- | --- |
| `/` | Canvas only. |
| `/node/:id` | Canvas + drawer for that node. Closing the drawer pushes `/`. |
| `/node/<unknown-id>` | Redirect to `/` and toast an error. |
| `/node/<connector-id>` | Redirect to `/` and toast — connectors are display-only. |

## Validation rules

Implemented in `src/lib/validators.ts`. Every input field validates on **blur** and on **submit**; the save button is disabled while the form is invalid.

| Field | Rule |
| --- | --- |
| Title / name | Required, 1–80 chars |
| Description / comment | ≤ 1000 chars (comment), ≤ 500 chars (description) |
| Attachment upload | At least one uploaded file is required for an attachment row |
| Business-hours row | `endTime > startTime` |
| Business-hours rows within a day | May repeat the day, but rows must not overlap |

## Keyboard shortcuts

Press `?` in the app to see this list at any time.

| Shortcut | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | Cycle focus through nodes in graph order (connectors skipped) |
| `Arrow keys` | Move focus through nodes in graph order |
| `Enter` | Open the details drawer for the focused node |
| `Esc` | Close the drawer |
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` / `Ctrl+Y` | Redo |
| `?` | Show shortcut help dialog |

Field-edit history is at submit/blur granularity, so in-field `Ctrl+Z` inside a textarea still lets the browser handle native undo.

## Testing strategy

The spec calls out tests as a gate, not an afterthought. Two layers:

### Unit (Vitest, jsdom)

Located next to the code they cover under `__tests__/`. Custom components, composables, stores, queries, and pure utilities have behavior-focused specs; generated Shadcn UI wrappers are treated as vendor code.

- **Lib** (`validators`, `node-factory`, `payload-adapter`, `layout`, `format`) — pure-function coverage, including overlap edge cases for business hours and the persistence-on/off paths for the adapter.
- **Stores** (`flow`, `history`) — state transitions, cascade deletion of subtrees + connectors, history depth cap, full undo/redo round-trips.
- **Queries** (`nodes`) — optimistic Pinia patch, rollback on error, history entry registration, secondary moves on `useMoveNode`.
- **Composables** (`useNodeEdges`, `useNodeKeyboard`, `useFlowHistory`) — edge derivation, keyboard traversal, drawer shortcuts, and modifier-key detection.
- **Components** — render with seeded props, validation triggers, submit-disabled behavior, that connectors don't emit click navigation, that the trigger drawer is read-only.

Run with `npm run test:unit`.

### E2E (Playwright across Chromium / WebKit)

One spec per scenario in [CLAUDE.md §8.7](CLAUDE.md):

- `load-canvas.spec.ts` — seed graph renders with correct edges.
- `create-node.spec.ts` — open dialog, create each editable type, persists after refresh.
- `edit-node.spec.ts` — navigate to `/node/:id` directly, edit, save, value sticks.
- `delete-node.spec.ts` — delete with cascade; trigger has no Delete button.
- `drag-node.spec.ts` — drag moves the node in-session; single undo reverts.
- `undo-redo.spec.ts` — create → undo → redo on every editable type.
- `deep-link.spec.ts` — `/node/:id` opens drawer; connector/unknown ids redirect with toast.
- `keyboard-nav.spec.ts` — Tab, Arrows, Enter, Esc, `?`; connectors skipped.

Every spec starts in a fresh browser context and enables the persistence flag in `beforeEach`. Local runs use the Vite dev server; CI builds first and runs against the preview server (see `playwright.config.ts`).

Run with `npm run test:e2e` (after `npx playwright install` once to grab browser binaries). Firefox is left commented in `playwright.config.ts` with the reason, but it is not part of the default gate.

## Continuous integration

GitHub Actions workflow at [.github/workflows/ci.yml](.github/workflows/ci.yml) runs the full gate:

1. `npm ci`
2. `npm run type-check`
3. `npm run lint`
4. `npm run test:unit`
5. `npm run build-only`
6. `npx playwright install --with-deps`
7. `npm run test:e2e`
8. Upload the Playwright HTML report on failure.

> **Trigger:** the workflow is currently `workflow_dispatch` only (manually triggered from the GitHub Actions UI). The auto-trigger on `push` / `pull_request` was disabled in commit `34c5aad` to avoid burning CI minutes during the take-home review window — uncomment the two lines at the top of `ci.yml` to re-enable PR/main CI. The gate steps are wired and have been validated on a manual run.

## Trade-offs & future work

A few places where I made a deliberate trade-off rather than reach for a heavier solution:

- **Persistence is client-side.** The spec is ambiguous, and a real backend was out of scope. The `payload-adapter` module is the only thing that would need to change to point at a HTTP API.
- **Trigger node is locked.** A workflow needs exactly one trigger; making it deletable would require a "no-trigger" empty state that the spec doesn't describe. Easy to relax later.
- **Edge routing is `smoothstep` everywhere.** Vue Flow's `bezier` looks fine too — `smoothstep` was chosen because the `dateTime → success/failure → next-action` shape reads more like an org chart that way.
- **History is field-level, not keystroke-level.** Per-keystroke undo would conflict with the browser's native in-field undo and explode the history stack. Blur/submit granularity is what users expect for form fields.
- **Auto-layout fills missing positions.** Dragged positions live in Pinia for the current session; a future enhancement would persist layout or add a "re-layout" button.
- **Attachments are client-side only.** The payload stores filenames, while uploaded `File` objects live in the in-memory `stores/attachments.ts` map and would need real upload infrastructure to be production-ready.

---

### Reference

- Spec: [REQUIREMENTS.md](REQUIREMENTS.md)
- Engineering notes & day-0 decisions: [CLAUDE.md](CLAUDE.md)
- Build plan (phase-by-phase): [TODO.md](TODO.md)
- Vue Flow: <https://vueflow.dev/>
- TanStack Query (Vue): <https://tanstack.com/query/latest/docs/framework/vue/overview>
- Shadcn Vue: <https://www.shadcn-vue.com/>
- Tailwind v4: <https://tailwindcss.com/docs/v4-beta>
- VeeValidate: <https://vee-validate.logaretm.com/v4/guide/overview/>
