import sqlite3 from 'sqlite3';
import crypto from 'crypto';
import { shuffle } from 'lodash/collection';

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
        player1_score   INTEGER DEFAULT NULL,
        player2_score   INTEGER DEFAULT NULL,
        next_round_id   TEXT DEFAULT NULL,
        played_at       TIMESTAMP DEFAULT NULL
    )`);

    // db.run(`INSERT INTO tournament (name) VALUES ('t1'), ('t2')`);
    db.run(`INSERT INTO player (name, tournament_id) VALUES
        ('Pato', 1),
        ('Majka', 1),
        ('Rudo', 1),
        ('Kika', 1),
        ('Jozo', 1)
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

const getMatch = (matchId, cb) => {
    db.all(`SELECT *, datetime(played_at, 'localtime') as played_at FROM match WHERE id = ?`, matchId, (err, rows) => {
        cb(rows.length, rows[0], err);
    });
};

const sendWinnerToTheNextRound = (nextRoundId, winnerId, cb) => {
    getMatch(nextRoundId, (exists, match, error) => {
        if (exists) {
            let slot = null;
            if (match.player1_id === null) {
                slot = 'player1_id';
            } else if (match.player2_id === null) {
                slot = 'player2_id';
            } else {
                cb(null, {
                    err: 'Both players are already assigned to the match'
                });
                return;
            }

            db.run(`UPDATE match SET
                        ${slot} = $winnerId
                    WHERE id = $id`, {
                        $id: nextRoundId,
                        $winnerId: winnerId
                    }, function(err) {
                        if (!err) {
                            cb(1);
                        } else {
                            cb(null, err);
                        }
                    }
            );
        } else {
            // test this
            cb(null, error);
        }
    });
};

const setTournamentAsFinished = (tournamentId, cb) => {
    db.run(`UPDATE tournament SET
                finished = 1
            WHERE id = ?`, tournamentId, function(err) {
                if (!err) {
                    if (this.changes) {
                        cb(1);
                    } else {
                        cb(null, {
                            err: 'Tournament does not exists'
                        });
                    }
                } else {
                    cb(null, err);
                }
            }
    );
};

export default {
    getTournaments: (cb) => {
        db.all(`SELECT *, datetime(created_at, 'localtime') as created_at FROM tournament`, (err, rows) => {
            cb(rows, err);
        });
    },

    getTournament: (tournamentId, cb) => {
        db.all(`
            SELECT tournament.*, datetime(created_at, 'localtime') as created_at,
                match.*, datetime(played_at, 'localtime') as played_at,
                player1.name as player1, player2.name as player2
            FROM tournament
            LEFT JOIN match on tournament.id = match.tournament_id
            LEFT JOIN player as player1 on match.player1_id = player1.id
            LEFT JOIN player as player2 on match.player2_id = player2.id
            WHERE tournament.id = ?`, tournamentId, (err, rows) => {
                if (rows) {
                    const { tournament_id, name, created_at, finished } = rows[0];

                    const tournament = {
                        id: tournament_id,
                        name,
                        created_at,
                        finished
                    };

                    const matches = rows.map((match) => {
                        const {
                            id, player1, player2, player1_score, player2_score,
                            next_round_id, played_at
                        } = match;

                        return {
                            id,
                            player1,
                            player2,
                            player1_score,
                            player2_score,
                            nextRoundId: next_round_id,
                            playedAt: played_at
                        };
                    });

                    cb({
                        tournament,
                        matches
                    });
                } else {
                    cb(null, err);
                }
            }
        );
    },

    insertTournament: (name, players, cb) => {
        db.run(`INSERT INTO tournament (name) VALUES (?)`, [name], function(err) {
            if (!err && this.lastID) {
                const matches = generateMatches(this.lastID, shuffle(players));

                matches.forEach((match) => {
                    insertMatch(match);
                });

                cb(this.lastID);
            } else {
                cb(null, err);
            }
        });
    },

    getMatch,

    updateScore: (matchId, player1Score, player2Score, cb) => {
        getMatch(matchId, (exists, match, err) => {
            if (exists) {
                db.run(`UPDATE match SET
                            player1_score = $player1Score,
                            player2_score = $player2Score,
                            played_at = datetime('now')
                        WHERE id = $id`, {
                            $id: matchId,
                            $player1Score: player1Score,
                            $player2Score: player2Score
                        }, function(error) {
                            if (!err) {
                                if (match.next_round_id) {
                                    const winnerId = player1Score > player2Score ? match.player1_id : match.player2_id;
                                    sendWinnerToTheNextRound(match.next_round_id, winnerId, (success, _error) => {
                                        cb(success, _error);
                                    });
                                } else {
                                    setTournamentAsFinished(match.tournament_id, (success, _error) => {
                                        cb(success, _error);
                                    });
                                }
                            } else {
                                cb(null, error);
                            }
                        }
                );
            } else {
                // test this
                cb(null, err);
            }
        });
    }
};