# TechnIQ

**[▶ Try it in the browser](https://younis-y.github.io/techniq-form-coach/)** — needs webcam permission. The hosted build is static, so pose estimation, rep counting and fault detection run; the ElevenLabs voice and the Gemini summary need the local proxy and are off.

Real-time lifting form feedback in the browser, built at UCL Zero to Demo 2025.
33-landmark MediaPipe pose estimation at webcam frame rate, atan2 joint-angle
geometry, a four-phase rep state machine (idle → descending → bottom →
ascending) driven by per-exercise angle thresholds, and rule-based fault
detection across four movements — squat, push-up, lateral raise and sit-up.

Everything runs client-side. No training data, no wearables, no video leaves the
machine, and credentials never reach the browser (see
[Security](#security)).

## The question

A pose model hands you 33 points and nothing else. How far can you get from those
alone: can a rule engine say something more useful than "form score 72" — can it
name a probable *cause* for a fault rather than just the fault, and can it
anticipate where a set degrades?

## What it does

**Fault detection and root-cause mapping — the working core.** The state machine
segments each repetition, joint angles are computed per frame from landmark
triples, and 19 rule checks fire across the four movements against 12 distinct
fault identifiers. `src/kineticChain.js` then maps each fault to a
candidate root cause with an explanation and a corrective, so the feedback names
a likely reason — "heels rising" becomes an ankle-mobility limitation with a
drill attached, rather than a number. The mapping is a curated lookup table
rather than an inference, which makes it predictable and inspectable.

**Fatigue extrapolation — a measured negative result.** `src/fatiguePredictor.js`
fits an ordinary least-squares line `score = m·rep + b` to per-rep mean form
scores and solves for the rep at which it crosses a threshold of 55, reporting
only when the slope is steeper than −0.5 per rep and the crossing lands within
20 reps.

The interesting finding is that this does not carry a usable signal, and the
repository says so. The fit takes one point per completed rep, each the mean of
noisy per-frame scores from a lite pose model, so on a typical set it
extrapolates a straight line through fewer than ten points and reports a number
with no confidence attached. It is shipped as a demonstration of the mechanism,
not as a prediction, and it is not validated against ground truth. Establishing
that a method does not work — and being able to say precisely why — is the more
useful half of the result.

Numbers that describe the implementation, all verifiable in the tree:

| Quantity | Value | Where |
|---|---|---|
| Pose landmarks per frame | 33 | MediaPipe `pose_landmarker`, loaded in `src/pose.js` |
| Model | `pose_landmarker_lite` float16, GPU delegate, 1 pose | `src/pose.js` |
| Detection / tracking confidence floor | 0.5 / 0.5 | `src/pose.js` |
| Lifts supported | 4 (squat, push-up, lateral raise, sit-up) | `src/exercises.js` |
| Distinct fault identifiers | 12 | `src/exercises.js` |
| Rep state machine states | 4 (idle, descending, bottom, ascending) | `src/repCounter.js` |
| Faults with a root-cause chain | 5, giving 12 candidate causes | `src/kineticChain.js` |
| Bilateral pairs compared | 4 (shoulder, hip, knee, ankle) | `src/asymmetry.js` |
| Injury-score threshold | 55 | `src/fatiguePredictor.js` |
| Slope gate for a prediction | m < -0.5 | `src/fatiguePredictor.js` |
| Extrapolation horizon | last rep + 20; a crossing at or before the last rep reports the last rep | `src/fatiguePredictor.js` |
| Voice throttles | 4.5 s between cues (queued mode, 4 priority levels); 15 s minimum between proactive pushes (agent mode) | `src/conversationalCoach.js` |

The 12 was counted as the distinct `id` values emitted by `checks.push` (`grep -o "id: '[a-z_]*'" src/exercises.js | sort -u`); the file has 19 push sites rather than 12 because several identifiers are emitted from more than one branch or from more than one lift's analyser, and some of those branches are all-clear results carrying `severity: 'success'`.

## Method

**Angles.** `calculateAngle(a, b, c)` in `src/angles.js` takes the difference of two `atan2` bearings measured at the vertex `b`, folds the result into 0-180°, and works in MediaPipe's normalised image coordinates, where y increases downward. `angleFromVertical` gives torso lean the same way. Using `atan2` rather than a dot-product arccosine avoids the numerical blow-up when the segments are nearly collinear, which is exactly the regime a lockout sits in.

**Faults.** Each lift has its own analyser returning a list of checks, each with a severity, a 0-100 score, and the landmark indices to highlight. Some checks are angular (squat depth from mean knee flexion, push-up body line from shoulder-hip-ankle); others are raw coordinate differences in normalised units (knee valgus at a 0.03 medial offset, elbow flare at 0.12, shoulder shrug at an ear-to-shoulder gap below 0.06). The per-frame overall score is the unweighted mean of the active checks.

**Reps.** `RepCounter` in `src/repCounter.js` runs one primary angle per lift through a four-state machine with per-exercise entry thresholds — knee angle for the squat, elbow for the push-up, shoulder abduction for the lateral raise, hip for the sit-up. Descents that reverse before reaching the bottom threshold are discarded as partial reps after a 10-frame guard. A completed rep stores the mean of the frame scores sampled across it; that sequence is the input to the fatigue fit.

**Asymmetry.** `src/asymmetry.js` compares the vertical position of four left/right landmark pairs. The grade is taken from the **raw** y-gap in normalised image units: mild above the pair's threshold, significant above twice it. The nose-to-ankle span is used only to turn that gap into the `asymmetryPct` figure shown in the sidebar; it plays no part in the grading. The per-pair thresholds are therefore **not scale-invariant** — the same physical imbalance grades higher when the subject stands closer to the camera. It is a single-frame measure and is not accumulated over the set.

**Coaching.** With no ElevenLabs agent configured, cues are queued with four priority levels and a 4.5-second floor between utterances, so an injury-severity cue displaces pending encouragement rather than waiting behind it. With an agent configured, `src/conversationalCoach.js` hands that job over to a two-way conversational session and the local cue queue is bypassed. A context push is attempted on an 8-second timer and again on each completed rep, but every attempt returns early unless at least 15 seconds have passed since the last successful push *and* the current form state carries a danger alert, a warning alert, or a fatigue prediction — so form state reaches the agent at most once every 15 seconds, and on a clean set never. Absent an API key entirely, everything falls through to browser `SpeechSynthesis`. The post-set summary calls Gemini if a key is present and otherwise assembles a template.

## Reproducing

```bash
npm install
npm run dev
```

Vite serves on port 3000 and opens a browser. Grant camera access, pick a lift, stand back far enough that hips and ankles are in frame, and press Start. Everything — the pose model, the angle maths, the rule engine, the fit — runs client-side; no video leaves the machine.

Credentials are optional, and none of them go in the browser. Copy
`.env.example` to `.env` and fill in whichever you have:

```bash
cp .env.example .env      # ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, GEMINI_API_KEY
npm run dev               # starts the credential proxy on :8787 and Vite on :3000
```

With no keys the app is fully functional: voice falls back to browser speech
synthesis and the set summary to a locally assembled template. The page asks the
proxy what is configured (`GET /api/config`) and gets back booleans, never
secrets, so it degrades without being told why.

## Security

Keys never enter the browser. `server/index.js` holds them and exposes four
endpoints; the front end calls those and nothing else.

| Endpoint | Purpose |
|---|---|
| `GET /api/config` | booleans describing what is configured |
| `POST /api/tts` | ElevenLabs text-to-speech, returns `audio/mpeg` |
| `POST /api/coach` | Gemini set summary, returns `{ text }` |
| `GET /api/agent-url` | signed WebSocket URL for a private conversational agent |

**This is a fix, not a mitigation, and it is worth saying what it replaced.** The
original build shipped the ElevenLabs key as a client-side `xi-api-key` header
from `src/voice.js` and `src/conversationalCoach.js`, and put the Gemini key in a
request **query string** in `src/gemini.js`. Both were readable by any visitor
through the network panel. The query-string form was worse: a key in a URL is
written into browser history, the `Referer` header, and the access logs of every
proxy and CDN the request crosses, where it outlives the session entirely. The
README of the day instructed readers to pass their key in the app's own URL,
which put it in the address bar too.

A key that was committed to this repository's history has been revoked. Moving a
secret into a Vite environment variable would not have helped — `import.meta.env`
values are inlined into the shipped bundle in plain text.

Three things the proxy does beyond forwarding, because a naive proxy is its own
hazard:

- **Voice allow-list.** `/api/tts` accepts only voice IDs in `ALLOWED_VOICES`.
  Without it the endpoint is an open relay: anyone reaching it could synthesise
  against any voice on the account and burn the quota.
- **Length caps.** 500 characters for speech, 4,000 for a prompt, and a 64 KB
  body limit, so a single request cannot run up an unbounded bill.
- **Terse upstream errors.** Provider failures are returned as
  `{"error":"tts upstream 401"}` rather than passed through, since provider error
  bodies can echo account detail.

The proxy is the trust boundary. Deploy it somewhere with its own network
controls, and put authentication in front of it if it is reachable from the open
internet — the caps above bound the damage, they do not prevent use.

## Scope

What this is not, stated plainly.

- **The fault thresholds are unvalidated heuristics.** Every number in `src/exercises.js` — the 0.03 valgus offset, the 45° lean cutoff, the 12° asymmetry gate, the 160° body-line floor — was set by hand during a hackathon. None is derived from data or from the literature, and none has been checked against motion-capture ground truth, against a coach's judgement, or across body types, camera angles, or clothing. They are plausible, not calibrated.
- **The predicted injury rep is a straight line extrapolated from the per-rep score sequence.** No confidence interval, no residual check, no model selection, and no reason to believe form decays linearly in the first place. Treat the output as an illustration of the idea, not as a forecast.
- **There are no tests.** No test suite, no test runner, no CI. Nothing in this repository is verified by anything except running it and watching.
- **There are no figures and no evaluation.** No accuracy figure, no agreement study, no held-out data. There is no dataset in this repository at all.
- **The asymmetry thresholds are not scale-invariant.** They are compared against the raw y-gap in normalised image coordinates, so the same physical imbalance grades more severely the closer the subject stands to the camera. The normalised `asymmetryPct` shown in the sidebar is display-only and is not what the grade is computed from. Whether grading should instead run on the normalised figure — which would require the four thresholds to be recalibrated — is an open question and is deliberately not changed here.
- **Single-frame, single-person, 2D only.** One pose is tracked, world landmarks are fetched but unused, and every measurement is taken in image coordinates — so results depend on camera placement and on the subject staying side-on or front-on as the checks assume.
- **The root-cause chain covers 5 of the 12 fault identifiers.** `src/kineticChain.js` has entries for `knee_valgus`, `forward_lean`, `hip_sag`, `elbow_flare` and `asymmetric`. The squat and push-up are covered directly; the lateral raise and sit-up are reached only through the shared `asymmetric` rule, so their lift-specific faults — `arm_height`, `elbow_bend`, `shoulder_shrug`, `rom`, `neck_strain`, `knee_position` — raise alerts with no root-cause output.
- **Three modules in `src/` are unreachable.** `src/main.js` is the only entry point, and nothing in the import graph reaches `src/voice.js` (the original one-way TTS module, superseded by `src/conversationalCoach.js`), `src/voiceFallback.js`, or `src/biomechanicsKB.js`. `voice.js` is kept because it is the clearest example of the call pattern the proxy replaced, and it now routes through `/api/tts` like everything else.
- **`supabase/migrations/` is not wired to anything.** The `check_ins` table and its row-level-security policies were written for a planned voice check-in feature. No code in `src/` reads or writes it, and no Supabase client is configured or included.
- **`knowledge/biomechanics.md` and `src/biomechanicsKB.js` are reference prose, not a validated clinical resource.** The 20 entries in `src/biomechanicsKB.js` were written to give a conversational agent something to ground answers in, but as noted above nothing imports that module. See the Sources section of `knowledge/biomechanics.md`.

## Health disclaimer

**This software is not medical advice, physiotherapy, or coaching advice, and must not be used as any of them.** It is an unvalidated demonstration built in a hackathon. It cannot see load, tempo, pain, prior injury, or anything outside the camera frame, and its thresholds have never been clinically reviewed. The phrase "injury risk" in the interface is a label on an arbitrary numeric threshold and carries no clinical meaning whatsoever. Do not change how you train on the strength of its output, do not use it to decide a set is safe to continue, and do not use it in place of a qualified coach, physiotherapist, or clinician. If something hurts, stop and see a professional.

## Licence

MIT, for the code in this repository; see `LICENSE`. Third-party references are cited in `knowledge/biomechanics.md` and are not covered by that licence.
