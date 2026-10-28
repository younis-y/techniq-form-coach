import { test } from 'node:test';
import assert from 'node:assert/strict';
import { predictFatigue } from '../src/fatiguePredictor.js';

test('a steady decline over enough reps predicts a crossing', () => {
    const r = predictFatigue([90, 86, 82, 78, 74, 70]);
    assert.equal(r.predictedInjuryRep, 10);
    assert.ok(r.r2 > 0.99);
});

test('too few reps never predict, however steep', () => {
    assert.equal(predictFatigue([90, 80, 70]).predictedInjuryRep, null);
});

test('noisy scores with no real trend do not predict', () => {
    assert.equal(predictFatigue([90, 60, 88, 62, 86, 64, 84]).predictedInjuryRep, null);
});

test('stable form is stable', () => {
    const r = predictFatigue([85, 86, 84, 85, 86]);
    assert.equal(r.trend, 'stable');
    assert.equal(r.predictedInjuryRep, null);
});
