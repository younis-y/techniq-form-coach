import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAngle } from '../src/angles.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);

test('right angle', () => close(calculateAngle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }), 90));
test('straight line (lockout) is 180, not NaN', () => close(calculateAngle({ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }), 180));
test('angle is folded into 0-180', () => close(calculateAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: -0.01 }), 180 - Math.atan2(0.01, 1) * 180 / Math.PI));
