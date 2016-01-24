import express from 'express';
import bodyParser from 'body-parser';
import cors from 'express-cors';
import { shuffle } from 'lodash/collection';

import DB from './src/database.js';

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
    allowedOrigins: [
        'localhost',
        'localhost:8080'
    ]
}));

const db = new DB('brackets.db');

const isEmptyObj = (obj) => (Object.keys(obj).length === 0);

app.get('/', function(req, res) {
    res.json('Hi there!');
});

app.get('/get-tournaments', function(req, res) {
    db.getTournaments((err, tournaments) => {
        if (!err) {
            res.status(200).json(tournaments);
        } else {
            res.status(500).json(err);
        }
    });
});

app.get('/get-tournament/:id', function(req, res) {
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

app.post('/create-tournament', function(req, res) {
    const name = req.body.name;
    const playerNames = req.body.players && JSON.parse(req.body.players);

    if (name && playerNames) {
        db.insertPlayers(playerNames, (err, players) => {
            if (!err) {
                db.createTournament(name, shuffle(players), (error, tournamentId) => {
                    if (!error) {
                        res.status(200).json({ tournamentId });
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

app.get('/get-match/:matchId', function(req, res) {
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

app.post('/set-score/:matchId', function(req, res) {
    const matchId = req.params.matchId;
    const player1Score = parseInt(req.body.player1_score, 10);
    const player2Score = parseInt(req.body.player2_score, 10);

    db.setScore(matchId, player1Score, player2Score, (err, result) => {
        if (!err) {
            res.status(200).json(result);
        } else {
            res.status(500).json(err);
        }
    });
});

const server = app.listen(3000, function() {
    const port = server.address().port;

    console.log('Tournament brackets server listening at port', port);
});