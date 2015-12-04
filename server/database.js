import sqlite3 from 'sqlite3';
import crypto from 'crypto';

export const generateMatches = (tournamentId, players, nextRoundId = null) => {
    const id = crypto.randomBytes(10).toString('hex');

    if (players.length <= 2) {
        // first round matches
        const [player1, player2] = players;

        return [{
            id,
            tournamentId,
            player1: player1.id,
            player2: player2 && player2.id || null,
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

class DB {
    constructor(name) {
        this._db = new sqlite3.Database(name);

        this._init();
    }

    _init() {
        this._db.serialize(() => {
            this._db.run('DROP TABLE if exists tournament');
            this._db.run('DROP TABLE if exists player');
            this._db.run('DROP TABLE if exists match');

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

    _insertMatch({ id, tournamentId, player1, player2, nextRoundId }) {
        this._db.run(
            `INSERT INTO match (id, tournament_id, player1_id, player2_id, next_round_id) VALUES (?,?,?,?,?)`,
            id, tournamentId, player1, player2, nextRoundId
        );
    }

    _sendWinnerToTheNextRound(nextRoundId, winnerId, cb) {
        this.getMatch(nextRoundId, (exists, match, error) => {
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

                this._db.run(`UPDATE match SET
                            ${slot} = $winnerId
                        WHERE id = $id`, {
                            $id: nextRoundId,
                            $winnerId: winnerId
                        }, (err) => {
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
    }

    _setTournamentAsFinished(tournamentId, cb) {
        this._db.run(`UPDATE tournament SET
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
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    getTournaments(cb) {
        this._db.all(`SELECT *, datetime(created_at, 'localtime') as created_at FROM tournament`, (err, rows) => {
            cb(rows, err);
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
    }

    insertPlayers(playerNames, cb) {
        let players = [];

        playerNames.forEach((name) => {
            this._db.run(`INSERT INTO player (name) VALUES (?)`, [name], function(err) {
                if (!err && this.lastID) {
                    players.push({
                        id: this.lastID,
                        name
                    });

                    if (players.length === playerNames.length) {
                        cb(players);
                    }
                } else {
                    cb(null, err);
                }
            });
        });
    }

    insertTournament(name, players, cb) {
        const self = this;

        this._db.run(`INSERT INTO tournament (name) VALUES (?)`, [name], function(err) {
            if (!err && this.lastID) {
                const matches = generateMatches(this.lastID, players);

                matches.forEach((match) => {
                    self._insertMatch(match);
                });

                cb(this.lastID);
            } else {
                cb(null, err);
            }
        });
    }

    getMatch(matchId, cb) {
        this._db.all(`SELECT *, datetime(played_at, 'localtime') as played_at FROM match WHERE id = ?`, matchId, (err, rows) => {
            cb(rows.length, rows[0], err);
        });
    }

    updateScore(matchId, player1Score, player2Score, cb) {
        const self = this;

        this.getMatch(matchId, (exists, match, err) => {
            if (exists) {
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
                                    self._sendWinnerToTheNextRound(match.next_round_id, winnerId, (success, _error) => {
                                        cb(success, _error);
                                    });
                                } else {
                                    self._setTournamentAsFinished(match.tournament_id, (success, _error) => {
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
}

export default DB;