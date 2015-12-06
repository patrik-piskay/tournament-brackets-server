import assert from 'assert';
import fs from 'fs';

import DB from '../../src/database.js';

/////////////////////////// HELPER FUNCTIONS ///////////////////////////

const getFromDb = (db, table, where, cb) => {
    db._db.all(`SELECT * FROM ${table} ${where}`, (err, rows) => {
        cb(rows, err);
    });
};

///////////////////////////////////////////////////////////////////////

let db;

describe('Database model', () => {
    beforeEach(() => {
        db = new DB('test.db');
    });

    after(() => {
        fs.unlink('./test.db');
    });

    it('should insert players', (done) => {
        const playerNames = [
            'John',
            'Josh',
            'Mike'
        ];
        db.insertPlayers(playerNames, (result) => {
            const playersFromResponse = result.map((player) => player.name);

            assert.notEqual(playersFromResponse.indexOf('John'), -1);
            assert.notEqual(playersFromResponse.indexOf('Josh'), -1);
            assert.notEqual(playersFromResponse.indexOf('Mike'), -1);

            db.getPlayers((playersFromDB) => {
                const playerNamesFromDB = playersFromDB.map((player) => player.name);

                assert.equal(playersFromDB.length, 3);
                assert.equal(playerNamesFromDB.length, 3);
                assert.notEqual(playerNamesFromDB.indexOf('John'), -1);
                assert.notEqual(playerNamesFromDB.indexOf('Josh'), -1);
                assert.notEqual(playerNamesFromDB.indexOf('Mike'), -1);

                done();
            });
        });
    });

    it('should fail to insert tournament', (done) => {
        const players = [
            { id: 1, name: 'John Doe' }
        ];

        db.createTournament('Tournament name', players, (success, error) => {
            assert.equal(error.err, 'Minimum 2 players are required for tournament to be created');

            done();
        });
    });

    it('should insert tournament', (done) => {
        const players = [
            { id: 1, name: 'John' },
            { id: 2, name: 'Mike' }
        ];

        db.createTournament('Tournament name', players, () => {
            getFromDb(db, 'tournament', '', (data) => {
                assert.equal(data.length, 1);
                assert.equal(data[0].name, 'Tournament name');
                assert.equal(data[0].finished, 0);

                done();
            });
        });
    });

    it('should insert matches when tournament is created', (done) => {
        const players = [
            {
                id: 1,
                name: 'John'
            },
            {
                id: 2,
                name: 'Mike'
            },
            {
                id: 3,
                name: 'Josh'
            }
        ];

        const playerIds = players.map((player) => player.id);

        db.createTournament('Tournament name', players, (tournamentId) => {
            getFromDb(db, 'match', '', (data) => {
                assert.equal(data.length, 2);
                data.forEach((row) => {
                    assert.equal(row.tournament_id, tournamentId);
                    assert.equal(row.player1_score, null);
                    assert.equal(row.player2_score, null);
                    assert.ok(row.player1_id === null || playerIds.indexOf(row.player1_id) !== -1);
                    assert.ok(row.player2_id === null || playerIds.indexOf(row.player2_id) !== -1);
                    assert.equal(row.played_at, null);
                });

                done();
            });
        });
    });

    it('should retrieve specific match', (done) => {
        const match = {
            id: 1,
            tournamentId: 1,
            player1: null,
            player2: null,
            nextRoundId: null
        };
        db._insertMatch(match, (matchId) => {
            db.getMatch(matchId, (inserted, result) => {
                assert.equal(inserted, 1);
                assert.deepEqual(result, {
                    id: '1',
                    tournament_id: match.tournamentId,
                    player1_id: match.player1,
                    player2_id: match.player2,
                    player1_score: null,
                    player2_score: null,
                    next_round_id: match.nextRoundId,
                    played_at: null
                });

                done();
            });
        });
    });

    it('should retrieve tournament information', (done) => {
        const playerNames = ['Josh', 'Mike', 'John'];

        db.insertPlayers(playerNames, (players) => {
            db.createTournament('Tournament name', players, (tournamentId) => {
                db.getTournament(tournamentId, (result) => {
                    const { tournament, matches } = result;

                    assert.ok(tournament);
                    assert.equal(tournament.id, tournamentId);
                    assert.equal(tournament.finished, 0);

                    assert.ok(matches);
                    assert.equal(matches.length, 2);
                    matches.forEach((match) => {
                        assert.ok(match.player1 === null || playerNames.indexOf(match.player1) !== -1);
                        assert.ok(match.player2 === null || playerNames.indexOf(match.player2) !== -1);
                        assert.equal(match.player1Score, null);
                        assert.equal(match.player2Score, null);
                        assert.equal(match.playedAt, null);
                        assert.ok(match.nextRoundId === null || typeof match.nextRoundId === 'string');
                    });

                    done();
                });
            });
        });
    });

    it('should return error when trying to update score with a draw', (done) => {
        db._insertMatch({
            id: 1,
            tournamentId: 1,
            player1: 1,
            player2: 2,
            nextRoundId: null
        }, (matchId) => {
            db.setScore(matchId, 1, 1, (success, error) => {
                assert.equal(success, null);
                assert.equal(error.err, 'Match has to have a winner, it can not end in a draw');

                done();
            });
        });
    });

    it('should return error when trying to set a score on match where score has already been set', (done) => {
        db._insertMatch({
            id: 1,
            tournamentId: 1,
            player1: 1,
            player2: 2,
            nextRoundId: null
        }, (matchId) => {
            db.setScore(matchId, 2, 1, () => {
                db.setScore(matchId, 2, 1, (success, error) => {
                    assert.equal(success, null);
                    assert.equal(error.err, 'Score has already been set for this match');

                    done();
                });
            });
        });
    });

    it('should return error when trying to set a score on match where less than 2 players are assigned to it', (done) => {
        db._insertMatch({
            id: 1,
            tournamentId: 1,
            player1: null,
            player2: null,
            nextRoundId: null
        }, (matchId) => {
            db.setScore(matchId, 2, 1, (success, error) => {
                assert.equal(success, null);
                assert.equal(error.err, 'Less than 2 players are assigned to the match, cannot set score until both players are assigned to it.');

                done();
            });
        });

        db._insertMatch({
            id: 1,
            tournamentId: 1,
            player1: 1,
            player2: null,
            nextRoundId: null
        }, (matchId) => {
            db.setScore(matchId, 2, 1, (success, error) => {
                assert.equal(success, null);
                assert.equal(error.err, 'Less than 2 players are assigned to the match, cannot set score until both players are assigned to it.');

                done();
            });
        });
    });

    it('should update score in match and set "played at" timestamps', (done) => {
        db._insertTournament('Test', (tournamentId) => {
            db._insertMatch({
                id: 1,
                tournamentId: tournamentId,
                player1: 1,
                player2: 2,
                nextRoundId: null
            }, (matchId) => {
                db.setScore(matchId, 1, 1, () => {
                    db.setScore(matchId, 2, 1, (result) => {
                        assert.ok(result);

                        db.getMatch(matchId, (exists, match) => {
                            assert.equal(match.player1_score, 2);
                            assert.equal(match.player2_score, 1);
                            assert.notEqual(match.played_at, null);

                            done();
                        });
                    });
                });
            });
        });
    });

    it('should set player1 in the next round match', (done) => {
        db._insertMatch({
            id: 1,
            tournamentId: 1,
            player1: null,
            player2: null,
            nextRoundId: null
        }, (matchId) => {
            db._sendWinnerToTheNextRound(matchId, 1, () => {
                db.getMatch(matchId, (exists, match) => {
                    assert.equal(match.player1_id, 1);
                    assert.equal(match.player2_id, null);

                    done();
                });
            });
        });
    });

    it('should set player2 in the next round match', (done) => {
        db._insertMatch({
            id: 1,
            tournamentId: 1,
            player1: 1,
            player2: null,
            nextRoundId: null
        }, (matchId) => {
            db._sendWinnerToTheNextRound(matchId, 2, () => {
                db.getMatch(matchId, (exists, match) => {
                    assert.equal(match.player1_id, 1);
                    assert.equal(match.player2_id, 2);

                    done();
                });
            });
        });
    });

    it('should return error when 2 players are already assigned to the next round match', (done) => {
        db._insertMatch({
            id: 1,
            tournamentId: 1,
            player1: 1,
            player2: 2,
            nextRoundId: null
        }, (matchId) => {
            db._sendWinnerToTheNextRound(matchId, 3, (success, error) => {
                assert.equal(error.err, 'Both players are already assigned to the match');

                done();
            });
        });
    });

    it('should update next round with a winner of the previous match', (done) => {
        db._insertTournament('Test', (tournamentId) => {
            // insert final match
            db._insertMatch({
                id: 1,
                tournamentId: tournamentId,
                player1: null,
                player2: null,
                nextRoundId: null
            }, (round2matchId) => {
                // insert first semi-final
                db._insertMatch({
                    id: 2,
                    tournamentId: tournamentId,
                    player1: 1,
                    player2: 2,
                    nextRoundId: round2matchId
                }, (round1match1Id) => {
                    // insert second semi-final
                    db._insertMatch({
                        id: 3,
                        tournamentId: tournamentId,
                        player1: 3,
                        player2: 4,
                        nextRoundId: round2matchId
                    }, (round1match2Id) => {
                        // set result of the first semi-final match
                        db.setScore(round1match1Id, 2, 1, () => {
                            // check update of final match
                            // (winner of the first semi-final match set as player1)
                            db.getMatch(round2matchId, (exists1, match1) => {
                                assert.equal(match1.player1_id, 1);
                                assert.equal(match1.player2_id, null);

                                // set result of the second semi-final match
                                db.setScore(round1match2Id, 1, 2, () => {
                                    // check update of final match
                                    // (winner of the seccond semi-final match set as player2)
                                    db.getMatch(round2matchId, (exists2, match2) => {
                                        assert.equal(match2.player1_id, 1);
                                        assert.equal(match2.player2_id, 4);

                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    it('should set tournament as finished', (done) => {
        db._insertTournament('Test', (tournamentId) => {
            db._setTournamentAsFinished(tournamentId, () => {
                db.getTournament(tournamentId, (result) => {
                    const { tournament } = result;

                    assert.equal(tournament.finished, 1);

                    done();
                });
            });
        });
    });

    it('should return error when trying to set non existing tournament as finished', (done) => {
        db._setTournamentAsFinished(0, (success, error) => {
            assert.equal(error.err, 'Tournament does not exists');

            done();
        });
    });

    it('should set tournament as finished when the final match score is set', (done) => {
        db._insertTournament('Test', (tournamentId) => {
            // insert final match
            db._insertMatch({
                id: 1,
                tournamentId: tournamentId,
                player1: 1,
                player2: 2,
                nextRoundId: null
            }, (matchId) => {
                db.setScore(matchId, 1, 2, () => {
                    db.getTournament(tournamentId, (result) => {
                        const { tournament } = result;

                        assert.equal(tournament.finished, 1);

                        done();
                    });
                });
            });
        });
    });
});