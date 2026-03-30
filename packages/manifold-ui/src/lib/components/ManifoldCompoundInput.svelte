<script lang="ts">
  import { getContext } from 'svelte';
  import type { ManifoldController } from '../builders/manifold.svelte';
  import type { DragModifierConfig } from '../builders/types';

  interface Props {
    /** Member keys this compound input represents, in order */
    members: string[];
    /**
     * Format pattern with {memberName} placeholders.
     * Examples: "rgb({r}, {g}, {b})", "{x}, {y}, {z}", "hsl({h}deg, {s}%, {l}%)"
     */
    pattern?: string;
    label?: string;
    class?: string;
  }

  let {
    members,
    pattern,
    label,
    class: className = ''
  }: Props = $props();

  const controller = getContext<ManifoldController>('manifold-controller');
  const groupId = getContext<string>('manifold-group-id');

  let editing = $state(false);
  let editText = $state('');
  let inputEl: HTMLInputElement | undefined = $state();

  // Drag tracking
  let pointerDown = false;
  let downX = 0;
  let downY = 0;
  let downPointerId = -1;
  let downPointerType: 'mouse' | 'touch' | 'pen' = 'mouse';

  const MOUSE_THRESHOLD = 3;
  const TOUCH_THRESHOLD = 10;

  // --- Derived ---
  let groupConfig = $derived(controller.getGroupConfig(groupId));
  let inputConfig = $derived(groupConfig?.config);

  // Build default pattern from members if none provided: "{r}, {g}, {b}"
  let effectivePattern = $derived(pattern ?? members.map(m => `{${m}}`).join(', '));

  // --- Format / Parse ---
  function formatValue(v: number): string {
    const step = inputConfig?.step ?? 1;
    if (step >= 1) return String(Math.round(v));
    const decimals = String(step).split('.')[1]?.length ?? 2;
    return v.toFixed(decimals);
  }

  function formatDisplay(): string {
    let result = effectivePattern;
    for (const m of members) {
      const val = controller.values[groupId]?.[m] ?? 0;
      result = result.replace(`{${m}}`, formatValue(val));
    }
    return result;
  }

  function buildParseRegex(): RegExp {
    // Escape special regex chars in the pattern, then replace {member} with capture groups
    let regexStr = effectivePattern.replace(/[.*+?^${}()|[\]\\]/g, (match) => {
      // Don't escape our {member} placeholders
      return match;
    });
    // Replace each {memberName} with a number capture group
    for (const m of members) {
      regexStr = regexStr.replace(`{${m}}`, '(-?[\\d]*\\.?[\\d]+)');
    }
    // Escape remaining regex-special chars that aren't part of our capture groups
    // Actually, let's do this more carefully:
    return new RegExp('^\\s*' + regexStr + '\\s*$');
  }

  function parseInput(text: string): Record<string, number> | null {
    // First try: regex match against the pattern
    try {
      const regex = buildParseRegex();
      const match = text.match(regex);
      if (match) {
        const result: Record<string, number> = {};
        for (let i = 0; i < members.length; i++) {
          const parsed = parseFloat(match[i + 1]);
          if (isNaN(parsed)) return null;
          result[members[i]] = parsed;
        }
        return result;
      }
    } catch {
      // Regex failed, try fallback
    }

    // Fallback: extract all numbers from the string in order
    const numbers = text.match(/-?[\d]*\.?[\d]+/g);
    if (numbers && numbers.length >= members.length) {
      const result: Record<string, number> = {};
      for (let i = 0; i < members.length; i++) {
        const parsed = parseFloat(numbers[i]);
        if (isNaN(parsed)) return null;
        result[members[i]] = parsed;
      }
      return result;
    }

    return null;
  }

  function clampValue(v: number): number {
    if (inputConfig?.min !== undefined) v = Math.max(inputConfig.min, v);
    if (inputConfig?.max !== undefined) v = Math.min(inputConfig.max, v);
    return v;
  }

  // --- Display ---
  let displayText = $derived(formatDisplay());

  // --- Editing ---
  function startEditing() {
    editing = true;
    editText = formatDisplay();
    requestAnimationFrame(() => inputEl?.select());
  }

  function commitEdit() {
    if (!editing) return;
    const parsed = parseInput(editText);
    if (parsed) {
      const clamped: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        clamped[k] = clampValue(v);
      }
      controller.set(groupId, clamped);
      controller.commit();
    }
    editing = false;
  }

  function cancelEdit() {
    editing = false;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
      inputEl?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
      inputEl?.blur();
    }
  }

  // --- Modifier detection from pointer events ---
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

  function getDragConfig(): DragModifierConfig | undefined {
    // Use group-level drag if available, fall back to inputDrag
    const drag = groupConfig?.drag ?? groupConfig?.inputDrag;
    if (!drag) return undefined;
    return drag[controller.modifier] ?? drag.base;
  }

  // --- Pointer / Drag ---
  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    pointerDown = true;
    downX = e.clientX;
    downY = e.clientY;
    downPointerId = e.pointerId;
    downPointerType = e.pointerType as 'mouse' | 'touch' | 'pen';

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerDownWhileEditing(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerDown = true;
    downX = e.clientX;
    downY = e.clientY;
    downPointerId = e.pointerId;
    downPointerType = e.pointerType as 'mouse' | 'touch' | 'pen';
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

      const dragConfig = getDragConfig();
      if (!dragConfig) return;

      if (editing) {
        cancelEdit();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }

      const snapshot = { ...controller.values[groupId] };
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

      controller.dragState.active = true;
      controller.dragState.tier = 'input';
      controller.dragState.groupId = groupId;
      controller.dragState.member = members[0]; // primary member
      controller.dragState.startX = downX;
      controller.dragState.startY = downY;
      controller.dragState.originRect = rect;
      controller.dragState.snapshot = snapshot;
      controller.dragState.hudType = dragConfig.type;
      controller.dragState.pointerType = downPointerType;
      controller.dragState.dragDx = 0;
      controller.dragState.dragDy = 0;

      controller.setActiveGroup(groupId);
      controller.emitDragStart({ groupId, tier: 'input', member: members[0] });
    }

    if (controller.dragState.active) {
      updateModifierFromEvent(e);

      const dragConfig = getDragConfig();
      const rawDx = e.clientX - downX;
      const rawDy = e.clientY - downY;
      const effectiveDx = dragConfig?.invertX ? -rawDx : rawDx;
      const effectiveDy = dragConfig?.invertY ? -rawDy : rawDy;

      controller.dragState.dragDx = effectiveDx;
      controller.dragState.dragDy = effectiveDy;

      if (dragConfig) {
        controller.dragState.hudType = dragConfig.type;

        const working: Record<string, number> = {};
        const groupValues = controller.values[groupId];
        for (const key of Object.keys(groupValues)) {
          working[key] = groupValues[key];
        }

        dragConfig.handler(effectiveDx, effectiveDy, working, controller.dragState.snapshot!, members[0]);
        controller.set(groupId, working);
      }
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!pointerDown) return;
    if (e.pointerId !== downPointerId) return;

    const wasDragging = controller.dragState.active;

    if (wasDragging) {
      controller.commit();
      controller.emitDragEnd({ groupId, tier: 'input', committed: true });
      controller.dragState.active = false;
      controller.dragState.hudType = null;
      controller.dragState.snapshot = null;
      controller.dragState.member = null;
      controller.dragState.dragDx = 0;
      controller.dragState.dragDy = 0;
    } else {
      startEditing();
    }

    pointerDown = false;
    downPointerId = -1;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }

  function onPointerCancel(e: PointerEvent) {
    if (!pointerDown) return;
    if (e.pointerId !== downPointerId) return;

    if (controller.dragState.active) {
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
</script>

<div
  class="manifold-compound-input {className}"
  role="presentation"
>
  {#if label}
    <label class="manifold-compound-label">{label}</label>
  {/if}

  {#if editing}
    <input
      bind:this={inputEl}
      class="manifold-compound-field"
      type="text"
      value={editText}
      oninput={(e) => { editText = (e.currentTarget as HTMLInputElement).value; }}
      onblur={commitEdit}
      onkeydown={onKeyDown}
      onpointerdown={onPointerDownWhileEditing}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerCancel}
    />
  {:else}
    <div
      class="manifold-compound-field manifold-compound-display"
      tabindex="0"
      role="textbox"
      aria-label={label ?? 'Compound value'}
      aria-readonly="true"
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerCancel}
      onfocusin={() => controller.setActiveGroup(groupId)}
    >
      {displayText}
    </div>
  {/if}
</div>

<style>
  .manifold-compound-input {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .manifold-compound-label {
    font-family: var(--manifold-font-label, system-ui, sans-serif);
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--manifold-text-label, #cbd5e1);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    user-select: none;
  }

  .manifold-compound-field {
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

  .manifold-compound-field:focus {
    background: var(--manifold-input-bg-focus, #211a30);
    border-color: var(--manifold-input-border-focus, #9d4edd);
  }

  .manifold-compound-display {
    cursor: ew-resize;
    user-select: none;
    touch-action: none;
  }
</style>
