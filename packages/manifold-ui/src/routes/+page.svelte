<script lang="ts">
  import Manifold from '$lib/components/Manifold.svelte';
  import ManifoldPanel from '$lib/components/ManifoldPanel.svelte';
  import ManifoldGroup from '$lib/components/ManifoldGroup.svelte';
  import ManifoldInput from '$lib/components/ManifoldInput.svelte';
  import { createManifold } from '$lib/builders/manifold.svelte';
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
          base: { type: 'axis_2d', handler: axis2dHandler }
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
  // Demo 2: Compositional API — RGBA color
  // ===========================================

  const colorSliderHandler: DragHandler = (dx, dy, current, start, member) => {
    current[member] = Math.max(0, Math.min(255, start[member] - dy * 0.5));
  };

  const alphaSliderHandler: DragHandler = (dx, dy, current, start, member) => {
    current[member] = Math.max(0, Math.min(1, start[member] - dy * 0.005));
  };

  const colorController = createManifold({
    groups: [
      {
        id: 'color',
        members: ['r', 'g', 'b'],
        initial: { r: 157, g: 78, b: 221 },
        config: { min: 0, max: 255, step: 1 },
        inputDrag: {
          base: { type: 'slider_1d', handler: colorSliderHandler }
        }
      },
      {
        id: 'alpha',
        members: ['a'],
        labels: ['alpha'],
        initial: { a: 1 },
        config: { min: 0, max: 1, step: 0.01 },
        inputDrag: {
          base: { type: 'slider_1d', handler: alphaSliderHandler }
        }
      }
    ]
  });

  let colorPreview = $derived(
    `rgba(${Math.round(colorController.values.color?.r ?? 0)}, ${Math.round(colorController.values.color?.g ?? 0)}, ${Math.round(colorController.values.color?.b ?? 0)}, ${colorController.values.alpha?.a ?? 1})`
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

    <!-- Demo 2: Compositional API -->
    <section class="demo-section">
      <h2 class="demo-heading">Compositional API</h2>
      <p class="demo-desc">
        An RGBA color picker using ManifoldPanel + ManifoldGroup + ManifoldInput.
      </p>

      <ManifoldPanel controller={colorController} title="Color">
        <ManifoldGroup id="color" label="RGB">
          <ManifoldInput member="r" label="R" />
          <ManifoldInput member="g" label="G" />
          <ManifoldInput member="b" label="B" />
        </ManifoldGroup>
        <ManifoldGroup id="alpha" label="Opacity">
          <ManifoldInput member="a" label="A" />
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
