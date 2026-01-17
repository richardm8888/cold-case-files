import { describe, it, expect } from 'vitest'
import { ColdCaseGame } from '../src/engine/game'
import { ClueType } from '../src/engine/models'

function buildNames(): Record<ClueType, string[]> {
    return {
        Evidence: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        Suspect: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'],
        Location: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'],
    }
}

it('creates full clue deck of 72 and deals starting hands', () => {
    const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
    const caseDeck = [
        { id: 'c1', requirements: [{ kind: 'Any', type: ClueType.Evidence }, { kind: 'Any', type: ClueType.Location }] },
        { id: 'c2', requirements: [{ kind: 'Specific', type: ClueType.Evidence, name: 'A' }, { kind: 'Any', type: ClueType.Suspect }] }
    ]
    const g = new ColdCaseGame('g1', ['p1', 'p2'], clueDeck, caseDeck as any)
    g.setup(() => 0.5)
    const s = g.serialize()
    expect(s.players[0].hand.length).toBe(3)
    expect(s.players[1].hand.length).toBe(3)
    expect(s.clueDeck.length).toBe(72 - 6)
})

it('banks a card for immediate score', () => {
    const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
    const caseDeck = [{ id: 'c1', requirements: [{ kind: 'Any', type: ClueType.Evidence }, { kind: 'Any', type: ClueType.Location }] }]
    const g = new ColdCaseGame('g1', ['p1', 'p2'], clueDeck, caseDeck as any)
    g.setup(() => 0.5)
    // bank first card
    g.bankClue('p1', 0)
    const s2 = g.serialize()
    expect(s2.players[0].score).toBeGreaterThanOrEqual(1)
})

it('draw -> solve uses drawn card', () => {
    const clueDeck = (ColdCaseGame as any).createClueDeck(buildNames())
    // create a case that requires Specific Evidence name 'A'
    const caseDeck = [{ id: 'c1', requirements: [{ kind: 'Specific', type: ClueType.Evidence, name: 'A' }, { kind: 'Any', type: ClueType.Suspect }] }]
    const g = new ColdCaseGame('g1', ['p1', 'p2'], clueDeck, caseDeck as any)
    g.setup(() => 0.5)
    // ensure top of deck has an Evidence A by moving one to top for deterministic test
    const idx = g.state.clueDeck.findIndex(c => c.type === ClueType.Evidence && c.name === 'A')
    if (idx >= 0) {
        const [card] = g.state.clueDeck.splice(idx, 1)
        g.state.clueDeck.unshift(card)
    }
    // current player p1 draws
    const drawn = g.drawClue('p1')
    // ensure hand has a suspect; if not, move one from deck
    const hasSuspect = g.state.players[0].hand.some(h => h.type === ClueType.Suspect)
    if (!hasSuspect) {
        const si = g.state.clueDeck.findIndex(c => c.type === ClueType.Suspect)
        if (si >= 0) {
            const [sCard] = g.state.clueDeck.splice(si, 1)
            g.state.players[0].hand.push(sCard)
        }
    }

    // find indices to satisfy case requirements
    const evidenceIdx = g.state.players[0].hand.findIndex(h => h.type === ClueType.Evidence && h.name === 'A')
    const suspectIdx = g.state.players[0].hand.findIndex(h => h.type === ClueType.Suspect)
    g.solveCase('p1', 'c1', [evidenceIdx, suspectIdx])
    const s = g.serialize()
    expect(s.players[0].score).toBeGreaterThan(0)
})
