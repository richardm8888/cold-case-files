import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'game.db');

export class Database {
    private db: SqlJsDatabase | null = null;

    async init() {
        const SQL = await initSqlJs();
        
        if (existsSync(DB_PATH)) {
            const buffer = readFileSync(DB_PATH);
            this.db = new SQL.Database(buffer);
        } else {
            this.db = new SQL.Database();
            this.createTables();
            this.save();
        }
    }

    private createTables() {
        if (!this.db) return;

        this.db.run(`
            CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY,
                created_at INTEGER NOT NULL,
                started_at INTEGER,
                finished_at INTEGER,
                state TEXT NOT NULL,
                current_player_index INTEGER NOT NULL DEFAULT 0
            )
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS players (
                id TEXT PRIMARY KEY,
                game_id TEXT NOT NULL,
                name TEXT NOT NULL,
                join_order INTEGER NOT NULL,
                FOREIGN KEY (game_id) REFERENCES games(id)
            )
        `);

        console.log('Database tables created');
    }

    save() {
        if (!this.db) return;
        const data = this.db.export();
        writeFileSync(DB_PATH, Buffer.from(data));
    }

    saveGame(gameId: string, gameState: string) {
        if (!this.db) throw new Error('Database not initialized');
        
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO games (id, created_at, state, current_player_index)
            VALUES (?, ?, ?, 0)
        `);
        stmt.run([gameId, Date.now(), gameState]);
        stmt.free();
        this.save();
    }

    updateGameState(gameId: string, gameState: string, currentPlayerIndex: number) {
        if (!this.db) throw new Error('Database not initialized');
        
        const stmt = this.db.prepare(`
            UPDATE games 
            SET state = ?, current_player_index = ?
            WHERE id = ?
        `);
        stmt.run([gameState, currentPlayerIndex, gameId]);
        stmt.free();
        this.save();
    }

    getGame(gameId: string): any {
        if (!this.db) throw new Error('Database not initialized');
        
        const stmt = this.db.prepare('SELECT * FROM games WHERE id = ?');
        stmt.bind([gameId]);
        
        let result = null;
        if (stmt.step()) {
            const row = stmt.getAsObject();
            result = {
                id: row.id,
                state: JSON.parse(row.state as string),
                createdAt: row.created_at,
                startedAt: row.started_at,
                finishedAt: row.finished_at
            };
        }
        stmt.free();
        return result;
    }

    listGames(): any[] {
        if (!this.db) throw new Error('Database not initialized');
        
        const stmt = this.db.prepare(`
            SELECT g.*, COUNT(p.id) as player_count
            FROM games g
            LEFT JOIN players p ON g.id = p.game_id
            WHERE g.finished_at IS NULL
            GROUP BY g.id
            ORDER BY g.created_at DESC
            LIMIT 20
        `);
        
        const games = [];
        while (stmt.step()) {
            games.push(stmt.getAsObject());
        }
        stmt.free();
        return games;
    }

    addPlayer(gameId: string, playerId: string, playerName: string, joinOrder: number) {
        if (!this.db) throw new Error('Database not initialized');
        
        const stmt = this.db.prepare(`
            INSERT INTO players (id, game_id, name, join_order)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run([playerId, gameId, playerName, joinOrder]);
        stmt.free();
        this.save();
    }

    getPlayers(gameId: string): any[] {
        if (!this.db) throw new Error('Database not initialized');
        
        const stmt = this.db.prepare(`
            SELECT * FROM players 
            WHERE game_id = ?
            ORDER BY join_order ASC
        `);
        stmt.bind([gameId]);
        
        const players = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            players.push({
                playerId: row.id,
                playerName: row.name,
                gameId: row.game_id,
                joinOrder: row.join_order
            });
        }
        stmt.free();
        return players;
    }
}
