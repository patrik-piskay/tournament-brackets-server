import assert from 'assert';

import { generateMatches } from '../database.js';

/////////////////////////// HELPER FUNCTIONS ///////////////////////////

const makePlayers = (number) => {
    let players = [];
    for (let i = 1; i <= number; i++) {
        players.push({
            id: i
        });
    }

    return players;
};

const isInt = (value) => {
    return !isNaN(value) && parseInt(value, 10) === value;
};

let generatedId;
const getId = () => generatedId++;
const resetIdGenerator = () => generatedId = 1;

////////////////////////////////////////////////////////////////////////

describe('Bracket generator', () => {
    beforeEach(() => {
        resetIdGenerator();
    });

    it('should return empty array when no players are provided', () => {
        const result1 = generateMatches(1, null, null);
        const result2 = generateMatches(1, [], null);

        assert.deepEqual(result1, []);
        assert.deepEqual(result2, []);
    });

    it('should return one item array when 1 or 2 players are provided', () => {
        const result1 = generateMatches(1, makePlayers(1), null);
        const result2 = generateMatches(1, makePlayers(2), null);

        assert.equal(result1.length, 1);
        assert.equal(result2.length, 1);
    });

    it('should return n-1 item array when n (n > 1) players are provided', () => {
        for (let i = 2; i <= 50; i++) {
            const result = generateMatches(1, makePlayers(i), null);

            assert.equal(result.length, i - 1);
        }
    });

    it('should check if players are set correctly in matches', () => {
        for (let i = 2; i <= 50; i++) {
            const result = generateMatches(1, makePlayers(i), null);

            result.forEach((match) => {
                // either both players are set, or only player1 is set, or both are not set
                assert.ok(
                    (isInt(match.player2) && isInt(match.player1)) || (
                        isInt(match.player1) || (
                            match.player1 === null && match.player2 === null
                        )
                    )
                );
            });
        }
    });

    it('should set correct tournament reference', () => {
        const result = generateMatches(1, makePlayers(10), null);

        result.forEach((match) => {
            assert.equal(match.tournamentId, 1);
        });
    });

    it('should set correct next round references', () => {
        const result1 = generateMatches(1, makePlayers(2), null, getId);
        resetIdGenerator();
        const result2 = generateMatches(1, makePlayers(3), null, getId);
        resetIdGenerator();
        const result3 = generateMatches(1, makePlayers(4), null, getId);
        resetIdGenerator();
        const result4 = generateMatches(1, makePlayers(5), null, getId);
        resetIdGenerator();
        const result5 = generateMatches(1, makePlayers(6), null, getId);
        resetIdGenerator();
        const result6 = generateMatches(1, makePlayers(7), null, getId);
        resetIdGenerator();
        const result7 = generateMatches(1, makePlayers(8), null, getId);

        assert.equal(result1[0].nextRoundId, null);

        assert.equal(result2[0].nextRoundId, null);
        assert.equal(result2[1].nextRoundId, 1);

        assert.equal(result3[0].nextRoundId, null);
        assert.equal(result3[1].nextRoundId, 1);
        assert.equal(result3[2].nextRoundId, 1);

        assert.equal(result4[0].nextRoundId, null);
        assert.equal(result4[1].nextRoundId, 1);
        assert.equal(result4[2].nextRoundId, 2);
        assert.equal(result4[3].nextRoundId, 1);

        assert.equal(result5[0].nextRoundId, null);
        assert.equal(result5[1].nextRoundId, 1);
        assert.equal(result5[2].nextRoundId, 2);
        assert.equal(result5[3].nextRoundId, 2);
        assert.equal(result5[4].nextRoundId, 1);

        assert.equal(result6[0].nextRoundId, null);
        assert.equal(result6[1].nextRoundId, 1);
        assert.equal(result6[2].nextRoundId, 2);
        assert.equal(result6[3].nextRoundId, 2);
        assert.equal(result6[4].nextRoundId, 1);
        assert.equal(result6[5].nextRoundId, 5);

        assert.equal(result7[0].nextRoundId, null);
        assert.equal(result7[1].nextRoundId, 1);
        assert.equal(result7[2].nextRoundId, 2);
        assert.equal(result7[3].nextRoundId, 2);
        assert.equal(result7[4].nextRoundId, 1);
        assert.equal(result7[5].nextRoundId, 5);
        assert.equal(result7[6].nextRoundId, 5);
    });
});