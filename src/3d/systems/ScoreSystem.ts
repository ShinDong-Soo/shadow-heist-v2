import type { RunSnapshot } from './RunStats';

export type HeistRank = 'S' | 'A' | 'B' | 'C';
export type ScoreResult = RunSnapshot & {
  score: number;
  maxScore: number;
  rank: HeistRank;
  perfect: boolean;
  newBest: boolean;
  bestScore: number;
  bestTime: number | null;
};

const STORAGE_KEY = 'shadow-heist-v2-best-v1';
const LOOT_SCORE: Record<string, number> = {
  'antique-watch': 1000,
  'royal-document': 2000,
  'diamond-brooch': 3000,
};

export class ScoreSystem {
  static readonly maxScore = 21000;

  calculate(run: RunSnapshot): Omit<ScoreResult, 'newBest' | 'bestScore' | 'bestTime'> {
    const lootScore = run.collectedLootIds.reduce((sum, id) => sum + (LOOT_SCORE[id] ?? 0), 0);
    const stealthScore = run.detectedCount === 0 ? 5000 : run.detectedCount === 1 ? 3000 : run.detectedCount === 2 ? 1500 : 0;
    const timeScore = run.elapsedSeconds < 300 ? 2000 : run.elapsedSeconds < 420 ? 1000 : run.elapsedSeconds < 600 ? 500 : 0;
    const score = (run.crownSecured ? 10000 : 0) + lootScore + stealthScore + timeScore;
    const ratio = score / ScoreSystem.maxScore;
    const rank: HeistRank = ratio >= .9 ? 'S' : ratio >= .75 ? 'A' : ratio >= .55 ? 'B' : 'C';
    return {
      ...run,
      score,
      maxScore: ScoreSystem.maxScore,
      rank,
      perfect: run.crownSecured && run.collectedLootIds.length === 3 && run.detectedCount === 0,
    };
  }

  saveBest(run: RunSnapshot): ScoreResult {
    const result = this.calculate(run);
    const previous = this.readBest();
    const newBest = result.score > previous.bestScore;
    const bestScore = Math.max(previous.bestScore, result.score);
    const bestTime = previous.bestTime === null ? result.elapsedSeconds : Math.min(previous.bestTime, result.elapsedSeconds);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ bestScore, bestTime, bestRank: newBest ? result.rank : previous.bestRank }));
    } catch {
      // Storage can be unavailable in private or restricted browsing. Results still work.
    }
    return { ...result, newBest, bestScore, bestTime };
  }

  private readBest(): { bestScore: number; bestTime: number | null; bestRank: HeistRank | null } {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<{ bestScore: number; bestTime: number; bestRank: HeistRank }>;
      return {
        bestScore: Number.isFinite(value.bestScore) ? value.bestScore! : 0,
        bestTime: Number.isFinite(value.bestTime) ? value.bestTime! : null,
        bestRank: value.bestRank ?? null,
      };
    } catch {
      return { bestScore: 0, bestTime: null, bestRank: null };
    }
  }
}

export function formatRunTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}
