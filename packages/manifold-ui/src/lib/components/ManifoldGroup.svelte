<script lang="ts">
  import { setContext, getContext } from 'svelte';
  import type { Snippet } from 'svelte';
  import type { ManifoldController } from '../builders/manifold.svelte';
  import type { DragModifierConfig } from '../builders/types';

  interface Props {
    id: string;
    label?: string;
    class?: string;
    children: Snippet;
  }

  let {
    id,
    label,
    class: className = '',
    children
  }: Props = $props();

  const controller = getContext<ManifoldController>('manifold-controller');

  // Provide group ID to child inputs
  setContext('manifold-group-id', id);

  let isActive = $derived(controller.activeGroup === id);

  let groupConfig = $derived(controller.getGroupConfig(id));

  // --- Group-level drag ---
  let pointerDown = false;
  let downX = 0;
  let downY = 0;
  let downPointerId = -1;
  let downPointerType: 'mouse' | 'touch' | 'pen' = 'mouse';

  const MOUSE_THRESHOLD = 3;
  const TOUCH_THRESHOLD = 10;

  function getGroupDragConfig(): DragModifierConfig | undefined {
    const drag = groupConfig?.drag;
    if (!drag) return undefined;
    return drag[controller.modifier] ?? drag.base;
  }

  function onFocusIn() {
    controller.setActiveGroup(id);
  }

  function onPointerDown(e: PointerEvent) {
    // Only start group drag on the fieldset background, not on child inputs
    if ((e.target as HTMLElement).closest('.manifold-input')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!getGroupDragConfig()) return;

    pointerDown = true;
    downX = e.clientX;
    downY = e.clientY;
    downPointerId = e.pointerId;
    downPointerType = e.pointerType as 'mouse' | 'touch' | 'pen';

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointerDown) return;
    if (e.pointerId !== downPointerId) return;

    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const threshold = downPointerType === 'touch' ? TOUCH_THRESHOLD : MOUSE_THRESHOLD;

    if (!controller.dragState.active) {
      if (dist < threshold) return;

      const dragConfig = getGroupDragConfig();
      if (!dragConfig) return;

      const snapshot = { ...controller.values[id] };
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

      controller.dragState.active = true;
      controller.dragState.tier = 'group';
      controller.dragState.groupId = id;
      controller.dragState.member = null;
      controller.dragState.startX = downX;
      controller.dragState.startY = downY;
      controller.dragState.originRect = rect;
      controller.dragState.snapshot = snapshot;
      controller.dragState.hudType = dragConfig.type;
      controller.dragState.pointerType = downPointerType;
      controller.dragState.dragDx = 0;
      controller.dragState.dragDy = 0;

      controller.emitDragStart({ groupId: id, tier: 'group' });
    }

    if (controller.dragState.active && controller.dragState.tier === 'group') {
      controller.dragState.dragDx = e.clientX - downX;
      controller.dragState.dragDy = e.clientY - downY;

      const dragConfig = getGroupDragConfig();
      if (dragConfig) {
        // Group drag uses first member as context
        const members = groupConfig?.members ?? [];
        dragConfig.handler(
          controller.dragState.dragDx,
          controller.dragState.dragDy,
          controller.values[id],
          controller.dragState.snapshot!,
          members[0] ?? ''
        );
      }
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!pointerDown) return;
    if (e.pointerId !== downPointerId) return;

    if (controller.dragState.active && controller.dragState.tier === 'group') {
      controller.commit();
      controller.emitDragEnd({ groupId: id, tier: 'group', committed: true });

      controller.dragState.active = false;
      controller.dragState.hudType = null;
      controller.dragState.snapshot = null;
      controller.dragState.member = null;
      controller.dragState.dragDx = 0;
      controller.dragState.dragDy = 0;
    }

    pointerDown = false;
    downPointerId = -1;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may already be released
    }
  }

  function onPointerCancel(e: PointerEvent) {
    if (!pointerDown) return;
    if (e.pointerId !== downPointerId) return;

    if (controller.dragState.active && controller.dragState.tier === 'group') {
      if (controller.dragState.snapshot) {
        controller.set(id, controller.dragState.snapshot);
      }
      controller.emitDragEnd({ groupId: id, tier: 'group', committed: false });

      controller.dragState.active = false;
      controller.dragState.hudType = null;
      controller.dragState.snapshot = null;
      controller.dragState.member = null;
      controller.dragState.dragDx = 0;
      controller.dragState.dragDy = 0;
    }

    pointerDown = false;
    downPointerId = -1;
  }
</script>

<fieldset
  class="manifold-group {className}"
  class:manifold-group-active={isActive}
  onfocusin={onFocusIn}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerCancel}
>
  {#if label}
    <legend class="manifold-group-legend">{label}</legend>
  {/if}
  <div class="manifold-group-grid">
    {@render children()}
  </div>
</fieldset>

<style>
  .manifold-group {
    border: 1px solid var(--manifold-border, #2d2640);
    border-radius: var(--manifold-radius, 6px);
    padding: 12px;
    margin: 0;
    background: transparent;
    transition: border-color 0.15s;
  }

  .manifold-group-active {
    border-color: var(--manifold-border-active, #3b2f56);
  }

  .manifold-group-legend {
    font-family: var(--manifold-font-label, system-ui, sans-serif);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--manifold-text-dim, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0 6px;
    user-select: none;
  }

  .manifold-group-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
    gap: 8px;
  }
</style>
