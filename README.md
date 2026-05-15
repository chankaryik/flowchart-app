# Respond.io Flow Chart App

A take-home implementation of a workflow editor for Respond.io.

The app loads a workflow from `public/payload.json`, shows it on a draggable canvas, and lets users create, edit, delete, move, undo, and redo workflow nodes. Node details open in a drawer whose state is stored in the URL, so a specific node can be shared or refreshed directly.

This README is written for both technical and non-technical reviewers. The first half explains what the app does and how to review it quickly. The second half gives the engineering details for anyone who wants to go deeper.

## Quick Review

If you only have a few minutes, this is the best review path:

1. Run the app with `npm install` and `npm run dev`.
2. Open <http://localhost:5173>.
3. Click a node to open its details drawer.
4. Create a new Send Message, Add Comments, or Business Hours node.
5. Edit a node, drag it, undo/redo the change, and refresh the page.
6. Toggle Persist data if you want edits to survive refreshes.

What this demonstrates:

- The required flow chart UI is implemented with Vue Flow.
- Node details are deep-linkable through `/node/:id`.
- Create, edit, delete, drag, undo, redo, validation, keyboard navigation, and persistence are all covered.
- The implementation is tested with Vitest and Playwright.
- The code is structured so the demo can be moved from local `payload.json` storage to a real backend later.

## What Was Built

The app supports the workflow concepts from the assignment:

| Area | What is included |
| --- | --- |
| Canvas | Vue Flow canvas with draggable nodes and smooth connector lines |
| Nodes | Trigger, Send Message, Business Hours, Add Comments, and display-only Success/Failure markers |
| Details drawer | Opens from a node click or direct URL such as `/node/abc123` |
| Editing | Per-node forms for title, description, messages, attachments, comments, and business hours |
| Validation | Form fields validate on blur and submit; invalid saves are blocked |
| Undo/Redo | Works for create, delete, drag, and committed field edits |
| Keyboard support | Tab/arrows move between nodes, Enter opens a node, Esc closes the drawer, `?` opens shortcuts |
| Persistence | Off by default for clean review; optional localStorage mode keeps edits after refresh |
| Responsive UI | Desktop and mobile layouts, dark mode, toasts, loading states, and reset/re-layout controls |
| Tests | Unit tests for logic/components and E2E tests for the main user journeys |

## Getting Started

### Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm
- A modern browser

### Install and Run

```sh
npm install
npm run dev
```

Open <http://localhost:5173>.

By default, each refresh reloads the original workflow from `public/payload.json`. To keep edits after a refresh, turn on **Persist data** in the app header.

### Production Build

```sh
npm run build
npm run preview
```

The preview server runs at <http://localhost:4173>.

## Useful Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build the production app |
| `npm run preview` | Preview the production build |
| `npm run type-check` | Run Vue/TypeScript checks |
| `npm run lint` | Run oxlint and ESLint with auto-fixes |
| `npm run format` | Format source files with oxfmt |
| `npm run test:unit` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright E2E tests |

For the first E2E run on a machine, install Playwright browsers:

```sh
npx playwright install
```

## Feature Notes

### Node Types

- **Trigger** starts the workflow. It is intentionally locked and read-only because a flow should have exactly one trigger.
- **Send Message** supports editable message rows and attachment rows.
- **Business Hours** uses the `dateTime` payload type internally and renders Success/Failure connector markers under it.
- **Success/Failure markers** are display-only. They cannot be opened, edited, deleted, or selected through keyboard navigation.
- **Add Comments** stores an editable comment.

### Persistence

The assignment requires fetching and mutating `payload.json`, but it does not provide a backend. This app handles that with a small adapter:

- On first load, it fetches `/payload.json`.
- With persistence off, refreshes always return to the original seed data.
- With persistence on, nodes and positions are saved to localStorage.
- The storage logic is isolated in `src/lib/payload-adapter.ts`, so replacing localStorage with an API later would be a small, contained change.

### URL-Driven Drawer

Drawer state lives in the route instead of hidden component state:

| URL | Result |
| --- | --- |
| `/` | Canvas only |
| `/node/:id` | Canvas plus details drawer for that node |
| `/node/<unknown-id>` | Redirects back to `/` with an error toast |
| `/node/<connector-id>` | Redirects back to `/` because connectors are display-only |

This makes node details shareable and keeps browser back/forward behavior natural.

### Undo and Redo

Undo/redo is implemented as a command stack. Each visible user action becomes one history entry:

- Create node
- Delete node
- Drag node
- Edit field after blur/submit

Field edits are not stored per keystroke because that would fight the browser's native text-field undo behavior.

## Engineering Overview

The app keeps the data flow intentionally simple:

```txt
User action
  -> TanStack Query mutation
  -> optimistic Pinia update
  -> payload adapter persistence
  -> rollback and toast if persistence fails
```

The main pieces are:

| Layer | Responsibility |
| --- | --- |
| Vue components | Render the canvas, nodes, drawer, and forms |
| Pinia stores | Hold the live graph, node positions, attachments, and undo history |
| TanStack Query | Load nodes and coordinate create/update/delete/move mutations |
| Vue Router | Keeps the details drawer addressable through the URL |
| `src/lib` | Pure business logic such as validation, layout, formatting, and payload handling |
| `src/composables` | Reusable interaction logic such as keyboard navigation and edge generation |

## Tech Stack

| Area | Choice |
| --- | --- |
| Framework | Vue 3 with `<script setup lang="ts">` |
| Build | Vite |
| Canvas | Vue Flow |
| State | Pinia and TanStack Vue Query |
| Routing | Vue Router |
| Styling | Tailwind CSS v4 and Shadcn Vue |
| Forms | VeeValidate and Valibot |
| Tests | Vitest and Playwright |
| Tooling | TypeScript, oxlint, ESLint, oxfmt |

The stack follows the assignment requirements. Extra libraries were kept small and practical: VueUse for browser utilities, lucide-vue-next for icons, vue-sonner for toasts, and nanoid for short node IDs.

## Project Map

```txt
src/
  App.vue                     App shell and global providers
  main.ts                     App bootstrap
  router/                     URL routes and drawer guards
  views/                      Main flow chart page
  components/
    flow/                     Canvas, create dialog, add button, node components
    drawer/                   Node details drawer and editors
    ui/                       Shadcn-generated UI components
  stores/                     Pinia stores for graph, history, attachments
  queries/                    TanStack Query client and node mutations
  composables/                Keyboard, edge, and history interaction logic
  lib/                        Types, validators, layout, formatting, payload adapter
e2e/                          Playwright tests
public/payload.json           Seed workflow graph
```

Tests are colocated with the code they cover in `__tests__` folders.

## Test Coverage

### Unit Tests

Run:

```sh
npm run test:unit
```

Unit coverage focuses on:

- Validation rules
- Node creation and layout helpers
- Payload loading and persistence behavior
- Pinia store state transitions
- Query mutation optimistic updates and rollback
- Keyboard navigation and edge generation
- Component behavior for forms, drawer, and node rendering

### E2E Tests

Run:

```sh
npm run test:e2e
```

Playwright covers:

- Loading the canvas
- Creating nodes
- Editing through the drawer
- Deleting nodes
- Dragging nodes
- Undo/redo
- Deep links to `/node/:id`
- Persistence toggle
- Keyboard navigation

The default E2E projects are Chromium and WebKit. Firefox is documented in `playwright.config.ts` but disabled because the bundled browser was unstable for this app during local testing.

## CI

GitHub Actions is configured in `.github/workflows/ci.yml`.

It runs:

1. Install dependencies
2. Type-check
3. Lint
4. Unit tests
5. Production build
6. Playwright browser install
7. E2E tests
8. Upload Playwright report on failure

The workflow is currently manual-only through `workflow_dispatch` to avoid spending CI minutes during the review window. The push and pull request triggers are left in the file as comments and can be re-enabled quickly.

## AI-Assisted Workflow

This project was built with AI coding assistance. I am including that openly because Respond.io mentioned that AI agents are already part of the team's development workflow, and I wanted the submission to reflect how I would work in that environment.

The agents helped with scaffolding, implementation, tests, review, simplification, and verification. I treated their output as draft code: reviewed the diffs, questioned suspicious choices, checked the UI manually, and ran the local verification steps. Any remaining trade-offs are my responsibility.

## Trade-Offs

- **Client-side persistence:** There is no backend in the assignment, so localStorage is used behind an adapter. This keeps the demo reviewable while leaving a clear path to an API.
- **Locked trigger:** The trigger is read-only to preserve one valid workflow starting point.
- **Manual re-layout:** The app provides a Re-layout button instead of continuously moving nodes after every edit, so user placement is respected.
- **Field-level history:** Form changes enter undo history after blur/submit, not on every keystroke.
- **Attachment files:** The payload stores filenames; uploaded `File` objects stay in memory because real file upload infrastructure is out of scope.

## References

- Assignment spec: [REQUIREMENTS.md](REQUIREMENTS.md)
- Engineering notes: [CLAUDE.md](CLAUDE.md)
- Build checklist: [TODO.md](TODO.md)
- Vue Flow: <https://vueflow.dev/>
- TanStack Query for Vue: <https://tanstack.com/query/latest/docs/framework/vue/overview>
- Shadcn Vue: <https://www.shadcn-vue.com/>
- VeeValidate: <https://vee-validate.logaretm.com/v4/guide/overview/>
