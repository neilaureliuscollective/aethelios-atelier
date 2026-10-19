import { DIRECTIONS, PALETTES, QUALITY_COPY, VISUAL_DIRECTION_COPY, type DiscoveryBriefMapping, type DiscoverySelection } from "@/lib/discovery";
import styles from "./DiscoveryStudio.module.css";

export function SelectionSummary({
  selection,
  mapping,
  heading = "Prepared direction"
}: {
  selection: DiscoverySelection;
  mapping: DiscoveryBriefMapping;
  heading?: string;
}) {
  const direction = DIRECTIONS[selection.selectedDirectionId];
  return (
    <article className={styles.solid} aria-labelledby="selection-summary-heading">
      <h2 id="selection-summary-heading">{heading}</h2>
      <p className={styles.badge}>Direction prepared on this device</p>
      <dl>
        <div>
          <dt>Business</dt>
          <dd>{selection.businessName || "Not specified"}</dd>
        </div>
        <div>
          <dt>Direction</dt>
          <dd>
            {direction.name} — {direction.epithet}
          </dd>
        </div>
        <div>
          <dt>Palette</dt>
          <dd>{PALETTES[selection.visualPreferences.paletteId].label}</dd>
        </div>
        <div>
          <dt>Visual</dt>
          <dd>{VISUAL_DIRECTION_COPY[selection.visualPreferences.visualDirectionId].label}</dd>
        </div>
        <div>
          <dt>Qualities</dt>
          <dd>
            {selection.desiredQualities.length
              ? selection.desiredQualities.map((id) => QUALITY_COPY[id].label).join(", ")
              : "Not specified"}
          </dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd>
            {selection.localRevision} · {selection.selectionId}
          </dd>
        </div>
      </dl>
      <p>
        {mapping.proposals.filter((item) => item.conflict).length
          ? "Some proposed fields would meet existing brief content. The other worker must offer append, replace, or skip."
          : "No existing brief fields would be overwritten by this mapping."}
      </p>
      <pre className={styles.summary}>{mapping.summary}</pre>
    </article>
  );
}
