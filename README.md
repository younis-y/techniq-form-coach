# TechnIQ

Real-time lifting form feedback from your webcam. It counts your reps, names
what is going wrong, and suggests the likely cause with a drill to fix it, all
in the browser, with no video leaving your machine.

**[▶ Try it in the browser](https://younis-y.github.io/techniq-form-coach/)** (needs webcam permission)

Built at UCL Zero to Demo 2025.

## What it does

Pick a lift (squat, push-up, lateral raise or sit-up), stand back so your whole
body is in frame, and press Start.

- **Tracks 33 body points** every frame with MediaPipe pose estimation, on your device.
- **Counts reps** with a four-phase state machine (idle → descending → bottom →
  ascending) and discards half reps.
- **Names faults as they happen**: 12 fault types across the four lifts, such as
  knees caving in, hips sagging, shrugging or pulling on your neck. The faulty
  joints light up on the skeleton.
- **Explains the likely cause.** Every fault maps to candidate root causes with a
  corrective drill. "Knees caving in" becomes "weak glute medius: banded lateral
  walks, clamshells", not just a lower score.
- **Flags left/right imbalance** at the shoulders, hips, knees and ankles, graded
  the same whether you stand near the camera or far from it.
- **Watches your form fade over a set** and, once the trend is clear, estimates the
  rep at which it drops below a set threshold.
- **Talks to you.** Spoken cues with priorities (a safety cue jumps the queue),
  optionally a two-way ElevenLabs voice coach, and a Gemini summary after the set.

The hosted demo is static, so the voice coach and the Gemini summary are off
there and spoken cues use browser speech. Everything else runs.

## How it works

```
webcam → MediaPipe pose (33 points) → joint angles → rule checks per lift → faults
                                                  ↘ rep state machine → per-rep score → fatigue trend
                                    faults → root-cause lookup → cause + drill
```

- **Angles** come from two `atan2` bearings at the joint (`src/angles.js`), which
  stays stable at lockout where an arccos formula breaks down.
- **Faults** are hand-written rules per lift in `src/exercises.js`: angular checks
  (squat depth, push-up body line) and position checks (knee offset, shoulder to
  ear gap). The frame score is the mean of the active checks.
- **Root causes** are a curated lookup in `src/kineticChain.js`, keyed by fault and,
  where one fault means different things on different lifts (depth), by lift as
  well. It is a lookup, not inference, so it is predictable and easy to inspect.
- **Imbalance** compares left/right heights as a share of body length (nose to
  mid-ankle), so distance from the camera does not change the grade
  (`src/asymmetry.js`).
- **Fatigue** fits a straight line to the per-rep scores and reports a crossing
  only with at least 5 reps and R² ≥ 0.5 (`src/fatiguePredictor.js`). Below that,
  the line would be a guess drawn through noise.

## Run it locally

Needs Node 20 or later.

```bash
npm install
cp .env.example .env   # optional: ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, GEMINI_API_KEY
npm run dev            # credential proxy on :8787, app on http://localhost:3000
```

All keys are optional. With none, voice falls back to browser speech and the set
summary to a local template.

```bash
npm test               # 22 tests: rep counting, angles, imbalance, fatigue gate, root-cause coverage
npm run build          # static build into dist/, deployed to GitHub Pages on push to main
```

## Security

API keys never reach the browser. `server/index.js` holds them and exposes four
endpoints; the front end calls only these.

| Endpoint | Purpose |
|---|---|
| `GET /api/config` | which features are configured (booleans, never secrets) |
| `POST /api/tts` | ElevenLabs text-to-speech, allow-listed voices only |
| `POST /api/coach` | Gemini set summary |
| `GET /api/agent-url` | signed WebSocket URL for the private voice agent |

The proxy caps request sizes (500 characters for speech, 4,000 for a prompt,
64 KB bodies) and returns short upstream errors, so it cannot be used as an open
relay or run up an unbounded bill. An earlier build sent keys from the browser,
and a key once committed to this repo's history has been revoked. If you deploy the proxy on the open internet, put
authentication in front of it.

## Limits

- **The thresholds are hand-set heuristics.** They were tuned by eye at a
  hackathon and have not been checked against motion capture, a coach's
  judgement, or a range of body types and camera angles.
- **2D, one person, one camera.** Results depend on standing side-on or front-on
  as each lift expects.
- **The fatigue estimate is a straight line**, gated on fit quality but not
  validated against real fatigue.
- **There is no evaluation dataset.** The tests check the logic, not accuracy on
  real lifters.

## Health disclaimer

This is a demo, not medical, physiotherapy or coaching advice. It cannot see load,
pain or past injuries, and "injury risk" in the interface is a label on an
arbitrary score threshold. Don't use it to decide whether a set is safe. If
something hurts, stop and see a professional.

## Licence

MIT; see `LICENSE`. Sources for the biomechanics notes are in
`knowledge/biomechanics.md`.
