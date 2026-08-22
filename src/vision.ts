export type VisionPoint = { x: number; y: number };
export type VisionRect = { x: number; y: number; w: number; h: number };

function segmentIntersectsRect(a: VisionPoint, b: VisionPoint, rect: VisionRect) {
  const edges: [VisionPoint, VisionPoint][] = [
    [{ x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y }],
    [{ x: rect.x + rect.w, y: rect.y }, { x: rect.x + rect.w, y: rect.y + rect.h }],
    [{ x: rect.x + rect.w, y: rect.y + rect.h }, { x: rect.x, y: rect.y + rect.h }],
    [{ x: rect.x, y: rect.y + rect.h }, { x: rect.x, y: rect.y }],
  ];
  return edges.some(([c, d]) => {
    const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(denominator) < .001) return false;
    const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denominator;
    const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / denominator;
    return t > .001 && t < .999 && u >= 0 && u <= 1;
  });
}

export function hasVisionLine(a: VisionPoint, b: VisionPoint, obstacles: VisionRect[]) {
  return !obstacles.some(rect => segmentIntersectsRect(a, b, rect));
}

export function castVisionRay(origin: VisionPoint, angle: number, maxRange: number, obstacles: VisionRect[]): VisionPoint {
  const steps = Math.ceil(maxRange / 5);
  for (let i = 1; i <= steps; i++) {
    const distance = i * 5;
    const x = origin.x + Math.cos(angle) * distance;
    const y = origin.y + Math.sin(angle) * distance;
    if (obstacles.some(rect => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h)) return { x, y };
  }
  return { x: origin.x + Math.cos(angle) * maxRange, y: origin.y + Math.sin(angle) * maxRange };
}
