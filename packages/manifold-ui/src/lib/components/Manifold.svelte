<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createManifold } from '../builders/manifold.svelte';
  import type { ManifoldSchema, ChangeEvent } from '../builders/types';
  import ManifoldPanel from './ManifoldPanel.svelte';
  import ManifoldGroup from './ManifoldGroup.svelte';
  import ManifoldInput from './ManifoldInput.svelte';

  interface Props {
    schema: ManifoldSchema;
    values?: Record<string, Record<string, number>>;
    unstyled?: boolean;
    class?: string;
    onChange?: (e: ChangeEvent) => void;
  }

  let {
    schema,
    values = $bindable(),
    unstyled = false,
    class: className = '',
    onChange
  }: Props = $props();

  /* eslint-disable svelte/state-referenced-locally --
     schema and onChange are init-time configuration, intentionally captured once */

  const controller = createManifold({
    groups: schema.groups,
    drag: schema.drag,
    historySize: schema.historySize,
    values
  });

  // Sync external bindable values with controller values
  $effect(() => {
    values = controller.values;
  });

  // Wire up change handler
  const unsubChange = onChange ? controller.onChange(onChange) : undefined;

  onDestroy(() => {
    unsubChange?.();
    controller.destroy();
  });
</script>

<ManifoldPanel {controller} title={schema.title} {unstyled} class={className}>
  {#each schema.groups as group (group.id)}
    <ManifoldGroup id={group.id} label={group.id}>
      {#each group.members as member, i (member)}
        <ManifoldInput
          {member}
          label={group.labels?.[i] ?? member}
          min={group.config?.min}
          max={group.config?.max}
          step={group.config?.step}
        />
      {/each}
    </ManifoldGroup>
  {/each}
</ManifoldPanel>
