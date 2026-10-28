import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RepCounter } from '../src/repCounter.js';

// Feed a sequence of primary angles at a constant form score.
function run(exercise, angles, score = 80) {
    const rc = new RepCounter();
    rc.configure(exercise);
    for (const a of angles) rc.update(a, score);
    return rc;
}

// One rep = ramp from `from` to `to` and back, in 5° steps.
function rep(from, to) {
    const step = from > to ? -5 : 5;
    const out = [];
    for (let a = from; step < 0 ? a >= to : a <= to; a += step) out.push(a);
    for (let a = to; step < 0 ? a <= from : a >= from; a -= step) out.push(a);
    return out;
}

test('squat: three full reps count three', () => {
    const angles = [170, ...rep(170, 90), ...rep(170, 90), ...rep(170, 90)];
    assert.equal(run('squat', angles).repCount, 3);
});

test('squat: a shallow dip is not a rep', () => {
    assert.equal(run('squat', rep(170, 130)).repCount, 0);
});

test('push-up: two full reps count two', () => {
    assert.equal(run('pushup', [...rep(170, 90), ...rep(170, 90)]).repCount, 2);
});

test('lateral raise: arms at rest count nothing', () => {
    // Shoulder abduction sits near 20° at rest.
    assert.equal(run('lateral_raise', Array(60).fill(20)).repCount, 0);
});

test('lateral raise: three raises to 85° count three', () => {
    const angles = [...rep(20, 85), ...rep(20, 85), ...rep(20, 85)];
    assert.equal(run('lateral_raise', angles).repCount, 3);
});

test('lateral raise: a half raise to 50° is not a rep', () => {
    assert.equal(run('lateral_raise', rep(20, 50)).repCount, 0);
});

test('sit-up: two reps count two', () => {
    assert.equal(run('situp', [...rep(150, 55), ...rep(150, 55)]).repCount, 2);
});

test('rep score is the mean of the frame scores inside the rep', () => {
    const rc = new RepCounter();
    rc.configure('squat');
    for (const a of rep(170, 90)) rc.update(a, a < 145 ? 60 : 100);
    assert.equal(rc.repCount, 1);
    assert.ok(rc.getRepScores()[0] < 100);
});
