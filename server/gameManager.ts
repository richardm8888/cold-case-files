import { Server } from 'socket.io';
import { Database } from './database';
import { ColdCaseGame } from '../src/engine/game';
import { ClueType } from '../src/engine/models';
import { randomUUID } from 'crypto';

export class GameManager {
    private games: Map<string, ColdCaseGame> = new Map();

    constructor(private db: Database, private io: Server) {
        this.init();
    }

    private async init() {
        await this.db.init();
        console.log('GameManager initialized');
    }

    createGame(playerName: string) {
        const gameId = randomUUID();
        const playerId = randomUUID();
        
        // Create decks
        const namesByType: Record<ClueType, string[]> = {
            Evidence: ['Bloody Knife', 'Fingerprint', 'Blood Sample', 'Torn Fabric', 'Gun', 'Fiber', 'Strange Residue', 'Notebook'],
            Suspect: ['Mr. Gray', 'Ms. Blue', 'Dr. Green', 'Officer Black', 'Ms. White', 'Mr. Gold', 'Mr. Red', 'Ms. Violet'],
            Location: ['Docks', 'Warehouse', 'Alley', 'Mansion', 'Park', 'Train Station', 'Bar', 'Factory']
        };

        const clueDeck = (ColdCaseGame as any).createClueDeck(namesByType);
        const caseDeck = this.createCaseDeck();

        // Create game with single player - DON'T setup yet, wait for start
        const game = new ColdCaseGame(gameId, [playerId], clueDeck, caseDeck as any);
        
        this.games.set(gameId, game);
        this.db.saveGame(gameId, JSON.stringify(game.serialize()));
        this.db.addPlayer(gameId, playerId, playerName, 0);

        return {
            gameId,
            playerId,
            playerName,
            game: game.serialize()
        };
    }

    joinGame(gameId: string, playerName: string) {
        const game = this.games.get(gameId);
        if (!game) {
            throw new Error('Game not found');
        }

        const state = game.serialize();
        if (state.players.length >= 4) {
            throw new Error('Game is full');
        }

        const playerId = randomUUID();
        const players = this.db.getPlayers(gameId);
        
        // Add player to database
        this.db.addPlayer(gameId, playerId, playerName, players.length);

        // Recreate game with new player
        const allPlayerIds = [...state.turnOrder, playerId];
        const newGame = new ColdCaseGame(gameId, allPlayerIds, state.clueDeck, state.caseDeck as any);
        newGame.state = { ...state, players: [...state.players], turnOrder: allPlayerIds };
        
        // Add new player state
        newGame.state.players.push({
            id: playerId,
            hand: [],
            bankedCaseIds: [],
            bankedClues: [],
            score: 0,
            turnsTaken: 0
        });

        this.games.set(gameId, newGame);
        this.db.updateGameState(gameId, JSON.stringify(newGame.serialize()), 0);

        // Notify all players in the game
        this.io.to(gameId).emit('player-joined', {
            playerId,
            playerName,
            game: newGame.serialize()
        });

        return {
            gameId,
            playerId,
            playerName,
            game: newGame.serialize()
        };
    }

    startGame(gameId: string) {
        const game = this.games.get(gameId);
        if (!game) {
            throw new Error('Game not found');
        }

        const state = game.serialize();
        if (state.players.length < 2) {
            throw new Error('Need at least 2 players to start');
        }

        game.setup(() => 0.42);
        this.db.updateGameState(gameId, JSON.stringify(game.serialize()), 0);

        return game.serialize();
    }

    getGame(gameId: string) {
        const game = this.games.get(gameId);
        if (!game) {
            // Try loading from database
            const dbGame = this.db.getGame(gameId);
            if (dbGame) {
                // Reconstruct game from saved state
                const savedState = dbGame.state;
                const newGame = new ColdCaseGame(
                    gameId,
                    savedState.turnOrder,
                    savedState.clueDeck,
                    savedState.caseDeck
                );
                newGame.state = savedState;
                this.games.set(gameId, newGame);
                return savedState;
            }
            return null;
        }
        return game.serialize();
    }

    listGames() {
        const dbGames = this.db.listGames();
        return dbGames.map(g => ({
            ...g,
            state: JSON.parse(g.state)
        }));
    }

    async handleAction(gameId: string, playerId: string, action: string, payload: any) {
        const game = this.games.get(gameId);
        if (!game) {
            throw new Error('Game not found');
        }

        switch (action) {
            case 'start-game':
                return this.startGame(gameId);
            case 'draw':
                game.drawClue(playerId);
                break;
            case 'bank':
                game.bankClue(playerId, payload.handIndex);
                break;
            case 'solve':
                game.solveCase(playerId, payload.caseId, payload.usedIndices);
                break;
            case 'end-turn':
                game.endTurnAfterDraw(playerId);
                break;
            case 'resolve-overage':
                game.resolveHandOverage(playerId, payload.action, payload.handIndex);
                break;
            default:
                throw new Error(`Unknown action: ${action}`);
        }

        const state = game.serialize();
        this.db.updateGameState(gameId, JSON.stringify(state), state.currentPlayerIndex);

        return state;
    }

    getPlayers(gameId: string) {
        return this.db.getPlayers(gameId);
    }

    private createCaseDeck() {
        return [
            { id: 'case-1', requirements: [{ kind: 'Any', type: ClueType.Evidence }, { kind: 'Any', type: ClueType.Location }] },
            { id: 'case-2', requirements: [{ kind: 'Any', type: ClueType.Suspect }, { kind: 'Any', type: ClueType.Evidence }] },
            { id: 'case-3', requirements: [{ kind: 'Any', type: ClueType.Location }, { kind: 'Any', type: ClueType.Suspect }] },
            { id: 'case-4', requirements: [{ kind: 'Specific', type: ClueType.Evidence, name: 'Bloody Knife' }, { kind: 'Any', type: ClueType.Suspect }] },
            { id: 'case-5', requirements: [{ kind: 'Specific', type: ClueType.Location, name: 'Docks' }, { kind: 'Any', type: ClueType.Evidence }] },
            { id: 'case-6', requirements: [{ kind: 'Specific', type: ClueType.Suspect, name: 'Mr. Gray' }, { kind: 'Any', type: ClueType.Location }] },
            { id: 'case-7', requirements: [{ kind: 'Specific', type: ClueType.Evidence, name: 'Fingerprint' }, { kind: 'Any', type: ClueType.Suspect }] },
            { id: 'case-8', requirements: [{ kind: 'Specific', type: ClueType.Location, name: 'Warehouse' }, { kind: 'Any', type: ClueType.Evidence }] },
            { id: 'case-9', requirements: [{ kind: 'Specific', type: ClueType.Suspect, name: 'Dr. Green' }, { kind: 'Any', type: ClueType.Evidence }] },
            { id: 'case-10', requirements: [{ kind: 'Any', type: ClueType.Location }, { kind: 'Any', type: ClueType.Suspect }, { kind: 'Any', type: ClueType.Evidence }] },
            { id: 'case-11', requirements: [{ kind: 'Specific', type: ClueType.Evidence, name: 'Gun' }, { kind: 'Any', type: ClueType.Suspect }, { kind: 'Any', type: ClueType.Location }] },
            { id: 'case-12', requirements: [{ kind: 'Specific', type: ClueType.Suspect, name: 'Ms. Blue' }, { kind: 'Any', type: ClueType.Evidence }, { kind: 'Any', type: ClueType.Location }] },
            { id: 'case-13', requirements: [{ kind: 'Specific', type: ClueType.Location, name: 'Mansion' }, { kind: 'Any', type: ClueType.Suspect }, { kind: 'Any', type: ClueType.Evidence }] },
            { id: 'case-14', requirements: [{ kind: 'Specific', type: ClueType.Evidence, name: 'Blood Sample' }, { kind: 'Specific', type: ClueType.Location, name: 'Alley' }, { kind: 'Any', type: ClueType.Suspect }] },
            { id: 'case-15', requirements: [{ kind: 'Specific', type: ClueType.Suspect, name: 'Officer Black' }, { kind: 'Specific', type: ClueType.Evidence, name: 'Torn Fabric' }, { kind: 'Any', type: ClueType.Location }] },
            { id: 'case-16', requirements: [{ kind: 'Specific', type: ClueType.Location, name: 'Park' }, { kind: 'Specific', type: ClueType.Suspect, name: 'Ms. White' }, { kind: 'Any', type: ClueType.Evidence }] },
            { id: 'case-17', requirements: [{ kind: 'Specific', type: ClueType.Evidence, name: 'Fiber' }, { kind: 'Any', type: ClueType.Suspect }, { kind: 'Any', type: ClueType.Location }] },
            { id: 'case-18', requirements: [{ kind: 'Specific', type: ClueType.Location, name: 'Train Station' }, { kind: 'Any', type: ClueType.Evidence }, { kind: 'Any', type: ClueType.Suspect }] },
        ];
    }
}
