export type CharacterAsset = {
  image: HTMLImageElement;
  path: string;
};

export type CharacterDirection = 'south' | 'west' | 'east' | 'north';

type SpriteFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CharacterSpriteSheet = CharacterAsset & {
  columns: 4;
  rows: 4;
  frames: Record<CharacterDirection, readonly SpriteFrame[]>;
  renderHeightRatio: number;
  footInsetRatio: number;
  fixedGrid?: { contentHeight: number; groundY: number };
  mirrorWestFromEast?: boolean;
};

function loadCharacter(path: string): CharacterAsset {
  const image = new Image();
  image.decoding = 'async';
  image.src = path;
  return { image, path };
}

const characterAssetPath = (filename: string) => `${import.meta.env.BASE_URL}assets/characters/${filename}`;

const fixedGridRow = (row: number): readonly SpriteFrame[] => [0, 1, 2, 3].map(column => ({
  x: column * 256,
  y: row * 256,
  width: 256,
  height: 256,
}));

// The v4 player sheet is normalized to fixed 256px cells. Every figure has
// the same 212px content height and a shared ground baseline at source y=238.
const playerWalkFrames: Record<CharacterDirection, readonly SpriteFrame[]> = {
  south: fixedGridRow(0),
  west: fixedGridRow(1),
  east: fixedGridRow(2),
  north: fixedGridRow(3),
};

const guardWalkFrames: Record<CharacterDirection, readonly SpriteFrame[]> = {
  south: [
    { x: 106, y: 15, width: 128, height: 234 },
    { x: 334, y: 15, width: 131, height: 234 },
    { x: 559, y: 16, width: 133, height: 233 },
    { x: 780, y: 16, width: 134, height: 233 },
  ],
  west: [
    { x: 107, y: 265, width: 121, height: 229 },
    { x: 335, y: 266, width: 124, height: 224 },
    { x: 559, y: 266, width: 116, height: 224 },
    { x: 783, y: 265, width: 105, height: 232 },
  ],
  east: [
    { x: 105, y: 514, width: 109, height: 219 },
    { x: 348, y: 515, width: 94, height: 218 },
    { x: 560, y: 515, width: 113, height: 218 },
    { x: 794, y: 514, width: 93, height: 219 },
  ],
  north: [
    { x: 102, y: 752, width: 127, height: 245 },
    { x: 336, y: 752, width: 124, height: 242 },
    { x: 560, y: 752, width: 124, height: 242 },
    { x: 777, y: 752, width: 122, height: 234 },
  ],
};

export const characterAssets = {
  player: loadCharacter(characterAssetPath('stealth-thief.png')),
  guard: loadCharacter(characterAssetPath('museum-guard.png')),
  playerWalk: {
    ...loadCharacter(characterAssetPath('stealth-thief-walk-4x4-v4.png')),
    columns: 4,
    rows: 4,
    frames: playerWalkFrames,
    renderHeightRatio: 0.9,
    footInsetRatio: 0.04,
    fixedGrid: { contentHeight: 212, groundY: 238 },
    mirrorWestFromEast: true,
  } satisfies CharacterSpriteSheet,
  guardWalk: {
    ...loadCharacter(characterAssetPath('museum-guard-walk-4x4.png')),
    columns: 4,
    rows: 4,
    frames: guardWalkFrames,
    renderHeightRatio: 0.9,
    footInsetRatio: 0.04,
  } satisfies CharacterSpriteSheet,
};

export function isCharacterReady(asset: CharacterAsset) {
  return asset.image.complete && asset.image.naturalWidth > 0;
}

export function directionFromAngle(angle: number): CharacterDirection {
  const horizontal = Math.cos(angle);
  const vertical = Math.sin(angle);
  if (Math.abs(horizontal) > Math.abs(vertical)) return horizontal < 0 ? 'west' : 'east';
  return vertical < 0 ? 'north' : 'south';
}

export function drawCharacterFrame(
  context: CanvasRenderingContext2D,
  sheet: CharacterSpriteSheet,
  direction: CharacterDirection,
  frame: number,
  destination: { x: number; y: number; width: number; height: number },
) {
  const safeFrame = Math.max(0, Math.min(sheet.columns - 1, Math.floor(frame)));
  const mirrored = Boolean(sheet.mirrorWestFromEast && direction === 'west');
  const sourceDirection = mirrored ? 'east' : direction;
  const source = sheet.frames[sourceDirection][safeFrame];
  const renderHeight = destination.height * sheet.renderHeightRatio;
  const scale = renderHeight / (sheet.fixedGrid?.contentHeight ?? source.height);
  const renderWidth = source.width * scale;
  const footY = destination.y + destination.height * (1 - sheet.footInsetRatio);
  const renderY = sheet.fixedGrid ? footY - sheet.fixedGrid.groundY * scale : footY - renderHeight;
  if (mirrored) {
    context.save();
    const centerX = destination.x + destination.width / 2;
    context.translate(centerX * 2, 0);
    context.scale(-1, 1);
  }
  context.drawImage(
    sheet.image,
    source.x,
    source.y,
    source.width,
    source.height,
    destination.x + (destination.width - renderWidth) / 2,
    renderY,
    renderWidth,
    source.height * scale,
  );
  if (mirrored) context.restore();
}
