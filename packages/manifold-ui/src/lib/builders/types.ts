/** HUD visual type displayed during drag */
export type HudType = 'slider_1d' | 'axis_2d' | 'axis_3d' | 'dial';

/** Modifier key state */
export type Modifier = 'base' | 'shift' | 'ctrl' | 'shiftCtrl';

/** Handler called during drag to update values */
export type DragHandler = (
  dx: number,
  dy: number,
  current: Record<string, number>,
  start: Record<string, number>,
  member: string
) => void;

/** Drag config for a single modifier state */
export interface DragModifierConfig {
  type: HudType;
  handler: DragHandler;
}

/** Drag config mapping modifier states to behaviors */
export type DragConfig = Partial<Record<Modifier, DragModifierConfig>>;

/** Per-input constraints */
export interface InputConfig {
  min?: number;
  max?: number;
  step?: number;
}

/** Group definition within a manifold */
export interface GroupConfig {
  id: string;
  members: string[];
  labels?: string[];
  initial?: Record<string, number>;
  config?: InputConfig;
  inputDrag?: DragConfig;
  drag?: DragConfig;
}

/** Top-level manifold configuration */
export interface ManifoldConfig {
  groups: GroupConfig[];
  values?: Record<string, Record<string, number>>;
  drag?: DragConfig;
  historySize?: number;
}

/** Schema config for the <Manifold> convenience component */
export interface ManifoldSchema extends ManifoldConfig {
  title?: string;
}

/** Change event payload */
export interface ChangeEvent {
  groupId: string;
  member: string;
  oldValue: number;
  newValue: number;
}

/** Drag start event payload */
export interface DragStartEvent {
  groupId: string;
  tier: 'input' | 'group' | 'panel';
  member?: string;
}

/** Drag end event payload */
export interface DragEndEvent {
  groupId: string;
  tier: 'input' | 'group' | 'panel';
  committed: boolean;
}

/** Internal drag state tracked by the builder */
export interface DragState {
  active: boolean;
  tier: 'input' | 'group' | 'panel';
  groupId: string;
  member: string | null;
  startX: number;
  startY: number;
  originRect: DOMRect | null;
  snapshot: Record<string, number> | null;
  hudType: HudType | null;
  pointerType: 'mouse' | 'touch' | 'pen';
  dragDx: number;
  dragDy: number;
}
