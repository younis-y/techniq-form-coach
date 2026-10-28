import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectAsymmetry } from '../src/asymmetry.js';
import { LANDMARKS as L } from '../src/pose.js';

// Standing figure centred at (0.5, 0.5); `scale` shrinks it as if the person
// stepped back from the camera. `drop` lowers the right hip by that fraction of
// the body's height.
function figure(scale, drop = 0) {
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
    const put = (i, x, y) => { lm[i] = { x: 0.5 + x * scale, y: 0.5 + y * scale }; };
    put(L.NOSE, 0, -0.4);
    put(L.LEFT_SHOULDER, -0.1, -0.3); put(L.RIGHT_SHOULDER, 0.1, -0.3);
    put(L.LEFT_HIP, -0.08, 0); put(L.RIGHT_HIP, 0.08, drop * 0.8);
    put(L.LEFT_KNEE, -0.08, 0.2); put(L.RIGHT_KNEE, 0.08, 0.2);
    put(L.LEFT_ANKLE, -0.08, 0.4); put(L.RIGHT_ANKLE, 0.08, 0.4);
    return lm;
}
const hip = (lm) => detectAsymmetry(lm).find(r => r.name === 'Hip');

test('a level body grades normal', () => {
    assert.equal(hip(figure(1)).severity, 'normal');
});

test('a clear hip drop is flagged', () => {
    assert.notEqual(hip(figure(1, 0.05)).severity, 'normal');
});

test('the same hip drop grades the same near and far from the camera', () => {
    for (const drop of [0.02, 0.04, 0.08]) {
        assert.equal(hip(figure(1, drop)).severity, hip(figure(0.5, drop)).severity, `drop ${drop}`);
    }
});

test('the displayed percentage matches what is graded', () => {
    const near = hip(figure(1, 0.05)).asymmetryPct;
    const far = hip(figure(0.5, 0.05)).asymmetryPct;
    assert.equal(near, far);
});
