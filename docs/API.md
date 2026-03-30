# manifold-ui API Reference

## Table of Contents

- [Builder API](#builder-api)
  - [createManifold(config)](#createmanifoldconfig)
  - [ManifoldController](#manifoldcontroller)
- [Configuration Types](#configuration-types)
  - [ManifoldConfig](#manifoldconfig)
  - [ManifoldSchema](#manifoldschema)
  - [GroupConfig](#groupconfig)
  - [InputConfig](#inputconfig)
  - [DragConfig](#dragconfig)
  - [DragModifierConfig](#dragmodifierconfig)
  - [DragHandler](#draghandler)
- [Components](#components)
  - [Manifold](#manifold)
  - [ManifoldPanel](#manifoldpanel)
  - [ManifoldGroup](#manifoldgroup)
  - [ManifoldInput](#manifoldinput)
  - [ManifoldCompoundInput](#manifoldcompoundinput)
  - [ManifoldHud](#manifoldhud)
- [HUD Types](#hud-types)
- [Event Types](#event-types)
- [Color Utilities](#color-utilities)
- [CSS Custom Properties](#css-custom-properties)
- [All Exported Types](#all-exported-types)

---

## Builder API

### createManifold(config)

Creates a reactive manifold controller. This is the foundation that all components build on.

```ts
import { createManifold } from 'manifold-ui';

const controller = createManifold({
  groups: [
    {
      id: 'position',
      members: ['x', 'y', 'z'],
      initial: { x: 0, y: 5, z: 0 },
      config: { step: 0.1 },
      inputDrag: {
        base: { type: 'axis_2d', handler: myHandler }
      }
    }
  ],
  historySize: 100
});
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `config` | [`ManifoldConfig`](#manifoldconfig) | Configuration object defining groups, drag behavior, and initial state |

**Returns:** [`ManifoldController`](#manifoldcontroller)

### ManifoldController

The return type of `createManifold()`. Provides reactive state and imperative methods.

```ts
type ManifoldController = ReturnType<typeof createManifold>;
```

#### Reactive Properties

All properties are reactive via Svelte 5 runes and will trigger re-renders when accessed in components or effects.

| Property | Type | Description |
|---|---|---|
| `values` | `Record<string, Record<string, number>>` | Current values for all groups. Keyed by group ID, then member name. |
| `activeGroup` | `string` | ID of the currently active group. Defaults to the first group's ID. |
| `modifier` | `Modifier` | Current modifier key state: `'base'`, `'shift'`, `'ctrl'`, or `'shiftCtrl'`. |
| `dragState` | [`DragState`](#dragstate) | Internal drag tracking state. Used by components to render HUDs. |
| `config` | `ManifoldConfig` | The original config object passed to `createManifold()`. |
| `groups` | `GroupConfig[]` | The groups array from the config. |

#### Methods

| Method | Signature | Description |
|---|---|---|
| `set` | `(groupId: string, partial: Record<string, number>) => void` | Partially update values for a group. Only changed members trigger change events. |
| `reset` | `(groupId: string) => void` | Reset a group's values to their initial state. |
| `commit` | `() => void` | Push the current state to the undo history stack. |
| `undo` | `() => void` | Revert to the previous state in the history stack. |
| `redo` | `() => void` | Re-apply the next state in the history stack. |
| `setActiveGroup` | `(id: string) => void` | Set the active group by ID. Ignored if the ID is not found. |
| `setModifier` | `(mod: Modifier) => void` | Set the current modifier key state. |
| `getGroupConfig` | `(id: string) => GroupConfig \| undefined` | Look up a group's config by ID. |
| `destroy` | `() => void` | Clear all event handlers, history, and internal state. Call in `onDestroy`. |

#### Event Methods

All event methods return an unsubscribe function.

| Method | Signature | Description |
|---|---|---|
| `onChange` | `(handler: (e: ChangeEvent) => void) => () => void` | Called when any value changes. |
| `onDragStart` | `(handler: (e: DragStartEvent) => void) => () => void` | Called when a drag interaction begins. |
| `onDragEnd` | `(handler: (e: DragEndEvent) => void) => () => void` | Called when a drag interaction ends. `committed: false` means Escape was pressed. |

#### Internal Event Emitters

These are used by components to signal drag lifecycle events. Typically not called by consumers directly.

| Method | Signature | Description |
|---|---|---|
| `emitDragStart` | `(e: DragStartEvent) => void` | Emit a drag start event. |
| `emitDragEnd` | `(e: DragEndEvent) => void` | Emit a drag end event. |

#### Two-Way Binding

The builder can use an external reactive object instead of creating its own internal state:

```ts
let transform = $state({ position: { x: 0, y: 0, z: 0 } });

const controller = createManifold({
  values: transform,   // uses this object by reference
  groups: [{ id: 'position', members: ['x', 'y', 'z'] }]
});

// controller.values === transform
// Changes from either direction are reactive
```

When `values` is provided, the builder uses it directly. When omitted, the builder creates internal state from `initial` values (defaulting to `0` for unspecified members).

---

## Configuration Types

### ManifoldConfig

Top-level configuration for `createManifold()`.

```ts
interface ManifoldConfig {
  /** Group definitions */
  groups: GroupConfig[];
  /** External reactive values object. If provided, the builder uses it by reference. */
  values?: Record<string, Record<string, number>>;
  /** Panel-level drag configuration */
  drag?: DragConfig;
  /** Maximum undo history entries. Default: 50 */
  historySize?: number;
}
```

### ManifoldSchema

Extended config for the `<Manifold>` schema component. Adds a `title` field.

```ts
interface ManifoldSchema extends ManifoldConfig {
  /** Panel title displayed above the groups */
  title?: string;
}
```

### GroupConfig

Defines a single group of related numeric values.

```ts
interface GroupConfig {
  /** Unique identifier for this group */
  id: string;
  /** Member names (e.g., ['x', 'y', 'z'] or ['r', 'g', 'b', 'a']) */
  members: string[];
  /** Display labels for each member. Falls back to member names. */
  labels?: string[];
  /** Initial values. Members default to 0 if not specified. */
  initial?: Record<string, number>;
  /** Input constraints applied to all members in this group */
  config?: InputConfig;
  /** Drag config for individual input-level drags */
  inputDrag?: DragConfig;
  /** Drag config for group-level drags (dragging the group background/label) */
  drag?: DragConfig;
}
```

### InputConfig

Per-input constraints applied to all members of a group.

```ts
interface InputConfig {
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Step size for arrow key increment and display precision */
  step?: number;
}
```

### DragConfig

Maps modifier key states to drag behaviors. Each modifier state can have a different HUD type and handler function.

```ts
type DragConfig = Partial<Record<Modifier, DragModifierConfig>>;
```

Where `Modifier` is:

```ts
type Modifier = 'base' | 'shift' | 'ctrl' | 'shiftCtrl';
```

If a modifier is not defined, the `base` handler is used as a fallback. If no `base` handler is defined either, no drag occurs for that modifier state.

**Example:**

```ts
const drag: DragConfig = {
  base:  { type: 'axis_2d',   handler: positionHandler },
  shift: { type: 'slider_1d', handler: depthHandler },
  ctrl:  { type: 'dial',      handler: rotationHandler }
};
```

### DragModifierConfig

Configuration for a single modifier state's drag behavior.

```ts
interface DragModifierConfig {
  /** HUD visual type to display during drag */
  type: HudType;
  /** Handler function called on each pointer move */
  handler: DragHandler;
  /** Invert horizontal drag direction. Default: false */
  invertX?: boolean;
  /** Invert vertical drag direction. Default: false */
  invertY?: boolean;
  /** Horizontal sensitivity multiplier. Default: 1. Set to 0 to lock X axis. */
  sensitivityX?: number;
  /** Vertical sensitivity multiplier. Default: 1. Set to 0 to lock Y axis. */
  sensitivityY?: number;
}
```

### DragHandler

The function signature called during drag interactions.

```ts
type DragHandler = (
  dx: number,
  dy: number,
  current: Record<string, number>,
  start: Record<string, number>,
  member: string
) => void;
```

| Parameter | Description |
|---|---|
| `dx` | Horizontal pixels from drag origin (after sensitivity and inversion) |
| `dy` | Vertical pixels from drag origin (after sensitivity and inversion) |
| `current` | Mutable object with current group values. Mutate this to update the UI. |
| `start` | Snapshot of group values at drag start (read-only reference). Use for relative calculations. |
| `member` | The member name that was clicked (for input-level drags) or the first member (for group/panel-level drags) |

**Important:** The handler mutates `current` directly. The component reads the mutated values and applies them via `controller.set()`.

**Example handlers:**

```ts
// Simple slider: dy controls the clicked member
const slider: DragHandler = (dx, dy, current, start, member) => {
  current[member] = start[member] - dy * 0.5;
};

// XY plane: dx/dy map to first two members
const xy: DragHandler = (dx, dy, current, start) => {
  const keys = Object.keys(start);
  current[keys[0]] = start[keys[0]] + dx * 0.5;
  current[keys[1]] = start[keys[1]] - dy * 0.5;
};

// Uniform scale: all members change together
const uniform: DragHandler = (dx, dy, current, start) => {
  for (const key of Object.keys(start)) {
    current[key] = start[key] - dy * 0.01;
  }
};
```

---

## Components

### Manifold

Schema-driven convenience wrapper. Creates a controller internally and renders `ManifoldPanel > ManifoldGroup > ManifoldInput` from a config object.

```svelte
<Manifold
  schema={mySchema}
  bind:values
  onChange={handleChange}
  unstyled={false}
  class="my-panel"
/>
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `schema` | `ManifoldSchema` | *required* | Configuration defining groups, drag behavior, and title |
| `values` | `Record<string, Record<string, number>>` | `undefined` | Bindable. Syncs with the internal controller's values. |
| `onChange` | `(e: ChangeEvent) => void` | `undefined` | Called when any value changes |
| `unstyled` | `boolean` | `false` | Strip all default styles |
| `class` | `string` | `''` | Additional CSS class names |

**Behavior:**
- Creates a `ManifoldController` internally from the schema
- Renders one `ManifoldGroup` per group config, with `ManifoldInput` for each member
- Group labels use the group `id`; input labels use `labels[i]` or fall back to the member name
- Input `min`, `max`, and `step` are read from `group.config`
- Cleans up the controller on destroy

### ManifoldPanel

Container component that provides the controller to descendants via Svelte context. Handles modifier key detection, panel-level drag, and HUD rendering.

```svelte
<ManifoldPanel controller={myController} title="Transform" unstyled={false} class="my-panel">
  <!-- ManifoldGroup children here -->
</ManifoldPanel>
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `controller` | `ManifoldController` | *required* | The controller instance from `createManifold()` |
| `title` | `string` | `undefined` | Panel title displayed at the top |
| `unstyled` | `boolean` | `false` | Strip all default styles |
| `class` | `string` | `''` | Additional CSS class names |
| `children` | `Snippet` | *required* | Svelte 5 snippet children |

**Context provided:** Sets `'manifold-controller'` context for all descendants.

**Keyboard handling:**
- Detects Shift, Ctrl, and Shift+Ctrl modifier key states
- Resets modifier to `'base'` when focus leaves the panel
- Handles Ctrl+Z / Cmd+Z for undo and Ctrl+Shift+Z / Cmd+Shift+Z for redo

**Panel-level drag:** If `controller.config.drag` is defined, dragging the panel background (not on a group or input) triggers a panel-tier drag.

**Accessibility:**
- Renders as a `<section>` with `aria-label`
- Includes a visually hidden `aria-live="polite"` region that announces drag state changes
- Renders a `<ManifoldHud>` internally (one per panel)

### ManifoldGroup

Groups related inputs. Renders as a `<fieldset>` with an optional `<legend>`.

```svelte
<ManifoldGroup id="position" label="Position" class="my-group">
  <ManifoldInput member="x" />
  <ManifoldInput member="y" />
  <ManifoldInput member="z" />
</ManifoldGroup>
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | *required* | Must match a group ID from the controller's config |
| `label` | `string` | `undefined` | Rendered as the `<legend>` text |
| `class` | `string` | `''` | Additional CSS class names |
| `children` | `Snippet` | *required* | Svelte 5 snippet children |

**Context:** Reads `'manifold-controller'` from parent. Sets `'manifold-group-id'` for child inputs.

**Active state:** The group activates (highlighted border) when any input inside it receives focus. Managed via `controller.setActiveGroup()`.

**Group-level drag:** If the group's config has a `drag` property, dragging the fieldset background (not on an input) triggers a group-tier drag.

**Layout:** Child inputs are laid out in a CSS Grid with `auto-fit` columns (minimum 72px each).

### ManifoldInput

A single numeric input. Supports click-to-type, drag-to-scrub, and arrow key adjustment.

```svelte
<ManifoldInput
  member="x"
  label="X"
  min={-100}
  max={100}
  step={0.1}
  class="my-input"
/>
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `member` | `string` | *required* | Member name within the group |
| `label` | `string` | member name | Display label above the input |
| `min` | `number` | from group config | Minimum value. Overrides group-level `config.min`. |
| `max` | `number` | from group config | Maximum value. Overrides group-level `config.max`. |
| `step` | `number` | `1` | Step size. Falls back to group-level `config.step`, then `1`. |
| `class` | `string` | `''` | Additional CSS class names |

**Context:** Reads `'manifold-controller'` and `'manifold-group-id'` from ancestors.

**Interaction modes:**

1. **Display mode** (default): Shows the formatted value. Cursor is `ns-resize`. Drag to scrub values. Click without moving to enter edit mode.
2. **Edit mode**: Shows a text input. Type a value and press Enter to confirm, Escape to cancel, or click away (blur) to confirm.

**Drag behavior:**
- Looks up drag config from the group's `inputDrag` property
- During drag, reads modifier keys from pointer events (since keyboard events don't fire during pointer capture)
- Applies `sensitivityX`/`sensitivityY` and `invertX`/`invertY` from the drag config
- Creates a working copy of group values, passes it to the handler, then applies via `controller.set()`
- Escape during drag reverts to the snapshot taken at drag start

**Keyboard:**
- Arrow Up/Down: increment/decrement by step
- Shift + Arrow: increment/decrement by step * 10
- Enter: confirm edit
- Escape: cancel edit or cancel drag

**Accessibility:**
- `role="spinbutton"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- `aria-label` set to the display label
- Semantic `<label>` element linked by `id`

### ManifoldCompoundInput

A single input field that displays and edits multiple values using a format pattern.

```svelte
<ManifoldCompoundInput
  members={['r', 'g', 'b', 'a']}
  pattern="rgba({r}, {g}, {b}, {a})"
  label="Color"
  class="my-compound"
/>
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `members` | `string[]` | *required* | Member names this compound input represents, in order |
| `pattern` | `string` | `'{m1}, {m2}, ...'` | Format pattern with `{memberName}` placeholders |
| `label` | `string` | `undefined` | Display label above the input |
| `class` | `string` | `''` | Additional CSS class names |

**Context:** Reads `'manifold-controller'` and `'manifold-group-id'` from ancestors.

**Display:** Renders the pattern with `{memberName}` placeholders replaced by formatted values. For example, `rgba({r}, {g}, {b}, {a})` becomes `rgba(157, 78, 221, 1)`.

**Parsing:** When the user edits the text, the input first tries to match the pattern structure using a generated regex. If that fails, it falls back to extracting all numeric values from the text in order.

**Drag behavior:** Uses the group's `drag` config, falling back to `inputDrag`. The first member in the `members` array is passed as the `member` argument to the drag handler.

### ManifoldHud

Internal component rendered inside `ManifoldPanel`. Not exported for direct use.

- Portals a `<div>` to `document.body` on mount, removes it on destroy
- Positioned at the drag origin using the `startX`/`startY` from `dragState`
- Renders SVG or HTML visuals based on `dragState.hudType`
- `pointer-events: none` and `aria-hidden="true"`
- Updates reactively when `dragState`, `modifier`, or values change

---

## HUD Types

```ts
type HudType = 'slider_1d' | 'axis_2d' | 'axis_3d' | 'axis_3d_tilt' | 'dial' | 'color_wheel';
```

### slider_1d

A vertical bar with a sliding thumb.

- **Visual:** Rounded vertical track with a horizontal thumb that moves up/down
- **Best for:** Single-axis values, scale, opacity
- **Thumb position:** Mapped from `dy` (dragging up moves the thumb up)
- **Size:** 80x80px

### axis_2d

A crosshair circle with a moving dot.

- **Visual:** Circle with dashed crosshair lines, dot tracks pointer position clamped to the circle
- **Best for:** XY position, 2D offsets
- **Dot position:** Mapped from both `dx` and `dy`, scaled and clamped to circle radius
- **Size:** 80x80px

### axis_3d

An XY crosshair that switches to a 3D cylinder for Z-axis editing.

- **Visual (base):** Same as `axis_2d` -- crosshair circle with tracking dot, wrapped in a perspective-transformed container
- **Visual (Shift held):** Switches to a translucent 3D cylinder with a shaded ball that moves along the vertical Z-axis
- **Best for:** 3D position editing with XY (base) and Z (Shift) modes
- **Size:** 80x80px (base), 80x120px (Z mode -- taller to accommodate the cylinder)
- **Modifier behavior:** Holding Shift or Shift+Ctrl switches to Z-mode with the cylinder visual

### axis_3d_tilt

An XY crosshair that tilts back with CSS perspective when Shift is held.

- **Visual (base):** Same as `axis_2d`
- **Visual (Shift held):** The entire crosshair circle tilts back 55 degrees via CSS `perspective(200px) rotateX(55deg)`, with the dot constrained to vertical movement and a "Z" label
- **Best for:** 3D position editing with a visual depth cue
- **Size:** 80x80px
- **Modifier behavior:** Holding Shift or Shift+Ctrl activates the tilted Z-mode

### dial

A dashed circle with a rotating pointer.

- **Visual:** Dashed circle outline with a line from center pointing toward the cursor angle, plus a center dot
- **Best for:** Rotation angles
- **Pointer angle:** Calculated from `dx`/`dy` using `atan2(dx, -dy)` (clockwise from top)
- **Size:** 80x80px
- **Colors:** Uses `--manifold-hud-accent-alt` (default: purple) for the pointer

### color_wheel

A multi-mode color picker with three modifier states.

- **Visual (base):** HSL color wheel (conic gradient) with a white-to-transparent radial overlay for saturation. Crosshair dot tracks position on the wheel. If the group has an `a` (alpha) member, the wheel opacity reflects the current alpha value with a checkerboard pattern underneath.
- **Visual (Ctrl held):** Saturation/brightness square. A rectangular gradient showing the current hue with saturation on X and brightness on Y. Crosshair dot tracks position.
- **Visual (Shift held):** Alpha slider. Dimmed color wheel with a vertical alpha slider bar on the right side, showing a checkerboard-backed gradient. Thumb position and percentage label update with drag.
- **Best for:** RGBA color picking with full control
- **Size:** 160x160px (larger than other HUDs)
- **Coordinate convention:** Uses clockwise-from-top angle convention matching CSS `conic-gradient`

---

## Event Types

### ChangeEvent

Emitted via `onChange` when a value changes.

```ts
interface ChangeEvent {
  /** Group containing the changed value */
  groupId: string;
  /** Member that changed */
  member: string;
  /** Previous value */
  oldValue: number;
  /** New value */
  newValue: number;
}
```

### DragStartEvent

Emitted via `onDragStart` when a drag interaction begins.

```ts
interface DragStartEvent {
  /** Group being dragged */
  groupId: string;
  /** Which surface was dragged */
  tier: 'input' | 'group' | 'panel';
  /** Member that was clicked (only for input-tier drags) */
  member?: string;
}
```

### DragEndEvent

Emitted via `onDragEnd` when a drag interaction ends.

```ts
interface DragEndEvent {
  /** Group that was dragged */
  groupId: string;
  /** Which surface was dragged */
  tier: 'input' | 'group' | 'panel';
  /** true if values were committed, false if Escape was pressed */
  committed: boolean;
}
```

### DragState

Internal drag tracking state. Exposed as `controller.dragState`. Used by `ManifoldHud` for rendering.

```ts
interface DragState {
  /** Whether a drag is currently active */
  active: boolean;
  /** Which surface initiated the drag */
  tier: 'input' | 'group' | 'panel';
  /** Group ID being dragged */
  groupId: string;
  /** Member clicked (null for group/panel drags) */
  member: string | null;
  /** Pointer X at drag start (viewport pixels) */
  startX: number;
  /** Pointer Y at drag start (viewport pixels) */
  startY: number;
  /** Bounding rect of the drag origin element */
  originRect: DOMRect | null;
  /** Snapshot of group values at drag start (for Escape revert) */
  snapshot: Record<string, number> | null;
  /** Current HUD type to render */
  hudType: HudType | null;
  /** Input device type */
  pointerType: 'mouse' | 'touch' | 'pen';
  /** Current drag delta X from origin (after sensitivity/inversion) */
  dragDx: number;
  /** Current drag delta Y from origin (after sensitivity/inversion) */
  dragDy: number;
}
```

---

## Color Utilities

All values use standard ranges: RGB 0-255, H 0-360, S/L 0-100, A 0-1, CMYK 0-100.

### Types

```ts
interface RGB  { r: number; g: number; b: number; }
interface RGBA extends RGB { a: number; }
interface HSL  { h: number; s: number; l: number; }
interface HSLA extends HSL { a: number; }
interface CMYK { c: number; m: number; y: number; k: number; }
```

### Conversion Functions

#### RGB / HSL

```ts
function rgbToHsl(r: number, g: number, b: number): HSL
function hslToRgb(h: number, s: number, l: number): RGB
```

#### RGB / Hex

```ts
function rgbToHex(r: number, g: number, b: number): string
// Returns '#rrggbb'

function rgbaToHex(r: number, g: number, b: number, a: number): string
// Returns '#rrggbb' if a >= 1, '#rrggbbaa' otherwise

function hexToRgb(hex: string): RGB | null
// Accepts '#rgb', '#rrggbb', or without '#'. Returns null on invalid input.

function hexToRgba(hex: string): RGBA | null
// Accepts '#rrggbbaa'. Returns a=1 for 6-digit hex.
```

#### RGB / CMYK

```ts
function rgbToCmyk(r: number, g: number, b: number): CMYK
function cmykToRgb(c: number, m: number, y: number, k: number): RGB
```

### Angle / Position Helpers

For use with the color wheel HUD. Both functions use a clockwise-from-top angle convention matching CSS `conic-gradient`.

```ts
function xyToHueSat(dx: number, dy: number, radius: number): { h: number; s: number }
// Convert XY offset from center to hue (0-360) and saturation (0-100)

function hueSatToXy(h: number, s: number, radius: number): { x: number; y: number }
// Convert hue and saturation back to XY offset from center
```

---

## CSS Custom Properties

All custom properties are defined on `:root` in the default theme and can be overridden on any ancestor element.

### Panel

| Property | Default | Description |
|---|---|---|
| `--manifold-bg` | `#13111c` | Panel background color |
| `--manifold-bg-active` | `#1a1525` | Active group background |
| `--manifold-border` | `#2d2640` | Panel and group border color |
| `--manifold-border-active` | `#3b2f56` | Active group border color |
| `--manifold-accent` | `#9d4edd` | Accent color (focus rings) |
| `--manifold-accent-hover` | `#b56eee` | Accent hover state |
| `--manifold-text` | `#e2e8f0` | Primary text color |
| `--manifold-text-dim` | `#94a3b8` | Dimmed text (titles, group legends) |
| `--manifold-text-label` | `#cbd5e1` | Input label color |
| `--manifold-radius` | `6px` | Border radius for inputs and groups |
| `--manifold-radius-panel` | `12px` | Border radius for the panel |
| `--manifold-font-mono` | `'JetBrains Mono', 'Fira Code', 'SF Mono', ui-monospace, monospace` | Monospace font for value display |
| `--manifold-font-label` | `system-ui, -apple-system, sans-serif` | Font for labels and titles |

### Inputs

| Property | Default | Description |
|---|---|---|
| `--manifold-input-bg` | `#1a1525` | Input background color |
| `--manifold-input-bg-focus` | `#211a30` | Input background when focused |
| `--manifold-input-border` | `#3b2f56` | Input border color |
| `--manifold-input-border-focus` | `#9d4edd` | Input border color when focused |

### HUD

| Property | Default | Description |
|---|---|---|
| `--manifold-hud-bg` | `rgba(19, 17, 28, 0.85)` | HUD background (not currently used by SVG HUDs) |
| `--manifold-hud-border` | `#2d2640` | HUD border and crosshair lines |
| `--manifold-hud-accent` | `#06b6d4` | Primary HUD accent (dot, thumb, cylinder) |
| `--manifold-hud-accent-alt` | `#c084fc` | Secondary HUD accent (dial pointer) |
| `--manifold-hud-backdrop-blur` | `12px` | Backdrop blur radius (reserved for future use) |

---

## All Exported Types

The following types are exported from `manifold-ui`:

```ts
// Builder
export { createManifold, type ManifoldController } from './builders/manifold.svelte';

// Components
export { default as Manifold } from './components/Manifold.svelte';
export { default as ManifoldPanel } from './components/ManifoldPanel.svelte';
export { default as ManifoldGroup } from './components/ManifoldGroup.svelte';
export { default as ManifoldInput } from './components/ManifoldInput.svelte';
export { default as ManifoldCompoundInput } from './components/ManifoldCompoundInput.svelte';

// Color utilities
export { rgbToHsl, hslToRgb } from './builders/color';
export { rgbToHex, rgbaToHex, hexToRgb, hexToRgba } from './builders/color';
export { rgbToCmyk, cmykToRgb } from './builders/color';
export { xyToHueSat, hueSatToXy } from './builders/color';
export type { RGB, RGBA, HSL, HSLA, CMYK } from './builders/color';

// Types
export type {
  ManifoldConfig,
  ManifoldSchema,
  GroupConfig,
  InputConfig,
  DragConfig,
  DragModifierConfig,
  DragHandler,
  DragState,
  HudType,
  Modifier,
  ChangeEvent,
  DragStartEvent,
  DragEndEvent
} from './builders/types';
```
