import React, { useEffect, useState } from 'react'
import { ColdCaseGame } from './engine/game'
import { ClueType } from './engine/models'

export default function App() {
    const [game, setGame] = useState<ColdCaseGame | null>(null)
    const [players] = useState(['player1', 'player2'])
    const [activePlayer, setActivePlayer] = useState('player1')
    const [message, setMessage] = useState<string | null>(null)
    const [, forceRerender] = useState(0)

    useEffect(() => {
        const namesByType: Record<ClueType, string[]> = {
            Evidence: ['Bloody Knife', 'Fingerprint', 'Blood Sample', 'Torn Fabric', 'Gun', 'Fiber', 'Strange Residue', 'Notebook'],
            Suspect: ['Mr. Gray', 'Ms. Blue', 'Dr. Green', 'Officer Black', 'Ms. White', 'Mr. Gold', 'Mr. Red', 'Ms. Violet'],
            Location: ['Docks', 'Warehouse', 'Alley', 'Mansion', 'Park', 'Train Station', 'Bar', 'Factory']
        }

        // create decks and game
        const clueDeck = (ColdCaseGame as any).createClueDeck(namesByType)
        const caseDeck = [
            { id: 'case-1', requirements: [{ kind: 'Any', type: ClueType.Evidence }, { kind: 'Any', type: ClueType.Location }] },
            { id: 'case-2', requirements: [{ kind: 'Specific', type: ClueType.Evidence, name: 'Bloody Knife' }, { kind: 'Any', type: ClueType.Suspect }] },
            { id: 'case-3', requirements: [{ kind: 'Any', type: ClueType.Location }, { kind: 'Any', type: ClueType.Suspect }, { kind: 'Any', type: ClueType.Evidence }] }
        ]
        const g = new ColdCaseGame('game-1', players, clueDeck, caseDeck as any)
        g.setup(() => 0.42)
        setGame(g)
    }, [players])

    if (!game) return <div className="container">Loading...</div>
    const state = game.serialize()
    const player = state.players.find((p) => p.id === activePlayer)!

    function refresh() { forceRerender((n) => n + 1) }
    function onDraw() {
        try {
            const card = (game.drawClue as any)(activePlayer)
            setMessage(`Drew: ${card.type} - ${card.name} (bank ${card.bankValue})`)
            refresh()
        } catch (err: any) {
            setMessage(String(err))
        }
    }
    function onBank(index: number) { try { game.bankClue(activePlayer, index); setMessage('Banked'); refresh() } catch (e: any) { setMessage(String(e)) } }
    function onSolve(caseId: string) {
        try {
            const face = state.faceUpCases.find((c: any) => c.id === caseId)!
            const usedIndices: number[] = []
            const hand = player.hand
            const reqs = face.requirements.slice()
            for (let i = reqs.length - 1; i >= 0; i--) { const r = reqs[i]; if (r.kind === 'Specific') { const idx = hand.findIndex(h => h.type === r.type && h.name === r.name && !usedIndices.includes(hand.indexOf(h))); if (idx === -1) { setMessage('Cannot solve'); return } usedIndices.push(idx); reqs.splice(i, 1) } }
            for (const r of reqs) { const idx = hand.findIndex(h => h.type === r.type && !usedIndices.includes(hand.indexOf(h))); if (idx === -1) { setMessage('Cannot solve'); return } usedIndices.push(idx) }
            game.solveCase(activePlayer, caseId, usedIndices)
            setMessage('Solved')
            refresh()
        } catch (e: any) { setMessage(String(e)) }
    }

    return (
        <div className="container">
            <h1>Cold Case Files — Local Multiplayer Demo</h1>
            <div style={{ marginBottom: 8 }}>
                Active Player: <select value={activePlayer} onChange={e => setActivePlayer(e.target.value)}>{players.map(p => <option key={p} value={p}>{p}</option>)}</select>
            </div>
            <div className="actions">
                <button onClick={() => game.endTurnAfterDraw(activePlayer)}>End Turn</button>
            </div>
            <div className="section">
                <h2>Face-up Cases</h2>
                <div className="cases">
                    {state.faceUpCases.map((c: any) => (
                        <div key={c.id} className="card">
                            <div><strong>{c.id}</strong></div>
                            <div>Points: {(c.requirements || []).reduce((s: any, r: any) => s + (r.kind === 'Any' ? 2 : 5), 0)}</div>
                            <ul>{c.requirements.map((r: any, i: number) => (<li key={i}>{r.kind === 'Any' ? `Any ${r.type}` : `${r.type}: ${r.name}`}</li>))}</ul>
                            <button onClick={() => onSolve(c.id)}>Solve</button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="section">
                <h2>{activePlayer} Hand ({player.hand.length})</h2>
                <div className="hand">{player.hand.map((c: any, i: number) => (<div key={c.id} className="card small"><div>{c.type}</div><div>{c.name}</div><div>Bank: {c.bankValue}</div><button onClick={() => onBank(i)}>Bank</button></div>))}</div>
                <div className="actions"><button onClick={onDraw}>Draw</button></div>
            </div>

            <div className="section">
                <h2>Public</h2>
                <div>Discard pile: {state.discardPile.length}</div>
                <div>Scores: {state.players.map(p => `${p.id}:${p.score}`).join(' | ')}</div>
            </div>

            {message && <div className="message">{message}</div>}
        </div>
    )
}
