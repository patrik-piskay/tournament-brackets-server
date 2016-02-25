import { shuffle } from 'lodash/collection';

import DB from '../database.js';
const db = new DB('../../brackets.db');

const isEmptyObj = (obj) => (Object.keys(obj).length === 0);

export const getAllTournaments = (cb) => {
    db.getTournaments((err, tournaments) => {
        if (!err) {
            cb({
                status: 200,
                json: tournaments
            });
        } else {
            cb({
                status: 500,
                json: err
            });
        }
    });
};

export const getTournament = (id, cb) => {
    db.getTournament(id, (err, tournament) => {
        if (!err) {
            if (!isEmptyObj(tournament)) {
                cb({
                    status: 200,
                    json: tournament
                });
            } else {
                cb({
                    status: 404,
                    json: {
                        err: 'Tournament not found'
                    }
                });
            }
        } else {
            cb({
                status: 500,
                json: err
            });
        }
    });
};

export const createTournament = (name, players, cb) => {
    if (name && players) {
        db.insertPlayers(players, (err, createdPlayers) => {
            if (!err) {
                db.createTournament(name, shuffle(createdPlayers), (error, tournamentId) => {
                    if (!error) {
                        db.getTournament(tournamentId, (err, tournament) => {
                            if (!err) {
                                cb({
                                    status: 200,
                                    json: tournament
                                });
                            } else {
                                cb({
                                    status: 200,
                                    json: {
                                        tournamentId
                                    }
                                });
                            }
                        });
                    } else {
                        cb({
                            status: 500,
                            json: err
                        });
                    }
                });
            } else {
                cb({
                    status: 500,
                    json: err
                });
            }
        });
    } else {
        cb({
            status: 400,
            json: {
                err: 'Both "name" and "players" have to be sent as part of the request'
            }
        });
    }
};

export const getMatch = (matchId, cb) => {
    db.getMatch(matchId, (err, exists, match) => {
        if (err) {
            cb({
                status: 500,
                json: err
            });
        } else if (!exists) {
            cb({
                status: 404,
                json: {
                    err: 'Match not found'
                }
            });
        } else {
            cb({
                status: 200,
                json: match
            });
        }
    });
};

export const setScore = (matchId, player1Score, player2Score, cb) => {
    if (isNaN(player1Score) || isNaN(player2Score)) {
        cb({
            status: 400,
            json: {
                err: 'Data sent in wrong format'
            }
        });
        return;
    }

    db.setScore(matchId, player1Score, player2Score, (err) => {
        if (!err) {
            db.getMatch(matchId, (error, exists, match) => {
                if (!error && exists) {
                    cb({
                        status: 200,
                        json: {
                            done: true,
                            match
                        }
                    });
                } else {
                    cb({
                        status: 200,
                        json: {
                            done: true
                        }
                    });
                }
            });

        } else {
            cb({
                status: 500,
                json: err
            });
        }
    });
};