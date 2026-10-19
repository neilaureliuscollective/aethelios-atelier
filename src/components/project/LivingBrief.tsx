import { displayFieldValue, FIELD_LABELS, provenanceLabel } from "@/lib/brief";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
import { BRIEF_FIELD_KEYS, type Brief, type Suggestion } from "@/lib/types";

export function LivingBrief({
  brief,
  suggestions,
  onResolve
}: {
  brief: Brief;
  suggestions: Suggestion[];
  onResolve?: (id: string, action: "accept" | "reject") => void;
}) {
  return (
    <aside className="surface-glass living-brief" aria-label="Living brief">
      <p className="tiny">Your direction</p>
      <h2 style={{ fontSize: 28 }}>Living brief</h2>
      <p className="muted" style={{ fontSize: 14 }}>
        Client statements, suggestions, unresolved questions, and founder decisions stay distinct.
        Suggestions are never labeled approved.
      </p>
      {BRIEF_FIELD_KEYS.map((key) => {
        const field = brief[key];
        const pending = suggestions.find((item) => item.id === field.pendingSuggestionId && item.status === "pending");
        if (!field.value && !pending && !field.unresolvedQuestion) return null;
        return (
          <div className="brief-item" key={key}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{FIELD_LABELS[key]}</strong>
              <span
                className={`badge ${
                  field.provenance.startsWith("ai_")
                    ? "badge-ai"
                    : field.provenance === "founder_decision"
                      ? "badge-founder"
                      : field.provenance === "unresolved"
                        ? "badge-open"
                        : "badge-client"
                }`}
              >
                {provenanceLabel(field.provenance)}
              </span>
            </div>
            {field.value ? <p>{displayFieldValue(key, field.value)}</p> : <p className="muted">Not yet captured</p>}
            {field.unresolvedQuestion ? (
              <p className="muted">Unresolved: {field.unresolvedQuestion}</p>
            ) : null}
            {pending ? (
              <div className="notice" style={{ marginTop: 8 }}>
                <p>
                  <strong>{INTELLIGENCE_DISPLAY_NAME} suggestion — not approved.</strong> {pending.proposedValue}
                </p>
                {pending.rationale ? <p className="muted">Context: {pending.rationale}</p> : null}
                {onResolve ? (
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="btn btn-gold" type="button" onClick={() => onResolve(pending.id, "accept")}>
                      Accept suggestion
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => onResolve(pending.id, "reject")}>
                      Keep my wording
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </aside>
  );
}
