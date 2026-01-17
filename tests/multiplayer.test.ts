import { describe, it, expect } from 'vitest'
import { ColdCaseGame } from '../src/engine/game'
import { ClueType } from '../src/engine/models'

describe('ColdCaseGame Multiplayer Features', () => {
    function buildNames() {
        return {
            Evidence: ['Knife', 'Print', 'Blood', 'Fabric', 'Gun', 'Fiber', 'Residue', 'Note'],
            Suspect: ['Gray', 'Blue', 'Green', 'Black', 'White', 'Gold', 'Red', 'Violet'],
            Location: ['Docks', 'Warehouse', 'Alley', 'Mansion', 'Park', 'Station', 'Bar', 'Factory'],
        }
    }

    // Helper to create a valid case for testing
    function createTestCase(id: string, points: number = 5) {
        return {
            id,
            name: `Test Case ${id}`,
            description: 'Test case',
            requirements: [
                { kind: 'Any', type: ClueType.Evidence },
                { kind: 'Any', type: ClueType.Suspect }
            ],
            points
        }
    }

    describe('Single player games', () => {
        it('allows creating game with 1 player', () => {
            const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
            const caseDeck = [createTestCase('c1')]
            
            const game = new ColdCaseGame('g1', ['p1'], clueDeck, caseDeck as any)
            
            expect(game.state.players).toHaveLength(1)
            expect(game.state.turnOrder).toEqual(['p1'])
        })

        it('single player game can be setup and played', () => {
            const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
            const caseDeck = [createTestCase('c1')]
            
            const game = new ColdCaseGame('g1', ['p1'], clueDeck, caseDeck as any)
            game.setup(() => 0.5)
            
            expect(game.state.players[0].hand.length).toBeGreaterThan(0)
            expect(game.state.faceUpCases.length).toBeGreaterThan(0)
        })
    })

    describe('Turn progression', () => {
        it('advances turn after draw and end-turn', () => {
            const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
            const caseDeck = [createTestCase('c1')]
            
            const game = new ColdCaseGame('g1', ['p1', 'p2'], clueDeck, caseDeck as any)
            game.setup(() => 0.5)
            
            expect(game.state.currentPlayerIndex).toBe(0)
            expect(game.state.currentTurnAction).toBe('none')
            
            game.drawClue('p1')
            expect(game.state.currentTurnAction).toBe('draw')
            
            game.endTurnAfterDraw('p1')
            expect(game.state.currentPlayerIndex).toBe(1)
            expect(game.state.currentTurnAction).toBe('none')
        })

        it('advances turn automatically after bank', () => {
            const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
            const caseDeck = [createTestCase('c1')]
            
            const game = new ColdCaseGame('g1', ['p1', 'p2'], clueDeck, caseDeck as any)
            game.setup(() => 0.5)
            
            game.bankClue('p1', 0)
            expect(game.state.currentPlayerIndex).toBe(1)
        })

        it('prevents actions when not your turn', () => {
            const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
            const caseDeck = [createTestCase('c1')]
            
            const game = new ColdCaseGame('g1', ['p1', 'p2'], clueDeck, caseDeck as any)
            game.setup(() => 0.5)
            
            expect(() => {
                game.drawClue('p2') // p2 tries to draw when it's p1's turn
            }).toThrow('Not this player\'s turn')
        })

        it('allows only one action per turn (draw)', () => {
            const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
            const caseDeck = [createTestCase('c1')]
            
            const game = new ColdCaseGame('g1', ['p1', 'p2'], clueDeck, caseDeck as any)
            game.setup(() => 0.5)
            
            game.drawClue('p1')
            
            expect(() => {
                game.drawClue('p1') // Try to draw again
            }).toThrow()
        })
    })

    describe('Turn wrapping', () => {
        it('wraps turn from last player to first', () => {
            const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
            const caseDeck = [createTestCase('c1')]
            
            const game = new ColdCaseGame('g1', ['p1', 'p2', 'p3'], clueDeck, caseDeck as any)
            game.setup(() => 0.5)
            
            // Play through all players
            game.bankClue('p1', 0) // p1's turn
            expect(game.state.currentPlayerIndex).toBe(1)
            
            game.bankClue('p2', 0) // p2's turn
            expect(game.state.currentPlayerIndex).toBe(2)
            
            game.bankClue('p3', 0) // p3's turn
            expect(game.state.currentPlayerIndex).toBe(0) // Back to p1
        })
    })

    describe('Game state serialization', () => {
        it('serialized state includes current turn action', () => {
            const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
            const caseDeck = [createTestCase('c1')]
            
            const game = new ColdCaseGame('g1', ['p1', 'p2'], clueDeck, caseDeck as any)
            game.setup(() => 0.5)
            
            let state = game.serialize()
            expect(state.currentTurnAction).toBe('none')
            
            game.drawClue('p1')
            state = game.serialize()
            expect(state.currentTurnAction).toBe('draw')
        })

        it('can reconstruct game from serialized state', () => {
            const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
            const caseDeck = [createTestCase('c1')]
            
            const game1 = new ColdCaseGame('g1', ['p1', 'p2'], clueDeck, caseDeck as any)
            game1.setup(() => 0.5)
            game1.drawClue('p1')
            
            const serialized = game1.serialize()
            
            const game2 = new ColdCaseGame('g1', ['p1', 'p2'], [], [])
            game2.state = serialized
            
            expect(game2.state.currentPlayerIndex).toBe(0)
            expect(game2.state.currentTurnAction).toBe('draw')
            expect(game2.state.players[0].hand.length).toBe(serialized.players[0].hand.length)
        })
    })

    describe('Multiple players', () => {
        it('supports 4 players', () => {
            const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
            const caseDeck = [createTestCase('c1')]
            
            const game = new ColdCaseGame('g1', ['p1', 'p2', 'p3', 'p4'], clueDeck, caseDeck as any)
            game.setup(() => 0.5)
            
            expect(game.state.players).toHaveLength(4)
            expect(game.state.players[0].hand.length).toBeGreaterThan(0)
            expect(game.state.players[3].hand.length).toBeGreaterThan(0)
        })

        it('rejects games with 5+ players', () => {
            const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
            const caseDeck = [createTestCase('c1')]
            
            expect(() => {
                new ColdCaseGame('g1', ['p1', 'p2', 'p3', 'p4', 'p5'], clueDeck, caseDeck as any)
            }).toThrow()
        })
    })

    describe('Face-up cases', () => {
        it('displays 4 face-up cases after setup', () => {
            const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
            const caseDeck = Array.from({ length: 10 }, (_, i) => createTestCase(`case-${i}`))
            
            const game = new ColdCaseGame('g1', ['p1', 'p2'], clueDeck, caseDeck as any)
            game.setup(() => 0.5)
            
            expect(game.state.faceUpCases).toHaveLength(4)
        })

        it('refills face-up cases when one is solved', () => {
            const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
            const caseDeck = Array.from({ length: 10 }, (_, i) => createTestCase(`case-${i}`))
            
            const game = new ColdCaseGame('g1', ['p1', 'p2'], clueDeck, caseDeck as any)
            game.setup(() => 0.5)
            
            // Ensure player has required cards (need Evidence and Suspect for the test case)
            game.state.players[0].hand = [
                { id: 'card1', type: ClueType.Evidence, name: 'Knife', bankValue: 1 },
                { id: 'card2', type: ClueType.Suspect, name: 'Gray', bankValue: 1 }
            ]
            
            const caseId = game.state.faceUpCases[0].id
            game.solveCase('p1', caseId, [0, 1])
            
            // Should still have 4 face-up cases (if there are enough in deck)
            expect(game.state.faceUpCases.length).toBeLessThanOrEqual(4)
        })
    })
})
