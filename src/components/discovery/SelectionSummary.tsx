import {
  DIRECTIONS,
  INTENT_COPY,
  PALETTES,
  QUALITY_COPY,
  VISUAL_DIRECTION_COPY,
  draftFromSelection,
  previewInstanceId,
  undecidedFromSelection,
  type DirectionId,
  type DiscoveryBriefMapping,
  type DiscoverySelection
} from "@/lib/discovery";
import { ConceptStage } from "./ConceptStage";
import styles from "./DiscoveryStudio.module.css";

const SWATCH_LABELS = ["Ground", "Signal", "Light"] as const;

export function SelectionSummary({
  selection,
  mapping,
  unpublished = false,
  heading = "Confirmed direction",
  onAction
}: {
  selection: DiscoverySelection;
  mapping: DiscoveryBriefMapping;
  unpublished?: boolean;
  heading?: string;
  onAction?: (directionId: DirectionId) => void;
}) {
  const direction = DIRECTIONS[selection.selectedDirectionId];
  const palette = PALETTES[selection.visualPreferences.paletteId];
  const visual = VISUAL_DIRECTION_COPY[selection.visualPreferences.visualDirectionId];
  const undecided = undecidedFromSelection(selection);
  const recapDraft = draftFromSelection(selection);
  const instanceId = previewInstanceId("recap", selection.selectedDirectionId);

  return (
    <article className={styles.solid} aria-labelledby="selection-summary-heading">
      <p className={styles.badge}>Direction prepared on this device</p>
      <h2 id="selection-summary-heading">{heading}</h2>
      <p className={styles.fine}>
        {unpublished
          ? "This recap is the last confirmed selection. Current studio edits are unpublished until you use this direction again."
          : "This recap is the last confirmed selection, matching the current studio."}
      </p>
      <div className={styles.recapPreview}>
        <div className={styles.previewShell} data-mode="desktop" data-preview-instance={instanceId}>
          <div className={styles.device} data-preview-device={instanceId}>
            <ConceptStage
              instanceId={instanceId}
              draft={recapDraft}
              directionId={selection.selectedDirectionId}
              onAction={onAction ?? (() => undefined)}
            />
          </div>
        </div>
      </div>
      <div className={styles.recapList}>
        <article>
          <h3>Chosen concept</h3>
          <p>
            {direction.name} — {direction.epithet}
          </p>
          <p>
            <strong>{selection.businessName || "Business name not specified"}</strong>
          </p>
        </article>
        <article>
          <h3>Palette</h3>
          <p className={styles.selectedHint}>
            {palette.label} · {visual.label}
          </p>
          <div className={styles.swatchRow}>
            {palette.preview.map((color, index) => (
              <div className={styles.swatchChip} key={`${color}-${index}`}>
                <i style={{ background: color }} aria-hidden="true" />
                <span>
                  {SWATCH_LABELS[index] ?? `Tone ${index + 1}`}: {color}
                </span>
              </div>
            ))}
          </div>
        </article>
        <article>
          <h3>Qualities and audience</h3>
          <p>
            {selection.desiredQualities.length
              ? selection.desiredQualities.map((id) => QUALITY_COPY[id].label).join(", ")
              : "Qualities not specified"}
          </p>
          <p>{selection.audience.trim() || "Audience not specified"}</p>
          {selection.customerFeeling ? <p>Customers should feel {selection.customerFeeling}.</p> : null}
        </article>
        <article>
          <h3>Written intent</h3>
          <p>{selection.intent ? INTENT_COPY[selection.intent].label : "Aim not specified"}</p>
          <p>{selection.intentNote.trim() || "No written intent was added."}</p>
        </article>
        <article>
          <h3>Priorities, notes, and exclusions</h3>
          <p>{selection.likesNote.trim() ? `What they like: ${selection.likesNote.trim()}` : "No note yet about what they like."}</p>
          <p>
            {selection.changeNote.trim()
              ? `What to change: ${selection.changeNote.trim()}`
              : "No note yet about what to change."}
          </p>
          <p>{selection.exclusions.trim() ? `Exclusions: ${selection.exclusions.trim()}` : "No exclusions were written."}</p>
        </article>
        <article>
          <h3>Still undecided</h3>
          <p>
            {undecided.length
              ? undecided.join(", ")
              : "No additional unknowns from this sketch."}
          </p>
          <p className={styles.fine}>
            Timing, budget, booking provider, and technical scope were not inferred from this direction.
          </p>
        </article>
      </div>
      <p className={styles.fine}>
        This sketch stays on this device. The existing account brief has not been checked or changed.
        A later import can offer append, replace, or skip for each proposed field against the brief
        that exists then.
      </p>
      <details>
        <summary>Copyable summary</summary>
        <pre className={styles.summary}>{mapping.summary}</pre>
      </details>
    </article>
  );
}
