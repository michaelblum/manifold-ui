// manifold-ui — Grouped numeric control surfaces for Svelte
export { createManifold, type ManifoldController } from './builders/manifold.svelte';
export type {
  ManifoldConfig,
  ManifoldSchema,
  GroupConfig,
  InputConfig,
  DragConfig,
  DragModifierConfig,
  DragHandler,
  DragState,
  HudType,
  Modifier,
  ChangeEvent,
  DragStartEvent,
  DragEndEvent
} from './builders/types';
