import crypto from 'crypto';

const getId = () => crypto.randomBytes(10).toString('hex');

const generateMatches = (tournamentId, players, nextRoundId = null, idGenerator = getId) => {
    if (!players || !(players.length > 1)) {
        return [];
    }

    const id = idGenerator();

    if (players.length === 2) {
        // first round matches
        const [player1, player2] = players;

        return [{
            id,
            tournamentId,
            player1: player1.id,
            player2: player2.id,
            nextRoundId
        }];
    } else {
        let middle = Math.ceil(players.length / 2);
        if ((players.length % 2 === 0) && (middle % 2 !== 0)) {
            // odd number of players in both groups, move one player to the other group
            middle = middle + 1;
        }
        const group1 = players.slice(0, middle);
        const group2 = players.slice(middle);

        if (group2.length === 1) {
            // only one player in 2nd group, put him into the higher round match
            return [
                {
                    id,
                    tournamentId,
                    player1: group2[0].id,
                    player2: null,
                    nextRoundId
                },
                ...generateMatches(tournamentId, group1, id, idGenerator)
            ];
        } else {
            return [
                {
                    id,
                    tournamentId,
                    player1: null,
                    player2: null,
                    nextRoundId
                },
                ...generateMatches(tournamentId, group1, id, idGenerator),
                ...generateMatches(tournamentId, group2, id, idGenerator)
            ];
        }
    }
};

export default generateMatches;