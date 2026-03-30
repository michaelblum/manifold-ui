<script lang="ts">
  import { getContext, onMount, onDestroy } from 'svelte';
  import type { ManifoldController } from '../builders/manifold.svelte';

  const controller = getContext<ManifoldController>('manifold-controller');

  let portal: HTMLDivElement | undefined;

  onMount(() => {
    portal = document.createElement('div');
    portal.className = 'manifold-hud-portal';
    portal.setAttribute('aria-hidden', 'true');
    portal.style.position = 'fixed';
    portal.style.top = '0';
    portal.style.left = '0';
    portal.style.width = '0';
    portal.style.height = '0';
    portal.style.pointerEvents = 'none';
    portal.style.zIndex = '99999';
    document.body.appendChild(portal);
  });

  onDestroy(() => {
    if (portal && portal.parentNode) {
      portal.parentNode.removeChild(portal);
    }
  });

  // --- HUD rendering ---
  const HUD_SIZE = 80;
  const HUD_HALF = HUD_SIZE / 2;

  function buildAxis2d(dx: number, dy: number): string {
    const cx = HUD_HALF;
    const cy = HUD_HALF;
    const r = HUD_HALF - 4;
    // Dot position clamped to circle
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = r - 4;
    const scale = dist > maxDist ? maxDist / dist : 1;
    const dotX = cx + dx * scale * 0.5;
    const dotY = cy + dy * scale * 0.5;

    return `<svg width="${HUD_SIZE}" height="${HUD_SIZE}" viewBox="0 0 ${HUD_SIZE} ${HUD_SIZE}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="var(--manifold-hud-border, #2d2640)" stroke-width="1.5"/>
      <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}"
        stroke="var(--manifold-hud-border, #2d2640)" stroke-width="0.5" stroke-dasharray="2,3"/>
      <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"
        stroke="var(--manifold-hud-border, #2d2640)" stroke-width="0.5" stroke-dasharray="2,3"/>
      <circle cx="${dotX}" cy="${dotY}" r="5"
        fill="var(--manifold-hud-accent, #06b6d4)"/>
    </svg>`;
  }

  function buildSlider1d(dx: number, dy: number): string {
    const barH = HUD_SIZE - 8;
    const barW = 6;
    const cx = HUD_SIZE / 2;
    // Map dy to thumb position (inverted: up = positive)
    const maxTravel = barH - 12;
    const thumbOffset = Math.max(-maxTravel / 2, Math.min(maxTravel / 2, -dy * 0.5));
    const thumbY = HUD_HALF + thumbOffset;

    return `<svg width="${HUD_SIZE}" height="${HUD_SIZE}" viewBox="0 0 ${HUD_SIZE} ${HUD_SIZE}">
      <rect x="${cx - barW / 2}" y="4" width="${barW}" height="${barH}" rx="3"
        fill="var(--manifold-hud-border, #2d2640)"/>
      <rect x="${cx - 10}" y="${thumbY - 4}" width="20" height="8" rx="4"
        fill="var(--manifold-hud-accent, #06b6d4)"/>
    </svg>`;
  }

  function buildAxis3d(dx: number, dy: number, modifier: string): string {
    const cx = HUD_HALF;
    const cy = HUD_HALF;
    const r = HUD_HALF - 4;
    const isZMode = modifier === 'shift' || modifier === 'shiftCtrl';

    // Perspective tilt amount (0 = flat, 1 = fully tilted)
    // We use CSS perspective on the portal container for the 3D effect
    const tiltAngle = isZMode ? 55 : 0;

    if (!isZMode) {
      // Flat XY mode — same as axis_2d but with subtle depth ring
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = r - 4;
      const scale = dist > maxDist ? maxDist / dist : 1;
      const dotX = cx + dx * scale * 0.5;
      const dotY = cy + dy * scale * 0.5;

      return `<div style="transform: perspective(200px) rotateX(${tiltAngle}deg); transition: transform 0.25s ease;">
        <svg width="${HUD_SIZE}" height="${HUD_SIZE}" viewBox="0 0 ${HUD_SIZE} ${HUD_SIZE}">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
            stroke="var(--manifold-hud-border, #2d2640)" stroke-width="1.5"/>
          <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}"
            stroke="var(--manifold-hud-border, #2d2640)" stroke-width="0.5" stroke-dasharray="2,3"/>
          <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"
            stroke="var(--manifold-hud-border, #2d2640)" stroke-width="0.5" stroke-dasharray="2,3"/>
          <circle cx="${dotX}" cy="${dotY}" r="5"
            fill="var(--manifold-hud-accent, #06b6d4)"/>
        </svg>
      </div>`;
    } else {
      // Tilted Z mode — circle in perspective with Z-axis dotted line
      // Dot moves only vertically (above/below center = Z value)
      const maxTravel = r - 6;
      const dotOffset = Math.max(-maxTravel, Math.min(maxTravel, -dy * 0.5));
      const dotY = cy + dotOffset;

      return `<div style="transform: perspective(200px) rotateX(${tiltAngle}deg); transition: transform 0.25s ease;">
        <svg width="${HUD_SIZE}" height="${HUD_SIZE}" viewBox="0 0 ${HUD_SIZE} ${HUD_SIZE}">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
            stroke="var(--manifold-hud-border, #2d2640)" stroke-width="1.5"/>
          <!-- Horizontal equator line (the XY plane seen from angle) -->
          <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"
            stroke="var(--manifold-hud-border, #2d2640)" stroke-width="1" stroke-dasharray="4,4"/>
          <!-- Z axis line (vertical, prominent) -->
          <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}"
            stroke="var(--manifold-hud-accent, #06b6d4)" stroke-width="0.8" stroke-dasharray="3,3" opacity="0.6"/>
          <!-- Dot on Z axis -->
          <circle cx="${cx}" cy="${dotY}" r="5"
            fill="var(--manifold-hud-accent, #06b6d4)"/>
          <!-- Z label -->
          <text x="${cx + 10}" y="${cy - r + 10}" font-size="9" font-family="monospace"
            fill="var(--manifold-hud-accent, #06b6d4)" opacity="0.7">Z</text>
        </svg>
      </div>`;
    }
  }

  function buildDial(dx: number, dy: number): string {
    const cx = HUD_HALF;
    const cy = HUD_HALF;
    const r = HUD_HALF - 6;
    // Angle from dx (clockwise, 0 = top)
    const angle = Math.atan2(dx, -dy);
    const pointerX = cx + Math.sin(angle) * (r - 4);
    const pointerY = cy - Math.cos(angle) * (r - 4);

    return `<svg width="${HUD_SIZE}" height="${HUD_SIZE}" viewBox="0 0 ${HUD_SIZE} ${HUD_SIZE}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="var(--manifold-hud-border, #2d2640)" stroke-width="1.5" stroke-dasharray="4,4"/>
      <line x1="${cx}" y1="${cy}" x2="${pointerX}" y2="${pointerY}"
        stroke="var(--manifold-hud-accent-alt, #c084fc)" stroke-width="2" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="3"
        fill="var(--manifold-hud-accent-alt, #c084fc)"/>
    </svg>`;
  }

  $effect(() => {
    if (!portal) return;
    const ds = controller.dragState;

    if (ds.active && ds.hudType !== null) {
      portal.style.display = 'block';

      // Position at drag origin
      const ox = ds.startX;
      const oy = ds.startY;
      portal.style.left = `${ox - HUD_HALF}px`;
      portal.style.top = `${oy - HUD_HALF}px`;
      portal.style.width = `${HUD_SIZE}px`;
      portal.style.height = `${HUD_SIZE}px`;

      let html = '';
      switch (ds.hudType) {
        case 'axis_2d':
          html = buildAxis2d(ds.dragDx, ds.dragDy);
          break;
        case 'axis_3d':
          html = buildAxis3d(ds.dragDx, ds.dragDy, controller.modifier);
          break;
        case 'slider_1d':
          html = buildSlider1d(ds.dragDx, ds.dragDy);
          break;
        case 'dial':
          html = buildDial(ds.dragDx, ds.dragDy);
          break;
      }

      portal.innerHTML = html;
    } else {
      portal.style.display = 'none';
      portal.innerHTML = '';
    }
  });
</script>
