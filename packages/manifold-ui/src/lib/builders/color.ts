// Color conversion utilities for manifold-ui
// All values normalized: RGB 0-255, H 0-360, S/L 0-100, A 0-1, CMYK 0-100

export interface RGB { r: number; g: number; b: number; }
export interface RGBA extends RGB { a: number; }
export interface HSL { h: number; s: number; l: number; }
export interface HSLA extends HSL { a: number; }
export interface CMYK { c: number; m: number; y: number; k: number; }

// --- RGB <-> HSL ---

export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  h /= 360; s /= 100; l /= 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255)
  };
}

// --- RGB <-> Hex ---

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  if (a >= 1) return rgbToHex(r, g, b);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a * 255)}`;
}

export function hexToRgb(hex: string): RGB | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16)
    };
  }
  if (clean.length >= 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }
  return null;
}

export function hexToRgba(hex: string): RGBA | null {
  const clean = hex.replace('#', '');
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  let a = 1;
  if (clean.length === 8) {
    a = parseInt(clean.slice(6, 8), 16) / 255;
  }
  return { ...rgb, a };
}

// --- RGB <-> CMYK ---

export function rgbToCmyk(r: number, g: number, b: number): CMYK {
  r /= 255; g /= 255; b /= 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - r - k) / (1 - k)) * 100),
    m: Math.round(((1 - g - k) / (1 - k)) * 100),
    y: Math.round(((1 - b - k) / (1 - k)) * 100),
    k: Math.round(k * 100)
  };
}

export function cmykToRgb(c: number, m: number, y: number, k: number): RGB {
  c /= 100; m /= 100; y /= 100; k /= 100;
  return {
    r: Math.round(255 * (1 - c) * (1 - k)),
    g: Math.round(255 * (1 - m) * (1 - k)),
    b: Math.round(255 * (1 - y) * (1 - k))
  };
}

// --- Angle / position helpers for the color wheel ---

/** Convert XY offset from center to hue (degrees) and saturation (0-100).
 *  Uses clockwise-from-top convention matching CSS conic-gradient. */
export function xyToHueSat(dx: number, dy: number, radius: number): { h: number; s: number } {
  const angle = Math.atan2(dx, -dy); // clockwise from top
  const h = (angle * 180 / Math.PI + 360) % 360;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const s = Math.min(100, (dist / radius) * 100);
  return { h: Math.round(h), s: Math.round(s) };
}

/** Convert hue (degrees) and saturation (0-100) to XY offset from center.
 *  Uses clockwise-from-top convention matching CSS conic-gradient. */
export function hueSatToXy(h: number, s: number, radius: number): { x: number; y: number } {
  const angle = (h * Math.PI) / 180;
  const dist = (s / 100) * radius;
  return {
    x: Math.sin(angle) * dist,   // clockwise from top
    y: -Math.cos(angle) * dist   // top = negative y in screen coords
  };
}
