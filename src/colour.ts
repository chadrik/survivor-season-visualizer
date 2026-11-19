/*
 * survivoR tribe colours are the real buff colours, some very light (Pagong
 * is pure yellow). Lines and label text need contrast on a white card, so
 * light colours are darkened for strokes and labels pick dark or light text.
 */

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0) as [number, number, number];
}

/* WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const toHex = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');

/* Darken until the colour has at least 3:1 contrast against white (luminance <= ~0.30). */
export function strokeColour(hex: string): string {
  let [r, g, b] = rgb(hex);
  for (let i = 0; i < 20 && luminance(`#${toHex(r)}${toHex(g)}${toHex(b)}`) > 0.3; i++) {
    r *= 0.9; g *= 0.9; b *= 0.9;
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/* Text colour for a label drawn on this colour. */
export const textOn = (hex: string): string => (luminance(hex) > 0.45 ? '#1b1f24' : '#ffffff');
