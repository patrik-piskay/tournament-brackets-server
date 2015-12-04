import express from 'express';
import DB from './database.js';
import bodyParser from 'body-parser';
import { shuffle } from 'lodash/collection';

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const db = new DB('brackets.db');

app.get('/', function(req, res) {
    res.send('Hello World!');
});

app.get('/get-tournaments', function(req, res) {
    db.getTournaments((tournaments, err) => {
        if (!err) {
            res.status(200).json(tournaments);
        } else {
            res.status(500).json(err);
        }
    });
});

app.get('/get-tournament/:id', function(req, res) {
    const id = parseInt(req.params.id, 10);

    db.getTournament(id, (tournament, err) => {
        if (!err) {
            res.status(200).json(tournament);
        } else {
            res.status(500).json(err);
        }
    });
});

app.post('/create-tournament', function(req, res) {
    const name = req.body.name;
    const playerNames = JSON.parse(req.body.players);

    if (name && playerNames) {
        db.insertPlayers(playerNames, (players, err) => {
            if (!err) {
                db.insertTournament(name, shuffle(players), (tournamentId, error) => {
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
        res.status(400);
    }
});

app.get('/get-match/:matchId', function(req, res) {
    const matchId = req.params.matchId;

    db.getMatch(matchId, (exists, match, err) => {
        if (err) {
            res.status(500).json(err);
        } else if (!exists) {
            res.status(404).json({ err: 'Not found' });
        } else {
            res.status(200).json(match);
        }
    });
});

app.put('/update-score/:matchId', function(req, res) {
    const matchId = req.params.matchId;
    const player1Score = parseInt(req.body.player1_score, 10);
    const player2Score = parseInt(req.body.player2_score, 10);

    if (player1Score === player2Score) {
        // match in tournament can not end with a draw
        res.status(400);
    }

    db.updateScore(matchId, player1Score, player2Score, (result, err) => {
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