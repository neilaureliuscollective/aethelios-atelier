"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { AppLink } from "@/components/ui/AppLink";
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
  confirmDirection,
  createDraft,
  createEnvelope,
  currentGuideView,
  defaultPaletteFor,
  hasUnpublishedChanges,
  isServiceInterestId,
  mapSelectionToBriefProposals,
  patchDraft,
  previewInstanceId,
  readDiscovery,
  recommendDirection,
  resetField,
  sanitizeIntakeStep,
  toggleFavorite,
  toggleQuality,
  writeDiscovery,
  writeDiscoveryHandoff,
  type DirectionId,
  type DiscoveryDraft,
  type DiscoveryPhase,
  type DiscoverySelection,
  type PaletteId,
  type PersistenceState,
  type PreviewActionContext,
  type PreviewMode,
  type VisualDirectionId
} from "@/lib/discovery";
import { ConceptStage } from "./ConceptStage";
import { Entrance } from "./Entrance";
import { Intake } from "./Intake";
import { Qualities } from "./Qualities";
import { SelectionSummary } from "./SelectionSummary";
import { resolveSampleVisit } from "./sampleVisit";
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
  sampleVisit: boolean;
};

type Action =
  | { type: "hydrate"; state: Partial<State> }
  | { type: "phase"; phase: DiscoveryPhase }
  | { type: "intake"; step: number }
  | { type: "patch"; patch: Partial<DiscoveryDraft> }
  | { type: "draft"; draft: DiscoveryDraft }
  | { type: "confirm"; draft: DiscoveryDraft; selection: DiscoverySelection }
  | { type: "preview"; mode: PreviewMode }
  | { type: "persist"; optIn: boolean; persistenceState: PersistenceState; message: string }
  | { type: "status"; status: string }
  | { type: "resetVisit" }
  | { type: "sample"; draft: DiscoveryDraft };

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
      return { ...state, intakeStep: sanitizeIntakeStep(action.step).step };
    case "patch":
      return { ...state, draft: patchDraft(state.draft, action.patch) };
    case "draft":
      return { ...state, draft: action.draft };
    case "confirm":
      return {
        ...state,
        draft: action.draft,
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
        persistenceMessage: action.message,
        sampleVisit: action.optIn ? false : state.sampleVisit
      };
    case "status":
      return { ...state, status: action.status };
    case "resetVisit":
      return {
        ...initial,
        persistenceOptIn: state.persistenceOptIn,
        persistenceState: state.persistenceState,
        persistenceMessage: state.persistenceOptIn
          ? "This visit was reset. The saved sketch on this device will update if saving stays on."
          : "This visit was reset. Nothing was stored on this device.",
        status: "Started over on this screen. A saved sketch was not removed."
      };
    case "sample":
      return {
        ...state,
        draft: action.draft,
        phase: "studio",
        farthest: farthestOf(state.farthest, "studio"),
        sampleVisit: true,
        status: "Sample direction for exploration. Not saved to an account."
      };
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
  status: "",
  sampleVisit: false
};

export function DiscoveryStudio() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demo, setDemo] = useState<PreviewActionContext | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hydrated = useRef(false);
  const skipPhaseFocus = useRef(true);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (demoOpen && !node.open) node.showModal();
    if (!demoOpen && node.open) node.close();
  }, [demoOpen]);

  useEffect(() => {
    const result = readDiscovery(browserStorage());
    const interest = new URLSearchParams(window.location.search).get("interest");
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
          persistenceMessage: result.notice
            ? result.notice
            : "Returning to the direction saved on this device. This is not an account.",
          status: result.notice ?? ""
        }
      });
    } else if (isServiceInterestId(interest)) {
      dispatch({ type: "patch", patch: { serviceInterest: interest } });
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
    if (skipPhaseFocus.current) {
      skipPhaseFocus.current = false;
      return;
    }
    const headings = [...document.querySelectorAll<HTMLElement>("[data-discovery-heading]")];
    const heading = headings.find((node) => node.offsetParent !== null) ?? headings[0];
    heading?.focus({ preventScroll: true });
  }, [state.phase, state.intakeStep]);

  useEffect(() => {
    if (!hydrated.current || !state.persistenceOptIn || state.sampleVisit) return;
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
  }, [state.draft, state.confirmed, state.phase, state.intakeStep, state.persistenceOptIn, state.sampleVisit]);

  const suggested = useMemo(() => recommendDirection(state.draft.qualities), [state.draft.qualities]);
  const unpublished = hasUnpublishedChanges(state.draft, state.confirmed);
  const mapping = useMemo(
    () => (state.confirmed ? mapSelectionToBriefProposals(state.confirmed) : null),
    [state.confirmed]
  );
  const guide = currentGuideView();
  const demoContent = demo ? buildConceptContent(demo.draft, demo.directionId) : null;

  const go = useCallback((phase: DiscoveryPhase) => dispatch({ type: "phase", phase }), []);
  const openSample = useCallback(() => {
    const resolved = resolveSampleVisit(state.draft, state.confirmed);
    if (!resolved.applied) {
      dispatch({ type: "phase", phase: "studio" });
      dispatch({ type: "status", status: resolved.status });
      return;
    }
    dispatch({ type: "sample", draft: resolved.draft });
  }, [state.draft, state.confirmed]);
  const onAction = useCallback((context: PreviewActionContext) => {
    setDemo(context);
    setDemoOpen(true);
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

  const confirm = useCallback((directionId: DirectionId = state.draft.activeDirectionId) => {
    const result = confirmDirection(state.draft, directionId, state.confirmed);
    writeDiscoveryHandoff(result.selection);
    dispatch({ type: "confirm", draft: result.draft, selection: result.selection });
  }, [state.draft, state.confirmed]);

  return (
    <div className={`${styles.root} discovery-root`}>
      <div className={styles.atmosphere} aria-hidden="true">
        <span className={styles.glowA} />
        <span className={styles.glowB} />
        <span className={styles.glowC} />
      </div>
      <div className={styles.frame}>
        {state.phase === "enter" ? null : (
        <div className={styles.toolbar} data-state={guide.state}>
          <div className={styles.toolbarMeta}>
            <span className={styles.badge}>{guide.labeled === "curated" ? "Curated" : "Live model"}</span>
            <span className={styles.fine} data-state={guide.state}>
              {state.sampleVisit
                ? "Sample exploration. Not live model output, and not saved to an account."
                : "Personalized from your answers. Not live model output."}
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
        )}

        {state.status ? (
          <p className={styles.status} role="status">
            {state.status}
          </p>
        ) : (
          <p className={styles.status} role="status" />
        )}

        {state.phase === "enter" ? (
          <Entrance onExplore={() => go("intake")} onSample={openSample} onAction={onAction} />
        ) : null}
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
            onPatch={(patch) => dispatch({ type: "patch", patch })}
            onDraft={(draft) => dispatch({ type: "draft", draft })}
            onPreview={(mode) => dispatch({ type: "preview", mode })}
            onAction={onAction}
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
            onAction={onAction}
          />
        ) : null}

        {state.phase === "enter" ? null : (
        <section className={styles.saveDrawer} style={{ marginTop: 22 }}>
          <h2>Save on this device</h2>
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
                if (written.ok) {
                  dispatch({ type: "status", status: "Saved on this device. This is still not an account." });
                }
              }}
            >
              Save on this device
            </button>
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              type="button"
              onClick={() => {
                const result = clearDiscovery(browserStorage());
                if (!result.ok) {
                  dispatch({
                    type: "persist",
                    optIn: state.persistenceOptIn,
                    persistenceState: result.state,
                    message: `Could not remove the saved sketch. ${result.reason}`
                  });
                  dispatch({
                    type: "status",
                    status: "The saved sketch is still on this device. Try removing it again."
                  });
                  return;
                }
                dispatch({
                  type: "persist",
                  optIn: false,
                  persistenceState: "memory",
                  message: "Removed the sketch saved on this device. This visit is still in memory until you start over."
                });
                dispatch({ type: "status", status: "Saved sketch removed from this device." });
              }}
            >
              Remove saved sketch
            </button>
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              type="button"
              onClick={() => dispatch({ type: "resetVisit" })}
            >
            Start over on this screen
          </button>
          </div>
          <details>
            <summary>How saving works</summary>
            <p className={styles.fine}>
              Default is memory only. Opting in stores the current sketch in this browser. Contact
              details are never stored here, and this does not import into an account.
            </p>
          </details>
        </section>
        )}
      </div>

      {demo && demoContent ? (
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby="demo-title"
        onClose={() => setDemoOpen(false)}
        data-demo-direction={demo.directionId}
        data-demo-name={demoContent.businessName}
        data-demo-source={demo.source}
        data-demo-instance={demo.instanceId}
        data-demo-headline={demoContent.headline}
      >
        <p className={styles.kicker}>
          {demo.source === "confirmed" ? "Confirmed direction" : "Current exploration"} ·{" "}
          {DIRECTIONS[demo.directionId].name} · {demoContent.businessName}
        </p>
        <h2 id="demo-title">{demoContent.actionLabel}</h2>
        <p>
          This is how {demoContent.businessName} could invite someone to continue in the{" "}
          {DIRECTIONS[demo.directionId].name} direction. It does not book an appointment, send a request,
          or take payment. A finished commission can later connect the booking provider the business
          already uses.
        </p>
        <p className={styles.fine}>{demoContent.headline}</p>
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
      ) : null}
    </div>
  );
}

function ServiceScopeNote({ interest }: { interest: DiscoveryDraft["serviceInterest"] }) {
  const copy =
    interest === "custom_apps_platforms"
      ? "This preview still illustrates a website direction. A custom app or platform would be scoped separately with Neil — selecting this interest does not create a working app."
      : interest === "ecommerce_storefronts"
        ? "This preview still illustrates a website direction. Commerce, inventory, and payments would be scoped separately — this is not a working storefront."
        : interest === "digital_infrastructure"
          ? "This preview still illustrates a website direction. Infrastructure and operations would be scoped separately — this is not a running system."
          : "These previews illustrate a website direction. Neil would still confirm scope, systems, and whether a booking tool should be connected later.";
  return (
    <p className={`${styles.fine} ${styles.serviceNote}`} data-service-scope={interest}>
      {copy}
    </p>
  );
}

function PreviewFrame({
  draft,
  directionId,
  instanceId,
  mode,
  source = "exploration",
  onAction
}: {
  draft: DiscoveryDraft;
  directionId: DirectionId;
  instanceId: string;
  mode: PreviewMode;
  source?: PreviewActionContext["source"];
  onAction: (context: PreviewActionContext) => void;
}) {
  const previewDraft = { ...draft, activeDirectionId: directionId };
  return (
    <div
      className={styles.previewShell}
      data-mode={mode}
      data-preview-instance={instanceId}
      data-preview-source={source}
      data-preview-direction={directionId}
      data-preview-name={previewDraft.businessName}
    >
      <div className={styles.device} data-preview-device={instanceId}>
        <ConceptStage
          instanceId={instanceId}
          draft={previewDraft}
          directionId={directionId}
          source={source}
          onAction={onAction}
        />
      </div>
    </div>
  );
}

function NativeRadioRow<T extends string>({
  name,
  value,
  options,
  ariaLabel,
  onChange
}: {
  name: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  ariaLabel: string;
  onChange: (id: T) => void;
}) {
  return (
    <div className={styles.chipRow} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <label className={styles.radioChip} key={option.id}>
          <input
            type="radio"
            name={name}
            value={option.id}
            checked={value === option.id}
            onChange={() => onChange(option.id)}
          />
          <span>
            {option.label}
            {value === option.id ? <span className={styles.visuallyHidden}> selected</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

function StudioDock({
  state,
  suggested,
  onPatch,
  onPreview,
  onConfirm,
  onCompare,
  onStudio,
  onReview
}: {
  state: State;
  suggested: DirectionId;
  onPatch: (patch: Partial<DiscoveryDraft>) => void;
  onPreview: (mode: PreviewMode) => void;
  onConfirm: (directionId?: DirectionId) => void;
  onCompare: () => void;
  onStudio: () => void;
  onReview: () => void;
}) {
  const comparing = state.phase === "compare";
  return (
    <div className={styles.stickyPrimary}>
      <NativeRadioRow
        name="direction-studio"
        value={state.draft.activeDirectionId}
        ariaLabel="Concept direction"
        options={DIRECTION_ORDER.map((id) => ({
          id,
          label: `${DIRECTIONS[id].name}${id === suggested ? " · suggested" : ""}`
        }))}
        onChange={(id) => onPatch({ activeDirectionId: id })}
      />
      <p className={styles.selectedHint}>
        Selected: {DIRECTIONS[state.draft.activeDirectionId].name} —{" "}
        {DIRECTIONS[state.draft.activeDirectionId].epithet}
      </p>
      <ServiceScopeNote interest={state.draft.serviceInterest} />
      <NativeRadioRow
        name="preview-studio"
        value={state.previewMode}
        ariaLabel="Preview mode"
        options={[
          { id: "desktop" as const, label: "Desktop" },
          { id: "mobile" as const, label: "Phone" }
        ]}
        onChange={onPreview}
      />
      <div className={styles.dockActions}>
        {comparing ? (
          <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={onStudio}>
            Back to studio
          </button>
        ) : (
          <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={onCompare}>
            Compare two
          </button>
        )}
        <button className={`${styles.btn} ${styles.btnEmerald}`} type="button" onClick={() => onConfirm()}>
          Use this direction
        </button>
        <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={onReview}>
          Review
        </button>
      </div>
    </div>
  );
}

function StudioControls({
  state,
  suggested,
  unpublished,
  compact,
  showDock,
  onPatch,
  onDraft,
  onPreview,
  onConfirm,
  onCompare,
  onStudio,
  onReview
}: {
  state: State;
  suggested: DirectionId;
  unpublished: boolean;
  compact: boolean;
  showDock: boolean;
  onPatch: (patch: Partial<DiscoveryDraft>) => void;
  onDraft: (draft: DiscoveryDraft) => void;
  onPreview: (mode: PreviewMode) => void;
  onConfirm: (directionId?: DirectionId) => void;
  onCompare: () => void;
  onStudio: () => void;
  onReview: () => void;
}) {
  return (
    <>
      {showDock ? (
        <StudioDock
          state={state}
          suggested={suggested}
          onPatch={onPatch}
          onPreview={onPreview}
          onConfirm={onConfirm}
          onCompare={onCompare}
          onStudio={onStudio}
          onReview={onReview}
        />
      ) : null}
      {unpublished ? (
        <p className={styles.notice} data-unpublished="true">
          Working changes differ from the last confirmed direction. Use this direction again to update the snapshot.
        </p>
      ) : null}
      {compact ? (
        <details className={styles.moreControls}>
          <summary>Edit name, palette, and notes</summary>
          <StudioFields
            state={state}
            radioSuffix="studio"
            onPatch={onPatch}
            onDraft={onDraft}
          />
        </details>
      ) : (
        <StudioFields
          state={state}
          radioSuffix="studio"
          onPatch={onPatch}
          onDraft={onDraft}
        />
      )}
    </>
  );
}

function StudioFields({
  state,
  radioSuffix,
  onPatch,
  onDraft
}: {
  state: State;
  radioSuffix: string;
  onPatch: (patch: Partial<DiscoveryDraft>) => void;
  onDraft: (draft: DiscoveryDraft) => void;
}) {
  return (
    <>
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
                <label
                  key={id}
                  className={styles.palette}
                  title={palette.label}
                  style={
                    {
                      "--p1": palette.preview[0],
                      "--p2": palette.preview[1],
                      "--p3": palette.preview[2]
                    } as CSSProperties
                  }
                >
                  <input
                    type="radio"
                    name={`palette-${radioSuffix}`}
                    value={id}
                    checked={state.draft.paletteId === id}
                    onChange={() => onPatch({ paletteId: id as PaletteId })}
                  />
                  <span className={styles.visuallyHidden}>
                    {palette.label}
                    {state.draft.paletteId === id ? " selected" : ""}
                  </span>
                </label>
              );
            })}
          </div>
          <p className={styles.selectedHint}>Selected: {PALETTES[state.draft.paletteId].label}</p>
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
                  name={`visual-${radioSuffix}`}
                  checked={state.draft.visualDirectionId === id}
                  onChange={() => onPatch({ visualDirectionId: id as VisualDirectionId })}
                />
                <span>
                  <strong>
                    {VISUAL_DIRECTION_COPY[id].label}
                    {state.draft.visualDirectionId === id ? " · selected" : ""}
                  </strong>
                  <em>{VISUAL_DIRECTION_COPY[id].summary}</em>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
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
            onChange={(event) => onPatch({ changeNote: event.target.value })}
          />
        </label>
        <button
          className={styles.chip}
          type="button"
          onClick={() => onPatch({ paletteId: defaultPaletteFor(state.draft.activeDirectionId) })}
        >
          Reset palette for this direction
        </button>
    </>
  );
}

function StudioBody({
  state,
  suggested,
  unpublished,
  onPatch,
  onDraft,
  onPreview,
  onAction,
  onConfirm,
  onCompare,
  onStudio,
  onReview
}: {
  state: State;
  suggested: DirectionId;
  unpublished: boolean;
  onPatch: (patch: Partial<DiscoveryDraft>) => void;
  onDraft: (draft: DiscoveryDraft) => void;
  onPreview: (mode: PreviewMode) => void;
  onAction: (context: PreviewActionContext) => void;
  onConfirm: (directionId?: DirectionId) => void;
  onCompare: () => void;
  onStudio: () => void;
  onReview: () => void;
}) {
  const comparing = state.phase === "compare";
  const compareIds = state.draft.compareIds;
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1100px)");
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const compact = narrow || comparing;
  const controlProps = {
    state,
    suggested,
    unpublished,
    compact,
    showDock: !narrow,
    onPatch,
    onDraft,
    onPreview,
    onConfirm,
    onCompare,
    onStudio,
    onReview
  };

  return (
    <section className={`${styles.studio} ${comparing ? "" : styles.studioWide}`.trim()}>
      {narrow ? (
        <StudioDock
          state={state}
          suggested={suggested}
          onPatch={onPatch}
          onPreview={onPreview}
          onConfirm={onConfirm}
          onCompare={onCompare}
          onStudio={onStudio}
          onReview={onReview}
        />
      ) : null}
      <div className={styles.previewColumn}>
        {comparing ? (
          <>
            <p className={styles.kicker}>Two-direction comparison</p>
            <h2 className={styles.heading} tabIndex={-1}>
              Choose with feeling, not conversion claims.
            </h2>
            <p className={styles.lede}>
              Both previews use the same business name, written intent, qualities, and notes. They
              differ in emphasis, visual personality, and how a visitor is invited to continue. Neither
              is a tested revenue or conversion result.
            </p>
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
                  {compareIds.includes(id) ? " · showing" : ""}
                </button>
              ))}
            </div>
            <div className={styles.comparePair}>
              {compareIds.map((id, slot) => {
                const instanceId = previewInstanceId("compare", id, slot);
                const content = buildConceptContent(state.draft, id);
                return (
                  <div
                    className={styles.comparePanel}
                    key={`${id}-${slot}`}
                    data-active={state.draft.activeDirectionId === id ? "true" : "false"}
                    data-compare-direction={id}
                  >
                    <p className={styles.selectedHint}>
                      {DIRECTIONS[id].name}
                      {state.draft.activeDirectionId === id ? " · current studio direction" : ""}
                      {state.draft.favorites.includes(id) ? " · shortlisted" : ""}
                    </p>
                    <PreviewFrame
                      draft={state.draft}
                      directionId={id}
                      instanceId={instanceId}
                      mode={state.previewMode}
                      source="exploration"
                      onAction={onAction}
                    />
                    <button
                      className={`${styles.btn} ${id === state.draft.activeDirectionId ? styles.btnEmerald : styles.btnGhost}`}
                      type="button"
                      data-confirm-direction={id}
                      onClick={() => onConfirm(id)}
                    >
                      Use {DIRECTIONS[id].name}
                    </button>
                    <article className={styles.solid}>
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
                        <strong>Customer path. </strong>
                        {content.comparisonAction}
                      </p>
                      <p className={styles.fine}>
                        Same answers throughout: {content.businessName}
                        {state.draft.intentNote.trim() ? ` — “${state.draft.intentNote.trim()}”` : ""}.
                      </p>
                    </article>
                  </div>
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
          <PreviewFrame
            draft={state.draft}
            directionId={state.draft.activeDirectionId}
            instanceId={previewInstanceId("solo", state.draft.activeDirectionId)}
            mode={state.previewMode}
            onAction={onAction}
          />
        )}
      </div>
      <aside className={styles.rail} data-mobile-dock="true">
        <div className={styles.solid}>
          <p className={styles.kicker}>Studio controls</p>
          <h2 className={styles.heading} data-discovery-heading tabIndex={-1}>
            {comparing ? "Compare" : "Shape this direction"}
          </h2>
          <StudioControls {...controlProps} />
        </div>
      </aside>
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
  onCopy,
  onAction
}: {
  draft: DiscoveryDraft;
  confirmed: DiscoverySelection | null;
  unpublished: boolean;
  mapping: ReturnType<typeof mapSelectionToBriefProposals> | null;
  onPatch: (patch: Partial<DiscoveryDraft>) => void;
  onConfirm: (directionId?: DirectionId) => void;
  onBack: () => void;
  onCopy: () => void;
  onAction: (context: PreviewActionContext) => void;
}) {
  return (
    <section className={styles.reviewGrid}>
      <div className={styles.panel}>
        <p className={styles.kicker}>Review</p>
        <h2 className={styles.heading} data-discovery-heading tabIndex={-1}>
          Prepare this direction on this device.
        </h2>
        <p className={styles.lede}>
          Confirm a snapshot to keep exactly what you chose. Later preview edits do not silently change
          it. Nothing is submitted, and nothing is added to an account.
        </p>
        <ServiceScopeNote interest={draft.serviceInterest} />
        <div className={styles.notice} data-unpublished={unpublished ? "true" : "false"}>
          {unpublished
            ? "You are looking at the last confirmed selection in the recap. Current exploration has unpublished changes. Use this direction again to refresh the snapshot."
            : confirmed
              ? "The recap is the last confirmed selection, and it matches the current studio."
              : "Use this direction to freeze a snapshot for review."}
        </div>
        <label className={styles.field}>
          <span>Written intent</span>
          <textarea
            className={styles.textarea}
            value={draft.intentNote}
            maxLength={160}
            onChange={(event) => onPatch({ intentNote: event.target.value })}
          />
        </label>
        <label className={styles.field}>
          <span>Audience</span>
          <textarea
            className={styles.textarea}
            value={draft.audience}
            maxLength={280}
            onChange={(event) => onPatch({ audience: event.target.value })}
          />
        </label>
        <label className={styles.field}>
          <span>Commission type, if you already know</span>
          <div className={styles.options} role="radiogroup" aria-label="Service interest">
            {[
              ["unspecified", "Not sure yet"],
              ["website", "Branded websites"],
              ["custom_apps_platforms", "Custom apps & platforms"],
              ["ecommerce_storefronts", "E-commerce & storefronts"],
              ["digital_infrastructure", "Digital infrastructure"],
              ...(draft.serviceInterest === "booking_connected_website"
                ? ([["booking_connected_website", "Saved as booking-connected website"]] as const)
                : [])
            ].map(([id, label]) => (
              <label className={styles.option} key={id}>
                <input
                  type="radio"
                  name="service"
                  checked={draft.serviceInterest === id}
                  onChange={() => onPatch({ serviceInterest: id as DiscoveryDraft["serviceInterest"] })}
                />
                <span>
                  <strong>
                    {label}
                    {draft.serviceInterest === id ? " · selected" : ""}
                  </strong>
                  <em>Explicit choice only. Looking at a concept does not select a package.</em>
                </span>
              </label>
            ))}
          </div>
        </label>
        <label className={styles.field}>
          <span>What you like</span>
          <textarea
            className={styles.textarea}
            value={draft.likesNote}
            maxLength={2000}
            onChange={(event) => onPatch({ likesNote: event.target.value })}
          />
        </label>
        <label className={styles.field}>
          <span>What to change</span>
          <textarea
            className={styles.textarea}
            value={draft.changeNote}
            maxLength={2000}
            onChange={(event) => onPatch({ changeNote: event.target.value })}
          />
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
        <div className={styles.footerNav}>
          <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={onBack}>
            Back to studio
          </button>
          <button className={`${styles.btn} ${styles.btnGold}`} type="button" onClick={() => onConfirm()}>
            Use this direction
          </button>
          <AppLink className={`${styles.btn} ${styles.btnGhost}`} href="/project">
            Add to your brief
          </AppLink>
          <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={onCopy} disabled={!mapping}>
            Copy summary
          </button>
        </div>
      </div>
      {confirmed && mapping ? (
        <SelectionSummary
          selection={confirmed}
          mapping={mapping}
          unpublished={unpublished}
          onAction={onAction}
        />
      ) : (
        <aside className={styles.solid}>
          <h2>No snapshot yet</h2>
          <p className={styles.fine}>Confirm a direction to prepare a reviewable summary.</p>
        </aside>
      )}
    </section>
  );
}
