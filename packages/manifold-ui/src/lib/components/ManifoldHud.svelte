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
      // Z-mode: translucent 3D cylinder with shaded ball
      const cylW = HUD_SIZE;
      const cylH = HUD_SIZE + 40; // Taller for cylinder
      const cylCx = cylW / 2;
      const cylRx = r * 0.85; // Horizontal radius of ellipses
      const cylRy = r * 0.28; // Vertical radius (perspective compression)
      const cylTop = 16; // Y of top ellipse center
      const cylBot = cylH - 16; // Y of bottom ellipse center
      const cylMidY = (cylTop + cylBot) / 2;

      // Ball position along cylinder axis
      const travel = (cylBot - cylTop) - cylRy * 2;
      const ballOffset = Math.max(-travel / 2, Math.min(travel / 2, -dy * 0.5));
      const ballY = cylMidY + ballOffset;
      const ballR = 7;

      return `<svg width="${cylW}" height="${cylH}" viewBox="0 0 ${cylW} ${cylH}">
        <defs>
          <!-- Cylinder body gradient -->
          <linearGradient id="manifold-cyl-body" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.08"/>
            <stop offset="35%" stop-color="#06b6d4" stop-opacity="0.15"/>
            <stop offset="65%" stop-color="#06b6d4" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.05"/>
          </linearGradient>
          <!-- Ball shading gradient -->
          <radialGradient id="manifold-ball-grad" cx="0.35" cy="0.3" r="0.65">
            <stop offset="0%" stop-color="#67e8f9"/>
            <stop offset="50%" stop-color="#06b6d4"/>
            <stop offset="100%" stop-color="#0e7490"/>
          </radialGradient>
          <!-- Top cap gradient for 3D rim -->
          <radialGradient id="manifold-cap-top" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.06"/>
            <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.02"/>
          </radialGradient>
        </defs>

        <!-- Cylinder body (rect between ellipses) -->
        <rect x="${cylCx - cylRx}" y="${cylTop}" width="${cylRx * 2}" height="${cylBot - cylTop}"
          fill="url(#manifold-cyl-body)"/>

        <!-- Cylinder side edges -->
        <line x1="${cylCx - cylRx}" y1="${cylTop}" x2="${cylCx - cylRx}" y2="${cylBot}"
          stroke="#06b6d4" stroke-opacity="0.25" stroke-width="1"/>
        <line x1="${cylCx + cylRx}" y1="${cylTop}" x2="${cylCx + cylRx}" y2="${cylBot}"
          stroke="#06b6d4" stroke-opacity="0.25" stroke-width="1"/>

        <!-- Bottom ellipse (behind ball) -->
        <ellipse cx="${cylCx}" cy="${cylBot}" rx="${cylRx}" ry="${cylRy}"
          fill="#06b6d4" fill-opacity="0.06"
          stroke="#06b6d4" stroke-opacity="0.2" stroke-width="1"/>

        <!-- Center axis dotted line -->
        <line x1="${cylCx}" y1="${cylTop - cylRy}" x2="${cylCx}" y2="${cylBot + cylRy}"
          stroke="#06b6d4" stroke-opacity="0.3" stroke-width="0.8" stroke-dasharray="3,4"/>

        <!-- Shaded 3D ball -->
        <circle cx="${cylCx}" cy="${ballY}" r="${ballR}"
          fill="url(#manifold-ball-grad)"
          stroke="#06b6d4" stroke-opacity="0.4" stroke-width="0.5"/>
        <!-- Ball highlight -->
        <circle cx="${cylCx - 2}" cy="${ballY - 2}" r="${ballR * 0.35}"
          fill="white" fill-opacity="0.4"/>

        <!-- Top ellipse (in front, drawn last) -->
        <ellipse cx="${cylCx}" cy="${cylTop}" rx="${cylRx}" ry="${cylRy}"
          fill="url(#manifold-cap-top)"
          stroke="#06b6d4" stroke-opacity="0.3" stroke-width="1"/>

        <!-- Z label -->
        <text x="${cylCx + cylRx + 6}" y="${cylTop + 4}" font-size="9" font-family="monospace"
          fill="#06b6d4" opacity="0.6">Z</text>
      </svg>`;
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

      // Determine height — axis_3d cylinder is taller
      const isAxis3dZ = ds.hudType === 'axis_3d' && (controller.modifier === 'shift' || controller.modifier === 'shiftCtrl');
      const hudH = isAxis3dZ ? HUD_SIZE + 40 : HUD_SIZE;

      // Position centered at drag origin
      const ox = ds.startX;
      const oy = ds.startY;
      portal.style.left = `${ox - HUD_HALF}px`;
      portal.style.top = `${oy - hudH / 2}px`;
      portal.style.width = `${HUD_SIZE}px`;
      portal.style.height = `${hudH}px`;

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
