import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Database } from './database';
import { GameManager } from './gameManager';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const db = new Database();
const gameManager = new GameManager(db, io);

// REST API endpoints
app.post('/api/games', (req, res) => {
    try {
        const { playerName } = req.body;
        const game = gameManager.createGame(playerName);
        res.json(game);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

app.get('/api/games/:gameId', (req, res) => {
    try {
        const game = gameManager.getGame(req.params.gameId);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        res.json(game);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

app.get('/api/games/:gameId/players', (req, res) => {
    try {
        const players = gameManager.getPlayers(req.params.gameId);
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

app.post('/api/games/:gameId/join', (req, res) => {
    try {
        const { playerName } = req.body;
        const result = gameManager.joinGame(req.params.gameId, playerName);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

app.get('/api/games', (req, res) => {
    try {
        const games = gameManager.listGames();
        res.json(games);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-game', ({ gameId, playerId }) => {
        socket.join(gameId);
        console.log(`Player ${playerId} joined game ${gameId}`);
    });

    socket.on('game-action', async (data) => {
        try {
            const { gameId, action, playerId, payload } = data;
            const updatedGame = await gameManager.handleAction(gameId, playerId, action, payload);
            
            // Special handling for game start
            if (action === 'start-game') {
                io.to(gameId).emit('game-started', updatedGame);
            } else {
                // Broadcast update to all players in the game
                io.to(gameId).emit('game-update', updatedGame);
            }
        } catch (error) {
            socket.emit('error', { message: String(error) });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
