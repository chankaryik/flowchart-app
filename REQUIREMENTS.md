# Objective

You will create a Flow Chart app with the necessary functionality to create, edit, and delete nodes.

# Technology

You are required to use the following technologies:

- Programming Language: JavaScript/ES6
- Framework/Libraries: Vite, Vue 3, Pinia, Vue Router, Vue Flow, Tanstack Query (Vue), TailwindCSS, Shadcn Vue, TypeScript, VueUse, VeeValidate, Valibot
- Testing: Vitest, Playwright

# Features

You are required to develop the following features in your application:

# Flow Chart: Canvas

- Utilize vue-flow library to display nodes accordingly from the **payload.json (located in root path)**
- Add draggable functionality for each node, so users can move nodes across the canvas

# Create Node

- Add **Create New Node button** on the page for creating nodes with the following fields:
  - Title - text field
  - Description - text field
  - Type of Node - select field
    - Send Message (`sendMessage`)
    - Add Comments (`addComment`)
    - Business Hours (`businessHours`)

# Node View in Canvas

- Each node on the canvas should contain the following information:
  - Icons
  - Title
  - Description (truncated)

# Node Details: Drawer

- Each node should have its own **Details** drawer to display its properties and attachments.
  - The Details drawer should be accessible via **URL** containing the node ID.
  - The Details drawer should be able to be toggled by clicking on the node.
  - The Title and Description Fields should be **Editable**.
  - Provide an option for the user to **delete** the node.
- Send Message
  - Display existing attachments as **Tile/Box Preview**, and also allow the user to upload new attachments.
  - Display existing tasks in an input text field, and allow user to update/remove texts.
- Add Comments
  - Display existing comment in an input text field, and allow user to update/remove comment.
- Business Hours
  - Display existing business hours.
  - Utilize a Date Time Picker to update **business hours**.
  - **Note that success & failure node should not be accessible, purely for display in canvas**

# Tanstack Query (Vue)

- Utilize **Tanstack Query (Vue)** for data fetching and mutation updates involving the **payload.json (located in root path)**.
- Use below configuration for the Tanstack Query (Vue):
```
{
     queryClientConfig: {
          defaultOptions: {
               queries: {
                    refetchOnWindowFocus: false,
                    networkMode: 'always',
                    staleTime: Infinity,
                    gcTime: 60 * 60 * 1000,
               },
          },
     },
};
```

# Key details to keep in mind

- The transition between canvas and nodes should be buttery smooth.
- All input fields should have necessary validations.
- Well-written code, optimized renders, and utility functions extracted in separate file.
- Ensure comprehensive unit tests on components and necessary logics.
- Ensure E2E tests are in place.
- Use Pinia and Vue Router for storing data and routing respectively.
- Provide a clear, well-documented README that explains setup, design decisions, and how to run the project.

# Other tasks

- Undo/Redo for node moves and edits
- Keyboard accessibility for selecting nodes and opening the details drawer
- CI/CD pipeline for running the tests