import React, { useEffect, useState } from 'react'
import { ColdCaseGame } from './engine/game'
import { ClueType, CaseCard } from './engine/models'

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

        const clueDeck = (ColdCaseGame as any).createClueDeck(namesByType)
        const caseDeck = [
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
        ]
        const g = new ColdCaseGame('game-1', players, clueDeck, caseDeck as any)
        g.setup(() => 0.42)
        setGame(g)
    }, [players])

    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 3000)
            return () => clearTimeout(timer)
        }
    }, [message])

    if (!game) return <div className="game-container">Loading...</div>

    const state = game.serialize()
    const currentPlayer = state.players[state.currentPlayerIndex]
    const needsOverageResolution = currentPlayer.hand.length > state.config.maxHandSize

    function refresh() { forceRerender((n) => n + 1) }

    function onDraw() {
        try {
            game.drawClue(currentPlayer.id)
            setMessage('Drew a card')
            refresh()
        } catch (e: any) {
            if (String(e).includes('HAND_OVERAGE')) {
                setMessage('Hand full! Choose a card to bank or discard')
            } else {
                setMessage(String(e))
            }
            refresh()
        }
    }

    function onBank(index: number) {
        try {
            const card = currentPlayer.hand[index]
            game.bankClue(currentPlayer.id, index)
            setMessage(`Banked ${card.name} for ${card.bankValue} points`)
            refresh()
        } catch (e: any) {
            setMessage(String(e))
        }
    }

    function handleOverage(action: 'bank' | 'discard', index: number) {
        try {
            const card = currentPlayer.hand[index]
            game.resolveHandOverage(currentPlayer.id, action, index)
            setMessage(action === 'bank' 
                ? `Banked ${card.name} for ${card.bankValue} points` 
                : `Discarded ${card.name}`)
            refresh()
        } catch (e: any) {
            setMessage(String(e))
        }
    }

    function onSolve(caseId: string) {
        try {
            const caseCard = state.faceUpCases.find(c => c.id === caseId)
            if (!caseCard) return

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

            game.solveCase(currentPlayer.id, caseId, usedIndices)
            const points = ColdCaseGame.casePoints(caseCard)
            setMessage(`Solved ${caseId} for ${points} points!`)
            refresh()
        } catch (e: any) {
            setMessage(String(e))
        }
    }

    function onEndTurn() {
        try {
            game.endTurnAfterDraw(currentPlayer.id)
            setMessage('Turn ended')
            refresh()
        } catch (e: any) {
            setMessage(String(e))
        }
    }

    function canSolveCase(c: CaseCard): boolean {
        const usedIndices: number[] = []
        const hand = currentPlayer.hand
        const reqs = c.requirements.slice()

        // Check specific requirements
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

        // Check any requirements
        for (const r of reqs) {
            const idx = hand.findIndex((h, hi) => 
                h.type === r.type && !usedIndices.includes(hi)
            )
            if (idx === -1) return false
            usedIndices.push(idx)
        }

        return true
    }

    return (
        <div className="game-container">
            {state.isFinished ? (
                <div className="game-over">
                    <h1>🎉 Game Over!</h1>
                    <div className="winners">
                        {(() => {
                            const maxScore = Math.max(...state.players.map(p => p.score))
                            const winners = state.players.filter(p => p.score === maxScore)
                            return winners.length === 1 
                                ? <p>Winner: <strong>{winners[0].id}</strong> with {winners[0].score} points!</p>
                                : <p>Tie between: <strong>{winners.map(w => w.id).join(', ')}</strong> with {maxScore} points each!</p>
                        })()}
                    </div>
                    <div className="final-scores">
                        <h2>Final Scores</h2>
                        {state.players.map(p => (
                            <div key={p.id} className="score-row">
                                <span>{p.id}:</span> <strong>{p.score} points</strong>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => window.location.reload()}>New Game</button>
                </div>
            ) : (
                <>
                    <div className="game-header">
                        <h1>🔎 Cold Case Files</h1>
                        <div className="header-scores">
                            {state.players.map(p => (
                                <div key={p.id} className={`header-score-item ${p.id === currentPlayer.id ? 'active-player' : ''}`}>
                                    <span className="player-name">{p.id}</span>
                                    <span className="player-score">{p.score}</span>
                                </div>
                            ))}
                        </div>
                        <div className="turn-status">
                            <strong>{currentPlayer.id}'s Turn</strong>
                            <span className="status-indicator">
                                {state.currentTurnAction === 'none' && '📋 Choose an action'}
                                {state.currentTurnAction === 'draw' && '🎯 Solve a case or end turn'}
                                {state.currentTurnAction === 'bank' && '✅ Turn complete'}
                                {state.currentTurnAction === 'solve' && '✅ Turn complete'}
                            </span>
                        </div>
                    </div>

                    {needsOverageResolution && (
                        <div className="overage-modal">
                            <div className="modal-content">
                                <h3>⚠️ Hand Limit Exceeded!</h3>
                                <p>You must bank or discard one card to continue:</p>
                                <div className="overage-cards">
                                    {currentPlayer.hand.map((card, i) => (
                                        <div key={card.id} className="overage-card">
                                            <div className="card-preview">
                                                <div className="card-type">{card.type}</div>
                                                <div className="card-name">{card.name}</div>
                                                <div className="card-value">Bank: {card.bankValue}</div>
                                            </div>
                                            <div className="overage-buttons">
                                                <button onClick={() => handleOverage('bank', i)} className="bank-btn">
                                                    Bank (+{card.bankValue})
                                                </button>
                                                <button onClick={() => handleOverage('discard', i)} className="discard-btn">
                                                    Discard (0)
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="board">
                        {/* Left side: Active cases */}
                        <div className="board-left">
                            <h2 className="section-title">Active Cases</h2>
                            <div className="active-cases">
                                {state.faceUpCases.map((c) => {
                                    const canSolve = canSolveCase(c)
                                    return (
                                        <div key={c.id} className={`case-card ${canSolve ? 'solvable' : ''}`}>
                                            <div className="case-id">{c.id}</div>
                                            <div className="case-requirements">
                                                {c.requirements.map((r, i) => (
                                                    <div key={i} className={`requirement ${r.kind}`}>
                                                        <span className="req-icon">
                                                            {r.type === ClueType.Evidence && '🔬'}
                                                            {r.type === ClueType.Suspect && '👤'}
                                                            {r.type === ClueType.Location && '📍'}
                                                        </span>
                                                        <span className="req-text">
                                                            {r.kind === 'Any' ? `Any ${r.type}` : r.name}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="case-footer">
                                                <span className="case-points">{ColdCaseGame.casePoints(c)} points</span>
                                                <button 
                                                    onClick={() => onSolve(c.id)}
                                                    disabled={!canSolve || needsOverageResolution}
                                                    className="solve-btn"
                                                >
                                                    Solve Case
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Center: Card piles and scores */}
                        <div className="board-center">
                            <h2 className="section-title">Card Decks</h2>
                            <div className="card-piles">
                                <div className="pile draw-pile">
                                    <div className="pile-card">
                                        <div className="card-back">
                                            <div className="card-back-design">?</div>
                                        </div>
                                    </div>
                                    <div className="pile-label">Draw Pile</div>
                                    <div className="pile-count">{state.clueDeck.length} cards</div>
                                    <button 
                                        onClick={onDraw}
                                        disabled={state.currentTurnAction !== 'none' || needsOverageResolution}
                                        className="pile-action-btn"
                                    >
                                        Draw Card
                                    </button>
                                </div>

                                <div className="pile discard-pile">
                                    <div className="pile-card">
                                        {state.discardPile.length > 0 ? (
                                            <div className="card-front discard">
                                                <div className="discard-icon">🗑️</div>
                                            </div>
                                        ) : (
                                            <div className="card-empty">Empty</div>
                                        )}
                                    </div>
                                    <div className="pile-label">Discard Pile</div>
                                    <div className="pile-count">{state.discardPile.length} cards</div>
                                </div>

                                <div className="pile case-deck-pile">
                                    <div className="pile-card">
                                        <div className="card-back case-back">
                                            <div className="card-back-design">📋</div>
                                        </div>
                                    </div>
                                    <div className="pile-label">Case Deck</div>
                                    <div className="pile-count">{state.caseDeck.length} remaining</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom: Hand area */}
                    <div className="hand-bar">
                        <div className="hand-header">
                            <h3>Your Hand ({currentPlayer.hand.length}/7)</h3>
                            {currentPlayer.hand.length >= 6 && (
                                <span className="hand-warning">
                                    {currentPlayer.hand.length === 7 ? '⚠️ Hand full!' : '⚠️ Nearly full'}
                                </span>
                            )}
                            <button 
                                onClick={onEndTurn}
                                disabled={state.currentTurnAction !== 'draw'}
                                className="end-turn-btn"
                            >
                                End Turn →
                            </button>
                        </div>
                        <div className="hand-cards">
                            {currentPlayer.hand.map((card, i) => (
                                <div key={card.id} className="hand-card">
                                    <div className="card-icon">
                                        {card.type === ClueType.Evidence && '🔬'}
                                        {card.type === ClueType.Suspect && '👤'}
                                        {card.type === ClueType.Location && '📍'}
                                    </div>
                                    <div className="card-type">{card.type}</div>
                                    <div className="card-name">{card.name}</div>
                                    <div className="card-value">{card.bankValue}</div>
                                    <button 
                                        onClick={() => onBank(i)}
                                        disabled={state.currentTurnAction === 'draw' || needsOverageResolution}
                                        className="bank-btn"
                                    >
                                        Bank
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {message && (
                        <div className="message-toast">
                            {message}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
