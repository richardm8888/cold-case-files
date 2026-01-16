export type PlayerId = string;

export enum ClueType {
  Evidence = "Evidence",
  Suspect = "Suspect",
  Location = "Location",
}

export interface ClueCard {
  id: string; // unique id
  type: ClueType;
  name: string; // specific identifier e.g. "Bloody Knife"
  bankValue: 1 | 2 | 3;
}

export type RequirementAny = {
  kind: "Any";
  type: ClueType;
};

export type RequirementSpecific = {
  kind: "Specific";
  type: ClueType;
  name: string;
};

export type CaseRequirement = RequirementAny | RequirementSpecific;

export interface CaseCard {
  id: string;
  requirements: CaseRequirement[]; // length 2 or 3
}

export interface PlayerState {
  id: PlayerId;
  name?: string;
  hand: ClueCard[];
  bankedCaseIds: string[];
  bankedClues: ClueCard[];
  score: number;
  turnsTaken: number;
}

export interface GameConfig {
  startingHandSize: number; // 3
  maxHandSize: number; // 7
}

export interface GameState {
  id: string;
  players: PlayerState[];
  turnOrder: PlayerId[];
  currentPlayerIndex: number;
  clueDeck: ClueCard[];
  caseDeck: CaseCard[];
  faceUpCases: CaseCard[];
  discardPile: ClueCard[];
  isFinished: boolean;
  config: GameConfig;
}
