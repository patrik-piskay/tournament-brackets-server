import express from 'express';
import db from './database.js';
import bodyParser from 'body-parser';

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function(req, res) {
    res.send('Hello World!');
});

app.get('/get-tournaments', function(req, res) {
    db.getTournaments((tournaments, err) => {
        res.json({
            tournaments,
            err
        });
    });
});

app.get('/get-tournament/:id', function(req, res) {
    const id = req.params.id;

    db.getTournament(id, (tournament, err) => {
        res.json({
            tournament,
            err
        });
    });
});

app.post('/create-tournament', function(req, res) {
    const name = req.body.name;
    const players = req.body.players;

    if (name && players) {
        db.insertTournament(name, JSON.parse(players));
    } else {
        
    }
});

app.post('/update-score/:matchId', function(req, res) {
    res.send('Hello World!');
});

const server = app.listen(3000, function() {
    const port = server.address().port;

    console.log('Tournament brackets server listening at port', port);
});