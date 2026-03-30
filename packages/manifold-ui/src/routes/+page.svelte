<script lang="ts">
  import Manifold from '$lib/components/Manifold.svelte';
  import ManifoldPanel from '$lib/components/ManifoldPanel.svelte';
  import ManifoldGroup from '$lib/components/ManifoldGroup.svelte';
  import ManifoldCompoundInput from '$lib/components/ManifoldCompoundInput.svelte';
  import { createManifold } from '$lib/builders/manifold.svelte';
  import { hslToRgb, rgbToHsl } from '$lib/builders/color';
  import type { ManifoldSchema, DragHandler } from '$lib/builders/types';

  // ===========================================
  // Demo 1: Schema API — Transform controls
  // ===========================================

  const axis2dHandler: DragHandler = (dx, dy, current, start, member) => {
    // Map x/y axes based on member name
    const members = Object.keys(start);
    const xKey = members[0];
    const yKey = members[1];
    if (xKey) current[xKey] = start[xKey] + dx * 0.5;
    if (yKey) current[yKey] = start[yKey] - dy * 0.5;
  };

  const dialHandler: DragHandler = (dx, dy, current, start, member) => {
    // Angular drag — dx rotates
    for (const key of Object.keys(start)) {
      if (key === member) {
        current[key] = start[key] + dx * 0.5;
      }
    }
  };

  const sliderHandler: DragHandler = (dx, dy, current, start, member) => {
    // Vertical slider — negative dy = increase
    current[member] = start[member] - dy * 0.01;
  };

  const transformSchema: ManifoldSchema = {
    title: 'Transform',
    groups: [
      {
        id: 'position',
        members: ['x', 'y', 'z'],
        initial: { x: 0, y: 0, z: 0 },
        config: { step: 0.1 },
        inputDrag: {
          base: { type: 'axis_3d', handler: axis2dHandler },
          shift: {
            type: 'axis_3d',
            handler: (dx, dy, current, start) => {
              current.z = start.z - dy * 0.5;
            }
          }
        }
      },
      {
        id: 'rotation',
        members: ['x', 'y', 'z'],
        labels: ['pitch', 'yaw', 'roll'],
        initial: { x: 0, y: 0, z: 0 },
        config: { step: 1, min: -360, max: 360 },
        inputDrag: {
          base: { type: 'dial', handler: dialHandler }
        }
      },
      {
        id: 'scale',
        members: ['x', 'y', 'z'],
        initial: { x: 1, y: 1, z: 1 },
        config: { step: 0.01, min: 0.01 },
        inputDrag: {
          base: { type: 'slider_1d', handler: sliderHandler }
        }
      }
    ]
  };

  let transformValues = $state<Record<string, Record<string, number>> | undefined>();

  // ===========================================
  // Demo 2: Color Wheel HUD
  // ===========================================

  const colorWheelHandler: DragHandler = (dx, dy, current, start) => {
    // Map drag position to hue (angle) and saturation (distance)
    // atan2(dx, -dy) gives clockwise-from-top, matching CSS conic-gradient
    const radius = 72; // matches WHEEL_RADIUS
    const angle = Math.atan2(dx, -dy);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hue = ((angle * 180 / Math.PI) + 360) % 360;
    const sat = Math.min(100, (dist / radius) * 100);
    const rgb = hslToRgb(hue, sat, 50);
    current.r = rgb.r;
    current.g = rgb.g;
    current.b = rgb.b;
  };

  const colorWheelRefineHandler: DragHandler = (dx, dy, current, start) => {
    // Ctrl: refine mode — dx = saturation, dy = lightness
    const hsl = rgbToHsl(start.r, start.g, start.b);
    const sat = Math.max(0, Math.min(100, 50 + dx * 0.5));
    const light = Math.max(0, Math.min(100, 50 - dy * 0.5));
    const rgb = hslToRgb(hsl.h, sat, light);
    current.r = rgb.r;
    current.g = rgb.g;
    current.b = rgb.b;
  };

  const colorWheelAlphaHandler: DragHandler = (dx, dy, current, start) => {
    // Shift: alpha mode — dy controls opacity
    // 80px of drag = full 0-1 range
    current.a = Math.max(0, Math.min(1, (start.a ?? 1) - dy / 80));
  };

  const wheelController = createManifold({
    groups: [
      {
        id: 'color',
        members: ['r', 'g', 'b', 'a'],
        initial: { r: 157, g: 78, b: 221, a: 1 },
        config: { min: 0, max: 255, step: 1 },
        inputDrag: {
          base: { type: 'color_wheel', handler: colorWheelHandler },
          ctrl: { type: 'color_wheel', handler: colorWheelRefineHandler },
          shift: { type: 'color_wheel', handler: colorWheelAlphaHandler }
        }
      }
    ]
  });

  let wheelPreview = $derived(
    `rgba(${Math.round(wheelController.values.color?.r ?? 0)}, ${Math.round(wheelController.values.color?.g ?? 0)}, ${Math.round(wheelController.values.color?.b ?? 0)}, ${wheelController.values.color?.a ?? 1})`
  );

  let colorPreview = $derived(
    `rgba(${Math.round(wheelController.values.color?.r ?? 0)}, ${Math.round(wheelController.values.color?.g ?? 0)}, ${Math.round(wheelController.values.color?.b ?? 0)}, ${wheelController.values.color?.a ?? 1})`
  );
</script>

<div class="sandbox">
  <h1 class="sandbox-title">manifold-ui dev sandbox</h1>

  <div class="demos">
    <!-- Demo 1: Schema API -->
    <section class="demo-section">
      <h2 class="demo-heading">Schema API</h2>
      <p class="demo-desc">
        A transform controller using the &lt;Manifold&gt; schema wrapper.
        Drag inputs to edit. Arrow keys increment. Click to type.
      </p>

      <Manifold schema={transformSchema} bind:values={transformValues} />

      {#if transformValues}
        <pre class="json-display">{JSON.stringify(transformValues, null, 2)}</pre>
      {/if}
    </section>

    <!-- Demo 2: Color Wheel HUD -->
    <section class="demo-section">
      <h2 class="demo-heading">Color Wheel HUD</h2>
      <p class="demo-desc">
        Drag to pick hue + saturation on the wheel.
        Hold <kbd>Ctrl/Cmd</kbd> to refine (saturation/brightness square).
        Hold <kbd>Shift</kbd> for alpha slider.
      </p>

      <ManifoldPanel controller={wheelController} title="Color Wheel">
        <ManifoldGroup id="color" label="RGBA">
          <ManifoldCompoundInput
            members={['r', 'g', 'b', 'a']}
            pattern={'rgba({r}, {g}, {b}, {a})'}
            label="Color"
          />
        </ManifoldGroup>
      </ManifoldPanel>

      <div class="color-preview-row">
        <div
          class="color-swatch"
          style="background: {wheelPreview};"
        ></div>
        <code class="color-value">{wheelPreview}</code>
      </div>
    </section>

    <!-- Demo 4: Compound Input -->
    <section class="demo-section">
      <h2 class="demo-heading">Compound Input</h2>
      <p class="demo-desc">
        A single input showing multiple values with a format pattern.
        Drag to adjust all values. Click to type.
      </p>

      <ManifoldPanel controller={wheelController} title="Color (Compound)">
        <ManifoldGroup id="color" label="RGBA">
          <ManifoldCompoundInput
            members={['r', 'g', 'b', 'a']}
            pattern={'rgba({r}, {g}, {b}, {a})'}
            label="Color"
          />
        </ManifoldGroup>
      </ManifoldPanel>

      <div class="color-preview-row">
        <div
          class="color-swatch"
          style="background: {colorPreview};"
        ></div>
        <code class="color-value">{colorPreview}</code>
      </div>
    </section>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #0a0910;
    color: #e2e8f0;
    font-family: system-ui, -apple-system, sans-serif;
    min-height: 100vh;
  }

  .sandbox {
    max-width: 720px;
    margin: 0 auto;
    padding: 40px 24px;
  }

  .sandbox-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #c084fc;
    margin: 0 0 32px 0;
    letter-spacing: -0.02em;
  }

  .demos {
    display: flex;
    flex-direction: column;
    gap: 48px;
  }

  .demo-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .demo-heading {
    font-size: 1rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0;
  }

  .demo-desc {
    font-size: 0.85rem;
    color: #64748b;
    margin: 0;
    line-height: 1.5;
  }

  .json-display {
    background: #13111c;
    border: 1px solid #2d2640;
    border-radius: 8px;
    padding: 12px 16px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.75rem;
    color: #06b6d4;
    overflow-x: auto;
    margin: 0;
  }

  .color-preview-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
  }

  .color-swatch {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    border: 1px solid #2d2640;
    flex-shrink: 0;
    /* Checkered background for alpha visibility */
    background-image:
      linear-gradient(45deg, #1a1525 25%, transparent 25%),
      linear-gradient(-45deg, #1a1525 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #1a1525 75%),
      linear-gradient(-45deg, transparent 75%, #1a1525 75%);
    background-size: 12px 12px;
    background-position: 0 0, 0 6px, 6px -6px, -6px 0px;
  }

  .color-value {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.8rem;
    color: #94a3b8;
  }
</style>
