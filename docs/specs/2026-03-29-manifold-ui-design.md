# manifold-ui Design Specification

**Date:** 2026-03-29
**Package:** `manifold-ui` on npm
**Repository:** `michaelblum/manifold-ui` on GitHub
**Framework:** Svelte 5 (runes), TypeScript
**Tagline:** Grouped numeric control surfaces for Svelte
**License:** MIT

---

## 1. Identity & Scope

### What It Is

A component library for manipulating groups of related numeric values through multiple interaction modalities: typing, drag-to-edit with contextual HUD overlays, and modifier-key rerouting. Applicable to any N-dimensional numeric tuple: position XYZ, RGBA color, rotation angles, 6DOF transforms, gradient parameters.

### What It Is Not

- Not a 3D gizmo or Three.js wrapper (Three.js integration is a showcase example, not part of the package)
- Not a design system or full UI framework
- Not a form library

### Key Properties

- **Zero runtime dependencies** — no Three.js, no Tailwind required
- **Ships with a polished dark default theme** — looks good immediately
- **Fully overridable** — every visual property exposed as CSS custom properties
- **N-ary groups** — not limited to triplets; supports 2, 3, 4, 6+ members per group
- **Svelte 5 runes** — built on `$state`, `$derived`, reactive throughout
- **Published via `svelte-package`** for standard npm distribution

---

## 2. API Layers

Three layers, each building on the one below:

```
Layer 3:  <Manifold schema={...} />              schema-driven (pass config, done)
Layer 2:  <ManifoldPanel> <ManifoldGroup> ...     component API (compose in templates)
Layer 1:  createManifold() / createGroup()        builder API (reactive state machines)
```

### Layer 1 — Builders

Pure reactive state machines. No DOM, no global listeners. Power users and AI agents work here.

```typescript
const manifold = createManifold({
  groups: [
    { id: 'position', members: ['x', 'y', 'z'], labels: ['X', 'Y', 'Z'],
      initial: { x: 0, y: 5, z: 0 },
      inputDrag: { base: { type: 'axis_2d', handler: posHandler } } },
    { id: 'color', members: ['r', 'g', 'b', 'a'], labels: ['R', 'G', 'B', 'A'],
      initial: { r: 128, g: 128, b: 128, a: 1 },
      config: { min: 0, max: 255, step: 1 } }
  ]
})

// Reactive state (Svelte 5 runes internally)
manifold.values          // { position: { x: 0, y: 0, z: 0 }, color: { r: 0, ... } }
manifold.activeGroup     // 'position'
manifold.modifier        // 'base' | 'shift' | 'ctrl' | 'shiftCtrl'

// Methods
manifold.set('position', { x: 5, y: 10 })   // partial updates
manifold.undo()                               // revert last committed change
manifold.redo()
manifold.reset('position')                    // reset group to initial values
manifold.destroy()                            // cleanup internal state

// Events (callback-based)
manifold.onChange(({ groupId, member, oldValue, newValue }) => { ... })
manifold.onDragStart(({ groupId }) => { ... })
manifold.onDragEnd(({ groupId, committed }) => { ... })  // committed=false on Escape
```

The builder owns: drag lifecycle state, modifier tracking, snapshot/revert for Escape, change event emission, undo/redo history. It does NOT touch the DOM or register any global listeners.

**Initial values:** Each group config accepts an `initial` object. Members default to `0` if not specified. The builder populates `manifold.values` from these on creation.

**Two-way binding:** The builder can borrow an external reactive object instead of creating its own:

```typescript
let transform = $state({ position: { x: 0, y: 0, z: 0 } });

const manifold = createManifold({
  values: transform,   // uses this object by reference, not a copy
  groups: [...]
})
// manifold.values === transform — same reactive reference
// drag changes transform. code changes transform. both directions work.
```

When the consumer provides a `values` object, the builder uses it directly. This enables zero-adapter integration with external systems (e.g., Three.js mesh properties). If no `values` object is provided, the builder creates its own internal state from `initial` values. The Layer 3 schema API exposes this via standard Svelte `bind:values`.

### Layer 2 — Components

Thin Svelte wrappers that consume a builder via context and bind to the DOM.

```svelte
<ManifoldPanel title="Node" controller={manifold}>
  <ManifoldGroup id="position" label="Position">
    <ManifoldInput member="x" />
    <ManifoldInput member="y" />
    <ManifoldInput member="z" />
  </ManifoldGroup>
  <ManifoldGroup id="color" label="Color">
    <ManifoldInput member="r" label="R" min={0} max={255} step={1} />
    <ManifoldInput member="g" label="G" min={0} max={255} step={1} />
    <ManifoldInput member="b" label="B" min={0} max={255} step={1} />
    <ManifoldInput member="a" label="A" min={0} max={1} step={0.01} />
  </ManifoldGroup>
</ManifoldPanel>
```

**Component responsibilities:**

- `<ManifoldPanel>` — accepts a builder controller via prop, provides it to children via Svelte `setContext`/`getContext`. Renders title/status bar. Can be a panel-level drag target.
- `<ManifoldGroup>` — registers itself with the controller on mount. Renders label, manages active/inactive visual state. Can be a group-level drag target.
- `<ManifoldInput>` — the core interaction element. Binds to the controller's values. Handles: typing, pointer capture for drag, HUD display, modifier-aware drag routing.
- `<ManifoldHud>` — internal component, portaled to `document.body`. Renders slider/crosshair/dial based on active drag state. One instance per panel, not per input.

**Where drag config lives:** Drag handlers and HUD type mappings are defined in the builder config (the `createManifold()` call), not as component props. Components look up their drag config from the builder by matching their `id`/`member` props to the group config. This keeps the compositional API clean — components declare identity, the builder owns behavior.

### Layer 3 — Schema Shorthand

Convenience wrapper that creates a builder internally and renders Layer 2 components from a config object.

```svelte
<Manifold
  schema={{
    title: "Transform",
    groups: [
      { id: 'position', label: 'Position', members: ['x', 'y', 'z'],
        inputDrag: { base: { type: 'axis_2d', handler: myHandler } } },
      { id: 'scale', label: 'Scale', members: ['x', 'y', 'z'],
        inputDrag: { base: { type: 'slider_1d', handler: scaleHandler } },
        config: { min: 0.01, step: 0.1 } }
    ]
  }}
  bind:values
  onChange={handleChange}
/>
```

---

## 3. Drag Interaction & HUD System

### Three Tiers of Drag Targets

Every visible surface of the component can be a drag target with configurable behavior:

| Click Target | Context Passed to Handler | Example Use |
|---|---|---|
| `<ManifoldInput>` | Group state + which member clicked | Drag Y input: change Y only, or change all XYZ uniformly |
| `<ManifoldGroup>` background/label | Group state, no specific member | Drag "Position" row: freeform XY movement |
| `<ManifoldPanel>` background | All group values | Drag anywhere: global operation |

Schema configuration for all three tiers:

```typescript
{
  title: "Transform",
  // Panel-level drag (optional)
  drag: {
    base: { type: 'axis_2d', handler: (dx, dy, allValues, start) => { ... } }
  },
  groups: [{
    id: 'position',
    members: ['x', 'y', 'z'],
    // Group-level drag (optional)
    drag: {
      base: { type: 'axis_2d', handler: (dx, dy, cur, start) => { ... } }
    },
    // Input-level drag (per-input, receives which member was clicked)
    inputDrag: {
      base: { type: 'slider_1d', handler: (dx, dy, cur, start, member) => { ... } },
      shift: { type: 'dial', handler: (dx, dy, cur, start, member) => { ... } }
    }
  }]
}
```

If a tier does not define a `drag` config, clicks on that area fall through to normal behavior (no drag).

### Drag Configuration Per Modifier

Each modifier key state can define both the **HUD type** and the **handler function**. Pressing or releasing a modifier mid-drag swaps both simultaneously:

```typescript
inputDrag: {
  base:  { type: 'axis_2d',   handler: positionHandler },
  shift: { type: 'slider_1d', handler: depthHandler }
}
```

### Drag Lifecycle

1. **`pointerdown`** on a drag target — record start position, mark as "potential drag"
2. **Pointer moves beyond threshold** (3px mouse, 10px touch) — transition to active drag:
   - Call `element.setPointerCapture(e.pointerId)`
   - Snapshot current group values (for Escape revert)
   - Blur the input if applicable (value display updates without cursor conflict)
   - Apply `user-select: none` to the component root only
   - Show HUD at drag origin
3. **During drag** — read `dx`/`dy` from origin, look up active modifier, call matching handler, update HUD visual
4. **Modifier key changes mid-drag** — swap handler AND HUD type reactively, continue with same origin/snapshot
5. **`pointerup`** — commit values, emit `onChange`, push to undo stack, release pointer capture, hide HUD
6. **`Escape` mid-drag** — revert to snapshot, emit `onDragEnd({ committed: false })`, release capture, hide HUD
7. **`lostpointercapture`** — cleanup if browser interrupts drag (tab switch, alert dialog)

**If no drag occurs** (click without exceeding movement threshold): focus the input for keyboard typing.

### HUD Types

| Type | Visual | Best For |
|---|---|---|
| `slider_1d` | Vertical bar + sliding thumb | Single-axis values, scale, opacity |
| `axis_2d` | Crosshair circle + moving dot | XY position, 2D offsets |
| `dial` | Dashed circle + rotating pointer | Rotation angles |

HUD rendering:
- Single `<div>` portaled to `document.body`
- Positioned at drag origin using `getBoundingClientRect()` (viewport-relative, scroll-safe)
- Styled via CSS custom properties (`--manifold-hud-*`)
- `pointer-events: none` — purely visual feedback
- `aria-hidden="true"` — invisible to screen readers
- Removed from DOM entirely when no drag is active

---

## 4. Undo/Redo Model

The component does **not** capture `Ctrl+Z` or any global keyboard shortcuts. Undo is exposed as an API for consumers to wire to their own application's undo system.

**Built-in (always active):**
- Escape to cancel an in-progress drag — reverts to the snapshot taken at drag start
- This is scoped to the component's own active interaction, not a global shortcut

**Exposed to consumers:**
- `manifold.undo()` / `manifold.redo()` — imperative methods on the builder instance
- `onChange` event includes `{ oldValue, newValue }` for consumers building their own undo stack
- `onDragEnd` event includes `{ committed: boolean }` to distinguish completed drags from Escape cancels
- Optional `historySize` config (default: 50 entries)

---

## 5. Accessibility & Keyboard

### Keyboard Interaction

| Key | Scope | Behavior |
|---|---|---|
| Arrow Up/Down | Focused input | Increment/decrement by `step` |
| Shift + Arrow | Focused input | Increment/decrement by `step * 10` |
| Enter | Focused input | Confirm typed value, blur input |
| Escape | During drag | Cancel drag, revert to snapshot |
| Escape | Focused input (not dragging) | Blur input |
| Tab / Shift+Tab | Inside panel | Native browser behavior — moves between inputs sequentially |

### Group Activation

Groups activate automatically when any input inside them receives focus. Tab moves between individual inputs naturally; crossing from one group's last input to the next group's first input activates the new group. No keyboard shortcut is hijacked.

### ARIA

```html
<div role="group" aria-label="Transform controls">
  <fieldset aria-label="Position">
    <legend class="manifold-group-label">Position</legend>
    <label>
      <span>X</span>
      <input type="number"
        role="spinbutton"
        aria-label="Position X"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
      />
    </label>
  </fieldset>
</div>
```

- `<fieldset>` + `<legend>` for natural screen reader grouping
- `aria-label` combines group + member name ("Position X")
- Live value changes during drag announced via `aria-live="polite"` on a visually hidden status region
- Drag-to-edit is a progressive enhancement — full functionality via keyboard typing and arrow keys
- HUD is `aria-hidden="true"`

### Modifier Key Scoping

- Modifier detection via `keydown`/`keyup` on the panel element (not window)
- Panel receives modifier events when it or any child has focus
- Modifier resets to `base` when panel loses focus entirely (`focusout` with no related target inside)

---

## 6. Styling & Theming

### Default Theme

Ships with a dark glass-morphism aesthetic. Looks good immediately with no configuration.

### CSS Custom Properties

Consumers override by setting variables on a parent container or globally:

```css
/* Minimal override */
.my-app {
  --manifold-accent: #10b981;
}

/* Full theme */
.my-app {
  --manifold-bg: #1a1a2e;
  --manifold-bg-active: rgba(16, 185, 129, 0.05);
  --manifold-border: #2d2d44;
  --manifold-border-active: #064e3b;
  --manifold-text: #f8fafc;
  --manifold-text-dim: #94a3b8;
  --manifold-text-label: #6b7280;
  --manifold-input-bg: #1a1525;
  --manifold-input-bg-focus: #231b33;
  --manifold-input-border: #3b2f56;
  --manifold-input-border-focus: #d8b4fe;
  --manifold-radius: 6px;
  --manifold-radius-panel: 8px;
  --manifold-font-mono: ui-monospace, SFMono-Regular, monospace;
  --manifold-font-label: inherit;
}

/* HUD theming */
.my-app {
  --manifold-hud-bg: rgba(0, 0, 0, 0.4);
  --manifold-hud-border: rgba(255, 255, 255, 0.15);
  --manifold-hud-accent: #06b6d4;
  --manifold-hud-accent-alt: #c084fc;
  --manifold-hud-backdrop-blur: 4px;
}
```

### Unstyled Mode

The `unstyled` prop strips all default styles. Components render with semantic class names only (`.manifold-panel`, `.manifold-group`, `.manifold-input`, `.manifold-hud`) for consumers who want full control.

```svelte
<Manifold schema={...} unstyled />
```

### Class Forwarding

Every component accepts a `class` prop that appends to the root element:

```svelte
<ManifoldPanel class="rounded-xl shadow-2xl">
  <ManifoldGroup class="border-b border-zinc-800">
    <ManifoldInput class="font-bold" member="x" />
  </ManifoldGroup>
</ManifoldPanel>
```

### Style Isolation

- All default styles scoped via Svelte component scoping
- No global CSS selectors emitted
- The component never touches styles outside its own DOM tree

---

## 7. Requirements (Red Flag Audit)

### R1 — Pointer Capture, Not Global Listeners

- Every drag interaction uses `element.setPointerCapture()` on the initiating element
- `pointermove` and `pointerup` handlers are on the element itself, not `window`
- `lostpointercapture` handles cleanup if the browser interrupts the drag
- Multiple component instances on the same page cannot interfere with each other

### R2 — Zero CSS Leakage

- All styles scoped via Svelte component scoping
- No global selectors (`input[type="number"]`, `body`, `*`)
- `user-select: none` applied only to the component's own root element, only during active drag, removed on drag end
- Default theme uses CSS custom properties that only affect elements inside the component tree

### R3 — No Global Keyboard Capture

- Modifier detection scoped to the panel element via `focusin`/`focusout`
- Tab key is never intercepted
- No `window.addEventListener('keydown')` for any purpose
- Modifier state resets to `base` when panel loses focus

### R4 — HUD Portaling with Correct Positioning

- HUD element appended to `document.body` to escape container clipping/overflow
- Position calculated using `getBoundingClientRect()` of the drag origin element
- `aria-hidden="true"` on the HUD container
- HUD element removed from DOM when no drag is active (not just hidden)

### R5 — Accessibility Baseline

- Semantic HTML: `<fieldset>` + `<legend>` for groups, `<label>` for inputs
- `role="spinbutton"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` on inputs
- `aria-label` combines group + member name
- Arrow keys for increment/decrement, Shift+Arrow for 10x step
- Drag is progressive enhancement — full functionality via keyboard
- Live value changes announced via `aria-live="polite"`

### R6 — Touch Device Support

- Drag threshold: 3px for mouse, 10px for touch (detected via `e.pointerType`)
- HUD positioned above/beside touch point, not under thumb
- Minimum 44x44px tap area per input (WCAG 2.5.5)
- Touch drag always uses `base` handler (no modifier keys on touch)

### R7 — Lifecycle Cleanup

- All event listeners added in `onMount`, removed in `onDestroy`
- Pointer capture released in `onDestroy` if component unmounts mid-drag
- HUD portal element removed from `document.body` in `onDestroy`
- Builder's `destroy()` method clears internal state, subscriptions, and history

---

## 8. Project Structure

```
manifold-ui/
├── packages/
│   └── manifold-ui/                    the npm package
│       ├── src/lib/
│       │   ├── builders/               Layer 1
│       │   │   ├── manifold.svelte.ts      createManifold()
│       │   │   ├── group.svelte.ts         createGroup()
│       │   │   ├── input.svelte.ts         createInput()
│       │   │   └── types.ts                shared TypeScript types
│       │   ├── components/             Layer 2
│       │   │   ├── ManifoldPanel.svelte
│       │   │   ├── ManifoldGroup.svelte
│       │   │   ├── ManifoldInput.svelte
│       │   │   └── ManifoldHud.svelte      internal, portaled
│       │   ├── schema/                 Layer 3
│       │   │   └── Manifold.svelte         schema-driven wrapper
│       │   ├── styles/
│       │   │   └── default-theme.css       CSS custom property defaults
│       │   └── index.ts                    public exports
│       ├── package.json
│       └── svelte.config.js
├── sites/
│   └── docs/                           demo site (GitHub Pages / Vercel)
│       ├── src/routes/
│       │   ├── +page.svelte                landing page with live demos
│       │   ├── examples/
│       │   │   ├── transform/              Standard XYZ transform
│       │   │   ├── color-picker/           RGBA color control
│       │   │   ├── gradient/               Gradient builder
│       │   │   ├── flight-sim/             Space flight (6DOF + slingshot)
│       │   │   └── three-gizmo/            Three.js integration showcase
│       │   └── docs/
│       │       ├── getting-started/
│       │       ├── api/
│       │       └── theming/
│       └── package.json
├── pnpm-workspace.yaml
└── README.md
```

### npm Package Exports

```typescript
// Layer 1 — Builders
export { createManifold } from './builders/manifold.svelte'
export type { ManifoldConfig, ManifoldState, GroupConfig,
              DragHandler, DragConfig } from './builders/types'

// Layer 2 — Components
export { default as ManifoldPanel } from './components/ManifoldPanel.svelte'
export { default as ManifoldGroup } from './components/ManifoldGroup.svelte'
export { default as ManifoldInput } from './components/ManifoldInput.svelte'

// Layer 3 — Schema
export { default as Manifold } from './schema/Manifold.svelte'
```

### Tooling

- pnpm workspaces (monorepo)
- Vite for dev/build
- `svelte-package` for library compilation
- Vitest for unit tests
- Playwright for interaction tests (drag, pointer capture, HUD)
- SvelteKit for the docs site
