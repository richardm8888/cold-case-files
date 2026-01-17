import React, { useEffect, useState } from 'react'
import { ColdCaseGame } from './engine/game'
import { ClueType, ClueCard, CaseCard } from './engine/models'

export default function App() {
    const [game, setGame] = useState<ColdCaseGame | null>(null)
    const [players] = useState(['Player 1', 'Player 2'])
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
            // 2-requirement cases (4-7 points each)
            { id: 'case-1', requirements: [{ kind: 'Any', type: ClueType.Evidence }, { kind: 'Any', type: ClueType.Location }] },
            { id: 'case-2', requirements: [{ kind: 'Any', type: ClueType.Suspect }, { kind: 'Any', type: ClueType.Evidence }] },
            { id: 'case-3', requirements: [{ kind: 'Any', type: ClueType.Location }, { kind: 'Any', type: ClueType.Suspect }] },
            { id: 'case-4', requirements: [{ kind: 'Specific', type: ClueType.Evidence, name: 'Bloody Knife' }, { kind: 'Any', type: ClueType.Suspect }] },
            { id: 'case-5', requirements: [{ kind: 'Specific', type: ClueType.Location, name: 'Docks' }, { kind: 'Any', type: ClueType.Evidence }] },
            { id: 'case-6', requirements: [{ kind: 'Specific', type: ClueType.Suspect, name: 'Mr. Gray' }, { kind: 'Any', type: ClueType.Location }] },
            { id: 'case-7', requirements: [{ kind: 'Specific', type: ClueType.Evidence, name: 'Fingerprint' }, { kind: 'Any', type: ClueType.Suspect }] },
            { id: 'case-8', requirements: [{ kind: 'Specific', type: ClueType.Location, name: 'Warehouse' }, { kind: 'Any', type: ClueType.Evidence }] },
            { id: 'case-9', requirements: [{ kind: 'Specific', type: ClueType.Suspect, name: 'Dr. Green' }, { kind: 'Any', type: ClueType.Evidence }] },
            
            // 3-requirement cases (6-12 points each)
            { id: 'case-10', requirements: [{ kind: 'Any', type: ClueType.Location }, { kind: 'Any', type: ClueType.Suspect }, { kind: 'Any', type: ClueType.Evidence }] },
            { id: 'case-11', requirements: [{ kind: 'Specific', type: ClueType.Evidence, name: 'Gun' }, { kind: 'Any', type: ClueType.Suspect }, { kind: 'Any', type: ClueType.Location }] },
            { id: 'case-12', requirements: [{ kind: 'Specific', type: ClueType.Suspect, name: 'Ms. Blue' }, { kind: 'Any', type: ClueType.Evidence }, { kind: 'Any', type: ClueType.Location }] },
            { id: 'case-13', requirements: [{ kind: 'Specific', type: ClueType.Location, name: 'Mansion' }, { kind: 'Any', type: ClueType.Suspect }, { kind: 'Any', type: ClueType.Evidence }] },
            { id: 'case-14', requirements: [{ kind: 'Specific', type: ClueType.Evidence, name: 'Blood Sample' }, { kind: 'Specific', type: ClueType.Location, name: 'Alley' }, { kind: 'Any', type: ClueType.Suspect }] },
            { id: 'case-15', requirements: [{ kind: 'Specific', type: ClueType.Suspect, name: 'Officer Black' }, { kind: 'Specific', type: ClueType.Evidence, name: 'Torn Fabric' }, { kind: 'Any', type: ClueType.Location }] },
            { id: 'case-16', requirements: [{ kind: 'Specific', type: ClueType.Location, name: 'Park' }, { kind: 'Specific', type: ClueType.Suspect, name: 'Ms. White' }, { kind: 'Any', type: ClueType.Evidence }] },
            { id: 'case-17', requirements: [{ kind: 'Specific', type: ClueType.Evidence, name: 'Fiber' }, { kind: 'Any', type: ClueType.Suspect }, { kind: 'Any', type: ClueType.Location }] },
            { id: 'case-18', requirements: [{ kind: 'Specific', type: ClueType.Location, name: 'Train Station' }, { kind: 'Any', type: ClueType.Evidence }, { kind: 'Any', type: ClueType.Suspect }] },
        ]
        const g = new ColdCaseGame('game-1', players, clueDeck, caseDeck as any)
        g.setup(() => 0.42)
        setGame(g)
    }, [players])

    if (!game) return <div className="container">Loading...</div>
    
    const state = game.serialize()
    const currentPlayerId = state.turnOrder[state.currentPlayerIndex]
    const currentPlayer = state.players.find((p) => p.id === currentPlayerId)!
    const needsOverageResolution = currentPlayer.hand.length > state.config.maxHandSize

    function refresh() { forceRerender((n) => n + 1) }

    function onDraw() {
        if (!game) return
        try {
            const card = game.drawClue(currentPlayerId)
            setMessage(`Drew: ${card.type} - ${card.name} (bank value ${card.bankValue})`)
            refresh()
        } catch (err: any) {
            if (err.message?.includes('HAND_OVERAGE')) {
                setMessage('Hand full! Choose a card to bank or discard.')
            } else {
                setMessage(String(err))
            }
            refresh()
        }
    }

    function onBank(index: number) {
        if (!game) return
        try {
            game.bankClue(currentPlayerId, index)
            setMessage(`Banked ${currentPlayer.hand[index]?.name || 'card'} for points`)
            refresh()
        } catch (e: any) {
            setMessage(String(e))
        }
    }

    function onResolveOverage(index: number, action: 'bank' | 'discard') {
        if (!game) return
        try {
            const card = currentPlayer.hand[index]
            game.resolveHandOverage(currentPlayerId, action, index)
            setMessage(action === 'bank' 
                ? `Banked ${card.name} for ${card.bankValue} points` 
                : `Discarded ${card.name}`)
            refresh()
        } catch (e: any) {
            setMessage(String(e))
        }
    }

    function onSolve(caseCard: CaseCard) {
        if (!game) return
        try {
            const usedIndices: number[] = []
            const hand = currentPlayer.hand
            const reqs = caseCard.requirements.slice()

            // Match specific requirements first
            for (let i = reqs.length - 1; i >= 0; i--) {
                const r = reqs[i]
                if (r.kind === 'Specific') {
                    const idx = hand.findIndex((h, hi) => 
                        h.type === r.type && h.name === r.name && !usedIndices.includes(hi)
                    )
                    if (idx === -1) {
                        setMessage(`Cannot solve: missing ${r.type} "${r.name}"`)
                        return
                    }
                    usedIndices.push(idx)
                    reqs.splice(i, 1)
                }
            }

            // Match any requirements
            for (const r of reqs) {
                const idx = hand.findIndex((h, hi) => 
                    h.type === r.type && !usedIndices.includes(hi)
                )
                if (idx === -1) {
                    setMessage(`Cannot solve: missing any ${r.type}`)
                    return
                }
                usedIndices.push(idx)
            }

            game.solveCase(currentPlayerId, caseCard.id, usedIndices)
            const points = ColdCaseGame.casePoints(caseCard)
            setMessage(`Solved ${caseCard.id} for ${points} points!`)
            refresh()
        } catch (e: any) {
            setMessage(String(e))
        }
    }

    function onEndTurn() {
        if (!game) return
        try {
            game.endTurnAfterDraw(currentPlayerId)
            setMessage('Turn ended')
            refresh()
        } catch (e: any) {
            setMessage(String(e))
        }
    }

    function canSolveCase(caseCard: CaseCard): boolean {
        const hand = currentPlayer.hand
        const usedIndices: number[] = []
        const reqs = caseCard.requirements.slice()

        for (let i = reqs.length - 1; i >= 0; i--) {
            const r = reqs[i]
            if (r.kind === 'Specific') {
                const idx = hand.findIndex((h, hi) => 
                    h.type === r.type && h.name === r.name && !usedIndices.includes(hi)
                )
                if (idx === -1) return false
                usedIndices.push(idx)
                reqs.splice(i, 1)
            }
        }

        for (const r of reqs) {
            const idx = hand.findIndex((h, hi) => 
                h.type === r.type && !usedIndices.includes(hi)
            )
            if (idx === -1) return false
            usedIndices.push(idx)
        }

        return true
    }

    const handSizeWarning = currentPlayer.hand.length >= state.config.maxHandSize - 1
    const canDraw = state.currentTurnAction === 'none' && state.clueDeck.length > 0 && !needsOverageResolution
    const canBank = state.currentTurnAction === 'none' && !needsOverageResolution
    const canEndTurn = state.currentTurnAction === 'draw' && !needsOverageResolution

    if (state.isFinished) {
        const winners = game.winners()
        return (
            <div className="container">
                <h1>Cold Case Files — Game Over</h1>
                <div className="section game-over">
                    <h2>🏆 Game Finished!</h2>
                    {winners.length === 1 ? (
                        <p className="winner-text">{winners[0].id} wins with {winners[0].score} points!</p>
                    ) : (
                        <p className="winner-text">Tie! Winners: {winners.map(w => `${w.id} (${w.score})`).join(', ')}</p>
                    )}
                    <h3>Final Scores</h3>
                    <div className="scores">
                        {state.players.map(p => (
                            <div key={p.id} className={winners.some(w => w.id === p.id) ? 'score winner' : 'score'}>
                                <strong>{p.id}:</strong> {p.score} points
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="container">
            <h1>Cold Case Files</h1>
            
            <div className="current-player-banner">
                <span className="current-label">Current Turn:</span>
                <span className="current-name">{currentPlayerId}</span>
                {state.currentTurnAction === 'draw' && (
                    <span className="turn-state">Drew card — solve a case or end turn</span>
                )}
                {state.currentTurnAction === 'none' && (
                    <span className="turn-state">Choose an action: draw, bank, or solve</span>
                )}
            </div>

            {message && <div className="message">{message}</div>}

            <div className="section">
                <h2>Face-up Cases</h2>
                <div className="cases">
                    {state.faceUpCases.map((c) => {
                        const solvable = canSolveCase(c)
                        const points = ColdCaseGame.casePoints(c)
                        return (
                            <div key={c.id} className={solvable ? 'card case solvable' : 'card case'}>
                                <div className="case-header">
                                    <strong>{c.id}</strong>
                                    <span className="points-badge">{points} pts</span>
                                </div>
                                <ul className="requirements">
                                    {c.requirements.map((r, i) => (
                                        <li key={i} className={r.kind === 'Specific' ? 'specific' : 'any'}>
                                            {r.kind === 'Any' ? `Any ${r.type}` : `${r.type}: ${r.name}`}
                                        </li>
                                    ))}
                                </ul>
                                <button 
                                    onClick={() => onSolve(c)} 
                                    disabled={!solvable || needsOverageResolution}
                                    className={solvable ? 'btn-solve' : ''}
                                >
                                    {solvable ? '✓ Solve' : 'Solve'}
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="section">
                <div className="hand-header">
                    <h2>{currentPlayerId}'s Hand ({currentPlayer.hand.length}/{state.config.maxHandSize})</h2>
                    {handSizeWarning && !needsOverageResolution && (
                        <span className="hand-warning">⚠️ Hand nearly full!</span>
                    )}
                    {needsOverageResolution && (
                        <span className="hand-warning urgent">❗ Hand overage! Bank or discard a card</span>
                    )}
                </div>
                <div className="hand">
                    {currentPlayer.hand.map((c, i) => (
                        <div key={c.id} className="card clue">
                            <div className="clue-type">{c.type}</div>
                            <div className="clue-name">{c.name}</div>
                            <div className="bank-value">Bank: {c.bankValue}</div>
                            {needsOverageResolution ? (
                                <div className="overage-actions">
                                    <button onClick={() => onResolveOverage(i, 'bank')} className="btn-bank-small">
                                        Bank
                                    </button>
                                    <button onClick={() => onResolveOverage(i, 'discard')} className="btn-discard">
                                        Discard
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => onBank(i)} 
                                    disabled={!canBank}
                                >
                                    Bank
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                {!needsOverageResolution && (
                    <div className="actions">
                        <button 
                            onClick={onDraw} 
                            disabled={!canDraw}
                            className="btn-draw"
                        >
                            Draw Card {state.clueDeck.length > 0 && `(${state.clueDeck.length} left)`}
                        </button>
                        {canEndTurn && (
                            <button onClick={onEndTurn} className="btn-end-turn">
                                End Turn
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="section">
                <h2>Game State</h2>
                <div className="game-info">
                    <div><strong>Clue Deck:</strong> {state.clueDeck.length} cards remaining</div>
                    <div><strong>Discard Pile:</strong> {state.discardPile.length} cards</div>
                    <div className="scores-row">
                        <strong>Scores:</strong>
                        {state.players.map((p, i) => (
                            <span 
                                key={p.id} 
                                className={p.id === currentPlayerId ? 'score-item current' : 'score-item'}
                            >
                                {p.id}: {p.score}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
