import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import Lobby from './Lobby';
import Game from './Game';
import { GameState } from './engine/models';

export default function App() {
    const [gameState, setGameState] = useState<'lobby' | 'playing'>('lobby');
    const [socket, setSocket] = useState<Socket | null>(null);
    const [gameId, setGameId] = useState<string>('');
    const [playerName, setPlayerName] = useState<string>('');
    const [currentGameState, setCurrentGameState] = useState<GameState | null>(null);

    useEffect(() => {
        // Try to rejoin existing game from localStorage
        const savedGame = localStorage.getItem('currentGame')
        if (savedGame) {
            try {
                const { gameId, playerId, playerName } = JSON.parse(savedGame)
                // Verify game still exists
                fetch(`http://localhost:3001/api/games/${gameId}`)
                    .then(res => res.json())
                    .then(gameState => {
                        const socketConnection = io('http://localhost:3001')
                        socketConnection.on('connect', () => {
                            socketConnection.emit('join-game', { gameId, playerId })
                            handleGameJoined(gameId, playerName, socketConnection, gameState)
                        })
                    })
                    .catch(() => {
                        // Game no longer exists, clear localStorage
                        localStorage.removeItem('currentGame')
                    })
            } catch (e) {
                localStorage.removeItem('currentGame')
            }
        }
    }, [])

    useEffect(() => {
        // Cleanup socket on unmount
        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [socket]);

    const handleGameCreated = (id: string, name: string, socketConnection: Socket, initialGameState: GameState) => {
        setGameId(id);
        setPlayerName(name);
        setSocket(socketConnection);
        setCurrentGameState(initialGameState);
        setGameState('playing');

        // Listen for game updates from server
        socketConnection.on('game-update', (updatedState: GameState) => {
            setCurrentGameState(updatedState);
        });

        socketConnection.on('player-joined', (data: { playerName: string, gameState: GameState }) => {
            console.log(`${data.playerName} joined the game`);
            setCurrentGameState(data.gameState);
        });
    };

    const handleGameJoined = (id: string, name: string, socketConnection: Socket, initialGameState: GameState) => {
        setGameId(id);
        setPlayerName(name);
        setSocket(socketConnection);
        setCurrentGameState(initialGameState);
        setGameState('playing');

        // Listen for game updates from server
        socketConnection.on('game-update', (updatedState: GameState) => {
            setCurrentGameState(updatedState);
        });

        socketConnection.on('player-joined', (data: { playerName: string, gameState: GameState }) => {
            console.log(`${data.playerName} joined the game`);
            setCurrentGameState(data.gameState);
        });
    };

    const handleLeaveGame = () => {
        if (socket) {
            socket.disconnect();
        }
        localStorage.removeItem('currentGame')
        setSocket(null);
        setGameId('');
        setPlayerName('');
        setCurrentGameState(null);
        setGameState('lobby');
    };

    if (gameState === 'lobby') {
        return (
            <Lobby 
                onGameCreated={handleGameCreated}
                onGameJoined={handleGameJoined}
            />
        );
    }

    return (
        <Game 
            socket={socket}
            gameId={gameId}
            playerName={playerName}
            initialGameState={currentGameState}
            onLeave={handleLeaveGame}
        />
    );
}
