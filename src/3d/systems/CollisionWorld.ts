export type CollisionBox = { minX: number; maxX: number; minZ: number; maxZ: number };

export type CircleMoveResult = {
  x: number;
  z: number;
  blockedX: boolean;
  blockedZ: boolean;
};

export function moveCircleWithSliding(
  startX: number,
  startZ: number,
  deltaX: number,
  deltaZ: number,
  radius: number,
  collisionBoxes: CollisionBox[],
): CircleMoveResult {
  const distance = Math.hypot(deltaX, deltaZ);
  const stepCount = Math.max(1, Math.ceil(distance / (radius * .45)));
  const stepX = deltaX / stepCount;
  const stepZ = deltaZ / stepCount;
  let x = startX;
  let z = startZ;
  let blockedX = false;
  let blockedZ = false;

  for (let step = 0; step < stepCount; step += 1) {
    const safeX = findSafeAxisPosition(x, stepX, z, true, radius, collisionBoxes);
    blockedX ||= Math.abs(safeX - (x + stepX)) > .00001;
    x = safeX;

    const safeZ = findSafeAxisPosition(z, stepZ, x, false, radius, collisionBoxes);
    blockedZ ||= Math.abs(safeZ - (z + stepZ)) > .00001;
    z = safeZ;
  }

  return { x, z, blockedX, blockedZ };
}

function findSafeAxisPosition(
  start: number,
  delta: number,
  fixedAxis: number,
  moveX: boolean,
  radius: number,
  collisionBoxes: CollisionBox[],
) {
  if (Math.abs(delta) < .000001) return start;

  const overlapsAt = (value: number) => collisionBoxes.some(box => (
    moveX
      ? circleOverlapsBox(value, fixedAxis, radius, box)
      : circleOverlapsBox(fixedAxis, value, radius, box)
  ));
  const target = start + delta;
  if (!overlapsAt(target)) return target;

  let safeRatio = 0;
  let blockedRatio = 1;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const middleRatio = (safeRatio + blockedRatio) * .5;
    if (overlapsAt(start + delta * middleRatio)) blockedRatio = middleRatio;
    else safeRatio = middleRatio;
  }
  return start + delta * safeRatio;
}

function circleOverlapsBox(x: number, z: number, radius: number, box: CollisionBox) {
  const closestX = Math.max(box.minX, Math.min(x, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
  const dx = x - closestX;
  const dz = z - closestZ;
  return dx * dx + dz * dz < radius * radius;
}
