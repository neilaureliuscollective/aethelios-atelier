"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type RefObject
} from "react";
import {
  DIRECTION_ORDER,
  DIRECTIONS,
  PALETTES,
  PALETTE_IDS,
  VISUAL_DIRECTION_COPY,
  VISUAL_DIRECTION_IDS,
  browserStorage,
  buildConceptContent,
  clearDiscovery,
  confirmSelection,
  createDraft,
  createEnvelope,
  createGuideView,
  currentGuideView,
  defaultPaletteFor,
  hasUnpublishedChanges,
  mapSelectionToBriefProposals,
  patchDraft,
  readDiscovery,
  recommendDirection,
  resetField,
  toggleFavorite,
  toggleQuality,
  writeDiscovery,
  type DirectionId,
  type DiscoveryDraft,
  type DiscoveryPhase,
  type DiscoverySelection,
  type GuideState,
  type PaletteId,
  type PersistenceState,
  type PreviewMode,
  type VisualDirectionId
} from "@/lib/discovery";
import { ConceptStage } from "./ConceptStage";
import { Entrance } from "./Entrance";
import { Intake } from "./Intake";
import { Qualities } from "./Qualities";
import { SelectionSummary } from "./SelectionSummary";
import styles from "./DiscoveryStudio.module.css";

const PHASES: Array<{ id: DiscoveryPhase; label: string }> = [
  { id: "enter", label: "Enter" },
  { id: "intake", label: "Business" },
  { id: "qualities", label: "Qualities" },
  { id: "studio", label: "Studio" },
  { id: "compare", label: "Compare" },
  { id: "review", label: "Review" }
];

type State = {
  phase: DiscoveryPhase;
  farthest: DiscoveryPhase;
  intakeStep: number;
  draft: DiscoveryDraft;
  confirmed: DiscoverySelection | null;
  previewMode: PreviewMode;
  persistenceOptIn: boolean;
  persistenceState: PersistenceState;
  persistenceMessage: string;
  status: string;
};

type Action =
  | { type: "hydrate"; state: Partial<State> }
  | { type: "phase"; phase: DiscoveryPhase }
  | { type: "intake"; step: number }
  | { type: "patch"; patch: Partial<DiscoveryDraft> }
  | { type: "draft"; draft: DiscoveryDraft }
  | { type: "confirm"; selection: DiscoverySelection }
  | { type: "preview"; mode: PreviewMode }
  | { type: "persist"; optIn: boolean; persistenceState: PersistenceState; message: string }
  | { type: "status"; status: string };

function farthestOf(a: DiscoveryPhase, b: DiscoveryPhase): DiscoveryPhase {
  return PHASES.findIndex((item) => item.id === a) >= PHASES.findIndex((item) => item.id === b) ? a : b;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.state };
    case "phase":
      return {
        ...state,
        phase: action.phase,
        farthest: farthestOf(state.farthest, action.phase),
        status: ""
      };
    case "intake":
      return { ...state, intakeStep: action.step };
    case "patch":
      return { ...state, draft: patchDraft(state.draft, action.patch) };
    case "draft":
      return { ...state, draft: action.draft };
    case "confirm":
      return {
        ...state,
        confirmed: action.selection,
        phase: "review",
        farthest: "review",
        status: "Direction prepared on this device."
      };
    case "preview":
      return { ...state, previewMode: action.mode };
    case "persist":
      return {
        ...state,
        persistenceOptIn: action.optIn,
        persistenceState: action.persistenceState,
        persistenceMessage: action.message
      };
    case "status":
      return { ...state, status: action.status };
    default:
      return state;
  }
}

const initial: State = {
  phase: "enter",
  farthest: "enter",
  intakeStep: 0,
  draft: createDraft(),
  confirmed: null,
  previewMode: "desktop",
  persistenceOptIn: false,
  persistenceState: "memory",
  persistenceMessage: "Kept in memory for this visit unless you opt in below.",
  status: ""
};

export function DiscoveryStudio() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [demoOpen, setDemoOpen] = useState(false);
  const [guidePreview, setGuidePreview] = useState<GuideState>("unavailable");
  const deviceRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (demoOpen && !node.open) node.showModal();
    if (!demoOpen && node.open) node.close();
  }, [demoOpen]);

  useEffect(() => {
    const result = readDiscovery(browserStorage());
    if (result.ok && result.state === "opted_in" && result.envelope) {
      dispatch({
        type: "hydrate",
        state: {
          draft: result.envelope.draft,
          confirmed: result.envelope.confirmed,
          phase: result.envelope.phase,
          farthest: farthestOf(result.envelope.phase, "enter"),
          intakeStep: result.envelope.intakeStep,
          persistenceOptIn: true,
          persistenceState: "opted_in",
          persistenceMessage: "Returning to the direction saved on this device. This is not an account."
        }
      });
    } else if (!result.ok) {
      dispatch({
        type: "persist",
        optIn: false,
        persistenceState: result.state,
        message: result.reason
      });
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, [state.phase]);

  useEffect(() => {
    if (!hydrated.current || !state.persistenceOptIn) return;
    const result = writeDiscovery(
      browserStorage(),
      createEnvelope(state.draft, state.confirmed, state.phase, state.intakeStep)
    );
    if (!result.ok) {
      dispatch({
        type: "persist",
        optIn: false,
        persistenceState: result.state,
        message: result.reason
      });
    }
  }, [state.draft, state.confirmed, state.phase, state.intakeStep, state.persistenceOptIn]);

  const suggested = useMemo(() => recommendDirection(state.draft.qualities), [state.draft.qualities]);
  const unpublished = hasUnpublishedChanges(state.draft, state.confirmed);
  const mapping = useMemo(
    () => (state.confirmed ? mapSelectionToBriefProposals(state.confirmed) : null),
    [state.confirmed]
  );
  const guide = guidePreview === "unavailable" ? currentGuideView() : createGuideView(guidePreview, "curated");

  const go = useCallback((phase: DiscoveryPhase) => dispatch({ type: "phase", phase }), []);
  const onAction = useCallback(() => setDemoOpen(true), []);
  const onSection = useCallback((id: string) => {
    const node = deviceRef.current?.querySelector(`#${id}`);
    node?.scrollIntoView({ block: "start" });
  }, []);

  const copySummary = async () => {
    if (!mapping) return;
    try {
      await navigator.clipboard.writeText(mapping.summary);
      dispatch({ type: "status", status: "Summary copied. It is still only on this device." });
    } catch {
      dispatch({ type: "status", status: "Copy was blocked. Select the summary text instead." });
    }
  };

  const confirm = () => {
    dispatch({ type: "confirm", selection: confirmSelection(state.draft, state.confirmed) });
  };

  return (
    <div className={`${styles.root} discovery-root`}>
      <div className={styles.atmosphere} aria-hidden="true">
        <span className={styles.glowA} />
        <span className={styles.glowB} />
        <span className={styles.glowC} />
      </div>
      <div className={styles.frame}>
        <div className={styles.innerNav}>
          <div className={styles.brandLockup}>
            <img src="/discovery/brand/icon.webp" alt="" width={36} height={36} />
            <span className={styles.brandCopy}>
              <strong>AETHELIOS</strong>
              <span>Discovery studio</span>
            </span>
          </div>
          <div className={styles.steps} role="navigation" aria-label="Discovery steps">
            {PHASES.map((item, index) => {
              const currentIndex = PHASES.findIndex((phase) => phase.id === state.phase);
              const farthestIndex = PHASES.findIndex((phase) => phase.id === state.farthest);
              const allowed = index <= Math.max(currentIndex, farthestIndex);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={styles.step}
                  aria-current={state.phase === item.id ? "step" : undefined}
                  disabled={!allowed}
                  onClick={() => go(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.guide} data-state={guide.state} aria-live="polite">
          <div className={styles.chipRow}>
            <span className={styles.badge}>{guide.labeled === "curated" ? "Curated" : "Live model"}</span>
            <strong>{guide.title}</strong>
          </div>
          <p className={styles.fine}>{guide.body}</p>
          <details>
            <summary>Guidance states for later live Aethelios</summary>
            <div className={styles.chipRow} role="radiogroup" aria-label="Guidance state preview">
              {(["unavailable", "available", "loading", "error"] as GuideState[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={styles.chip}
                  aria-checked={guidePreview === item}
                  role="radio"
                  onClick={() => setGuidePreview(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <p className={styles.fine}>
              Presentational boundary only. This pass never calls a model. Exploration stays usable in
              every state.
            </p>
          </details>
        </div>

        <p className={styles.status} role="status">
          {state.status}
        </p>

        {state.phase === "enter" ? <Entrance onExplore={() => go("intake")} /> : null}
        {state.phase === "intake" ? (
          <Intake
            draft={state.draft}
            step={state.intakeStep}
            onPatch={(patch) => dispatch({ type: "patch", patch })}
            onStep={(step) => dispatch({ type: "intake", step })}
            onContinue={() => go("qualities")}
          />
        ) : null}
        {state.phase === "qualities" ? (
          <Qualities
            draft={state.draft}
            onToggle={(id) => dispatch({ type: "draft", draft: toggleQuality(state.draft, id) })}
            onBack={() => go("intake")}
            onContinue={() => go("studio")}
          />
        ) : null}

        {state.phase === "studio" || state.phase === "compare" ? (
          <StudioBody
            state={state}
            suggested={suggested}
            unpublished={unpublished}
            deviceRef={deviceRef}
            onPatch={(patch) => dispatch({ type: "patch", patch })}
            onDraft={(draft) => dispatch({ type: "draft", draft })}
            onPreview={(mode) => dispatch({ type: "preview", mode })}
            onAction={onAction}
            onSection={onSection}
            onConfirm={confirm}
            onCompare={() => go("compare")}
            onStudio={() => go("studio")}
            onReview={() => go("review")}
          />
        ) : null}

        {state.phase === "review" ? (
          <ReviewBody
            draft={state.draft}
            confirmed={state.confirmed}
            unpublished={unpublished}
            mapping={mapping}
            onPatch={(patch) => dispatch({ type: "patch", patch })}
            onConfirm={confirm}
            onBack={() => go("studio")}
            onCopy={() => void copySummary()}
          />
        ) : null}

        {state.phase === "enter" ? null : (
        <section className={styles.glass} style={{ marginTop: 22 }}>
          <h2>Save on this device</h2>
          <p className={styles.fine}>
            Default is memory only. Opting in stores the current sketch in this browser under a
            namespaced key. Contact details, credentials, and founder notes are never stored here, and
            this does not import into a signed-in account.
          </p>
          <p className={styles.notice}>{state.persistenceMessage}</p>
          <div className={styles.actions}>
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              type="button"
              onClick={() => {
                const written = writeDiscovery(
                  browserStorage(),
                  createEnvelope(state.draft, state.confirmed, state.phase, state.intakeStep)
                );
                dispatch({
                  type: "persist",
                  optIn: written.ok,
                  persistenceState: written.ok ? "opted_in" : written.state,
                  message: written.ok
                    ? "Saved on this device. Clear anytime. This is not an account."
                    : written.reason
                });
              }}
            >
              Save on this device
            </button>
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              type="button"
              onClick={() => {
                clearDiscovery(browserStorage());
                dispatch({
                  type: "persist",
                  optIn: false,
                  persistenceState: "memory",
                  message: "Cleared. Discovery is in memory for this visit only."
                });
              }}
            >
              Clear saved sketch
            </button>
          </div>
        </section>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby="demo-title"
        onClose={() => setDemoOpen(false)}
      >
        <h2 id="demo-title">{buildConceptContent(state.draft, state.draft.activeDirectionId).actionLabel}</h2>
        <p>
          This is the proposed customer path. It does not book an appointment, send a request, or
          take payment. A finished commission can later connect the booking provider the business
          already uses.
        </p>
        <ol>
          <li>See the offering.</li>
          <li>Choose to continue.</li>
          <li>Leave this studio for the real booking tool — not hosted here.</li>
        </ol>
        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.btnGhost}`} type="button" disabled>
            Demonstration — no booking
          </button>
          <button className={`${styles.btn} ${styles.btnGold}`} type="button" onClick={() => setDemoOpen(false)}>
            Close
          </button>
        </div>
      </dialog>
    </div>
  );
}

function StudioBody({
  state,
  suggested,
  unpublished,
  deviceRef,
  onPatch,
  onDraft,
  onPreview,
  onAction,
  onSection,
  onConfirm,
  onCompare,
  onStudio,
  onReview
}: {
  state: State;
  suggested: DirectionId;
  unpublished: boolean;
  deviceRef: RefObject<HTMLDivElement | null>;
  onPatch: (patch: Partial<DiscoveryDraft>) => void;
  onDraft: (draft: DiscoveryDraft) => void;
  onPreview: (mode: PreviewMode) => void;
  onAction: () => void;
  onSection: (id: string) => void;
  onConfirm: () => void;
  onCompare: () => void;
  onStudio: () => void;
  onReview: () => void;
}) {
  const comparing = state.phase === "compare";
  const compareIds = state.draft.compareIds;
  const [compareFocus, setCompareFocus] = useState<DirectionId>(compareIds[0] ?? "lumen");
  useEffect(() => {
    if (!compareIds.includes(compareFocus)) setCompareFocus(compareIds[0] ?? "lumen");
  }, [compareIds, compareFocus]);
  return (
    <section className={`${styles.studio} ${comparing ? "" : styles.studioWide}`.trim()}>
      <aside className={styles.rail}>
        <div className={styles.solid}>
          <h2>Shape this direction</h2>
          <label className={styles.field}>
            <span>Business name</span>
            <input
              className={styles.input}
              type="text"
              value={state.draft.businessName}
              maxLength={80}
              onChange={(event) => onPatch({ businessName: event.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span>Headline</span>
            <input
              className={styles.input}
              type="text"
              value={state.draft.headline}
              maxLength={120}
              onChange={(event) => onPatch({ headline: event.target.value })}
            />
          </label>
          <fieldset className={styles.field}>
            <legend className={styles.legend}>Palette</legend>
            <div className={styles.paletteRow} role="radiogroup" aria-label="Palette">
              {PALETTE_IDS.map((id) => {
                const palette = PALETTES[id];
                return (
                  <button
                    key={id}
                    type="button"
                    className={styles.palette}
                    role="radio"
                    aria-checked={state.draft.paletteId === id}
                    aria-label={palette.label}
                    title={palette.label}
                    style={
                      {
                        "--p1": palette.preview[0],
                        "--p2": palette.preview[1],
                        "--p3": palette.preview[2]
                      } as CSSProperties
                    }
                    onClick={() => onPatch({ paletteId: id as PaletteId })}
                  />
                );
              })}
            </div>
            <p className={styles.fine}>{PALETTES[state.draft.paletteId].summary}</p>
            <button
              className={styles.chip}
              type="button"
              onClick={() => onDraft(resetField(state.draft, "paletteId"))}
            >
              Reset palette
            </button>
          </fieldset>
          <fieldset className={styles.field}>
            <legend className={styles.legend}>Visual direction</legend>
            <div className={styles.options} role="radiogroup" aria-label="Visual direction">
              {VISUAL_DIRECTION_IDS.map((id) => (
                <label className={styles.option} key={id}>
                  <input
                    type="radio"
                    name="visual"
                    checked={state.draft.visualDirectionId === id}
                    onChange={() => onPatch({ visualDirectionId: id as VisualDirectionId })}
                  />
                  <span>
                    <strong>{VISUAL_DIRECTION_COPY[id].label}</strong>
                    <em>{VISUAL_DIRECTION_COPY[id].summary}</em>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className={styles.field}>
            <legend className={styles.legend}>Preview</legend>
            <div className={styles.chipRow} role="radiogroup" aria-label="Preview mode">
              {(["desktop", "mobile"] as PreviewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={styles.chip}
                  role="radio"
                  aria-checked={state.previewMode === mode}
                  onClick={() => onPreview(mode)}
                >
                  {mode === "desktop" ? "Desktop" : "Phone"}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </aside>

      <div>
        {comparing ? (
          <>
            <p className={styles.kicker}>Two-direction comparison</p>
            <h2>Choose with feeling, not conversion claims.</h2>
            <div className={styles.chipRow} role="group" aria-label="Directions to compare">
              {DIRECTION_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={styles.chip}
                  aria-pressed={compareIds.includes(id)}
                  onClick={() => {
                    const current = state.draft.compareIds;
                    if (current.includes(id)) return;
                    onPatch({ compareIds: [current[1] ?? "lumen", id] });
                  }}
                >
                  {DIRECTIONS[id].name}
                </button>
              ))}
            </div>
            <div className={styles.compareSingle}>
              <div className={styles.chipRow} role="radiogroup" aria-label="Compared direction">
                {compareIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={styles.chip}
                    role="radio"
                    aria-checked={compareFocus === id}
                    onClick={() => setCompareFocus(id)}
                  >
                    {DIRECTIONS[id].name}
                  </button>
                ))}
              </div>
              <div className={styles.previewShell} data-mode={state.previewMode}>
                <div className={styles.device}>
                  <ConceptStage
                    draft={{ ...state.draft, activeDirectionId: compareFocus }}
                    directionId={compareFocus}
                    onAction={onAction}
                    onSection={onSection}
                  />
                </div>
              </div>
            </div>
            <div className={styles.comparePair}>
              {compareIds.map((id) => (
                <div key={id} className={styles.previewShell} data-mode="desktop">
                  <div className={styles.device}>
                    <ConceptStage
                      draft={{ ...state.draft, activeDirectionId: id }}
                      directionId={id}
                      onAction={onAction}
                      onSection={onSection}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.compareCopy}>
              {compareIds.map((id) => {
                const content = buildConceptContent(state.draft, id);
                return (
                  <article className={styles.solid} key={id}>
                    <h3>
                      {DIRECTIONS[id].name} — {DIRECTIONS[id].epithet}
                    </h3>
                    <p>
                      <strong>Feeling. </strong>
                      {content.comparisonFeeling}
                    </p>
                    <p>
                      <strong>Emphasis. </strong>
                      {content.comparisonEmphasis}
                    </p>
                    <p>
                      <strong>Customer action. </strong>
                      {content.comparisonAction}
                    </p>
                  </article>
                );
              })}
            </div>
            <p className={styles.fine}>
              Neither direction is claimed to increase revenue. They differ in atmosphere, what they
              emphasize, and how a visitor is invited to continue.
            </p>
            <div className={styles.footerNav}>
              <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={onStudio}>
                Back to studio
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.previewShell} data-mode={state.previewMode} ref={deviceRef}>
              <div className={styles.device}>
                <ConceptStage
                  draft={state.draft}
                  directionId={state.draft.activeDirectionId}
                  onAction={onAction}
                  onSection={onSection}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {comparing ? null : (
        <aside className={styles.side}>
          <div className={styles.solid}>
            <h2>Directions</h2>
            <div className={styles.options} role="radiogroup" aria-label="Concept direction">
              {DIRECTION_ORDER.map((id) => (
                <label className={styles.option} key={id}>
                  <input
                    type="radio"
                    name="direction"
                    value={id}
                    checked={state.draft.activeDirectionId === id}
                    onChange={() => onPatch({ activeDirectionId: id })}
                  />
                  <span>
                    <strong>
                      {DIRECTIONS[id].name}
                      {id === suggested ? " · suggested" : ""}
                    </strong>
                    <em>{DIRECTIONS[id].epithet}</em>
                    {state.draft.activeDirectionId === id ? <span className={styles.badge}>Selected</span> : null}
                  </span>
                </label>
              ))}
            </div>
            <p className={styles.fine}>Suggested from your qualities, not by a model.</p>
            <div className={styles.chipRow}>
              {DIRECTION_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={styles.chip}
                  aria-pressed={state.draft.favorites.includes(id)}
                  onClick={() => onDraft(toggleFavorite(state.draft, id))}
                >
                  {state.draft.favorites.includes(id) ? "Shortlisted" : "Shortlist"} {DIRECTIONS[id].name}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.glass}>
            <h2>Notes</h2>
            <label className={styles.field}>
              <span>What you like</span>
              <textarea
                className={styles.textarea}
                value={state.draft.likesNote}
                maxLength={2000}
                onChange={(event) => onPatch({ likesNote: event.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span>What to change</span>
              <textarea
                className={styles.textarea}
                value={state.draft.changeNote}
                maxLength={2000}
                onChange={(event) => onPatch({ likesNote: state.draft.likesNote, changeNote: event.target.value })}
              />
            </label>
            <button className={`${styles.btn} ${styles.btnEmerald}`} type="button" onClick={onConfirm}>
              Use this direction
            </button>
            {unpublished ? (
              <p className={styles.notice}>Preview changes are not in the prepared snapshot until you use this direction again.</p>
            ) : null}
            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={onCompare}>
                Compare two
              </button>
              <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={onReview}>
                Review
              </button>
            </div>
            <button
              className={styles.chip}
              type="button"
              onClick={() => onPatch({ paletteId: defaultPaletteFor(state.draft.activeDirectionId) })}
            >
              Reset palette for this direction
            </button>
          </div>
        </aside>
      )}
    </section>
  );
}

function ReviewBody({
  draft,
  confirmed,
  unpublished,
  mapping,
  onPatch,
  onConfirm,
  onBack,
  onCopy
}: {
  draft: DiscoveryDraft;
  confirmed: DiscoverySelection | null;
  unpublished: boolean;
  mapping: ReturnType<typeof mapSelectionToBriefProposals> | null;
  onPatch: (patch: Partial<DiscoveryDraft>) => void;
  onConfirm: () => void;
  onBack: () => void;
  onCopy: () => void;
}) {
  return (
    <section className={styles.reviewGrid}>
      <div className={styles.panel}>
        <p className={styles.kicker}>Review</p>
        <h2>Prepare this direction on this device.</h2>
        <p className={styles.lede}>
          The snapshot below is exactly what a later import can carry forward. Later preview edits do
          not silently change it. Nothing is submitted, and nothing is added to an account.
        </p>
        <label className={styles.field}>
          <span>Commission type, if you already know</span>
          <div className={styles.options} role="radiogroup" aria-label="Service interest">
            {[
              ["unspecified", "Not sure yet"],
              ["website", "Branded website"],
              ["booking_connected_website", "Booking-connected website"]
            ].map(([id, label]) => (
              <label className={styles.option} key={id}>
                <input
                  type="radio"
                  name="service"
                  checked={draft.serviceInterest === id}
                  onChange={() => onPatch({ serviceInterest: id as DiscoveryDraft["serviceInterest"] })}
                />
                <span>
                  <strong>{label}</strong>
                  <em>Explicit choice only. Looking at a concept does not select a package.</em>
                </span>
              </label>
            ))}
          </div>
        </label>
        <label className={styles.field}>
          <span>Exclusions</span>
          <textarea
            className={styles.textarea}
            value={draft.exclusions}
            maxLength={2000}
            onChange={(event) => onPatch({ exclusions: event.target.value })}
          />
        </label>
        <div className={styles.notice}>
          {unpublished
            ? "You have unpublished preview changes. Use this direction again to refresh the snapshot."
            : confirmed
              ? "The prepared snapshot matches the current studio choices."
              : "Use this direction to freeze a snapshot for review."}
        </div>
        <div className={styles.footerNav}>
          <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={onBack}>
            Back to studio
          </button>
          <button className={`${styles.btn} ${styles.btnGold}`} type="button" onClick={onConfirm}>
            Use this direction
          </button>
          <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={onCopy} disabled={!mapping}>
            Copy summary
          </button>
        </div>
      </div>
      {confirmed && mapping ? (
        <SelectionSummary selection={confirmed} mapping={mapping} />
      ) : (
        <aside className={styles.solid}>
          <h2>No snapshot yet</h2>
          <p className={styles.fine}>Confirm a direction to prepare a reviewable summary.</p>
        </aside>
      )}
    </section>
  );
}
