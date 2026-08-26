export type InteractionCandidate = {
  id: string;
  available: boolean;
  label: string;
  priority: number;
};

export class InteractionSystem {
  selected: InteractionCandidate | null = null;

  update(candidates: InteractionCandidate[]) {
    this.selected = candidates
      .filter(candidate => candidate.available)
      .sort((a, b) => b.priority - a.priority)[0] ?? null;
  }

  reset() {
    this.selected = null;
  }

  isSelected(id: string) {
    return this.selected?.id === id;
  }

  get available() {
    return this.selected !== null;
  }

  get label() {
    return this.selected?.label ?? '';
  }
}

