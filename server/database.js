import sqlite3 from 'sqlite3';
import crypto from 'crypto';

const db = new sqlite3.Database('brackets.db');

db.serialize(() => {
    db.run('DROP TABLE if exists tournament');
    db.run('DROP TABLE if exists player');
    db.run('DROP TABLE if exists match');

    db.run(`CREATE TABLE if not exists tournament (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT,
        finished        BOOLEAN DEFAULT 0,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // t_id asi nie potrebne
    db.run(`CREATE TABLE if not exists player (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT,
        tournament_id   INTEGER
    )`);

    db.run(`CREATE TABLE if not exists match (
        id              TEXT PRIMARY KEY,
        tournament_id   INTEGER NOT NULL,
        player1_id      INTEGER DEFAULT NULL,
        player2_id      INTEGER DEFAULT NULL,
        next_round_id   TEXT DEFAULT NULL,
        played_at       TIMESTAMP DEFAULT NULL
    )`);

    db.run(`INSERT INTO tournament (name) VALUES ('t1'), ('t2')`);
    db.run(`INSERT INTO player (name, tournament_id) VALUES
        ('Pato', 1),
        ('Majka', 1)
    `);
    // db.run(`INSERT INTO match (tournament_id, player1_id, player2_id, next_round_id) VALUES
    //     (1, null, 3, null),
    //     (1, 1, 2, 1)
    // `);
});

export const insertMatch = ({ id, tournamentId, player1, player2, nextRoundId }) => {
    db.run(
        `INSERT INTO match (id, tournament_id, player1_id, player2_id, next_round_id) VALUES (?,?,?,?,?)`,
        id, tournamentId, player1, player2, nextRoundId
    );
};


export const generateMatches = (tournamentId, players, nextRoundId = null) => {
    const id = crypto.randomBytes(10).toString('hex');

    if (players.length <= 2) {
        // first round matches
        const [player1, player2] = players;

        return [{
            id,
            tournamentId,
            player1,
            player2: player2 || null,
            nextRoundId
        }];
    } else {
        const middle = Math.ceil(players.length / 2);
        const group1 = players.slice(0, middle);
        const group2 = players.slice(middle);

        return [
            {
                id,
                tournamentId,
                player1: null,
                player2: null,
                nextRoundId
            },
            ...generateMatches(tournamentId, group1, id),
            ...generateMatches(tournamentId, group2, id)
        ];
    }
};

export default {
    getTournaments: (cb) => {
        db.all(`SELECT *, datetime(created_at, 'localtime') as created FROM tournament`, (err, rows) => {
            cb(rows, err);
        });
    },

    getTournament: (id, cb) => {
        db.all(`
            SELECT tournament.*, datetime(created_at, 'localtime') as created_at,
                match.*, datetime(played_at, 'localtime') as played_at,
                player1.name as player1, player2.name as player2
            FROM tournament
            LEFT JOIN match on tournament.id = match.tournament_id
            LEFT JOIN player as player1 on match.player1_id = player1.id
            LEFT JOIN player as player2 on match.player2_id = player2.id
            WHERE tournament.id = ?`, id, (err, rows) => {
                cb(rows, err);
            }
        );
    },

    insertTournament: (name, players) => {
        db.run(`INSERT INTO tournament (name) VALUES (?)`, [name], function(err) {
            if (!err && this.lastID) {
                const matches = generateMatches(this.lastID, players);

                matches.forEach((match) => {
                    insertMatch(match);
                });
            }
        });
    }
};