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

  function buildAxis3dTilt(dx: number, dy: number, modifier: string): string {
    // The original CSS-perspective version: flat circle tilts back when Shift is held
    const cx = HUD_HALF;
    const cy = HUD_HALF;
    const r = HUD_HALF - 4;
    const isZMode = modifier === 'shift' || modifier === 'shiftCtrl';
    const tiltAngle = isZMode ? 55 : 0;

    if (!isZMode) {
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
      const maxTravel = r - 6;
      const dotOffset = Math.max(-maxTravel, Math.min(maxTravel, -dy * 0.5));
      const dotY = cy + dotOffset;

      return `<div style="transform: perspective(200px) rotateX(${tiltAngle}deg); transition: transform 0.25s ease;">
        <svg width="${HUD_SIZE}" height="${HUD_SIZE}" viewBox="0 0 ${HUD_SIZE} ${HUD_SIZE}">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
            stroke="var(--manifold-hud-border, #2d2640)" stroke-width="1.5"/>
          <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"
            stroke="var(--manifold-hud-border, #2d2640)" stroke-width="1" stroke-dasharray="4,4"/>
          <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}"
            stroke="var(--manifold-hud-accent, #06b6d4)" stroke-width="0.8" stroke-dasharray="3,3" opacity="0.6"/>
          <circle cx="${cx}" cy="${dotY}" r="5"
            fill="var(--manifold-hud-accent, #06b6d4)"/>
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

  const WHEEL_SIZE = 160;
  const WHEEL_HALF = WHEEL_SIZE / 2;
  const WHEEL_RADIUS = WHEEL_HALF - 8;

  function getCurrentAlpha(): number {
    // Try to read alpha from the active group's values
    const gid = controller.dragState.groupId;
    if (!gid) return 1;
    const vals = controller.values[gid];
    if (vals && 'a' in vals) return vals.a;
    return 1;
  }

  function buildColorWheel(dx: number, dy: number, modifier: string): string {
    const cx = WHEEL_HALF;
    const cy = WHEEL_HALF;
    const r = WHEEL_RADIUS;
    const isAlpha = modifier === 'shift';
    const isRefine = modifier === 'ctrl' || modifier === 'shiftCtrl';

    // Current position on wheel (dx/dy are pixels from drag origin)
    const dist = Math.sqrt(dx * dx + dy * dy);
    // atan2(dx, -dy) gives clockwise-from-top angle, matching CSS conic-gradient
    const angle = Math.atan2(dx, -dy);
    const hue = ((angle * 180 / Math.PI) + 360) % 360;
    const sat = Math.min(100, (dist / r) * 100);

    if (isRefine) {
      // REFINE MODE: locked hue → saturation/brightness square
      // The square shows the locked hue with:
      //   X axis: saturation (left=0, right=100)
      //   Y axis: lightness (top=100/bright, bottom=0/dark)
      const sqSize = WHEEL_SIZE - 16;
      const sqX = 8;
      const sqY = 8;

      // Map dx/dy to position in square
      const normX = Math.max(0, Math.min(1, 0.5 + dx / (sqSize * 2)));
      const normY = Math.max(0, Math.min(1, 0.5 + dy / (sqSize * 2)));
      const dotX = sqX + normX * sqSize;
      const dotY = sqY + normY * sqSize;

      // Build the hue-specific color for the gradient
      const hueColor = `hsl(${Math.round(hue)}, 100%, 50%)`;

      return `<div style="
        width: ${WHEEL_SIZE}px; height: ${WHEEL_SIZE}px;
        border-radius: 8px; overflow: hidden; position: relative;
        border: 1px solid rgba(255,255,255,0.15);
        transition: border-radius 0.2s;
      ">
        <!-- Saturation gradient: white to hue color -->
        <div style="
          position: absolute; inset: 0;
          background: linear-gradient(to right, white, ${hueColor});
        "></div>
        <!-- Brightness gradient: transparent to black -->
        <div style="
          position: absolute; inset: 0;
          background: linear-gradient(to bottom, transparent, black);
        "></div>
        <!-- Crosshair -->
        <svg style="position: absolute; inset: 0;" width="${WHEEL_SIZE}" height="${WHEEL_SIZE}">
          <line x1="${dotX}" y1="0" x2="${dotX}" y2="${WHEEL_SIZE}"
            stroke="rgba(255,255,255,0.4)" stroke-width="0.5"/>
          <line x1="0" y1="${dotY}" x2="${WHEEL_SIZE}" y2="${dotY}"
            stroke="rgba(255,255,255,0.4)" stroke-width="0.5"/>
          <circle cx="${dotX}" cy="${dotY}" r="6" fill="none"
            stroke="white" stroke-width="1.5"/>
          <circle cx="${dotX}" cy="${dotY}" r="5" fill="none"
            stroke="black" stroke-width="0.5"/>
        </svg>
      </div>`;

    } else if (isAlpha) {
      // ALPHA MODE: checkerboard + color overlay with opacity slider
      // Map dy to alpha: dragging up = more opaque, down = more transparent
      // Use WHEEL_SIZE as the full range so a full-height drag = full alpha range
      // 80px drag = full range, matching handler sensitivity
      const alphaLevel = Math.max(0, Math.min(1, 0.5 - dy / 80));
      const barH = WHEEL_SIZE - 16;
      const barX = WHEEL_SIZE - 24;
      const thumbY = 8 + (1 - alphaLevel) * barH;

      return `<div style="
        width: ${WHEEL_SIZE}px; height: ${WHEEL_SIZE}px;
        position: relative;
      ">
        <!-- Wheel (dimmed) -->
        <div style="
          width: ${WHEEL_SIZE - 32}px; height: ${WHEEL_SIZE - 32}px;
          margin: 8px; border-radius: 50%;
          background: conic-gradient(
            hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%),
            hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%)
          );
          opacity: ${0.3 + alphaLevel * 0.5};
          transition: opacity 0.1s;
          position: relative;
        ">
          <div style="
            position: absolute; inset: 15%;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,255,255,0.9) 0%, transparent 70%);
          "></div>
          <!-- Checkerboard pattern underneath -->
        </div>
        <!-- Alpha slider bar -->
        <svg style="position: absolute; right: 0; top: 0;" width="24" height="${WHEEL_SIZE}">
          <!-- Checkerboard background for slider -->
          <defs>
            <pattern id="manifold-checker" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="#999"/>
              <rect x="4" y="4" width="4" height="4" fill="#999"/>
              <rect x="4" width="4" height="4" fill="#666"/>
              <rect y="4" width="4" height="4" fill="#666"/>
            </pattern>
          </defs>
          <rect x="6" y="8" width="12" height="${barH}" rx="6" fill="url(#manifold-checker)"/>
          <rect x="6" y="8" width="12" height="${barH}" rx="6"
            fill="linear-gradient(to bottom, rgba(255,255,255,1), rgba(255,255,255,0))"
            opacity="0.8"/>
          <!-- Thumb -->
          <circle cx="12" cy="${thumbY}" r="6"
            fill="white" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>
          <!-- Label -->
          <text x="12" y="${WHEEL_SIZE - 2}" text-anchor="middle"
            font-size="7" font-family="monospace" fill="rgba(255,255,255,0.5)">
            ${Math.round(alphaLevel * 100)}%
          </text>
        </svg>
      </div>`;

    } else {
      // BASE MODE: HSL color wheel
      // Dot tracks mouse position directly, clamped to circle
      const maxDist = r - 4;
      const clampScale = dist > maxDist ? maxDist / (dist || 1) : 1;
      const dotX = cx + dx * clampScale;
      const dotY = cy + dy * clampScale;

      const alpha = getCurrentAlpha();

      return `<div style="
        width: ${WHEEL_SIZE}px; height: ${WHEEL_SIZE}px;
        position: relative;
      ">
        <!-- Checkerboard behind wheel to show alpha -->
        ${alpha < 1 ? `<div style="
          position: absolute;
          width: ${r * 2}px; height: ${r * 2}px;
          left: ${WHEEL_HALF - r}px; top: ${WHEEL_HALF - r}px;
          border-radius: 50%; overflow: hidden;
          background: repeating-conic-gradient(#444 0% 25%, #666 0% 50%) 50% / 12px 12px;
        "></div>` : ''}
        <!-- Color wheel -->
        <div style="
          width: ${r * 2}px; height: ${r * 2}px;
          margin: ${WHEEL_HALF - r}px;
          border-radius: 50%;
          background: conic-gradient(
            hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%),
            hsl(90,100%,50%), hsl(120,100%,50%), hsl(150,100%,50%),
            hsl(180,100%,50%), hsl(210,100%,50%), hsl(240,100%,50%),
            hsl(270,100%,50%), hsl(300,100%,50%), hsl(330,100%,50%),
            hsl(360,100%,50%)
          );
          opacity: ${alpha};
          position: relative;
          border: 1px solid rgba(255,255,255,0.15);
        ">
          <!-- White-to-transparent radial for saturation -->
          <div style="
            position: absolute; inset: 0;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,255,255,0.85) 0%, transparent 70%);
          "></div>
        </div>
        <!-- Crosshair dot -->
        <svg style="position: absolute; inset: 0;" width="${WHEEL_SIZE}" height="${WHEEL_SIZE}">
          <circle cx="${dotX}" cy="${dotY}" r="6" fill="none"
            stroke="white" stroke-width="1.5" filter="drop-shadow(0 0 2px rgba(0,0,0,0.5))"/>
          <circle cx="${dotX}" cy="${dotY}" r="5" fill="none"
            stroke="black" stroke-width="0.5"/>
          <circle cx="${dotX}" cy="${dotY}" r="2"
            fill="hsl(${Math.round(hue)}, ${Math.round(sat)}%, 50%)"/>
        </svg>
      </div>`;
    }
  }

  $effect(() => {
    if (!portal) return;
    const ds = controller.dragState;
    // Read modifier eagerly to ensure Svelte tracks it as a dependency
    const mod = controller.modifier;

    if (ds.active && ds.hudType !== null) {
      portal.style.display = 'block';

      // Determine size — some HUDs are larger
      const isAxis3dZ = ds.hudType === 'axis_3d' && (mod === 'shift' || mod === 'shiftCtrl');
      const isWheel = ds.hudType === 'color_wheel';
      const hudW = isWheel ? WHEEL_SIZE : HUD_SIZE;
      const hudH = isAxis3dZ ? HUD_SIZE + 40 : (isWheel ? WHEEL_SIZE : HUD_SIZE);
      const hudHalfW = hudW / 2;

      // Position centered at drag origin
      const ox = ds.startX;
      const oy = ds.startY;
      portal.style.left = `${ox - hudHalfW}px`;
      portal.style.top = `${oy - hudH / 2}px`;
      portal.style.width = `${hudW}px`;
      portal.style.height = `${hudH}px`;

      let html = '';
      switch (ds.hudType) {
        case 'axis_2d':
          html = buildAxis2d(ds.dragDx, ds.dragDy);
          break;
        case 'axis_3d':
          html = buildAxis3d(ds.dragDx, ds.dragDy, mod);
          break;
        case 'axis_3d_tilt':
          html = buildAxis3dTilt(ds.dragDx, ds.dragDy, mod);
          break;
        case 'slider_1d':
          html = buildSlider1d(ds.dragDx, ds.dragDy);
          break;
        case 'dial':
          html = buildDial(ds.dragDx, ds.dragDy);
          break;
        case 'color_wheel':
          html = buildColorWheel(ds.dragDx, ds.dragDy, mod);
          break;
      }

      portal.innerHTML = html;
    } else {
      portal.style.display = 'none';
      portal.innerHTML = '';
    }
  });
</script>
