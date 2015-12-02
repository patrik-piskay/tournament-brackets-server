import sqlite3 from 'sqlite3';

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
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id   INTEGER NOT NULL,
        player1_id      INTEGER DEFAULT NULL,
        player2_id      INTEGER DEFAULT NULL,
        next_round_id   INTEGER DEFAULT NULL,
        played_at       TIMESTAMP DEFAULT NULL
    )`);

    db.run(`INSERT INTO tournament (name) VALUES ('t1'), ('t2')`);
    db.run(`INSERT INTO player (name, tournament_id) VALUES
        ('Pato', 1),
        ('Majka', 1),
        ('Jozo', 1),
        ('Rudo', 2),
        ('Kika', 2)
    `);
    db.run(`INSERT INTO match (tournament_id, player1_id, player2_id, next_round_id) VALUES
        (1, null, 3, null),
        (1, 1, 2, 1)
    `);
});

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

    insertTournament: (name) => {
        db.run(`INSERT INTO tournament (name) VALUES (?)`, name);
    }
};