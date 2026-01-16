import {
  ClueCard,
  ClueType,
  CaseCard,
  CaseRequirement,
  GameConfig,
  GameState,
  PlayerState,
  PlayerId,
} from './models'

export class ColdCaseGame {
  state: GameState;

  constructor(id: string, playerIds: PlayerId[], clueDeck: ClueCard[], caseDeck: CaseCard[]) {
    if (playerIds.length < 1 || playerIds.length > 4) {
      throw new Error("Game supports 1-4 players in demo (spec is 2-4);");
    }
    const players: PlayerState[] = playerIds.map((pid) => ({
      id: pid,
      hand: [],
      bankedCaseIds: [],
      bankedClues: [],
      score: 0,
      turnsTaken: 0,
    }));

    this.state = {
      id,
      players,
      turnOrder: playerIds.slice(),
      currentPlayerIndex: 0,
      clueDeck: clueDeck.slice(),
      caseDeck: caseDeck.slice(),
      faceUpCases: [],
      discardPile: [],
      isFinished: false,
      config: { startingHandSize: 3, maxHandSize: 7 },
    };
  }

  static shuffle<T>(arr: T[], rng = Math.random): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  static createClueDeck(namesByType: Record<ClueType, string[]>): ClueCard[] {
    const deck: ClueCard[] = [];
    for (const type of Object.values(ClueType)) {
      const names = namesByType[type as ClueType];
      if (!names || names.length !== 8) {
        throw new Error(`Expected 8 names for type ${type}`);
      }
      for (const name of names) {
        for (const v of [1, 2, 3] as (1 | 2 | 3)[]) {
          deck.push({
            id: `${type}_${name}_${v}_${Math.random().toString(36).slice(2, 9)}`,
            type: type as ClueType,
            name,
            bankValue: v,
          });
        }
      }
    }
    if (deck.length !== 72) throw new Error("Clue deck must be 72 cards");
    return deck;
  }

  // Additional methods...
}