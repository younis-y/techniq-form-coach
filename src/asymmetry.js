/**
 * TechnIQ AI — Bilateral Asymmetry Detection
 * Compares left vs right side landmarks to detect muscle imbalances.
 * Core novelty feature #3.
 */

import { LANDMARKS } from './pose.js';

// Body length (nose to mid-ankle, normalised image units) the pair thresholds
// below were tuned at. Below MIN_BODY_LENGTH the body is not usefully in frame.
const REFERENCE_BODY_LENGTH = 0.8;
const MIN_BODY_LENGTH = 0.1;

/**
 * Symmetric landmark pairs to compare.
 */
const SYMMETRIC_PAIRS = [
    {
        name: 'Shoulder',
        left: LANDMARKS.LEFT_SHOULDER,
        right: LANDMARKS.RIGHT_SHOULDER,
        threshold: 0.03,
        concern: 'Possible rotator cuff imbalance or scoliotic tendency',
    },
    {
        name: 'Hip',
        left: LANDMARKS.LEFT_HIP,
        right: LANDMARKS.RIGHT_HIP,
        threshold: 0.025,
        concern: 'Pelvic tilt — possible unilateral glute or hip flexor tightness',
    },
    {
        name: 'Knee',
        left: LANDMARKS.LEFT_KNEE,
        right: LANDMARKS.RIGHT_KNEE,
        threshold: 0.035,
        concern: 'Uneven load distribution — risk of unilateral knee injury',
    },
    {
        name: 'Ankle',
        left: LANDMARKS.LEFT_ANKLE,
        right: LANDMARKS.RIGHT_ANKLE,
        threshold: 0.03,
        concern: 'Ankle mobility asymmetry — may cause compensatory movement upstream',
    },
];

/**
 * Analyse bilateral asymmetry from landmarks.
 * @param {Array} landmarks - MediaPipe landmarks
 * @returns {Array<{ name: string, asymmetryPct: number, direction: string, concern: string, severity: 'normal'|'mild'|'significant' }>}
 */
export function detectAsymmetry(landmarks) {
    const results = [];

    // Grade on the gap as a share of body length, so the same imbalance grades
    // the same whether the person stands near the camera or far from it. Body
    // length is the straight-line nose to mid-ankle distance, which also holds
    // when the body is horizontal (push-up, sit-up).
    const nose = landmarks[LANDMARKS.NOSE];
    const la = landmarks[LANDMARKS.LEFT_ANKLE];
    const ra = landmarks[LANDMARKS.RIGHT_ANKLE];
    const bodyLength = Math.hypot(nose.x - (la.x + ra.x) / 2, nose.y - (la.y + ra.y) / 2);

    for (const pair of SYMMETRIC_PAIRS) {
        const left = landmarks[pair.left];
        const right = landmarks[pair.right];

        // Compare Y position (vertical asymmetry — the most clinically relevant)
        const yDiff = left.y - right.y;
        const absYDiff = Math.abs(yDiff);
        const relDiff = bodyLength > MIN_BODY_LENGTH ? absYDiff / bodyLength : 0;
        const asymmetryPct = Math.round(relDiff * 100);

        const direction = yDiff > 0 ? 'Left side lower' : 'Right side lower';

        // Thresholds were hand-set in raw image units for a person filling
        // about REFERENCE_BODY_LENGTH of the frame; converted once here.
        const threshold = pair.threshold / REFERENCE_BODY_LENGTH;
        let severity = 'normal';
        if (relDiff > threshold * 2) severity = 'significant';
        else if (relDiff > threshold) severity = 'mild';

        results.push({
            name: pair.name,
            asymmetryPct,
            direction,
            concern: pair.concern,
            severity,
            rawDiff: absYDiff,
        });
    }

    return results;
}
