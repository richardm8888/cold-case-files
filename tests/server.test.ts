import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { Server } from 'http'
import { GameManager } from '../server/gameManager'
import { Database } from '../server/database'
import express from 'express'
import cors from 'cors'
import { Server as SocketIOServer } from 'socket.io'

describe('Server API', () => {
    let app: any
    let server: Server
    let gameManager: GameManager
    let db: Database

    beforeAll(async () => {
        // Create test app
        app = express()
        app.use(cors())
        app.use(express.json())

        const httpServer = require('http').createServer(app)
        const io = new SocketIOServer(httpServer, { cors: { origin: '*' } })
        
        db = new Database()
        await db.init()
        gameManager = new GameManager(db, io)

        // Add routes
        app.post('/api/games', (req: any, res: any) => {
            try {
                const { playerName } = req.body
                const result = gameManager.createGame(playerName)
                res.json(result)
            } catch (error) {
                res.status(500).json({ error: String(error) })
            }
        })

        app.get('/api/games/:gameId', (req: any, res: any) => {
            try {
                const game = gameManager.getGame(req.params.gameId)
                if (!game) {
                    return res.status(404).json({ error: 'Game not found' })
                }
                res.json(game)
            } catch (error) {
                res.status(500).json({ error: String(error) })
            }
        })

        app.get('/api/games/:gameId/players', (req: any, res: any) => {
            try {
                const players = gameManager.getPlayers(req.params.gameId)
                res.json(players)
            } catch (error) {
                res.status(500).json({ error: String(error) })
            }
        })

        app.post('/api/games/:gameId/join', (req: any, res: any) => {
            try {
                const { playerName } = req.body
                const result = gameManager.joinGame(req.params.gameId, playerName)
                res.json(result)
            } catch (error) {
                res.status(500).json({ error: String(error) })
            }
        })

        app.get('/api/games', (req: any, res: any) => {
            try {
                const games = gameManager.listGames()
                res.json(games)
            } catch (error) {
                res.status(500).json({ error: String(error) })
            }
        })

        server = httpServer
    })

    afterAll(() => {
        if (server) {
            server.close()
        }
    })

    describe('POST /api/games', () => {
        it('creates a new game with one player', async () => {
            const response = await request(app)
                .post('/api/games')
                .send({ playerName: 'Alice' })
                .expect(200)

            expect(response.body).toHaveProperty('gameId')
            expect(response.body).toHaveProperty('playerId')
            expect(response.body.playerName).toBe('Alice')
            expect(response.body.game).toHaveProperty('players')
            expect(response.body.game.players).toHaveLength(1)
        })

        it('creates game without starting it', async () => {
            const response = await request(app)
                .post('/api/games')
                .send({ playerName: 'Bob' })
                .expect(200)

            // Game should not have face-up cases yet (not started)
            expect(response.body.game.faceUpCases).toHaveLength(0)
        })

        it('returns error if playerName is missing', async () => {
            const response = await request(app)
                .post('/api/games')
                .send({})
                .expect(500)

            expect(response.body).toHaveProperty('error')
        })
    })

    describe('GET /api/games/:gameId', () => {
        it('retrieves game state by ID', async () => {
            const createResponse = await request(app)
                .post('/api/games')
                .send({ playerName: 'Charlie' })

            const gameId = createResponse.body.gameId

            const response = await request(app)
                .get(`/api/games/${gameId}`)
                .expect(200)

            expect(response.body).toHaveProperty('id', gameId)
            expect(response.body).toHaveProperty('players')
        })

        it('returns 404 for non-existent game', async () => {
            await request(app)
                .get('/api/games/fake-game-id')
                .expect(404)
        })
    })

    describe('POST /api/games/:gameId/join', () => {
        it('allows second player to join game', async () => {
            const createResponse = await request(app)
                .post('/api/games')
                .send({ playerName: 'Player1' })

            const gameId = createResponse.body.gameId

            const joinResponse = await request(app)
                .post(`/api/games/${gameId}/join`)
                .send({ playerName: 'Player2' })
                .expect(200)

            expect(joinResponse.body).toHaveProperty('gameId', gameId)
            expect(joinResponse.body).toHaveProperty('playerId')
            expect(joinResponse.body.playerName).toBe('Player2')
            expect(joinResponse.body.game.players).toHaveLength(2)
        })

        it('prevents joining game with 4 players', async () => {
            const createResponse = await request(app)
                .post('/api/games')
                .send({ playerName: 'P1' })

            const gameId = createResponse.body.gameId

            // Join 3 more players
            await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'P2' })
            await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'P3' })
            await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'P4' })

            // 5th player should fail
            const response = await request(app)
                .post(`/api/games/${gameId}/join`)
                .send({ playerName: 'P5' })
                .expect(500)

            expect(response.body.error).toContain('full')
        })
    })

    describe('GET /api/games/:gameId/players', () => {
        it('returns list of players with correct names', async () => {
            const createResponse = await request(app)
                .post('/api/games')
                .send({ playerName: 'Alice' })

            const gameId = createResponse.body.gameId

            await request(app)
                .post(`/api/games/${gameId}/join`)
                .send({ playerName: 'Bob' })

            const response = await request(app)
                .get(`/api/games/${gameId}/players`)
                .expect(200)

            expect(response.body).toHaveLength(2)
            expect(response.body[0]).toHaveProperty('playerName', 'Alice')
            expect(response.body[0]).toHaveProperty('playerId')
            expect(response.body[0]).toHaveProperty('joinOrder', 0)
            expect(response.body[1]).toHaveProperty('playerName', 'Bob')
            expect(response.body[1]).toHaveProperty('joinOrder', 1)
        })
    })

    describe('GET /api/games', () => {
        it('lists all available games', async () => {
            await request(app)
                .post('/api/games')
                .send({ playerName: 'GameCreator' })

            const response = await request(app)
                .get('/api/games')
                .expect(200)

            expect(Array.isArray(response.body)).toBe(true)
            expect(response.body.length).toBeGreaterThan(0)
        })
    })
})

describe('GameManager', () => {
    let gameManager: GameManager
    let db: Database
    let io: any

    beforeEach(async () => {
        db = new Database()
        await db.init()
        io = { to: () => ({ emit: () => {} }) }
        gameManager = new GameManager(db, io as any)
    })

    describe('createGame', () => {
        it('creates game with 1 player', () => {
            const result = gameManager.createGame('TestPlayer')
            
            expect(result).toHaveProperty('gameId')
            expect(result).toHaveProperty('playerId')
            expect(result.playerName).toBe('TestPlayer')
            expect(result.game.players).toHaveLength(1)
        })

        it('game is not started on creation', () => {
            const result = gameManager.createGame('TestPlayer')
            expect(result.game.faceUpCases).toHaveLength(0)
        })
    })

    describe('joinGame', () => {
        it('adds player to existing game', () => {
            const created = gameManager.createGame('Player1')
            const joined = gameManager.joinGame(created.gameId, 'Player2')

            expect(joined.gameId).toBe(created.gameId)
            expect(joined.game.players).toHaveLength(2)
        })

        it('throws error for non-existent game', () => {
            expect(() => {
                gameManager.joinGame('fake-id', 'Player')
            }).toThrow('Game not found')
        })
    })

    describe('startGame', () => {
        it('starts game and deals cards', () => {
            const created = gameManager.createGame('Player1')
            gameManager.joinGame(created.gameId, 'Player2')
            
            const started = gameManager.startGame(created.gameId)

            expect(started.faceUpCases.length).toBeGreaterThan(0)
            expect(started.players[0].hand.length).toBeGreaterThan(0)
            expect(started.players[1].hand.length).toBeGreaterThan(0)
        })

        it('requires at least 2 players to start', () => {
            const created = gameManager.createGame('LonePlayer')
            
            expect(() => {
                gameManager.startGame(created.gameId)
            }).toThrow('Need at least 2 players')
        })
    })

    describe('handleAction', () => {
        it('handles draw action', async () => {
            const created = gameManager.createGame('P1')
            gameManager.joinGame(created.gameId, 'P2')
            gameManager.startGame(created.gameId)

            const playerId = created.game.turnOrder[0]
            const initialState = gameManager.getGame(created.gameId)
            const initialHandSize = initialState.players[0].hand.length

            const updated = await gameManager.handleAction(created.gameId, playerId, 'draw', {})

            expect(updated.players[0].hand.length).toBe(initialHandSize + 1)
        })

        it('handles bank action', async () => {
            const created = gameManager.createGame('P1')
            gameManager.joinGame(created.gameId, 'P2')
            gameManager.startGame(created.gameId)

            const playerId = created.game.turnOrder[0]
            const initialState = gameManager.getGame(created.gameId)
            const initialScore = initialState.players[0].score

            const updated = await gameManager.handleAction(created.gameId, playerId, 'bank', { handIndex: 0 })

            expect(updated.players[0].score).toBeGreaterThan(initialScore)
        })

        it('handles end-turn action', async () => {
            const created = gameManager.createGame('P1')
            gameManager.joinGame(created.gameId, 'P2')
            gameManager.startGame(created.gameId)

            const playerId = created.game.turnOrder[0]
            
            // Draw a card first
            await gameManager.handleAction(created.gameId, playerId, 'draw', {})
            
            // End turn
            const updated = await gameManager.handleAction(created.gameId, playerId, 'end-turn', {})

            expect(updated.currentPlayerIndex).toBe(1)
        })
    })
})
