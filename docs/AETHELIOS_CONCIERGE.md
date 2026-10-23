# Aethelios public concierge

Visitor-facing digital concierge for Aethelios Atelier. This is not Companion Talk, not the commission-brief assistant, and not Discovery’s curated guide.

Aethelios is an AI-powered extension of Neil Stutes’s approach. He does not impersonate Neil, accept work, or invent proof.

## Surfaces

| Surface | Behavior |
| --- | --- |
| Marketing pages (`/`, `/services`, `/approach`, `/about`, `/pricing`, `/discover`, `/inquire`, `/custom-projects`, `/services/barbers-salons`) | Persistent launcher + docked panel |
| `/concierge` | Dedicated inline view, same on-device conversation |
| `/project`, `/companion`, `/workspace`, `/founder`, `/account`, `/offline` | Hidden — those routes already have their own threads or are private |

Entry points: hero and home-page actions (`atelier:open-concierge`), footer link, launcher. No auto-open popup.

## Architecture

```
UI (ConciergeRoot / ConciergePanel)
  → POST /api/concierge/talk
      → ConciergeEngine
          → safety + intent + fact extraction
          → curatedTurn (always available)
          → OpenAI chat completions only when aureliusStatus().ready
  → POST /api/inquiries  (source: concierge, visitor-reviewed brief)
  → POST /api/concierge/events  (named events only)
```

Layers, kept separate on purpose:

1. **Identity** — `src/lib/concierge/identity.ts`, `instructions.ts`
2. **Business knowledge** — `knowledge.ts` reads `SERVICE_CATALOG`, `AURELIUS_FACTS`, Fix It Shop, process
3. **Website context** — `pages.ts` (current path only; no repository or env access)
4. **Conversation context** — on-device `atelier.concierge.v1` + last 12 messages on the request
5. **Actions** — links to real routes, brief start, inquiry handoff
6. **Policies** — no quotes, no calendar, no invented proof, untrusted visitor text wrapped

## Voice

Public Talk is a **modality** on this same engine, not a second assistant.

- Browser `SpeechRecognition` / `webkitSpeechRecognition` for dictation where the browser supports it.
- `speechSynthesis` reads only `spokenText` (first two sentences). The full reply stays on screen.
- `POST /api/concierge/talk` with `spoken: true` when the turn came from the microphone.
- Firefox and other browsers without recognition fall back to typing. That is disclosed, not hidden.
- Companion WebRTC (`/api/companion/voice`) stays authenticated and gated. Public visitors do not use it.

See `docs/research/AETHELIOS_VOICE.md`.

## Live model vs curated path

The same OpenAI gate as the rest of Atelier:

- Off unless `ATELIER_OPENAI_ENABLED=true` **and** `OPENAI_API_KEY` is set
- Model: `OPENAI_MODEL` (default `gpt-4o-mini`), timeout and max tokens from existing config
- Cost: public turns are rate-limited (24/hour/IP). Output is capped below the brief-assistant maximum
- When live is off, or the model returns empty text, visitors still get grounded curated guidance
- Secret/injection probes never reach the model
- Provider errors return a recovery message and a real inquiry path — never a fake success

Keys stay server-side. `/api/config` exposes `concierge.live` only.

## Inquiry handoff

`ConciergeInquiry` builds an editable brief from known facts and recent visitor lines, then posts to the existing inquiry pipeline with `source: "concierge"`. Delivery is still email / local capture / mailto / unconfigured. The UI does not claim a send unless that pipeline returns success.

## Measurement

First-party events in process memory via `POST /api/concierge/events`:

`opened`, `first_message`, `suggestion_selected`, `engaged`, `link_clicked`, `inquiry_started`, `inquiry_submitted`, `handoff_requested`, `response_failed`, `abandoned`

No message bodies. Nothing is forwarded to an analytics vendor from this code. To attach a provider later, replace `recordConciergeEvent` — do not log conversation text.

## Privacy

- Conversation text is stored in `localStorage` on the visitor’s device
- Server receives the current turn plus clipped history for the model/curated engine
- Personal details enter Atelier systems only after inquiry consent
- Rate limit is IP-based and in-memory (same class as guest inquiries)

## Tests

`src/lib/concierge/concierge.test.ts` and `engine.test.ts` cover the quality scenarios in the build directive (known service, vague problem, about, out-of-scope, pricing, proof, handoff, inquiry, change of direction, no re-asking, provider failure, malformed/malicious input, secret probes). Inquiry source `concierge` is covered in `src/lib/inquiry/inquiry.test.ts`.

## What this is not

- Not a scheduler
- Not a CRM write
- Not autonomous site generation
- Not Companion / Business Studio
- Not a claim that live AI is on in production
