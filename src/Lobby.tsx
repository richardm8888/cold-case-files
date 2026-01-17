import React, { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import { GameState } from './engine/models'

const API_URL = 'http://localhost:3001'

interface LobbyProps {
    onGameCreated: (gameId: string, playerName: string, socket: Socket, gameState: GameState) => void
    onGameJoined: (gameId: string, playerName: string, socket: Socket, gameState: GameState) => void
}

export default function Lobby({ onGameCreated, onGameJoined }: LobbyProps) {
    const [playerName, setPlayerName] = useState('')
    const [gameCode, setGameCode] = useState('')
    const [availableGames, setAvailableGames] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchGames()
        const interval = setInterval(fetchGames, 5000)
        return () => clearInterval(interval)
    }, [])

    async function fetchGames() {
        try {
            const response = await fetch(`${API_URL}/api/games`)
            const games = await response.json()
            setAvailableGames(games)
        } catch (err) {
            console.error('Failed to fetch games:', err)
        }
    }

    async function createGame() {
        if (!playerName.trim()) {
            setError('Please enter your name')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`${API_URL}/api/games`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerName })
            })

            const data = await response.json()
            
            // Fetch the game state
            const gameStateResponse = await fetch(`${API_URL}/api/games/${data.gameId}`)
            const gameState = await gameStateResponse.json()
            
            const socket = io(API_URL)
            
            // Save to localStorage for re-entry
            localStorage.setItem('currentGame', JSON.stringify({
                gameId: data.gameId,
                playerId: data.playerId,
                playerName: playerName
            }))
            
            socket.on('connect', () => {
                socket.emit('join-game', { gameId: data.gameId, playerId: data.playerId })
                onGameCreated(data.gameId, playerName, socket, gameState)
            })
        } catch (err) {
            setError('Failed to create game: ' + String(err))
        } finally {
            setLoading(false)
        }
    }

    async function joinGame(gameId: string) {
        if (!playerName.trim()) {
            setError('Please enter your name')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`${API_URL}/api/games/${gameId}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerName })
            })

            const data = await response.json()
            
            // Fetch the game state
            const gameStateResponse = await fetch(`${API_URL}/api/games/${gameId}`)
            const gameState = await gameStateResponse.json()
            
            const socket = io(API_URL)
            
            // Save to localStorage for re-entry
            localStorage.setItem('currentGame', JSON.stringify({
                gameId: data.gameId,
                playerId: data.playerId,
                playerName: playerName
            }))
            
            socket.on('connect', () => {
                socket.emit('join-game', { gameId: data.gameId, playerId: data.playerId })
                onGameJoined(data.gameId, playerName, socket, gameState)
            })
        } catch (err) {
            setError('Failed to join game: ' + String(err))
        } finally {
            setLoading(false)
        }
    }

    async function joinByCode() {
        if (!gameCode.trim()) {
            setError('Please enter a game code')
            return
        }
        await joinGame(gameCode)
    }

    return (
        <div className="lobby-container">
            <div className="lobby-card">
                <h1>🔎 Cold Case Files</h1>
                <p className="subtitle">Detective Card Game</p>

                <div className="player-name-section">
                    <label>Your Name</label>
                    <input 
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Enter detective name..."
                        disabled={loading}
                        onKeyDown={(e) => e.key === 'Enter' && createGame()}
                    />
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="lobby-actions">
                    <button 
                        onClick={createGame}
                        disabled={loading || !playerName.trim()}
                        className="create-game-btn"
                    >
                        Create New Game
                    </button>

                    <div className="join-by-code">
                        <input
                            type="text"
                            value={gameCode}
                            onChange={(e) => setGameCode(e.target.value)}
                            placeholder="Game code..."
                            disabled={loading}
                            onKeyDown={(e) => e.key === 'Enter' && joinByCode()}
                        />
                        <button 
                            onClick={joinByCode}
                            disabled={loading || !playerName.trim() || !gameCode.trim()}
                        >
                            Join by Code
                        </button>
                    </div>
                </div>

                {availableGames.length > 0 && (
                    <div className="available-games">
                        <h3>Available Games</h3>
                        <div className="games-list">
                            {availableGames.map((game) => (
                                <div key={game.id} className="game-item">
                                    <div className="game-info">
                                        <span className="game-id">{game.id.slice(0, 8)}...</span>
                                        <span className="player-count">{game.player_count} player(s)</span>
                                    </div>
                                    <button 
                                        onClick={() => joinGame(game.id)}
                                        disabled={loading || !playerName.trim()}
                                    >
                                        Join
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
