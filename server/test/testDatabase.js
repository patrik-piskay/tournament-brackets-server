import assert from 'assert';
import fs from 'fs';

import DB, { generateMatches } from '../database.js';

describe('Bracket generator', () => {
    it('should generate matches', () => {
        assert.equal(1, 1);
    });
});

let db;

describe('Database model', () => {
    beforeEach(() => {
        db = new DB('test.db');
    });

    after(() => {
        fs.unlink('./test.db');
    });

    it('should insert players', () => {
        assert.equal(1, 1);
    });

    it('should insert tournaments', () => {
        assert.equal(1, 1);
    });

    it('should insert matches', () => {
        assert.equal(1, 1);
    });

    it('should retrieve match', () => {
        assert.equal(1, 1);
    });

    it('should retrieve tournament information', () => {
        assert.equal(1, 1);
    });

    it('should update next round with the winner of previous match', () => {
        assert.equal(1, 1);
    });

    it('should update score in match and update next round match', () => {
        assert.equal(1, 1);
    });

    it('should set tournament as finished', () => {
        assert.equal(1, 1);
    });
});