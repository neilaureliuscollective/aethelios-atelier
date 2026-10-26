"use client";

import { useEffect, useRef } from "react";
import { useAethelios } from "@/components/aethelios/AetheliosProvider";
import { DISCOVERY_TOPICS, nextTopic } from "@/lib/concierge/brief";
import { AppLink } from "@/components/ui/AppLink";
import { ConciergeHandoff } from "./ConciergeHandoff";
import { PresentationCanvas } from "./PresentationCanvas";
import styles from "./conversation.module.css";

const STARTERS = [
  ["A better website", "I’d like a new website for my business. "],
  ["An app or client portal", "I’d like an app or client portal for my business. "],
  ["Connected systems", "I’d like to connect and automate my business systems. "]
] as const;

/** Service pages link here with ?interest=…; the composer opens on that topic. */
const INTEREST_OPENERS: Record<string, string> = {
  website: STARTERS[0][1],
  custom_apps_platforms: STARTERS[1][1],
  ecommerce_storefronts: "I’d like to sell online with a storefront for my business. ",
  digital_infrastructure: STARTERS[2][1]
};

export function ConciergeStage() {
  const { messages, document, preview, slideIndex, setSlideIndex, pending, streaming,
    error, input, setInput, send, composeDocument, abort, brief, ready, atLimit } = useAethelios();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const hasConversation = messages.some((message) => message.role === "user");

  useEffect(() => {
    const panel = messagesRef.current;
    if (panel && pinnedRef.current) panel.scrollTop = panel.scrollHeight;
  }, [messages.length, streaming]);

  useEffect(() => {
    const interest = new URLSearchParams(window.location.search).get("interest");
    const opener = interest ? INTEREST_OPENERS[interest] : undefined;
    if (opener && !input) setInput(opener);
    // Only on arrival: a later edit by the visitor must not be replaced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const covered = DISCOVERY_TOPICS.filter((topic) => brief[topic.id]);
  const upNext = nextTopic(brief);

  const condensed = [...messages.filter((message) => message.role === "user").map((message) => message.body), input.trim()].filter(Boolean).join("\n").length > 2000;

  function submit() {
    if (pending || atLimit || !input.trim()) return;
    void send(input);
  }

  return (
    <section className={styles.stage} aria-labelledby="concierge-heading">
      <div className={styles.hero}>
        <picture className={styles.heroMedia}>
          <source media="(max-width: 540px)" srcSet="/atmosphere/atelier-hero-mobile.webp" />
          <img src="/atmosphere/atelier-hero.webp"
            alt="Conceptual atelier architecture: emerald glass and champagne brass rising through warm light above an obsidian floor."
            width={2560} height={1440} fetchPriority="high" decoding="async" />
        </picture>
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>Aethelios Atelier · Built for what’s next</p>
            <h1 id="concierge-heading">Your ambition.<br /><em>Our next conversation.</em></h1>
            <p className={styles.lede}>A considered website. A smarter app. A business that works better. Tell us what you have in mind — we’ll help shape the direction.</p>
            <div className={styles.links}>
              <button className="btn btn-gold" type="button" onClick={() => inputRef.current?.focus()}>Let’s talk about your project <span aria-hidden="true">↗</span></button>
              <AppLink href="/inquire" className={styles.textLink}>Prefer to enquire directly? →</AppLink>
            </div>
            <p className={styles.note}>Founder-led design & development. No account required.</p>
          </div>
        </div>
      </div>
      <div className={styles.shell}>
        <ol className={styles.path} aria-label="Your path to a proposal">
          <li><span>01</span><div><strong>Start with your business</strong><p>Your goals, your challenges, your next chapter.</p></div></li>
          <li><span>02</span><div><strong>Shape a direction</strong><p>Turn the conversation into a document you can review.</p></div></li>
          <li><span>03</span><div><strong>Take it to Neil</strong><p>Send your brief for a personal review and next steps.</p></div></li>
        </ol>

        <div className={styles.panel} id="aethelios">
          <header className={styles.panelHead}>
            <span className={styles.monogram} aria-hidden="true">A</span>
            <div><h2>Aethelios</h2><p>Your project conversation</p></div>
            <span className={styles.badge}>Guided discovery</span>
          </header>
          {hasConversation ? (
            <div className={styles.progress} data-ready={ready ? "true" : "false"}>
              <ol aria-label={`Your brief: ${covered.length} of ${DISCOVERY_TOPICS.length} topics covered`}>
                {DISCOVERY_TOPICS.map((topic) => (
                  <li key={topic.id} title={topic.label} data-covered={brief[topic.id] ? "true" : "false"} />
                ))}
              </ol>
              <p aria-live="polite">
                {ready
                  ? "Enough for Neil — your direction can be written."
                  : upNext
                    ? `Your brief · ${covered.length} of ${DISCOVERY_TOPICS.length} · next, ${upNext.label.toLowerCase()}`
                    : "Your brief is complete."}
              </p>
            </div>
          ) : null}
          <div className={styles.messages} ref={messagesRef} role="log" aria-label="Project conversation" aria-live="polite" tabIndex={0}
            onScroll={(event) => { const panel = event.currentTarget; pinnedRef.current = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 48; }}>
            <div className={styles.welcome}>
              <p className={styles.eyebrow}>A good project starts with understanding.</p>
              <h3>What would you like<br />to make possible?</h3>
              <p>Tell me a little about your business and what you’d like to improve. It doesn’t need to be a finished idea.</p>
            </div>
            {!hasConversation && <div className={styles.starters} aria-label="Conversation starters">
              {STARTERS.map(([label, text]) => <button key={label} type="button" disabled={pending} onClick={() => { setInput(text); inputRef.current?.focus(); }}>{label}<span aria-hidden="true">↗</span></button>)}
            </div>}
            {messages.map((message) => <div key={message.id} className={styles.message} data-role={message.role}>
              <span>{message.role === "user" ? "You" : "Aethelios"}</span><p>{message.body}</p>
            </div>)}
            {pending && <div className={styles.message}><span>Aethelios · {document ? "shaping your direction" : "considering your project"}</span>{streaming ? <p>{streaming}</p> : <p className={styles.typing} aria-label="Aethelios is writing"><i /><i /><i /></p>}</div>}
          </div>
          <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); submit(); }}>
            <label htmlFor="concierge-input">Tell us about your project</label>
            <textarea id="concierge-input" ref={inputRef} value={input} maxLength={2000} disabled={pending || atLimit}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }}
              placeholder={atLimit ? "This conversation is complete — write your direction below." : "I run a business in… and I’m looking to…"} rows={3} aria-describedby="conversation-privacy" />
            <div className={styles.composerActions}><span>Shift + Enter for a new line</span>
              {pending ? <button type="button" className="btn btn-ghost" onClick={abort}>Stop response</button> : <button type="submit" className="btn btn-gold" disabled={!input.trim()}>Send message <span aria-hidden="true">↑</span></button>}
            </div>
          </form>
          {error && <div className={styles.error} role="alert"><p>{error}</p><p>Your message remains above. Try again, or <AppLink href="/inquire">send an enquiry directly</AppLink>.</p></div>}
          <footer className={styles.panelFoot}>
            <p id="conversation-privacy">A draft, not a commitment. Nothing is sent to Neil until you review and choose to send. Avoid sharing sensitive information.</p>
            {condensed && <p>For longer conversations, the direction uses your opening and latest details. Review it for missing requirements before sending.</p>}
            {hasConversation && <button type="button" className={ready && !document ? "btn btn-gold" : "btn btn-ghost"} disabled={pending} onClick={() => void composeDocument()}>{document ? "Update your direction" : "Create my direction"} <span aria-hidden="true">→</span></button>}
          </footer>
        </div>
      </div>
      {document ? <div className={styles.document}><PresentationCanvas document={document} preview={preview} index={slideIndex} onSelect={setSlideIndex} /></div>
        : hasConversation && !pending ? <div className={styles.document}><ConciergeHandoff /></div> : null}
      <div className={styles.signature}><span>Strategy meets craft.</span><span>Websites / Applications / Digital infrastructure</span></div>
    </section>
  );
}
