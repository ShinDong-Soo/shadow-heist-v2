export type ExplorationCell = { id: number; x: number; y: number };

export function createExplorationCells(worldWidth: number, worldHeight: number, cellSize = 60): ExplorationCell[] {
  const cells: ExplorationCell[] = [];
  const columns = Math.ceil(worldWidth / cellSize);
  const rows = Math.ceil(worldHeight / cellSize);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      cells.push({ id: row * columns + column, x: column * cellSize + cellSize / 2, y: row * cellSize + cellSize / 2 });
    }
  }
  return cells;
}

export function exploredPercent(exploredCount: number, totalCount: number) {
  if (totalCount <= 0) return 0;
  return Math.round(exploredCount / totalCount * 100);
}
