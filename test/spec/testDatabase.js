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

describe('Database model', function() {
    this.timeout(3000);

    beforeEach((done) => {
        db = new DB('test.db');

        done();
    });

    afterEach((done) => {
        db._db.close(() => {
            fs.unlink('./test.db');
            done();
        });
    });

    it('should insert players', (done) => {
        const playerNames = [
            'John',
            'Josh',
            'Mike'
        ];
        db.insertPlayers(playerNames, (err1, result) => {
            assert.equal(err1, null);

            const playersFromResponse = result.map((player) => player.name);

            assert.notEqual(playersFromResponse.indexOf('John'), -1);
            assert.notEqual(playersFromResponse.indexOf('Josh'), -1);
            assert.notEqual(playersFromResponse.indexOf('Mike'), -1);

            db.getPlayers((err2, playersFromDB) => {
                assert.equal(err2, null);

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

        db.createTournament('Tournament name', players, (error) => {
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

        db.createTournament('Tournament name', players, (err, tournamentId) => {
            assert.equal(err, null);

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
        const playerNames = ['Josh', 'Mike', 'John'];

        const match = {
            id: 1,
            tournamentId: 1,
            player1: 1,
            player2: 2,
            nextRoundId: null
        };

        db.insertPlayers(playerNames, (err1, players) => {
            db._insertMatch(match, (err1, matchId) => {
                assert.equal(err1, null);

                db.getMatch(matchId, (err2, inserted, result) => {
                    assert.equal(err2, null);

                    assert.equal(inserted, 1);
                    assert.deepEqual(result, {
                        id: '1',
                        tournament_id: match.tournamentId,
                        player1_id: match.player1,
                        player2_id: match.player2,
                        player1: players[0].name,
                        player2: players[1].name,
                        player1_score: null,
                        player2_score: null,
                        next_round_id: match.nextRoundId,
                        played_at: null
                    });

                    done();
                });
            });
        });
    });

    it('should retrieve tournament information', (done) => {
        const playerNames = ['Josh', 'Mike', 'John'];

        db.insertPlayers(playerNames, (err1, players) => {
            assert.equal(err1, null);

            db.createTournament('Tournament name', players, (err2, tournamentId) => {
                assert.equal(err2, null);

                db.getTournament(tournamentId, (err3, result) => {
                    assert.equal(err3, null);

                    const { tournament, matches } = result;

                    assert.ok(tournament);
                    assert.equal(tournament.id, tournamentId);
                    assert.equal(tournament.finished, 0);

                    assert.ok(matches);
                    assert.equal(matches.length, 2);
                    matches.forEach((match) => {
                        assert.ok(match.player1 === null || playerNames.indexOf(match.player1) !== -1);
                        assert.ok(match.player2 === null || playerNames.indexOf(match.player2) !== -1);
                        assert.equal(match.player1_score, null);
                        assert.equal(match.player2_score, null);
                        assert.equal(match.played_at, null);
                        assert.ok(match.next_round_id === null || typeof match.next_round_id === 'string');
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
        }, (err, matchId) => {
            db.setScore(matchId, 1, 1, (error) => {
                assert.equal(error.err, 'Match has to have a winner, it can not end with a draw');

                done();
            });
        });
    });

    it('should return error when trying to update score on non existant match', (done) => {
        db.setScore(0, 2, 1, (error) => {
            assert.equal(error.err, 'Match does not exists');

            done();
        });
    });

    it('should return error when trying to set a score on match where score has already been set', (done) => {
        db._insertMatch({
            id: 1,
            tournamentId: 1,
            player1: 1,
            player2: 2,
            nextRoundId: null
        }, (err, matchId) => {
            db.setScore(matchId, 2, 1, () => {
                db.setScore(matchId, 2, 1, (error) => {
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
        }, (err, matchId) => {
            db.setScore(matchId, 2, 1, (error) => {
                assert.equal(error.err, 'Less than 2 players are assigned to the match, cannot set score until both players are assigned to it.');

                done();
            });
        });
    });

    it('should return error when trying to set a score on match where less than 2 players are assigned to it', (done) => {
        db._insertMatch({
            id: 1,
            tournamentId: 1,
            player1: 1,
            player2: null,
            nextRoundId: null
        }, (err, matchId) => {
            db.setScore(matchId, 2, 1, (error) => {
                assert.equal(error.err, 'Less than 2 players are assigned to the match, cannot set score until both players are assigned to it.');

                done();
            });
        });
    });

    it('should update score in match and set "played at" timestamps', (done) => {
        db._insertTournament('Test', (err1, tournamentId) => {
            assert.equal(err1, null);

            db._insertMatch({
                id: 1,
                tournamentId: tournamentId,
                player1: 1,
                player2: 2,
                nextRoundId: null
            }, (err2, matchId) => {
                assert.equal(err2, null);

                db.setScore(matchId, 1, 1, () => {
                    db.setScore(matchId, 2, 1, (err3, result) => {
                        assert.equal(err3, null);
                        assert.ok(result);

                        db.getMatch(matchId, (err4, exists, match) => {
                            assert.equal(err4, null);

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
        }, (err1, matchId) => {
            assert.equal(err1, null);

            db._sendWinnerToTheNextRound(matchId, 1, () => {
                db.getMatch(matchId, (err2, exists, match) => {
                    assert.equal(err2, null);

                    assert.equal(match.player1_id, 1);
                    assert.equal(match.player2_id, null);

                    done();
                });
            });
        });
    });

    it('should fail when next round match does not exists', (done) => {
        db._sendWinnerToTheNextRound(0, 1, (error) => {
            assert.equal(error.err, 'Next round match does not exists');

            done();
        });
    });

    it('should set player2 in the next round match', (done) => {
        db._insertMatch({
            id: 1,
            tournamentId: 1,
            player1: 1,
            player2: null,
            nextRoundId: null
        }, (err1, matchId) => {
            db._sendWinnerToTheNextRound(matchId, 2, () => {
                db.getMatch(matchId, (err2, exists, match) => {
                    assert.equal(err2, null);

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
        }, (err, matchId) => {
            db._sendWinnerToTheNextRound(matchId, 3, (error) => {
                assert.equal(error.err, 'Both players are already assigned to the match');

                done();
            });
        });
    });

    it('should update next round with a winner of the previous match', (done) => {
        db._insertTournament('Test', (err1, tournamentId) => {
            // insert final match
            db._insertMatch({
                id: 1,
                tournamentId: tournamentId,
                player1: null,
                player2: null,
                nextRoundId: null
            }, (err2, round2matchId) => {
                // insert first semi-final
                db._insertMatch({
                    id: 2,
                    tournamentId: tournamentId,
                    player1: 1,
                    player2: 2,
                    nextRoundId: round2matchId
                }, (err3, round1match1Id) => {
                    // insert second semi-final
                    db._insertMatch({
                        id: 3,
                        tournamentId: tournamentId,
                        player1: 3,
                        player2: 4,
                        nextRoundId: round2matchId
                    }, (err4, round1match2Id) => {
                        // set result of the first semi-final match
                        db.setScore(round1match1Id, 2, 1, () => {
                            // check update of final match
                            // (winner of the first semi-final match set as player1)
                            db.getMatch(round2matchId, (err5, exists1, match1) => {
                                assert.equal(match1.player1_id, 1);
                                assert.equal(match1.player2_id, null);

                                // set result of the second semi-final match
                                db.setScore(round1match2Id, 1, 2, () => {
                                    // check update of final match
                                    // (winner of the seccond semi-final match set as player2)
                                    db.getMatch(round2matchId, (err6, exists2, match2) => {
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
        db._insertTournament('Test', (err1, tournamentId) => {
            db._setTournamentAsFinished(tournamentId, () => {
                db.getTournament(tournamentId, (err2, result) => {
                    assert.equal(err2, null);

                    const { tournament } = result;

                    assert.equal(tournament.finished, 1);

                    done();
                });
            });
        });
    });

    it('should return error when trying to set non existing tournament as finished', (done) => {
        db._setTournamentAsFinished(0, (error) => {
            assert.equal(error.err, 'Tournament does not exists');

            done();
        });
    });

    it('should set tournament as finished when the final match score is set', (done) => {
        db._insertTournament('Test', (err1, tournamentId) => {
            // insert final match
            db._insertMatch({
                id: 1,
                tournamentId: tournamentId,
                player1: 1,
                player2: 2,
                nextRoundId: null
            }, (err2, matchId) => {
                db.setScore(matchId, 1, 2, () => {
                    db.getTournament(tournamentId, (err3, result) => {
                        const { tournament } = result;

                        assert.equal(tournament.finished, 1);

                        done();
                    });
                });
            });
        });
    });
});