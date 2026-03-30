<script lang="ts">
  import { getContext } from 'svelte';
  import type { ManifoldController } from '../builders/manifold.svelte';
  import type { DragModifierConfig } from '../builders/types';

  interface Props {
    member: string;
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    class?: string;
  }

  let {
    member,
    label,
    min,
    max,
    step = 1,
    class: className = ''
  }: Props = $props();

  const controller = getContext<ManifoldController>('manifold-controller');
  const groupId = getContext<string>('manifold-group-id');

  let inputEl: HTMLInputElement | undefined = $state();
  let editing = $state(false);
  let editText = $state('');

  // Drag tracking (not part of controller state until threshold crossed)
  let pointerDown = false;
  let downX = 0;
  let downY = 0;
  let downPointerId = -1;
  let downPointerType: 'mouse' | 'touch' | 'pen' = 'mouse';

  const MOUSE_THRESHOLD = 3;
  const TOUCH_THRESHOLD = 10;

  // --- Derived values ---
  let value = $derived(controller.values[groupId]?.[member] ?? 0);

  let groupConfig = $derived(controller.getGroupConfig(groupId));

  let inputConfig = $derived(groupConfig?.config);
  let effectiveMin = $derived(min ?? inputConfig?.min);
  let effectiveMax = $derived(max ?? inputConfig?.max);
  let effectiveStep = $derived(step ?? inputConfig?.step ?? 1);

  let displayLabel = $derived(label ?? member);

  // --- Helpers ---
  function clampValue(v: number): number {
    if (effectiveMin !== undefined) v = Math.max(effectiveMin, v);
    if (effectiveMax !== undefined) v = Math.min(effectiveMax, v);
    return v;
  }

  function formatValue(v: number): string {
    // Show a reasonable number of decimals based on step
    if (effectiveStep >= 1) return String(Math.round(v));
    const decimals = String(effectiveStep).split('.')[1]?.length ?? 2;
    return v.toFixed(decimals);
  }

  function getDragConfig(): DragModifierConfig | undefined {
    const drag = groupConfig?.inputDrag;
    if (!drag) return undefined;
    return drag[controller.modifier] ?? drag.base;
  }

  // --- Input editing ---
  function startEditing() {
    editing = true;
    editText = formatValue(value);
    // Focus the input after Svelte updates the DOM
    requestAnimationFrame(() => inputEl?.select());
  }

  function commitEdit() {
    if (!editing) return;
    const parsed = parseFloat(editText);
    if (!isNaN(parsed)) {
      const clamped = clampValue(parsed);
      const old = value;
      controller.set(groupId, { [member]: clamped });
      controller.commit();
    }
    editing = false;
  }

  function cancelEdit() {
    editing = false;
  }

  // --- Keyboard ---
  function onKeyDown(e: KeyboardEvent) {
    if (editing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
        inputEl?.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
        inputEl?.blur();
      }
      return;
    }

    // Arrow key increment/decrement (when focused but not editing)
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const multiplier = e.shiftKey ? 10 : 1;
      const delta = (e.key === 'ArrowUp' ? 1 : -1) * effectiveStep * multiplier;
      const newVal = clampValue(value + delta);
      controller.set(groupId, { [member]: newVal });
      controller.commit();
    }
  }

  // --- Modifier detection from pointer events ---
  // During pointer capture, keyboard events don't fire on the captured element.
  // Pointer events carry shiftKey/ctrlKey/metaKey, so we read modifiers from there.
  function updateModifierFromEvent(e: PointerEvent) {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (e.shiftKey && isCtrl) {
      controller.setModifier('shiftCtrl');
    } else if (e.shiftKey) {
      controller.setModifier('shift');
    } else if (isCtrl) {
      controller.setModifier('ctrl');
    } else {
      controller.setModifier('base');
    }
  }

  // --- Pointer / Drag ---
  function onPointerDownWhileEditing(e: PointerEvent) {
    // When editing, allow native text selection on click.
    // Track pointer for potential drag-out-of-edit-mode.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerDown = true;
    downX = e.clientX;
    downY = e.clientY;
    downPointerId = e.pointerId;
    downPointerType = e.pointerType as 'mouse' | 'touch' | 'pen';
    // Don't preventDefault or setPointerCapture yet — let native text selection work.
    // If drag threshold is crossed, we'll cancel editing and start drag.
  }

  function onPointerDown(e: PointerEvent) {
    // Only primary button for mouse
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    pointerDown = true;
    downX = e.clientX;
    downY = e.clientY;
    downPointerId = e.pointerId;
    downPointerType = e.pointerType as 'mouse' | 'touch' | 'pen';

    // Capture to this element
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
      // Not yet dragging -- check threshold
      if (dist < threshold) return;

      // Start drag
      const dragConfig = getDragConfig();
      if (!dragConfig) {
        // No drag configured -- treat as click
        return;
      }

      // If we were editing, cancel edit and capture pointer for drag
      if (editing) {
        cancelEdit();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }

      // Snapshot group values for revert
      const snapshot = { ...controller.values[groupId] };

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

      controller.dragState.active = true;
      controller.dragState.tier = 'input';
      controller.dragState.groupId = groupId;
      controller.dragState.member = member;
      controller.dragState.startX = downX;
      controller.dragState.startY = downY;
      controller.dragState.originRect = rect;
      controller.dragState.snapshot = snapshot;
      controller.dragState.hudType = dragConfig.type;
      controller.dragState.pointerType = downPointerType;
      controller.dragState.dragDx = 0;
      controller.dragState.dragDy = 0;

      controller.setActiveGroup(groupId);
      controller.emitDragStart({ groupId, tier: 'input', member });
    }

    if (controller.dragState.active) {
      // Update modifier from pointer event (keyboard events don't fire during pointer capture)
      updateModifierFromEvent(e);

      // Update drag deltas (from drag start, not pointer down)
      controller.dragState.dragDx = e.clientX - downX;
      controller.dragState.dragDy = e.clientY - downY;

      // Call the drag handler (re-read config in case modifier changed)
      const dragConfig = getDragConfig();
      if (dragConfig) {
        // Update HUD type if modifier changed
        controller.dragState.hudType = dragConfig.type;

        // Create a plain working copy for the handler to mutate,
        // then apply via controller.set() to ensure reactivity
        const working: Record<string, number> = {};
        const groupValues = controller.values[groupId];
        for (const key of Object.keys(groupValues)) {
          working[key] = groupValues[key];
        }

        dragConfig.handler(
          controller.dragState.dragDx,
          controller.dragState.dragDy,
          working,
          controller.dragState.snapshot!,
          member
        );

        controller.set(groupId, working);
      }
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!pointerDown) return;
    if (e.pointerId !== downPointerId) return;

    const wasDragging = controller.dragState.active;

    if (wasDragging) {
      // Commit the drag
      controller.commit();
      controller.emitDragEnd({ groupId, tier: 'input', committed: true });

      // Reset drag state
      controller.dragState.active = false;
      controller.dragState.hudType = null;
      controller.dragState.snapshot = null;
      controller.dragState.member = null;
      controller.dragState.dragDx = 0;
      controller.dragState.dragDy = 0;
    } else {
      // Click without drag -- enter edit mode
      startEditing();
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

    if (controller.dragState.active) {
      // Revert to snapshot
      if (controller.dragState.snapshot) {
        controller.set(groupId, controller.dragState.snapshot);
      }
      controller.emitDragEnd({ groupId, tier: 'input', committed: false });

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

  // Escape during drag reverts
  function onKeyDownDrag(e: KeyboardEvent) {
    if (e.key === 'Escape' && controller.dragState.active && controller.dragState.member === member) {
      e.preventDefault();
      if (controller.dragState.snapshot) {
        controller.set(groupId, controller.dragState.snapshot);
      }
      controller.emitDragEnd({ groupId, tier: 'input', committed: false });

      controller.dragState.active = false;
      controller.dragState.hudType = null;
      controller.dragState.snapshot = null;
      controller.dragState.member = null;
      controller.dragState.dragDx = 0;
      controller.dragState.dragDy = 0;

      pointerDown = false;
      downPointerId = -1;
    }
  }
</script>

<div
  class="manifold-input {className}"
  onkeydown={onKeyDownDrag}
  role="presentation"
>
  {#if displayLabel}
    <label class="manifold-input-label" for="manifold-{groupId}-{member}">
      {displayLabel}
    </label>
  {/if}

  {#if editing}
    <input
      bind:this={inputEl}
      id="manifold-{groupId}-{member}"
      class="manifold-input-field"
      type="text"
      inputmode="decimal"
      value={editText}
      oninput={(e) => { editText = (e.currentTarget as HTMLInputElement).value; }}
      onblur={commitEdit}
      onkeydown={onKeyDown}
      onpointerdown={onPointerDownWhileEditing}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerCancel}
      role="spinbutton"
      aria-label="{displayLabel}"
      aria-valuenow={value}
      aria-valuemin={effectiveMin}
      aria-valuemax={effectiveMax}
    />
  {:else}
    <div
      id="manifold-{groupId}-{member}"
      class="manifold-input-field manifold-input-display"
      tabindex="0"
      role="spinbutton"
      aria-label="{displayLabel}"
      aria-valuenow={value}
      aria-valuemin={effectiveMin}
      aria-valuemax={effectiveMax}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerCancel}
      onkeydown={onKeyDown}
      onfocusin={() => controller.setActiveGroup(groupId)}
    >
      {formatValue(value)}
    </div>
  {/if}
</div>

<style>
  .manifold-input {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .manifold-input-label {
    font-family: var(--manifold-font-label, system-ui, sans-serif);
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--manifold-text-label, #cbd5e1);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    user-select: none;
  }

  .manifold-input-field {
    font-family: var(--manifold-font-mono, monospace);
    font-size: 0.85rem;
    color: var(--manifold-text, #e2e8f0);
    background: var(--manifold-input-bg, #1a1525);
    border: 1px solid var(--manifold-input-border, #3b2f56);
    border-radius: var(--manifold-radius, 6px);
    padding: 6px 8px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.15s, background-color 0.15s;
  }

  .manifold-input-field:focus {
    background: var(--manifold-input-bg-focus, #211a30);
    border-color: var(--manifold-input-border-focus, #9d4edd);
  }

  .manifold-input-display {
    cursor: ew-resize;
    user-select: none;
    touch-action: none;
  }
</style>
