import express from 'express';
import bodyParser from 'body-parser';
import cors from 'express-cors';
import { shuffle } from 'lodash/collection';

import DB from './database.js';

const app = express();

app.use(bodyParser.json());
app.use(cors({
    allowedOrigins: [
        'localhost',
        'localhost:8080'
    ]
}));

const db = new DB('../brackets.db');

const isEmptyObj = (obj) => (Object.keys(obj).length === 0);

app.get('/', function(req, res) {
    res.json('Hi there!');
});

app.get('/tournaments', function(req, res) {
    db.getTournaments((err, tournaments) => {
        if (!err) {
            res.status(200).json(tournaments);
        } else {
            res.status(500).json(err);
        }
    });
});

app.get('/tournament/:id', function(req, res) {
    const id = parseInt(req.params.id, 10);

    db.getTournament(id, (err, tournament) => {
        if (!err) {
            if (!isEmptyObj(tournament)) {
                res.status(200).json(tournament);
            } else {
                res.status(404).json({ err: 'Tournament not found' });
            }
        } else {
            res.status(500).json(err);
        }
    });
});

app.post('/tournament', function(req, res) {
    const name = req.body.name;
    const playerNames = req.body.players;

    if (name && playerNames) {
        db.insertPlayers(playerNames, (err, players) => {
            if (!err) {
                db.createTournament(name, shuffle(players), (error, tournamentId) => {
                    if (!error) {
                        db.getTournament(tournamentId, (err, tournament) => {
                            if (!err) {
                                res.status(200).json(tournament);
                            } else {
                                res.status(200).json({ tournamentId });
                            }
                        });
                    } else {
                        res.status(500).json(error);
                    }
                });
            } else {
                res.status(500).json(err);
            }
        });
    } else {
        res.status(400).json({
            err: 'Both "name" and "players" have to be sent as part of the request'
        });
    }
});

app.get('/match/:matchId', function(req, res) {
    const matchId = req.params.matchId;

    db.getMatch(matchId, (err, exists, match) => {
        if (err) {
            res.status(500).json(err);
        } else if (!exists) {
            res.status(404).json({ err: 'Match not found' });
        } else {
            res.status(200).json(match);
        }
    });
});

app.post('/match/:matchId/set-score', function(req, res) {
    const matchId = req.params.matchId;
    const player1Score = parseInt(req.body.player1_score, 10);
    const player2Score = parseInt(req.body.player2_score, 10);

    if (isNaN(player1Score) || isNaN(player2Score)) {
        res.status(400).json({
            err: 'Data sent in wrong format'
        });
        return;
    }

    db.setScore(matchId, player1Score, player2Score, (err) => {
        if (!err) {
            db.getMatch(matchId, (error, exists, match) => {
                if (!error && exists) {
                    res.status(200).json({
                        done: true,
                        match
                    });
                } else {
                    res.status(200).json({
                        done: true
                    });
                }
            });

        } else {
            res.status(500).json(err);
        }
    });
});

const server = app.listen(3000, function() {
    const port = server.address().port;

    console.log('Tournament brackets server listening at port', port);
});