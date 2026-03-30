<script lang="ts">
  import { setContext } from 'svelte';
  import type { Snippet } from 'svelte';
  import type { ManifoldController } from '../builders/manifold.svelte';
  import type { DragModifierConfig } from '../builders/types';
  import ManifoldHud from './ManifoldHud.svelte';
  import '../styles/default-theme.css';

  interface Props {
    controller: ManifoldController;
    title?: string;
    unstyled?: boolean;
    class?: string;
    children: Snippet;
  }

  let {
    controller,
    title,
    unstyled = false,
    class: className = '',
    children
  }: Props = $props();

  // Provide controller to all descendants
  setContext('manifold-controller', controller);

  let liveAnnouncement = $state('');

  // --- Modifier key detection ---
  function updateModifier(e: KeyboardEvent) {
    if (e.shiftKey && e.ctrlKey) {
      controller.setModifier('shiftCtrl');
    } else if (e.shiftKey) {
      controller.setModifier('shift');
    } else if (e.ctrlKey) {
      controller.setModifier('ctrl');
    } else {
      controller.setModifier('base');
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    updateModifier(e);

    // Undo/Redo shortcuts
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        controller.redo();
      } else {
        controller.undo();
      }
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    updateModifier(e);
  }

  function onFocusOut(e: FocusEvent) {
    // Reset modifier when focus leaves the panel entirely
    const panel = (e.currentTarget as HTMLElement);
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !panel.contains(related)) {
      controller.setModifier('base');
    }
  }

  // --- Panel-level drag ---
  let pointerDown = false;
  let downX = 0;
  let downY = 0;
  let downPointerId = -1;
  let downPointerType: 'mouse' | 'touch' | 'pen' = 'mouse';

  const MOUSE_THRESHOLD = 3;
  const TOUCH_THRESHOLD = 10;

  function getPanelDragConfig(): DragModifierConfig | undefined {
    const drag = controller.config.drag;
    if (!drag) return undefined;
    return drag[controller.modifier] ?? drag.base;
  }

  function onPointerDown(e: PointerEvent) {
    // Only start panel drag on the panel background
    if ((e.target as HTMLElement).closest('.manifold-input, .manifold-group')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!getPanelDragConfig()) return;

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

      const dragConfig = getPanelDragConfig();
      if (!dragConfig) return;

      const groupId = controller.activeGroup;
      const snapshot = { ...controller.values[groupId] };
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

      controller.dragState.active = true;
      controller.dragState.tier = 'panel';
      controller.dragState.groupId = groupId;
      controller.dragState.member = null;
      controller.dragState.startX = downX;
      controller.dragState.startY = downY;
      controller.dragState.originRect = rect;
      controller.dragState.snapshot = snapshot;
      controller.dragState.hudType = dragConfig.type;
      controller.dragState.pointerType = downPointerType;
      controller.dragState.dragDx = 0;
      controller.dragState.dragDy = 0;

      controller.emitDragStart({ groupId, tier: 'panel' });
    }

    if (controller.dragState.active && controller.dragState.tier === 'panel') {
      controller.dragState.dragDx = e.clientX - downX;
      controller.dragState.dragDy = e.clientY - downY;

      const dragConfig = getPanelDragConfig();
      const groupId = controller.dragState.groupId;
      if (dragConfig) {
        const groupCfg = controller.getGroupConfig(groupId);
        const members = groupCfg?.members ?? [];
        dragConfig.handler(
          controller.dragState.dragDx,
          controller.dragState.dragDy,
          controller.values[groupId],
          controller.dragState.snapshot!,
          members[0] ?? ''
        );
      }
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!pointerDown) return;
    if (e.pointerId !== downPointerId) return;

    if (controller.dragState.active && controller.dragState.tier === 'panel') {
      controller.commit();
      controller.emitDragEnd({ groupId: controller.dragState.groupId, tier: 'panel', committed: true });

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

    if (controller.dragState.active && controller.dragState.tier === 'panel') {
      const groupId = controller.dragState.groupId;
      if (controller.dragState.snapshot) {
        controller.set(groupId, controller.dragState.snapshot);
      }
      controller.emitDragEnd({ groupId, tier: 'panel', committed: false });

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

  // Announce drag values for screen readers
  $effect(() => {
    if (controller.dragState.active) {
      const ds = controller.dragState;
      const dx = Math.round(ds.dragDx);
      const dy = Math.round(ds.dragDy);
      liveAnnouncement = `Dragging ${ds.member ?? ds.groupId}: dx ${dx}, dy ${dy}`;
    } else {
      liveAnnouncement = '';
    }
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  class={unstyled ? className : `manifold-panel ${className}`}
  aria-label={title ?? 'Manifold controls'}
  tabindex="-1"
  onkeydown={onKeyDown}
  onkeyup={onKeyUp}
  onfocusout={onFocusOut}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerCancel}
>
  {#if title && !unstyled}
    <div class="manifold-panel-title">{title}</div>
  {/if}
  {@render children()}

  <ManifoldHud />

  <!-- Screen reader live region -->
  <div class="manifold-sr-live" aria-live="polite" aria-atomic="true">
    {liveAnnouncement}
  </div>
</section>

{#if !unstyled}
<style>
  .manifold-panel {
    background: var(--manifold-bg, #13111c);
    border: 1px solid var(--manifold-border, #2d2640);
    border-radius: var(--manifold-radius-panel, 12px);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: var(--manifold-text, #e2e8f0);
    font-family: var(--manifold-font-label, system-ui, sans-serif);
    outline: none;
  }

  .manifold-panel-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--manifold-text-dim, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    user-select: none;
  }

  .manifold-sr-live {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
{/if}
