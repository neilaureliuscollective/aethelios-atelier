# Aethelios voice architecture

Research and implementation decision for a **voice-first public concierge** that stays the same Aethelios as the text path. Brand spelling in this repository is **Aethelios / Aethelios Atelier** (not Aethilios / Athilios).

Verified facts, reasoned conclusions, and hypotheses are labeled.

## 1. Executive summary

The Companion workspace already has a gated OpenAI Realtime WebRTC path. The public concierge did not. The strongest practical first voice product is **not** a second speech-to-speech agent.

**Recommendation (implemented):** browser speech recognition → the existing concierge talk engine → a short spoken summary, with the full written reply on screen.

**Deferred:** public OpenAI Realtime. It is the right *later* architecture for interruption-quality conversation, but it is already gated, unreconciled for billing, expensive for anonymous visitors, and would fork personality unless it shares the same knowledge, tools, and inquiry handoff.

## 2. Current codebase findings

| Surface | What exists | Voice |
| --- | --- | --- |
| Public concierge (`src/lib/concierge`, `/api/concierge/talk`) | Text discovery, curated fallback, optional OpenAI, inquiry handoff | **This work:** browser Talk control |
| Commission brief (`AureliusBoundary`) | Project-scoped chat + tools | None |
| Companion Talk | Authenticated SSE + tools | Separate `VoiceControl` |
| Companion voice (`src/lib/cofounder/voice.ts`) | WebRTC SDP → ` /v1/realtime/sessions` + `/v1/realtime/calls`, voice `verse`, model `gpt-realtime` | Gated by `ATELIER_OPENAI_ENABLED` + `ATELIER_VOICE_COMMISSIONED`. `billedMinutes` always 0. Handshake is documented as not a billed minute. |
| Discovery Aethelios | Curated copy only | None |

Worth preserving: fail-closed OpenAI, inquiry consent path, on-device conversation storage, first-party events without message bodies, Companion tenant isolation.

Missing foundations that would block **public Realtime** today: anonymous abuse controls beyond IP rate limits, duration reconciliation, a shared tool loop with the concierge engine, and GA client-secret flow (`POST /v1/realtime/client_secrets` per current OpenAI docs). Companion still uses a beta-era handshake (`OpenAI-Beta: realtime=v1` on `/calls`).

## 3. Research sources

Official / primary

- OpenAI Realtime guide (fetched 23 Oct 2026): https://platform.openai.com/docs/guides/realtime — speech-to-speech, ephemeral client secret, WebRTC in the browser, WebSocket on the server, barge-in and turn-taking as the reason to use it. GA migration: `client_secrets`, `/v1/realtime/calls`, drop `OpenAI-Beta` for the GA interface.
- OpenAI pricing (fetched 23 Oct 2026): https://platform.openai.com/docs/pricing — `gpt-4o-mini` text $0.15 / $0.60 per 1M; `gpt-realtime` / `gpt-realtime-2.1` audio $32 / $64 per 1M tokens.
- MDN / Can I Use Speech Recognition and SpeechSynthesis (2026 tables): recognition is Chromium + Safari (prefixed); Firefox does not ship recognition. Synthesis is widely available.

Secondary (vendor or third-party; not treated as official)

- Cekura speech-to-speech bench: GPT Realtime 2.1 median reply ~1.94s; estimated ~$0.085/min from published rates. Independent, not an OpenAI claim.
- Visa agentic-commerce survey (2025): control and transparency drive trust. Consumer checkout, not B2B studio sales.
- NN/G site-specific chatbot qualities (2026): handoff, scoped flexibility, one bot, page awareness. Applied earlier to the text concierge.

ElevenLabs and similar conversational vendors were considered as **new infrastructure**. They require a new secret, a new personality path, and do not reuse Companion’s existing OpenAI boundary. Rejected for this stage.

## 4. Architecture comparison

| Approach | Latency / feel | Cost | Fits Atelier | Main risk |
| --- | --- | --- | --- | --- |
| A. Native S2S (OpenAI Realtime WebRTC) | Best barge-in and turn-taking (official reason to use it) | Audio tokens $32/$64 per 1M; minutes add up on public traffic | Already built for **Companion**, gated | Public anonymous spend/abuse; second prompt unless unified; billing not reconciled |
| B. Chained STT → LLM → TTS (OpenAI Whisper + `gpt-4o-mini` + TTS) | Higher first-audio than S2S | Whisper ~$0.003–$0.017/min class + cheap text + TTS $12/1M audio | New server audio pipeline | We receive audio; more surface; still not as interruptible as Realtime |
| C. Browser Web Speech → existing concierge → `speechSynthesis` | Recognition + one HTTP turn + device TTS. Slower than S2S. | $0 extra when curated; same `gpt-4o-mini` text when live | **Chosen for public V1** | Vendor speech services (Google/Apple/Microsoft) see audio; Firefox has no STT; TTS quality is OS-dependent |
| D. Microphone bolted onto a second chatbot | Looks like voice | Hidden cost of drift | Fails the “one Aethelios” rule | Two personalities, two knowledge bases |

**Reasoned conclusion:** C is the smallest change that makes speaking a first-class way to use the **same** discovery, knowledge, and inquiry path. A remains the upgrade for commissioned, authenticated, or spend-approved sessions.

**Uncertain until measured on this site:** actual recognition quality in noisy shops, iOS PWA recognition (WebKit bugs report home-screen web apps failing), and whether visitors prefer tap-to-talk vs hands-free.

## 5. Recommended experience

1. Visitor opens Aethelios (launcher or `/concierge`).
2. They tap **Talk** (user gesture — required for mic).
3. State is explicit: listening / considering / speaking / blocked / unavailable.
4. One utterance becomes the same `POST /api/concierge/talk` message as typing, with `spoken: true`.
5. Full written reply + cards stay on screen. Only a **two-sentence spoken summary** is read.
6. Visitor can interrupt speech by tapping Talk. They can always type.
7. Inquiry still requires review and consent. No calendar. No implied booking.

This matches “think aloud” without pretending we have production Realtime on the public site.

## 6. Conversational intelligence

Unchanged core: listen, one useful question, no re-asking, no fabricated proof, no forced funnel.

Spoken-specific: first two sentences must stand alone; lists and caveats stay written.

Discovery stages (flexible, not a CRM state machine): orientation → exploration → named problem → possible path → visitor-approved handoff.

A barbershop “I want to grow” story is **explore**, not an automatic website sale.

## 7. Handoff and commercial model

Reuse `POST /api/inquiries` with `source: "concierge"` and an editable brief. Do not add opportunity tables until founder review of stored inquiries is actually needed.

Current-stage model: **useful free discovery → permissioned founder request**. Not subscriptions, not voice minutes for sale, not autonomous implementation.

## 8. Security and privacy

- No API keys in the client.
- Public talk is rate-limited (24/hour/IP).
- Voice audio in V1 does **not** hit Atelier servers; the browser vendor’s speech service might. Disclose that.
- Do not retain audio. Transcripts stay on-device until inquiry consent.
- Do not expose Companion voice to guests (`requireCompanionWrite`).
- Prompt-injection and secret probes stay on the text safety path.

## 9. Cost (order-of-magnitude, official rates)

Assumptions: live OpenAI on, `gpt-4o-mini`, ~1.5k tokens/turn.

- Short typed/spoken session (8 turns): roughly a fraction of a cent.
- Same session on `gpt-realtime` audio: tens of cents possible; public abuse would dominate.

Measure later: events already include `voice_started`, `voice_unsupported`, `voice_denied`. Add cost when live usage is authorized.

## 10. Testing

Automated: spoken summary length, missing-API detection, growth-story intent, existing concierge journeys, inquiry source.

Manual (cannot fully automate here): Chrome/Safari mic permission, interrupt, iOS Safari vs PWA, Firefox type-only fallback, noisy room.

## 11. Roadmap

| Phase | Work | Done when |
| --- | --- | --- |
| 1 | Shared public concierge (text) | Visitors can discover and inquire without a second bot |
| 2 | Browser Talk on the same engine | Speak or type; spoken summary; honest limits |
| 3 | Tighten Companion Realtime to GA client-secrets; duration evidence | Still authenticated / commissioned only |
| 4 | Optional public Realtime after spend approval + abuse budget | Same knowledge, tools, and inquiry as text |
| Defer | ElevenLabs, always-on wake word, live scheduling, CRM sync | No existing integration; would invent capability |

## 12. Risks

- Visitors assume they are on Realtime-quality voice. Mitigation: status copy and “short spoken answer.”
- Browser vendor processes audio. Mitigation: disclosure; type remains default-capable.
- Companion and public voice could still drift if Realtime is later given a different prompt. Mitigation: one knowledge module, one inquiry path.
- Cost if phase 4 is enabled too early.

## 13. Open questions that actually need the founder

1. Authorize OpenAI spend (`ATELIER_OPENAI_ENABLED`) for live public replies?
2. Commission Companion Realtime (`ATELIER_VOICE_COMMISSIONED`) for signed-in workspace voice?
3. After duration evidence exists, should **public** Realtime ever be enabled, or stay workspace-only?
4. Inquiry delivery on production (`ATELIER_INQUIRY_TO` + Resend) — required for a real handoff, independent of voice.
