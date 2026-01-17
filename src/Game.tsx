import React, { useEffect, useState } from 'react'
import { Socket } from 'socket.io-client'
import { ColdCaseGame } from './engine/game'
import { ClueType, CaseCard, GameState } from './engine/models'

interface GameProps {
    socket: Socket | null
    gameId: string
    playerName: string
    initialGameState: GameState | null
    onLeave: () => void
}

interface Player {
    playerId: string
    playerName: string
    joinOrder: number
}

export default function Game({ socket, gameId, playerName, initialGameState, onLeave }: GameProps) {
    const [game, setGame] = useState<ColdCaseGame | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [playerIdToName, setPlayerIdToName] = useState<Record<string, string>>({})
    const [players, setPlayers] = useState<Player[]>([])
    const [isGameStarted, setIsGameStarted] = useState(false)
    const [, forceRerender] = useState(0)

    const showMessage = (msg: string) => setMessage(msg)

    useEffect(() => {
        if (initialGameState) {
            // Initialize game with state from server
            // Create a minimal instance just to hold the state
            const coldCaseGame = new ColdCaseGame(
                initialGameState.id,
                initialGameState.turnOrder,
                [],
                []
            )
            coldCaseGame.state = initialGameState
            setGame(coldCaseGame)
        }
    }, [initialGameState])

    // Fetch player names from server
    useEffect(() => {
        if (gameId) {
            const fetchPlayers = () => {
                fetch(`http://localhost:3001/api/games/${gameId}/players`)
                    .then(res => res.json())
                    .then(playersList => {
                        const mapping: Record<string, string> = {}
                        playersList.forEach((p: any) => {
                            mapping[p.playerId] = p.playerName
                        })
                        setPlayerIdToName(mapping)
                        setPlayers(playersList)
                    })
                    .catch(err => console.error('Failed to fetch player names:', err))
            }
            
            fetchPlayers() // Initial fetch
            
            // Poll for updates while in waiting room
            const interval = setInterval(fetchPlayers, 2000)
            return () => clearInterval(interval)
        }
    }, [gameId])

    // Check if game is started
    useEffect(() => {
        if (initialGameState) {
            // Game is started if there are face-up cases
            setIsGameStarted(initialGameState.faceUpCases.length > 0)
        }
    }, [initialGameState])

    useEffect(() => {
        if (socket && game) {
            // Listen for game updates
            socket.on('game-update', (updatedState: GameState) => {
                game.state = updatedState
                forceRerender(prev => prev + 1)
            })

            socket.on('player-joined', (data: { playerName: string, gameState: GameState }) => {
                showMessage(`${data.playerName} joined the game`)
                game.state = data.gameState
                // Refresh player list
                fetch(`http://localhost:3001/api/games/${gameId}/players`)
                    .then(res => res.json())
                    .then(playersList => {
                        const mapping: Record<string, string> = {}
                        playersList.forEach((p: any) => {
                            mapping[p.playerId] = p.playerName
                        })
                        setPlayerIdToName(mapping)
                        setPlayers(playersList)
                    })
                forceRerender(prev => prev + 1)
            })

            socket.on('action-result', (data: { success: boolean, message: string, gameState?: GameState }) => {
                if (data.message) {
                    showMessage(data.message)
                }
                if (data.gameState) {
                    game.state = data.gameState
                    forceRerender(prev => prev + 1)
                }
            })

            socket.on('error', (errorMessage: string) => {
                showMessage(errorMessage)
            })

            socket.on('game-started', (gameState: GameState) => {
                showMessage('Game has started!')
                game.state = gameState
                setIsGameStarted(true)
                forceRerender(prev => prev + 1)
            })

            return () => {
                socket.off('game-update')
                socket.off('player-joined')
                socket.off('action-result')
                socket.off('error')
                socket.off('game-started')
            }
        }
    }, [socket, game])

    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 3000)
            return () => clearTimeout(timer)
        }
    }, [message])

    if (!game) return <div className="game-container">Loading...</div>

    const state = game.serialize()
    const currentPlayer = state.players[state.currentPlayerIndex]
    // Find our player by matching playerName with the ID-to-name mapping
    const myPlayerId = Object.entries(playerIdToName).find(([id, name]) => name === playerName)?.[0]
    const isMyTurn = myPlayerId && currentPlayer.id === myPlayerId
    const needsOverageResolution = isMyTurn && currentPlayer.hand.length > state.config.maxHandSize

    // Helper to get display name for a player ID
    const getPlayerName = (playerId: string) => playerIdToName[playerId] || playerId

    function refresh() { forceRerender((n) => n + 1) }

    function startGame() {
        if (!socket || !myPlayerId) return
        socket.emit('game-action', {
            gameId,
            action: 'start-game',
            playerId: myPlayerId,
            payload: {}
        })
    }

    const isCreator = players.length > 0 && players[0].playerName === playerName
    const canStartGame = isCreator && players.length >= 2

    // Show waiting room if game hasn't started
    if (!isGameStarted) {
        return (
            <div className="game-container">
                <div className="lobby-card" style={{ margin: '2rem auto', maxWidth: '600px' }}>
                    <h1>🔎 Waiting Room</h1>
                    <p className="subtitle">Game Code: <strong style={{ color: '#d4af37' }}>{gameId}</strong></p>
                    
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ color: '#d4af37', marginBottom: '1rem' }}>Players ({players.length}/4)</h3>
                        {players.map((p, i) => (
                            <div key={p.playerId} style={{ 
                                padding: '0.75rem', 
                                background: 'rgba(212, 175, 55, 0.1)',
                                borderRadius: '4px',
                                marginBottom: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                {i === 0 && <span>👑</span>}
                                <span>{p.playerName}</span>
                                {p.playerName === playerName && <span style={{ color: '#d4af37' }}>(You)</span>}
                            </div>
                        ))}
                    </div>

                    {isCreator ? (
                        <div>
                            <button 
                                onClick={startGame}
                                disabled={!canStartGame}
                                className="create-game-btn"
                                style={{ marginBottom: '1rem' }}
                            >
                                {canStartGame ? 'Start Game' : 'Waiting for more players...'}
                            </button>
                            <p style={{ fontSize: '0.9rem', color: '#a8a8a8', textAlign: 'center' }}>
                                {canStartGame ? 'Click to start when ready' : 'Need at least 2 players to start'}
                            </p>
                        </div>
                    ) : (
                        <p style={{ textAlign: 'center', color: '#a8a8a8' }}>
                            Waiting for {players[0]?.playerName} to start the game...
                        </p>
                    )}

                    <button 
                        onClick={onLeave}
                        style={{ 
                            marginTop: '1rem',
                            width: '100%',
                            padding: '0.75rem',
                            background: '#c0392b',
                            border: '1px solid #a93226',
                            color: 'white',
                            cursor: 'pointer',
                            borderRadius: '3px',
                            fontFamily: 'inherit'
                        }}
                    >
                        Leave Game
                    </button>
                </div>
            </div>
        )
    }

    function onDraw() {
        if (!isMyTurn) {
            setMessage('Not your turn!')
            return
        }
        if (!socket || !myPlayerId) {
            setMessage('Not connected to server')
            return
        }
        
        socket.emit('game-action', {
            gameId,
            action: 'draw',
            playerId: myPlayerId,
            payload: {}
        })
    }

    function onBank(index: number) {
        if (!isMyTurn) {
            setMessage('Not your turn!')
            return
        }
        if (!socket || !myPlayerId) {
            setMessage('Not connected to server')
            return
        }

        socket.emit('game-action', {
            gameId,
            action: 'bank',
            playerId: myPlayerId,
            payload: { handIndex: index }
        })
    }

    function handleOverage(action: 'bank' | 'discard', index: number) {
        if (!socket || !myPlayerId) {
            setMessage('Not connected to server')
            return
        }

        socket.emit('game-action', {
            gameId,
            action: 'resolve-overage',
            playerId: myPlayerId,
            payload: {
                action: action,
                handIndex: index
            }
        })
    }

    function onSolve(caseId: string) {
        if (!isMyTurn) {
            setMessage('Not your turn!')
            return
        }
        if (!socket || !myPlayerId) {
            setMessage('Not connected to server')
            return
        }

        // Calculate which cards to use (client-side validation)
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

        socket.emit('game-action', {
            gameId,
            action: 'solve',
            playerId: myPlayerId,
            payload: {
                caseId,
                usedIndices
            }
        })
    }

    function onEndTurn() {
        if (!isMyTurn) {
            setMessage('Not your turn!')
            return
        }
        if (!socket || !myPlayerId) {
            setMessage('Not connected to server')
            return
        }

        socket.emit('game-action', {
            gameId,
            action: 'end-turn',
            playerId: myPlayerId,
            payload: {}
        })
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
                                ? <p>Winner: <strong>{getPlayerName(winners[0].id)}</strong> with {winners[0].score} points!</p>
                                : <p>Tie between: <strong>{winners.map(w => getPlayerName(w.id)).join(', ')}</strong> with {maxScore} points each!</p>
                        })()}
                    </div>
                    <div className="final-scores">
                        <h2>Final Scores</h2>
                        {state.players.map(p => (
                            <div key={p.id} className="score-row">
                                <span>{getPlayerName(p.id)}:</span> <strong>{p.score} points</strong>
                            </div>
                        ))}
                    </div>
                    <button onClick={onLeave}>Return to Lobby</button>
                </div>
            ) : (
                <>
                    <div className="game-header">
                        <h1>🔎 Cold Case Files</h1>
                        <div className="game-info" style={{ fontSize: '0.85rem', color: '#a8a8a8', marginBottom: '0.5rem' }}>
                            <div>Game Code: <strong style={{ color: '#d4af37' }}>{gameId}</strong></div>
                            <div>Playing as: <strong>{playerName}</strong></div>
                            <button 
                                onClick={onLeave} 
                                style={{ 
                                    marginLeft: '1rem', 
                                    padding: '0.25rem 0.75rem', 
                                    fontSize: '0.75rem',
                                    background: '#c0392b',
                                    border: '1px solid #a93226',
                                    color: 'white',
                                    cursor: 'pointer',
                                    borderRadius: '3px'
                                }}
                            >
                                Leave Game
                            </button>
                        </div>
                        <div className="header-scores">
                            {state.players.map(p => (
                                <div key={p.id} className={`header-score-item ${p.id === currentPlayer.id ? 'active-player' : ''}`}>
                                    <span className="player-name">{getPlayerName(p.id)}</span>
                                    <span className="player-score">{p.score}</span>
                                </div>
                            ))}
                        </div>
                        <div className="turn-status">
                            <strong>{getPlayerName(currentPlayer.id)}'s Turn</strong> {!isMyTurn && <span style={{ color: '#e74c3c', marginLeft: '0.5rem' }}>(Waiting...)</span>}
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
                                                    disabled={!isMyTurn || !canSolve || needsOverageResolution}
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
                                        disabled={!isMyTurn || state.currentTurnAction !== 'none' || needsOverageResolution}
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
                                disabled={!isMyTurn || state.currentTurnAction !== 'draw'}
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
                                        disabled={!isMyTurn || state.currentTurnAction === 'draw' || needsOverageResolution}
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
