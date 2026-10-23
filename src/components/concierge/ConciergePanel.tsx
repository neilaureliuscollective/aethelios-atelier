"use client";

import { useEffect, useId, useRef } from "react";
import { AppLink } from "@/components/ui/AppLink";
import { ConciergeInquiry } from "@/components/concierge/ConciergeInquiry";
import { ConciergeVoice } from "@/components/concierge/ConciergeVoice";
import { CONCIERGE_PRIVACY_NOTE } from "@/lib/concierge/identity";
import type {
  ConciergeAction,
  ConciergeFacts,
  ConciergeMessage,
  ConciergeSuggestion,
  ConciergeWelcome
} from "@/lib/concierge/types";

export function ConciergePanel({
  variant,
  welcome,
  messages,
  facts,
  suggestions,
  actions,
  pending,
  error,
  inquiryOpen,
  composer,
  onComposerChange,
  onSend,
  onSuggestion,
  onClose,
  onStartOver,
  onInquiryOpen,
  onInquiryClose,
  onInquirySubmitted,
  onAction,
  path,
  spokenText,
  onVoiceTranscript
}: {
  variant: "dock" | "inline";
  welcome: ConciergeWelcome | null;
  messages: ConciergeMessage[];
  facts: ConciergeFacts;
  suggestions: ConciergeSuggestion[];
  actions: ConciergeAction[];
  pending: boolean;
  error: string;
  inquiryOpen: boolean;
  composer: string;
  onComposerChange: (value: string) => void;
  onSend: (text?: string) => void;
  onSuggestion: (suggestion: ConciergeSuggestion) => void;
  onClose: () => void;
  onStartOver: () => void;
  onInquiryOpen: () => void;
  onInquiryClose: () => void;
  onInquirySubmitted: () => void;
  onAction: (action: ConciergeAction) => void;
  path: string;
  spokenText: string;
  onVoiceTranscript: (text: string) => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const latestRef = useRef<HTMLElement | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (variant === "dock") closeRef.current?.focus();
  }, [variant]);

  useEffect(() => {
    latestRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [messages, pending]);

  const starters = messages.length === 0 ? welcome?.starters ?? [] : suggestions;

  return (
    <section
      className={`concierge-panel concierge-panel-${variant} surface-glass`}
      role={variant === "dock" ? "dialog" : "region"}
      aria-modal={variant === "dock" ? true : undefined}
      aria-labelledby={titleId}
    >
      <header className="concierge-head">
        <div>
          <p className="kicker">Digital concierge</p>
          <h2 id={titleId}>Aethelios</h2>
          <p className="tiny">AI guide · not a person · not Neil</p>
        </div>
        <div className="concierge-head-actions">
          {variant === "dock" ? (
            <AppLink className="btn btn-ghost btn-compact" href="/concierge">
              Expand
            </AppLink>
          ) : null}
          <button type="button" className="btn btn-ghost btn-compact" onClick={onStartOver}>
            Start over
          </button>
          {variant === "dock" ? (
            <button ref={closeRef} type="button" className="btn btn-ghost btn-compact" onClick={onClose}>
              Close
            </button>
          ) : null}
        </div>
      </header>

      {inquiryOpen ? (
        <ConciergeInquiry
          facts={facts}
          messages={messages}
          path={path}
          onClose={onInquiryClose}
          onSubmitted={onInquirySubmitted}
        />
      ) : (
        <>
          <div className="concierge-thread" aria-live="polite">
            {messages.length === 0 && welcome ? (
              <article className="concierge-msg concierge-msg-assistant">
                <p className="tiny">Aethelios</p>
                {welcome.body.split("\n\n").map((para) => (
                  <p key={para.slice(0, 24)}>{para}</p>
                ))}
              </article>
            ) : null}
            {messages.map((item, index) => (
              <article
                key={item.id}
                className={`concierge-msg concierge-msg-${item.role}`}
                ref={index === messages.length - 1 ? latestRef : undefined}
              >
                <p className="tiny">{item.role === "user" ? "You" : item.liveAi ? "Aethelios" : "Aethelios · verified notes"}</p>
                {item.body.split("\n\n").map((para, paraIndex) => (
                  <p key={`${item.id}-${paraIndex}`}>{para}</p>
                ))}
              </article>
            ))}
            {pending ? (
              <p className="concierge-pending tiny" role="status">
                Aethelios is considering that…
              </p>
            ) : null}
            {error ? <p className="notice notice-warn">{error}</p> : null}
          </div>

          {starters.length ? (
            <div className="concierge-suggestions" aria-label="Suggested starting points">
              {starters.map((item) => (
                <button key={item.id} type="button" className="concierge-chip" onClick={() => onSuggestion(item)} disabled={pending}>
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}

          {actions.length ? (
            <div className="concierge-actions" aria-label="Next steps">
              {actions.map((action) =>
                action.kind === "start_inquiry" ? (
                  <button
                    key={action.label}
                    type="button"
                    className="btn btn-gold btn-compact"
                    onClick={() => {
                      onInquiryOpen();
                      onAction(action);
                    }}
                  >
                    {action.label}
                  </button>
                ) : action.kind === "start_brief" ? (
                  <AppLink key={action.href + action.label} className="btn btn-ghost btn-compact" href={action.href} onClick={() => onAction(action)}>
                    {action.label}
                  </AppLink>
                ) : (
                  <AppLink key={action.href + action.label} className="btn btn-ghost btn-compact" href={action.href} onClick={() => onAction(action)}>
                    {action.label}
                  </AppLink>
                )
              )}
            </div>
          ) : null}

          <form
            ref={formRef}
            className="concierge-composer"
            onSubmit={(event) => {
              event.preventDefault();
              onSend();
            }}
          >
            <label className="sr-only" htmlFor="concierge-input">
              Ask Aethelios
            </label>
            <textarea
              id="concierge-input"
              rows={2}
              value={composer}
              disabled={pending}
              placeholder="Describe the business, or ask a question…"
              onChange={(event) => onComposerChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSend();
                }
              }}
            />
            <button className="btn btn-gold" type="submit" disabled={pending || !composer.trim()}>
              Send
            </button>
          </form>
          <ConciergeVoice
            path={path}
            pending={pending}
            spokenText={spokenText}
            inquiryOpen={inquiryOpen}
            onTranscript={onVoiceTranscript}
          />
          <p className="concierge-privacy tiny">{CONCIERGE_PRIVACY_NOTE}</p>
        </>
      )}
    </section>
  );
}
