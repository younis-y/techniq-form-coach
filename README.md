# TechnIQ

Real-time lifting form feedback from a webcam: 33-landmark MediaPipe pose estimation, atan2 joint-angle geometry, a rep-phase state machine, rule-based fault detection across four lifts, and a least-squares fit to per-rep form scores extrapolated to a fixed threshold.

Built for UCL Zero to Demo 2025.

## The question

A pose model gives you 33 points and nothing else. The question this project was built to probe is how far you can get from those points alone, in a browser, with no training data and no wearables: can a rule engine say something more specific than "form score 72" — can it name a probable *cause* for a fault rather than the fault itself, and can it say in advance which rep the set falls apart on?

## What the tree actually does

The first half works well enough to demonstrate. `src/kineticChain.js` maps 5 fault identifiers to 12 candidate root causes, each with an explanation and a corrective, and returns the first candidate in the list. That is a lookup table, not an inference: it does not use any additional signal to choose between the candidates for a given fault, so for a given fault it always names the same cause.

The second half does not work, and the honest result is the negative one. `src/fatiguePredictor.js` fits an ordinary least-squares straight line `score = m·rep + b` to the per-rep mean form scores, then solves for the rep at which that line crosses a fixed threshold of **55**. It reports a prediction when the fitted slope is steeper than **-0.5 points per rep** and the crossing falls no more than **20 reps** past the last rep observed. There is a second path: if the fitted line has already crossed the threshold at or before the last rep, it reports the last rep itself rather than nothing. The only case that returns no prediction at all is a shallow slope, fewer than two reps, or a crossing more than 20 reps out. The fit takes one point per completed rep, each itself the mean of noisy per-frame scores from a lite pose model, so it extrapolates from however few reps have been counted so far. The extrapolated "predicted injury rep" is therefore a number with no usable confidence attached to it, and it should be read as a demo of the mechanism rather than as a prediction. It is not validated against anything.

Numbers that describe the implementation, all verifiable in the tree:

| Quantity | Value | Where |
|---|---|---|
| Pose landmarks per frame | 33 | `src/pose.js` |
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

API keys are optional and user-supplied. Pass them once in the query string and they are cached in `localStorage`:

```
http://localhost:3000/?elevenlabs=YOUR_KEY&agent=YOUR_AGENT_ID&gemini=YOUR_KEY
```

Both keys are exposed to anyone who can see the page, and the Gemini one additionally lands in browser history and in server logs — read the Security section below before pasting a key you care about. With no keys the app is fully functional: voice falls back to browser speech synthesis and the summary to a locally assembled template.

## Security

**Both API keys this app accepts are sent from the browser and are readable by anyone who loads the page.**

*ElevenLabs.* `src/voice.js` and `src/conversationalCoach.js` both call `api.elevenlabs.io` directly from client-side JavaScript with the key in an `xi-api-key` request header. Any key that reaches this front end — bundled at build time, typed into the URL, or restored from `localStorage` — is present in the page's memory, visible in the network panel, and extractable by any visitor. This is a design limitation of calling a secret-authenticated API from a browser, and it is not fixed by moving the key into an environment variable: a Vite `import.meta.env` value is inlined into the shipped bundle in plain text.

*Google Gemini.* The same exposure applies to the optional Gemini key, in a worse form. `src/gemini.js:40` interpolates the key directly into the **request URL query string** — `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}` — rather than into a header. A key in a URL is written into places a key in a header is not: browser history, the `Referer` header, and the access logs of every proxy, CDN, and server the request passes through, where it survives long after the session ends and outside the operator's control. `README.md` instructs the reader to pass `&gemini=YOUR_KEY` in the query string of the app's own URL, which puts it in the browser's address bar and history as well, and it is then cached in `localStorage`. Treat any Gemini key given to this app as disclosed. The summary feature is optional: with no key it falls through to a locally assembled template, and that is the only mode this app should be run in with a key you care about.

The repository ships no key of either kind. The hardcoded ElevenLabs fallback that earlier private revisions carried has been removed, and the value it contained must be treated as compromised and revoked at the provider — scrubbing it from this tree does not invalidate the credential.

A production version needs the browser never to hold either key at all. For ElevenLabs the two standard routes are a server-side proxy that holds the key and forwards synthesis requests on behalf of an authenticated user, or ElevenLabs' signed-URL endpoint, where a short-lived per-session URL is minted server-side and the browser receives only that. For Gemini the only route is a server-side proxy; there is no browser-safe key form. Neither is implemented here. This is a hackathon demo and should be run locally with a personal key, or not at all.

Documented rather than quietly patched, because the shape of the flaw is the point: the fix is architectural, and a reader should be able to see what was wrong before deciding whether to trust what is left. Both flows are named here for the same reason — disclosing one client-side key flow and not the other would be worse than disclosing neither.

## Scope

What this is not, stated plainly.

- **The fault thresholds are unvalidated heuristics.** Every number in `src/exercises.js` — the 0.03 valgus offset, the 45° lean cutoff, the 12° asymmetry gate, the 160° body-line floor — was set by hand during a hackathon. None is derived from data or from the literature, and none has been checked against motion-capture ground truth, against a coach's judgement, or across body types, camera angles, or clothing. They are plausible, not calibrated.
- **The predicted injury rep is a straight line extrapolated from the per-rep score sequence.** No confidence interval, no residual check, no model selection, and no reason to believe form decays linearly in the first place. Treat the output as an illustration of the idea, not as a forecast.
- **There are no tests.** No test suite, no test runner, no CI. Nothing in this repository is verified by anything except running it and watching.
- **There are no figures and no evaluation.** No accuracy figure, no agreement study, no held-out data. There is no dataset in this repository at all.
- **The asymmetry thresholds are not scale-invariant.** They are compared against the raw y-gap in normalised image coordinates, so the same physical imbalance grades more severely the closer the subject stands to the camera. The normalised `asymmetryPct` shown in the sidebar is display-only and is not what the grade is computed from. Whether grading should instead run on the normalised figure — which would require the four thresholds to be recalibrated — is an open question and is deliberately not changed here.
- **Single-frame, single-person, 2D only.** One pose is tracked, world landmarks are fetched but unused, and every measurement is taken in image coordinates — so results depend on camera placement and on the subject staying side-on or front-on as the checks assume.
- **The root-cause chain covers 5 of the 12 fault identifiers.** `src/kineticChain.js` has entries for `knee_valgus`, `forward_lean`, `hip_sag`, `elbow_flare` and `asymmetric`. The squat and push-up are covered directly; the lateral raise and sit-up are reached only through the shared `asymmetric` rule, so their lift-specific faults — `arm_height`, `elbow_bend`, `shoulder_shrug`, `rom`, `neck_strain`, `knee_position` — raise alerts with no root-cause output.
- **Three modules in `src/` are unreachable.** `src/main.js` is the only entry point, and nothing in the import graph reaches `src/voice.js` (the original one-way TTS module, superseded by `src/conversationalCoach.js`), `src/voiceFallback.js`, or `src/biomechanicsKB.js`. `voice.js` is kept in the tree because the security note above cites it as one of the two `xi-api-key` call sites.
- **`supabase/migrations/` is not wired to anything.** The `check_ins` table and its row-level-security policies were written for a planned voice check-in feature. No code in `src/` reads or writes it, and no Supabase client is configured or included.
- **`knowledge/biomechanics.md` and `src/biomechanicsKB.js` are reference prose, not a validated clinical resource.** The 20 entries in `src/biomechanicsKB.js` were written to give a conversational agent something to ground answers in, but as noted above nothing imports that module. See the Sources section of `knowledge/biomechanics.md`.

## Health disclaimer

**This software is not medical advice, physiotherapy, or coaching advice, and must not be used as any of them.** It is an unvalidated demonstration built in a hackathon. It cannot see load, tempo, pain, prior injury, or anything outside the camera frame, and its thresholds have never been clinically reviewed. The phrase "injury risk" in the interface is a label on an arbitrary numeric threshold and carries no clinical meaning whatsoever. Do not change how you train on the strength of its output, do not use it to decide a set is safe to continue, and do not use it in place of a qualified coach, physiotherapist, or clinician. If something hurts, stop and see a professional.

## Licence

MIT, for the code in this repository; see `LICENSE`. Third-party references are cited in `knowledge/biomechanics.md` and are not covered by that licence.
