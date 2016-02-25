import {
    getAllTournaments,
    getTournament,
    createTournament,
    getMatch,
    setScore
} from '../handlers';

const register = (server) => {
    server.get('/', function(req, res) {
        res.json('Hi there!');
    });

    server.get('/tournaments', function(req, res) {
        getAllTournaments((response) => {
            const { status, json } = response;

            res.status(status).json(json);
        });
    });

    server.get('/tournament/:id', function(req, res) {
        const id = parseInt(req.params.id, 10);

        getTournament(id, (response) => {
            const { status, json } = response;

            res.status(status).json(json);
        });
    });

    server.post('/tournament', function(req, res) {
        const name = req.body.name;
        const playerNames = req.body.players;

        createTournament(name, playerNames, (response) => {
            const { status, json } = response;

            res.status(status).json(json);
        });
    });

    server.get('/match/:matchId', function(req, res) {
        const matchId = req.params.matchId;

        getMatch(matchId, (response) => {
            const { status, json } = response;

            res.status(status).json(json);
        });
    });

    server.post('/match/:matchId/set-score', function(req, res) {
        const matchId = req.params.matchId;
        const player1Score = parseInt(req.body.player1_score, 10);
        const player2Score = parseInt(req.body.player2_score, 10);

        setScore(matchId, player1Score, player2Score, (response) => {
            const { status, json } = response;

            res.status(status).json(json);
        });
    });
};

export default {
    register
};