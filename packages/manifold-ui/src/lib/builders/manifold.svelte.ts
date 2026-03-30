import type {
  ManifoldConfig,
  GroupConfig,
  Modifier,
  ChangeEvent,
  DragStartEvent,
  DragEndEvent,
  DragState
} from './types.js';

export function createManifold(config: ManifoldConfig) {
  const { groups, historySize = 50 } = config;

  // --- State ---
  const initials: Record<string, Record<string, number>> = {};
  for (const group of groups) {
    initials[group.id] = {};
    for (const member of group.members) {
      initials[group.id][member] = group.initial?.[member] ?? 0;
    }
  }

  let values = $state<Record<string, Record<string, number>>>(
    config.values ?? structuredClone(initials)
  );

  let activeGroup = $state<string>(groups[0]?.id ?? '');
  let modifier = $state<Modifier>('base');

  // --- Drag State ---
  let dragState = $state<DragState>({
    active: false,
    tier: 'input',
    groupId: '',
    member: null,
    startX: 0,
    startY: 0,
    originRect: null,
    snapshot: null,
    hudType: null,
    pointerType: 'mouse',
    dragDx: 0,
    dragDy: 0
  });

  // --- Undo/Redo ---
  let history: string[] = [JSON.stringify(config.values ?? initials)];
  let historyIndex = 0;

  function commit() {
    const snapshot = JSON.stringify(values);
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
    }
    history.push(snapshot);
    if (history.length > historySize) {
      history.shift();
    } else {
      historyIndex++;
    }
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    const restored = JSON.parse(history[historyIndex]);
    for (const gid of Object.keys(restored)) {
      for (const mid of Object.keys(restored[gid])) {
        values[gid][mid] = restored[gid][mid];
      }
    }
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    const restored = JSON.parse(history[historyIndex]);
    for (const gid of Object.keys(restored)) {
      for (const mid of Object.keys(restored[gid])) {
        values[gid][mid] = restored[gid][mid];
      }
    }
  }

  // --- Events ---
  let changeHandlers: Array<(e: ChangeEvent) => void> = [];
  let dragStartHandlers: Array<(e: DragStartEvent) => void> = [];
  let dragEndHandlers: Array<(e: DragEndEvent) => void> = [];
  let destroyed = false;

  function emitChange(groupId: string, member: string, oldValue: number, newValue: number) {
    if (destroyed) return;
    for (const handler of changeHandlers) {
      handler({ groupId, member, oldValue, newValue });
    }
  }

  function set(groupId: string, partial: Record<string, number>) {
    const group = values[groupId];
    if (!group) return;
    for (const [member, newValue] of Object.entries(partial)) {
      if (member in group) {
        const oldValue = group[member];
        if (oldValue !== newValue) {
          group[member] = newValue;
          emitChange(groupId, member, oldValue, newValue);
        }
      }
    }
  }

  function reset(groupId: string) {
    const initial = initials[groupId];
    if (!initial) return;
    set(groupId, { ...initial });
  }

  function setActiveGroup(id: string) {
    if (groups.some(g => g.id === id)) {
      activeGroup = id;
    }
  }

  function setModifier(mod: Modifier) {
    modifier = mod;
  }

  function getGroupConfig(id: string): GroupConfig | undefined {
    return groups.find(g => g.id === id);
  }

  function onChange(handler: (e: ChangeEvent) => void) {
    changeHandlers.push(handler);
    return () => { changeHandlers = changeHandlers.filter(h => h !== handler); };
  }

  function onDragStart(handler: (e: DragStartEvent) => void) {
    dragStartHandlers.push(handler);
    return () => { dragStartHandlers = dragStartHandlers.filter(h => h !== handler); };
  }

  function onDragEnd(handler: (e: DragEndEvent) => void) {
    dragEndHandlers.push(handler);
    return () => { dragEndHandlers = dragEndHandlers.filter(h => h !== handler); };
  }

  function emitDragStart(e: DragStartEvent) {
    if (destroyed) return;
    for (const handler of dragStartHandlers) handler(e);
  }

  function emitDragEnd(e: DragEndEvent) {
    if (destroyed) return;
    for (const handler of dragEndHandlers) handler(e);
  }

  function destroy() {
    destroyed = true;
    changeHandlers = [];
    dragStartHandlers = [];
    dragEndHandlers = [];
    history = [];
  }

  return {
    get values() { return values; },
    get activeGroup() { return activeGroup; },
    get modifier() { return modifier; },
    get dragState() { return dragState; },
    get config() { return config; },
    groups,
    set,
    reset,
    commit,
    undo,
    redo,
    setActiveGroup,
    setModifier,
    getGroupConfig,
    onChange,
    onDragStart,
    onDragEnd,
    emitDragStart,
    emitDragEnd,
    destroy
  };
}

export type ManifoldController = ReturnType<typeof createManifold>;
