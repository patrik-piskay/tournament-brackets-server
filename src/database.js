import sqlite3 from 'sqlite3';

import generateMatches from './bracketGenerator.js';

class DB {
    constructor(name) {
        this._db = new sqlite3.Database(name);

        this._init();
    }

    _init() {
        this._db.configure('busyTimeout', 2000);

        this._db.serialize(() => {
            this._db.run(`CREATE TABLE if not exists tournament (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                name            TEXT,
                finished        BOOLEAN DEFAULT 0,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

            this._db.run(`CREATE TABLE if not exists player (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                name            TEXT
            )`);

            this._db.run(`CREATE TABLE if not exists match (
                id              TEXT PRIMARY KEY,
                tournament_id   INTEGER NOT NULL,
                player1_id      INTEGER DEFAULT NULL,
                player2_id      INTEGER DEFAULT NULL,
                player1_score   INTEGER DEFAULT NULL,
                player2_score   INTEGER DEFAULT NULL,
                next_round_id   TEXT DEFAULT NULL,
                played_at       TIMESTAMP DEFAULT NULL
            )`);
        });
    }

    _insertTournament(name, cb) {
        this._db.run(`INSERT INTO tournament (name) VALUES (?)`, [name], function(err) {
            if (!err && this.lastID) {
                cb(null, this.lastID);
            } else {
                cb(err);
            }
        });
    }

    _insertMatch({ id, tournamentId, player1, player2, nextRoundId }, cb) {
        this._db.run(
            `INSERT INTO match (id, tournament_id, player1_id, player2_id, next_round_id) VALUES (?,?,?,?,?)`,
            [id, tournamentId, player1, player2, nextRoundId],
            function(err) {
                cb(err, this.lastID);
            }
        );
    }

    _sendWinnerToTheNextRound(nextRoundId, winnerId, cb) {
        this.getMatch(nextRoundId, (error, exists, match) => {
            if (error) {
                cb(error);
                return;
            }

            if (exists) {
                let slot = null;
                if (match.player1_id === null) {
                    slot = 'player1_id';
                } else if (match.player2_id === null) {
                    slot = 'player2_id';
                } else {
                    cb({
                        err: 'Both players are already assigned to the match'
                    });
                    return;
                }

                this._db.run(`UPDATE match SET
                            ${slot} = $winnerId
                        WHERE id = $id`, {
                            $id: nextRoundId,
                            $winnerId: winnerId
                        }, (err) => {
                            cb(err, 1);
                        }
                );
            } else {
                cb({
                    err: 'Next round match does not exists'
                });
            }
        });
    }

    _setTournamentAsFinished(tournamentId, cb) {
        this._db.run(`UPDATE tournament SET
                    finished = 1
                WHERE id = ?`, tournamentId, function(err) {
                    if (!err) {
                        if (this.changes) {
                            cb(null, 1);
                        } else {
                            cb({
                                err: 'Tournament does not exists'
                            });
                        }
                    } else {
                        cb(err);
                    }
                }
        );
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    getTournaments(cb) {
        this._db.all(`SELECT *, datetime(created_at, 'localtime') as created_at FROM tournament`, (err, rows) => {
            cb(err, rows);
        });
    }

    getTournament(tournamentId, cb) {
        this._db.all(`
            SELECT tournament.*, datetime(created_at, 'localtime') as created_at,
                match.*, datetime(played_at, 'localtime') as played_at,
                player1.name as player1, player2.name as player2
            FROM tournament
            LEFT JOIN match on tournament.id = match.tournament_id
            LEFT JOIN player as player1 on match.player1_id = player1.id
            LEFT JOIN player as player2 on match.player2_id = player2.id
            WHERE tournament.id = ?`, tournamentId, (err, rows) => {
                if (!err) {
                    if (!rows.length) {
                        cb(null, {});
                        return;
                    }

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
                            player1Score: player1_score,
                            player2Score: player2_score,
                            nextRoundId: next_round_id,
                            playedAt: played_at
                        };
                    });

                    cb(null, {
                        tournament,
                        matches
                    });
                } else {
                    cb(err);
                }
            }
        );
    }

    insertPlayers(playerNames, cb) {
        if (!playerNames || !playerNames.length) {
            cb(null, {});
            return;
        }

        let players = [];

        playerNames.forEach((name) => {
            this._db.run(`INSERT INTO player (name) VALUES (?)`, [name], function(err) {
                if (!err && this.lastID) {
                    players.push({
                        id: this.lastID,
                        name
                    });

                    if (players.length === playerNames.length) {
                        cb(null, players);
                    }
                } else {
                    cb(err);
                }
            });
        });
    }

    getPlayers(cb) {
        this._db.all(`SELECT * FROM player`, (err, rows) => {
            cb(err, rows);
        });
    }

    createTournament(name, players, cb) {
        if (players.length < 2) {
            cb({
                err: 'Minimum 2 players are required for tournament to be created'
            });
            return;
        }

        this._insertTournament(name, (err, tournamentId) => {
            if (tournamentId) {
                const matches = generateMatches(tournamentId, players);
                let matchesInserted = 0;

                matches.forEach((match) => {
                    this._insertMatch(match, (error, inserted) => {
                        if (inserted) {
                            matchesInserted++;

                            if (matchesInserted === players.length - 1) {
                                cb(error, tournamentId);
                            }
                        } else {
                            cb(error);
                        }
                    });
                });
            } else {
                cb(err);
            }
        });
    }

    getMatch(matchId, cb) {
        this._db.all(`SELECT *, datetime(played_at, 'localtime') as played_at FROM match WHERE id = ?`, matchId, (err, rows) => {
            cb(err, rows.length, rows[0]);
        });
    }

    setScore(matchId, player1Score, player2Score, cb) {
        if (player1Score === player2Score) {
            cb({
                err: 'Match has to have a winner, it can not end in a draw'
            });
            return;
        }

        const self = this;

        this.getMatch(matchId, (err, exists, match) => {
            if (err) {
                cb(err);
                return;
            }

            if (exists) {
                if (match.player1_id === null || match.player2_id === null) {
                    cb({
                        err: 'Less than 2 players are assigned to the match, cannot set score until both players are assigned to it.'
                    });
                    return;
                }

                if (match.player1_score !== null && match.player2_score !== null) {
                    cb({
                        err: 'Score has already been set for this match'
                    });
                    return;
                }

                this._db.run(`UPDATE match SET
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
                                    self._sendWinnerToTheNextRound(match.next_round_id, winnerId, (_error, success) => {
                                        cb(_error, success);
                                    });
                                } else {
                                    self._setTournamentAsFinished(match.tournament_id, (_error, success) => {
                                        cb(_error, success);
                                    });
                                }
                            } else {
                                cb(error);
                            }
                        }
                );
            } else {
                cb({
                    err: 'Match does not exists'
                });
            }
        });
    }
}

export default DB;