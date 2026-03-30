# manifold-ui

**Grouped numeric control surfaces for Svelte**

[![npm](https://img.shields.io/npm/v/manifold-ui)](https://www.npmjs.com/package/manifold-ui)
[![license](https://img.shields.io/npm/l/manifold-ui)](https://github.com/michaelblum/manifold-ui/blob/main/LICENSE)
[![svelte](https://img.shields.io/badge/svelte-5-ff3e00)](https://svelte.dev)

---

## What is this?

manifold-ui is a Svelte 5 component library for manipulating groups of related numeric values through drag-to-edit inputs, contextual HUD overlays, and modifier-key rerouting. It handles XYZ positions, RGBA colors, rotation angles, or any N-dimensional numeric tuple -- with zero runtime dependencies beyond Svelte itself.

## Features

- **Drag-to-edit inputs** -- click to type, drag to scrub, with configurable sensitivity and axis inversion
- **Contextual HUD overlays** -- 6 built-in HUD types (slider, 2D/3D axis, dial, color wheel) portaled to the viewport
- **Modifier-key rerouting** -- swap handler and HUD mid-drag by holding Shift, Ctrl, or both
- **Three API layers** -- schema-driven, component composition, or raw builder for full control
- **N-ary groups** -- not limited to triplets; supports 2, 3, 4, or more members per group
- **Compound inputs** -- display multiple values in a single field with format patterns (`rgba({r}, {g}, {b}, {a})`)
- **Undo/redo** -- built-in history stack with configurable depth
- **Escape to cancel** -- reverts to snapshot taken at drag start
- **Accessible** -- `fieldset`/`legend` structure, `aria-live` announcements, full keyboard control
- **Touch-aware** -- separate drag thresholds for mouse (3px) and touch (10px)
- **Themeable** -- dark default theme, fully overridable via CSS custom properties
- **Zero runtime dependencies** -- only requires Svelte 5 as a peer dependency

## Install

```bash
npm install manifold-ui
```

Requires Svelte 5 (`^5.0.0`) as a peer dependency.

## Quick Start

### Schema API (simplest)

Pass a config object. The `<Manifold>` component creates a controller internally and renders everything for you.

```svelte
<script lang="ts">
  import { Manifold } from 'manifold-ui';
  import type { ManifoldSchema, DragHandler } from 'manifold-ui';

  const handler: DragHandler = (dx, dy, current, start, member) => {
    current[member] = start[member] + dx * 0.5;
  };

  const schema: ManifoldSchema = {
    title: 'Transform',
    groups: [
      {
        id: 'position',
        members: ['x', 'y', 'z'],
        initial: { x: 0, y: 0, z: 0 },
        config: { step: 0.1 },
        inputDrag: {
          base: { type: 'slider_1d', handler }
        }
      }
    ]
  };

  let values = $state<Record<string, Record<string, number>>>();
</script>

<Manifold {schema} bind:values />
```

### Component API (compose your layout)

Use `ManifoldPanel`, `ManifoldGroup`, and `ManifoldInput` for custom layouts. Create a controller with `createManifold` and pass it to the panel.

```svelte
<script lang="ts">
  import {
    createManifold,
    ManifoldPanel,
    ManifoldGroup,
    ManifoldInput
  } from 'manifold-ui';

  const controller = createManifold({
    groups: [
      {
        id: 'color',
        members: ['r', 'g', 'b'],
        initial: { r: 128, g: 128, b: 128 },
        config: { min: 0, max: 255, step: 1 },
        inputDrag: {
          base: {
            type: 'slider_1d',
            handler: (dx, dy, current, start, member) => {
              current[member] = start[member] - dy * 0.5;
            }
          }
        }
      }
    ]
  });
</script>

<ManifoldPanel {controller} title="Color">
  <ManifoldGroup id="color" label="RGB">
    <ManifoldInput member="r" label="R" />
    <ManifoldInput member="g" label="G" />
    <ManifoldInput member="b" label="B" />
  </ManifoldGroup>
</ManifoldPanel>
```

### Builder API (power users)

The builder is a reactive state machine. No DOM, no components -- just state and methods.

```ts
import { createManifold } from 'manifold-ui';

const manifold = createManifold({
  groups: [
    { id: 'position', members: ['x', 'y', 'z'], initial: { x: 0, y: 5, z: 0 } }
  ]
});

// Reactive state (Svelte 5 runes internally)
manifold.values;        // { position: { x: 0, y: 5, z: 0 } }
manifold.activeGroup;   // 'position'
manifold.modifier;      // 'base'

// Imperative updates
manifold.set('position', { x: 10, y: 20 });   // partial update
manifold.reset('position');                     // reset to initial values
manifold.undo();                                // revert last commit
manifold.redo();

// Events
const unsub = manifold.onChange(({ groupId, member, oldValue, newValue }) => {
  console.log(`${groupId}.${member}: ${oldValue} -> ${newValue}`);
});
unsub(); // unsubscribe
```

## HUD Types

Six visual HUD overlays appear at the drag origin during interaction:

| Type | Visual | Best For |
|---|---|---|
| `slider_1d` | Vertical bar with sliding thumb | Single-axis values, scale, opacity |
| `axis_2d` | Crosshair circle with moving dot | XY position, 2D offsets |
| `axis_3d` | XY crosshair + Z cylinder (on Shift) | 3D position with Z-axis toggle |
| `axis_3d_tilt` | XY crosshair with CSS perspective tilt | 3D position with visual depth |
| `dial` | Dashed circle with rotating pointer | Rotation angles |
| `color_wheel` | HSL wheel, SV square (Ctrl), alpha slider (Shift) | Color picking with mode switching |

## Compound Inputs

Display multiple values in a single field using format patterns:

```svelte
<ManifoldCompoundInput
  members={['r', 'g', 'b', 'a']}
  pattern="rgba({r}, {g}, {b}, {a})"
  label="Color"
/>
```

Click to edit the full expression. The input parses numbers from typed text using the pattern structure, with a fallback to extracting all numeric values in order.

## Color Utilities

Built-in color conversion functions for use with the color wheel HUD:

```ts
import { rgbToHsl, hslToRgb, rgbToHex, hexToRgb, rgbToCmyk, cmykToRgb } from 'manifold-ui';
import { xyToHueSat, hueSatToXy } from 'manifold-ui';

const hsl = rgbToHsl(157, 78, 221);     // { h: 268, s: 70, l: 59 }
const rgb = hslToRgb(268, 70, 59);      // { r: 157, g: 78, b: 221 }
const hex = rgbToHex(157, 78, 221);     // '#9d4edd'
```

## Theming

Override CSS custom properties on a parent container:

```css
.my-app {
  /* Panel */
  --manifold-bg: #1a1a2e;
  --manifold-border: #2d2d44;
  --manifold-accent: #10b981;
  --manifold-text: #f8fafc;
  --manifold-text-dim: #94a3b8;
  --manifold-text-label: #cbd5e1;
  --manifold-radius: 6px;
  --manifold-radius-panel: 12px;

  /* Inputs */
  --manifold-input-bg: #1a1525;
  --manifold-input-bg-focus: #211a30;
  --manifold-input-border: #3b2f56;
  --manifold-input-border-focus: #9d4edd;

  /* HUD */
  --manifold-hud-accent: #06b6d4;
  --manifold-hud-accent-alt: #c084fc;
}
```

Strip all default styles with the `unstyled` prop:

```svelte
<Manifold schema={schema} unstyled />
```

All components accept a `class` prop for additional class names.

## API Reference

See [docs/API.md](docs/API.md) for the full API reference, including all types, component props, HUD behavior details, and CSS custom properties.

## Contributing

1. Clone the repo and install dependencies: `pnpm install`
2. Start the dev server: `pnpm dev`
3. Run tests: `pnpm test`
4. Type-check: `pnpm check`

The dev sandbox at `localhost:5173` has interactive demos of all features.

## License

[MIT](LICENSE) -- Michael Blum
