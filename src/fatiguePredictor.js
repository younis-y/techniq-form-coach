/**
 * TechnIQ AI — Fatigue Predictor
 * Fits an ordinary least-squares straight line to the per-rep form scores and
 * extrapolates it to the fixed INJURY_THRESHOLD below, reporting the rep at
 * which the fitted line crosses it.
 *
 * The fit is linear, not polynomial, and it runs on one point per completed
 * rep, each a mean over noisy per-frame scores. A crossing is reported only
 * with 5+ reps and R² >= 0.5; it is still not validated. See the Scope section of the
 * README before reading anything into it.
 */

const INJURY_THRESHOLD = 55; // Form score below this = injury risk
// A crossing is only reported when the line actually explains the scores:
// at least MIN_REPS points and an R² of at least MIN_R2. Otherwise the
// "prediction" is a line drawn through noise.
const MIN_REPS = 5;
const MIN_R2 = 0.5;

/**
 * Predict the rep at which the fitted score line crosses the injury threshold.
 * Ordinary least squares, first order.
 *
 * @param {number[]} repScores - Array of form scores per rep
 * @returns {{ predictedInjuryRep: number|null, trend: 'stable'|'declining'|'critical', degradationPct: number, trendLine: number[], slope: number, r2: number }}
 */
export function predictFatigue(repScores) {
    if (repScores.length < 2) {
        return {
            predictedInjuryRep: null,
            trend: 'stable',
            degradationPct: 0,
            trendLine: [...repScores],
        };
    }

    // Calculate degradation percentage (first rep vs latest)
    const first = repScores[0];
    const last = repScores[repScores.length - 1];
    const degradationPct = first > 0 ? Math.round(((first - last) / first) * 100) : 0;

    // Determine trend
    let trend = 'stable';
    if (degradationPct > 20) trend = 'critical';
    else if (degradationPct > 8) trend = 'declining';

    // Ordinary least-squares line fit. Chosen over anything higher-order
    // because n is small; note that small n is also why the extrapolation
    // below should not be trusted.
    const n = repScores.length;
    const xs = repScores.map((_, i) => i + 1);

    // y = mx + b
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = repScores.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((sum, x, i) => sum + x * repScores[i], 0);
    const sumX2 = xs.reduce((sum, x) => sum + x * x, 0);

    const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const b = (sumY - m * sumX) / n;

    // Generate trend line
    const trendLine = xs.map(x => Math.round(m * x + b));

    // How much of the rep-to-rep variation the line explains.
    const meanY = sumY / n;
    const ssTot = repScores.reduce((s, y) => s + (y - meanY) ** 2, 0);
    const ssRes = repScores.reduce((s, y, i) => s + (y - (m * xs[i] + b)) ** 2, 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // Predict injury rep: solve m*x + b = INJURY_THRESHOLD
    let predictedInjuryRep = null;
    if (m < -0.5 && n >= MIN_REPS && r2 >= MIN_R2) {
        // Form is declining
        const injuryX = (INJURY_THRESHOLD - b) / m;
        if (injuryX > n && injuryX < n + 20) {
            predictedInjuryRep = Math.ceil(injuryX);
        } else if (injuryX <= n) {
            predictedInjuryRep = n; // Already at/past injury threshold
        }
    }

    return {
        predictedInjuryRep,
        trend,
        degradationPct,
        trendLine,
        slope: m,
        r2,
    };
}
