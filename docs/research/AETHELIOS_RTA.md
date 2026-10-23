# Aethelios RTA

Full-screen voice room for Aethelios Atelier. Same concierge mind as the dock widget. Different room, longer conversation, living orb.

## 1. Why the previous build stopped

The earlier RTA turn did **not** fail on a TypeScript, lint, or tool error. Research finished (cutoffs, orb approaches, file audit). The agent was about to write files and the run was interrupted before any RTA path existed. Recovery confirmed: no `/rta` route, no orb component, no limit changes.

This document is the research that turn collected, plus what was implemented after resume.

## 2. Cutoff research — what actually clips a voice agent

Verified or primary

- **OpenAI Realtime session cap:** 60 minutes. Official docs. Public RTA does not use Realtime in this phase, so this is not the clip visitors would hit today.
- **Server VAD:** default `silence_duration_ms` around 500ms ends a user turn on a thinking pause. Semantic VAD with low eagerness is the documented way to wait.
- **Chrome SpeechRecognition:** even with `continuous: true`, Chromium ends the recognizer after silence or periodically. `onend` must restart. `no-speech` is not a permission failure.
- **Chrome SpeechSynthesis:** network voices often stop near 15 seconds. Chunk and queue utterances. `onboundary` is the only useful speech-energy signal from TTS (the utterance is not in the Web Audio graph).
- **Web Speech one-shot:** `continuous: false` (the dock widget) sends one utterance and stops.

Atelier-specific clips that were already in this repo

| Clip | Where | Dock | RTA |
| --- | --- | --- | --- |
| One-shot recognition | `ConciergeVoice` `continuous: false` | kept (tap-to-talk) | continuous + `onend` restart |
| Spoken summary 2 sentences / 320 chars | `spokenSummary`, `CONCIERGE_SPOKEN_RULE` | kept | 10 sentences / 1400 chars, then TTS chunks |
| History 12, model slice 10 | `clipHistory`, engine | kept | 40 kept, 32 sent |
| Message 2000 | talk schema + sanitize | kept | 6000 |
| Rate 24 / hour / IP | `conciergeRateLimited` | kept | 80 |
| Tokens 420 when spoken | engine | kept | 900 |
| `no-speech` treated as failure | dock onerror | kept | restart |

RTA is not given a max call duration. The visitor ends it.

## 3. Orb research — how to make it alive

Approaches found (all secondary except Web Audio / canvas, which are platform APIs)

1. **Shader blob (ChatGPT Advanced Voice Mode recreations).** Three.js / custom GLSL, vertex displacement from a single amplitude uniform. ElevenLabs Orb, Javi0108 VoiceChatGpt-Prototype, weeeha/AI-Orb. Closest to OpenAI’s smooth morphing sphere. Needs WebGL and usually a 3D library this repo does not ship.
2. **Audio-reactive mesh + frequency bands.** Same pipeline, split FFT bins (bass / mids / highs) instead of one RMS. More expressive; still a filled volume.
3. **Particle sphere (VoiceOrbs “Particles Orb”).** Hundreds of points on a rotating sphere. Black shows through. Idle breath, listen/speak scatter. Moderate CPU, no extra dependency.
4. **CSS radial orb.** The existing `public/discovery/materials/orb.svg` and the live Architect build: a **solid** emerald disc plus gold ellipses. Looks premium at rest. Does **not** move with speech. This is the static green ball the caller reported.

What ChatGPT AVM is doing (reasoned, not official)

A filled, lit volume whose surface displaces with output audio. Beautiful, generic. Affiliates and Atelier visitors would see “the ChatGPT orb in green.”

What we chose for RTA

**WebGL2 liquid-glass volume** — one analytic sphere, refracted interior, Fresnel gold rim, ACES tonemap, soft bloom. Atelier emerald/deep fill with gold as caustic, not a dotted equator. Canvas 2D stacked gradients only if WebGL2 is missing. No particle sphere, no hoop, no constant spin.

Audio drive

- **Listening:** mic RMS → `inputRef`, rim ripples only.
- **Speaking:** TTS envelope + `onboundary` → `outputRef`, interior warp and core brightness.
- **Thinking:** interior swirl, no fake audio.
- Levels use attack/release. State mixes spring. Amplitude changes depth, not spin rate.

## 4. Experience

Route: `/rta`. Black field, brand line **AETHELIOS / RTA**, orb, status (`Speaking` / `Listening` / `Considering`), presence **I'm here with you.** Controls: Minimize, Mute, Transcript, End. Minimize shrinks the room to a corner orb. Transcript is a drawer; typing still works.

Same `POST /api/concierge/talk` engine with `mode: "rta"`. Inquiry and safety paths are unchanged. The dock widget is hidden on `/rta`. If the microphone is blocked, the call stays open, mute is on, and the transcript opens so the visitor can keep talking in type.

## 5. Files

| Path | Role |
| --- | --- |
| `src/app/rta/page.tsx` | Route |
| `src/components/rta/RtaExperience.tsx` | Call UI, continuous speech, mute/transcript/minimize |
| `src/components/rta/ArchitectOrb.tsx` | Liquid-glass WebGL2 orb |
| `src/lib/rta/glassShader.ts` | Fragment/vertex program |
| `src/lib/rta/*` | Limits, speech helpers, orb math, Cedar TTS, tests |
| `src/app/api/concierge/speak/route.ts` | OpenAI Speech audio for RTA |
| `docs/research/AETHELIOS_RTA.md` | This note |

## 6. Still true

Public Realtime is still deferred (cost, abuse, Companion-only handshake). Recognition stays on the browser. Spoken replies use `POST /api/concierge/speak` with OpenAI `gpt-4o-mini-tts` and the built-in `cedar` voice when `ATELIER_OPENAI_ENABLED` and `OPENAI_API_KEY` are both set. If that gate is closed, RTA falls back to `window.speechSynthesis`. Cedar exists in OpenAI’s Speech roster (alongside marin, onyx, ash, echo, verse). OpenAI recommends marin or cedar for quality; cedar is the resonant masculine match. Verse stays on the private Companion path.
