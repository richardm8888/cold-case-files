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

/**
 * Full game engine implementing the Cold Case Files rules.
 */
export class ColdCaseGame {
    state: GameState;

    constructor(id: string, playerIds: PlayerId[], clueDeck: ClueCard[], caseDeck: CaseCard[]) {
        if (playerIds.length < 1 || playerIds.length > 4) {
            throw new Error('Game supports 1-4 players');
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
            currentTurnAction: "none",
            clueDeck: clueDeck.slice(),
            caseDeck: caseDeck.slice(),
            faceUpCases: [],
            discardPile: [],
            isFinished: false,
            config: { startingHandSize: 3, maxHandSize: 7 },
        };
    }

    // Utility: Fisher-Yates
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
        if (deck.length !== 72) throw new Error('Clue deck must be 72 cards');
        return deck;
    }

    static casePoints(c: CaseCard): number {
        let points = 0;
        for (const r of c.requirements) {
            points += r.kind === 'Any' ? 2 : 5;
        }
        return points;
    }

    static validateCaseDeck(caseDeck: CaseCard[]) {
        for (const c of caseDeck) {
            if (c.requirements.every((r) => r.kind === 'Specific')) {
                throw new Error(`Case ${c.id} invalid: all requirements specific`);
            }
            if (c.requirements.length < 2 || c.requirements.length > 3) {
                throw new Error(`Case ${c.id} must have 2 or 3 requirements`);
            }
        }
    }

    setup(seedRng?: () => number) {
        // Validate case deck before setup
        ColdCaseGame.validateCaseDeck(this.state.caseDeck);

        if (seedRng) {
            this.state.clueDeck = ColdCaseGame.shuffle(this.state.clueDeck, seedRng);
            this.state.caseDeck = ColdCaseGame.shuffle(this.state.caseDeck, seedRng);
        } else {
            this.state.clueDeck = ColdCaseGame.shuffle(this.state.clueDeck);
            this.state.caseDeck = ColdCaseGame.shuffle(this.state.caseDeck);
        }

        // Reveal 4 cases face-up (if available)
        this.state.faceUpCases = [];
        for (let i = 0; i < 4; i++) {
            const c = this.state.caseDeck.shift();
            if (c) this.state.faceUpCases.push(c);
        }

        // Deal starting hands (startingHandSize per config)
        for (let i = 0; i < this.state.config.startingHandSize; i++) {
            for (const p of this.state.players) {
                const card = this.state.clueDeck.shift();
                if (card) p.hand.push(card);
            }
        }
    }

    private currentPlayer(): PlayerState {
        return this.state.players[this.state.currentPlayerIndex];
    }

    private findPlayer(pid: PlayerId): PlayerState {
        const p = this.state.players.find((x) => x.id === pid);
        if (!p) throw new Error(`Player ${pid} not found`);
        return p;
    }

    // Action 1: Bank a clue card (consumes turn).
    // Hand indices are validated server-side at time of call.
    bankClue(playerId: PlayerId, handIndex: number) {
        const player = this.findPlayer(playerId);
        if (this.currentPlayer().id !== playerId) {
            throw new Error("Not this player's turn");
        }

        if (this.state.currentTurnAction === "draw") {
            throw new Error("Cannot bank after drawing - must solve a case or end turn");
        }
        if (this.state.currentTurnAction !== "none") {
            throw new Error("Action already taken this turn");
        }

        if (handIndex < 0 || handIndex >= player.hand.length) {
            throw new Error('Invalid hand index');
        }

        const card = player.hand.splice(handIndex, 1)[0];
        player.bankedClues.push(card);
        player.score += card.bankValue;
        this.state.currentTurnAction = "bank";
        player.turnsTaken += 1;

        this.advanceTurnIfNeeded();
    }

    // Action 2: Solve a case (consumes turn).
    solveCase(playerId: PlayerId, caseId: string, usedHandIndices: number[]) {
        const player = this.findPlayer(playerId);
        if (this.currentPlayer().id !== playerId) {
            throw new Error("Not this player's turn");
        }

        if (this.state.currentTurnAction !== "none" && this.state.currentTurnAction !== "draw") {
            throw new Error("Action already taken this turn");
        }

        const faceIdx = this.state.faceUpCases.findIndex((c) => c.id === caseId);
        if (faceIdx === -1) throw new Error('Case not face-up or not available');
        const caseCard = this.state.faceUpCases[faceIdx];

        // Ensure used indices are valid, unique, and correspond to cards in player's hand
        const uniqueIdx = Array.from(new Set(usedHandIndices));
        if (uniqueIdx.length !== usedHandIndices.length) {
            throw new Error('Duplicate hand indices');
        }
        if (uniqueIdx.some((i) => i < 0 || i >= player.hand.length)) {
            throw new Error('Invalid hand index');
        }
        const usedCards = uniqueIdx.map((i) => player.hand[i]);

        // Match requirements: specific requirements must match specific name & type, Any matches by type.
        // Order-insensitive. Greedy: match specific first, then Any.
        const reqsRemaining = caseCard.requirements.slice();
        const matched = new Array<boolean>(usedCards.length).fill(false);

        // Specific requirements
        for (let ri = reqsRemaining.length - 1; ri >= 0; ri--) {
            const r = reqsRemaining[ri];
            if (r.kind === 'Specific') {
                let found = false;
                for (let ci = 0; ci < usedCards.length; ci++) {
                    if (matched[ci]) continue;
                    const card = usedCards[ci];
                    if (card.type === r.type && card.name === r.name) {
                        matched[ci] = true;
                        found = true;
                        break;
                    }
                }
                if (!found) throw new Error('Requirements not satisfied: missing specific requirement');
                reqsRemaining.splice(ri, 1);
            }
        }

        // Any requirements: each needs any card of that type
        for (const r of reqsRemaining) {
            if (r.kind !== 'Any') throw new Error('Unexpected remaining specific requirement');
        }
        for (const r of reqsRemaining) {
            let found = false;
            for (let ci = 0; ci < usedCards.length; ci++) {
                if (matched[ci]) continue;
                const card = usedCards[ci];
                if (card.type === r.type) {
                    matched[ci] = true;
                    found = true;
                    break;
                }
            }
            if (!found) throw new Error('Requirements not satisfied: missing any-type requirement');
        }

        // All requirements matched. Remove used cards from player's hand and move to discard (score 0).
        // Remove using descending indices to avoid shifting problems.
        const indicesSorted = uniqueIdx.slice().sort((a, b) => b - a);
        for (const idx of indicesSorted) {
            const c = player.hand.splice(idx, 1)[0];
            if (c) this.state.discardPile.push(c);
        }

        // Award case to player's bank and add points.
        player.bankedCaseIds.push(caseCard.id);
        const pts = ColdCaseGame.casePoints(caseCard);
        player.score += pts;

        // Replace solved case immediately (if available)
        this.state.faceUpCases.splice(faceIdx, 1);
        const replacement = this.state.caseDeck.shift();
        if (replacement) {
            this.state.faceUpCases.push(replacement);
        }

        this.state.currentTurnAction = "solve";
        player.turnsTaken += 1;
        this.advanceTurnIfNeeded();
    }

    // Action 3: Draw a clue (consumes turn unless the player immediately solves after drawing).
    // Returns the drawn card. If hand exceeds max, caller must resolve overage.
    drawClue(playerId: PlayerId): ClueCard {
        const player = this.findPlayer(playerId);
        if (this.currentPlayer().id !== playerId) {
            throw new Error("Not this player's turn");
        }

        if (this.state.currentTurnAction !== "none") {
            throw new Error("Action already taken this turn - only one action per turn");
        }

        const card = this.state.clueDeck.shift();
        if (!card) {
            throw new Error('Clue deck is empty');
        }
        player.hand.push(card);
        this.state.currentTurnAction = "draw";

        if (player.hand.length > this.state.config.maxHandSize) {
            // Caller must call resolveHandOverage immediately.
            throw new Error('HAND_OVERAGE: player must immediately bank or discard one card; call resolveHandOverage()');
        }

        // Note: Caller must either call solveCase (which consumes the same turn) or call endTurnAfterDraw()
        return card;
    }

    // When a player chooses not to solve after drawing, they must explicitly end their turn.
    endTurnAfterDraw(playerId: PlayerId) {
        const player = this.findPlayer(playerId);
        if (this.currentPlayer().id !== playerId) {
            throw new Error("Not this player's turn");
        }
        player.turnsTaken += 1;
        this.advanceTurnIfNeeded();
    }

    // Resolve overage forced by draw: either bank or discard a card immediately.
    resolveHandOverage(playerId: PlayerId, action: 'bank' | 'discard', handIndex: number) {
        const player = this.findPlayer(playerId);
        if (player.hand.length <= this.state.config.maxHandSize) {
            throw new Error('No overage to resolve');
        }
        if (handIndex < 0 || handIndex >= player.hand.length) throw new Error('Invalid index');

        const card = player.hand.splice(handIndex, 1)[0];
        if (!card) throw new Error('Invalid index');

        if (action === 'bank') {
            player.bankedClues.push(card);
            player.score += card.bankValue;
        } else {
            this.state.discardPile.push(card);
        }
        // Resolving overage does not automatically end the player's turn (they may attempt to solve if draw was their action).
    }

    private advanceTurnIfNeeded() {
        this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.turnOrder.length;
        this.state.currentTurnAction = "none";

        // Game end: when clue deck is empty and all players have equal turnsTaken
        if (this.state.clueDeck.length === 0) {
            const counts = this.state.players.map((p) => p.turnsTaken);
            const allEqual = counts.every((c) => c === counts[0]);
            if (allEqual) {
                this.state.isFinished = true;
            } else {
                this.state.isFinished = false;
            }
        }
    }

    winners(): PlayerState[] {
        if (!this.state.isFinished) throw new Error('Game not finished');
        const maxScore = Math.max(...this.state.players.map((p) => p.score));
        return this.state.players.filter((p) => p.score === maxScore);
    }

    serialize(): GameState {
        return JSON.parse(JSON.stringify(this.state));
    }
}
