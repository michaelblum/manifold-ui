// manifold-ui — Grouped numeric control surfaces for Svelte

// Builder
export { createManifold, type ManifoldController } from './builders/manifold.svelte';

// Components
export { default as Manifold } from './components/Manifold.svelte';
export { default as ManifoldPanel } from './components/ManifoldPanel.svelte';
export { default as ManifoldGroup } from './components/ManifoldGroup.svelte';
export { default as ManifoldInput } from './components/ManifoldInput.svelte';
export { default as ManifoldCompoundInput } from './components/ManifoldCompoundInput.svelte';

// Color utilities
export {
  rgbToHsl, hslToRgb,
  rgbToHex, rgbaToHex, hexToRgb, hexToRgba,
  rgbToCmyk, cmykToRgb,
  xyToHueSat, hueSatToXy
} from './builders/color';
export type { RGB, RGBA, HSL, HSLA, CMYK } from './builders/color';

// Types
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
