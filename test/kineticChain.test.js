import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { traceKineticChain } from '../src/kineticChain.js';

// Fault ids each lift's analyser can emit, read from the source so a new
// rule without a root cause fails this test.
const src = readFileSync(new URL('../src/exercises.js', import.meta.url), 'utf8');
const LIFTS = { Squat: 'squat', Pushup: 'pushup', LateralRaise: 'lateral_raise', Situp: 'situp' };
const idsByLift = Object.fromEntries(src.split('export function analyse').slice(1)
    .filter(part => part.slice(0, part.indexOf('(')) in LIFTS)
    .map(part => [LIFTS[part.slice(0, part.indexOf('('))],
        [...new Set([...part.matchAll(/id: '([a-z_]+)'/g)].map(m => m[1]))]]));

test('every fault the rule engine can raise has a root cause', () => {
    assert.equal(Object.keys(idsByLift).length, 4);
    for (const [exercise, ids] of Object.entries(idsByLift)) {
        for (const id of ids) {
            const [r] = traceKineticChain([{ id, severity: 'warning' }], exercise);
            assert.ok(r && r.rootCause, `${exercise}/${id}`);
        }
    }
});

test('depth gets a different cause on the squat and the push-up', () => {
    const squat = traceKineticChain([{ id: 'depth', severity: 'warning' }], 'squat')[0];
    const pushup = traceKineticChain([{ id: 'depth', severity: 'warning' }], 'pushup')[0];
    assert.notEqual(squat.rootCause, pushup.rootCause);
});

test('passing checks produce no root cause', () => {
    assert.deepEqual(traceKineticChain([{ id: 'knee_valgus', severity: 'success' }], 'squat'), []);
});
