/**
 * TechnIQ AI — Kinetic Chain Root-Cause Analysis
 * Maps symptoms (form faults) → upstream biomechanical causes → corrective exercises.
 * This is the core novelty feature.
 */

/**
 * Kinetic chain rules database.
 * Each rule: when a form fault is detected, trace upstream to find the root cause.
 */
const KINETIC_CHAINS = {
    // ===== SQUAT CHAINS =====
    knee_valgus: {
        symptom: 'Knee Valgus (Caving Inward)',
        chain: [
            {
                rootCause: 'Weak Hip Abductors (Gluteus Medius)',
                explanation: 'Hip abductors fail to stabilise the femur → internal rotation → knee caves inward',
                corrective: 'Banded lateral walks, clamshells, single-leg glute bridges',
                muscleGroup: 'hip',
            },
            {
                rootCause: 'Tight Adductors',
                explanation: 'Overactive inner thigh muscles pull the knee inward under load',
                corrective: 'Foam roll adductors, seated butterfly stretch',
                muscleGroup: 'hip',
            },
            {
                rootCause: 'Weak VMO (Inner Quad)',
                explanation: 'Underdeveloped vastus medialis cannot stabilise the patella during flexion',
                corrective: 'Terminal knee extensions, wall sits with ball squeeze',
                muscleGroup: 'knee',
            },
        ],
    },

    forward_lean: {
        symptom: 'Excessive Forward Lean',
        chain: [
            {
                rootCause: 'Tight Ankle Dorsiflexion',
                explanation: 'Limited ankle mobility forces the torso forward to maintain balance → excessive hip hinge',
                corrective: 'Heel-elevated squats, wall ankle stretches, banded ankle mobilisation',
                muscleGroup: 'ankle',
            },
            {
                rootCause: 'Weak Thoracic Extensors',
                explanation: 'Upper back muscles cannot maintain an upright torso position under load',
                corrective: 'Thoracic foam rolling, face pulls, prone Y-raises',
                muscleGroup: 'back',
            },
            {
                rootCause: 'Weak Core / Anterior Chain',
                explanation: 'Core cannot resist flexion forces → spine rounds forward',
                corrective: 'Dead bugs, Pallof presses, front-loaded goblet squats',
                muscleGroup: 'core',
            },
        ],
    },

    asymmetric: {
        symptom: 'Asymmetric Descent (Lateral Shift)',
        chain: [
            {
                rootCause: 'Unilateral Hip Mobility Deficit',
                explanation: 'One hip has less range of motion → body shifts to the more mobile side',
                corrective: '90/90 hip switches, pigeon stretch on the tight side',
                muscleGroup: 'hip',
            },
            {
                rootCause: 'Unilateral Glute Weakness',
                explanation: 'Weaker glute on one side cannot control the descent evenly',
                corrective: 'Single-leg Romanian deadlifts, Bulgarian split squats (weak side first)',
                muscleGroup: 'hip',
            },
        ],
    },

    // ===== PUSH-UP CHAINS =====
    hip_sag: {
        symptom: 'Hip Sag (Anterior Pelvic Tilt)',
        chain: [
            {
                rootCause: 'Weak Core (Transverse Abdominis)',
                explanation: 'Deep core cannot maintain spinal neutrality against gravity → hips drop',
                corrective: 'Planks, dead bugs, hollow body holds',
                muscleGroup: 'core',
            },
            {
                rootCause: 'Weak Glutes',
                explanation: 'Glutes fail to posteriorly tilt the pelvis → lower back hyperextends',
                corrective: 'Glute bridges before push-ups, squeeze glutes throughout the set',
                muscleGroup: 'hip',
            },
        ],
    },

    elbow_flare: {
        symptom: 'Elbow Flare (>75° from body)',
        chain: [
            {
                rootCause: 'Weak Serratus Anterior',
                explanation: 'Serratus fails to protract and stabilise the scapula → shoulder compensates by flaring elbows',
                corrective: 'Scapular push-ups, serratus wall slides',
                muscleGroup: 'shoulder',
            },
            {
                rootCause: 'Tight Pec Minor',
                explanation: 'Shortened pec minor pulls the shoulder forward → default elbow path widens',
                corrective: 'Doorway pec stretch, foam roll pec minor',
                muscleGroup: 'chest',
            },
        ],
    },

    // ===== DEPTH (keyed per lift: same id, different cause) =====
    'squat:depth': {
        symptom: 'Shallow Squat Depth',
        chain: [
            {
                rootCause: 'Limited Ankle Dorsiflexion',
                explanation: 'Shins cannot travel forward far enough → hips stop above knee height',
                corrective: 'Heel-elevated goblet squats, banded ankle mobilisation',
                muscleGroup: 'ankle',
            },
            {
                rootCause: 'Limited Hip Flexion Mobility',
                explanation: 'Hip capsule or posterior chain tightness blocks the bottom position',
                corrective: 'Deep squat holds with support, 90/90 hip switches',
                muscleGroup: 'hip',
            },
        ],
    },

    'pushup:depth': {
        symptom: 'Shallow Push-up Depth',
        chain: [
            {
                rootCause: 'Insufficient Chest and Triceps Strength',
                explanation: 'Not enough pressing strength to control the bottom range → reps cut short',
                corrective: 'Incline push-ups to full depth, slow eccentric push-ups',
                muscleGroup: 'chest',
            },
            {
                rootCause: 'Limited Shoulder Extension Mobility',
                explanation: 'Tight front of shoulder stops the chest lowering towards the floor',
                corrective: 'Doorway pec stretch, sleeper stretch',
                muscleGroup: 'shoulder',
            },
        ],
    },

    // ===== LATERAL RAISE CHAINS =====
    arm_height: {
        symptom: 'Arm Height Off Target',
        chain: [
            {
                rootCause: 'Load Too Heavy for the Lateral Delts',
                explanation: 'Delts cannot lift the weight to shoulder height, or momentum throws it past',
                corrective: 'Drop the weight, 2-second pause at shoulder height',
                muscleGroup: 'shoulder',
            },
            {
                rootCause: 'Poor Scapular Control',
                explanation: 'Shoulder blade does not upwardly rotate smoothly → arm path stalls or overshoots',
                corrective: 'Wall slides, scapular plane raises with a light band',
                muscleGroup: 'shoulder',
            },
        ],
    },

    elbow_bend: {
        symptom: 'Excess Elbow Bend',
        chain: [
            {
                rootCause: 'Compensating for a Heavy Load',
                explanation: 'Bending the elbow shortens the lever arm → the delts do less work',
                corrective: 'Lighter dumbbells, keep a soft fixed elbow throughout',
                muscleGroup: 'shoulder',
            },
            {
                rootCause: 'Biceps Taking Over',
                explanation: 'Elbow flexors join in when the lateral delts fatigue',
                corrective: 'Cable lateral raises, straight-arm band raises',
                muscleGroup: 'arm',
            },
        ],
    },

    shoulder_shrug: {
        symptom: 'Shoulder Shrug',
        chain: [
            {
                rootCause: 'Dominant Upper Trapezius',
                explanation: 'Upper traps elevate the shoulder when the lateral delts cannot finish the raise',
                corrective: 'Lighter load, depress the shoulders before each rep, Y-raises',
                muscleGroup: 'shoulder',
            },
            {
                rootCause: 'Weak Lower Trapezius',
                explanation: 'Lower traps fail to hold the shoulder blade down → it rides up',
                corrective: 'Prone Y-raises, scapular depression holds',
                muscleGroup: 'back',
            },
        ],
    },

    // ===== SIT-UP CHAINS =====
    rom: {
        symptom: 'Short Sit-up Range',
        chain: [
            {
                rootCause: 'Weak Rectus Abdominis',
                explanation: 'Abdominals cannot flex the trunk all the way up',
                corrective: 'Slow negative sit-ups, dead bugs',
                muscleGroup: 'core',
            },
            {
                rootCause: 'Tight Hip Flexors',
                explanation: 'Hip flexors pull the pelvis forward and take over the movement',
                corrective: 'Half-kneeling hip flexor stretch, crunches with feet unanchored',
                muscleGroup: 'hip',
            },
        ],
    },

    neck_strain: {
        symptom: 'Neck Pulling',
        chain: [
            {
                rootCause: 'Weak Deep Neck Flexors',
                explanation: 'Neck cannot hold its position → chin is pulled towards the chest',
                corrective: 'Chin tucks, keep a fist-sized gap between chin and chest',
                muscleGroup: 'neck',
            },
            {
                rootCause: 'Hands Pulling on the Head',
                explanation: 'Arms do the lifting when the core fatigues',
                corrective: 'Cross the arms over the chest instead',
                muscleGroup: 'core',
            },
        ],
    },

    knee_position: {
        symptom: 'Legs Too Straight',
        chain: [
            {
                rootCause: 'Setup: Feet Too Far Out',
                explanation: 'Straight legs hand the work to the hip flexors and load the lower back',
                corrective: 'Bend knees to about 90°, feet flat and hip-width apart',
                muscleGroup: 'hip',
            },
        ],
    },
};

/**
 * Given a list of form checks (from exercises.js), trace the kinetic chain
 * for any faults and return root-cause analyses.
 *
 * @param {Array} checks - Form checks from analyseForm()
 * @param {string} [exercise] - Selected lift; picks a per-lift chain such as 'squat:depth' when one exists
 * @returns {Array<{ symptom: string, rootCause: string, explanation: string, corrective: string, muscleGroup: string }>}
 */
export function traceKineticChain(checks, exercise) {
    const results = [];

    for (const check of checks) {
        if (check.severity === 'success') continue;

        const chain = KINETIC_CHAINS[`${exercise}:${check.id}`] || KINETIC_CHAINS[check.id];
        if (!chain) continue;

        // Return the most likely root cause (first in the chain)
        // In a full system, we'd use additional signals to narrow down
        const primaryCause = chain.chain[0];
        results.push({
            symptom: chain.symptom,
            rootCause: primaryCause.rootCause,
            explanation: primaryCause.explanation,
            corrective: primaryCause.corrective,
            muscleGroup: primaryCause.muscleGroup,
            allCauses: chain.chain,
        });
    }

    return results;
}
