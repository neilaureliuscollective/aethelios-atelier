"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/shell/SessionShell";
import { api } from "@/lib/client/api";
import { ownerFence } from "@/lib/client/ownerFence";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { readDiscoveryHandoff, writeDiscoveryHandoff, parseSelection, readDiscovery, browserStorage, draftFromSelection, confirmDirection, DIRECTION_ORDER, DIRECTIONS } from "@/lib/discovery";
import { trustedSpecFromDiscovery } from "@/lib/design-spec/fromDiscovery";
import { buildComposition, defaultLayers, paletteForDesignSpec, paletteForProfile } from "@/lib/cofounder/composition";
import { renderComposition } from "@/lib/cofounder/renderComposition";
import type { DiscoverySelection } from "@/lib/discovery/types";
import type { BusinessProfile } from "@/lib/cofounder/types";
import type { BrandKit } from "@/lib/cofounder/brandKit";
import styles from "./brandDirection.module.css";

function DirectionPreview({ selection, profile, mode, businessId, copy }: {
  selection: DiscoverySelection; profile: BusinessProfile; mode: BrandKit["mode"]; businessId: string; copy: { headline: string; body: string };
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    let cancelled = false;
    setFailed("");
    canvas.current?.getContext("2d")?.clearRect(0, 0, canvas.current.width, canvas.current.height);
    const spec = selection.designSpec ?? trustedSpecFromDiscovery(draftFromSelection(selection), selection.selectedDirectionId);
    const logo = profile.brandAssets.find((asset) => asset.kind === "logo");
    const composition = buildComposition({
      businessId, layout: "square_announcement", layoutVersion: 2, designSpec: spec,
      profile, palette: mode === "existing_brand" ? paletteForProfile(profile, 2) : paletteForDesignSpec(spec),
      layers: defaultLayers({ headline: copy.headline, body: copy.body, designSpec: spec,
        layoutVersion: 2, logoDocumentId: logo?.documentId, logoAssetId: logo?.assetId })
    });
    // Render offscreen so an older asynchronous image load cannot overwrite a newer choice.
    const buffer = document.createElement("canvas");
    void renderComposition(composition, buffer).then(() => {
      if (cancelled || !canvas.current) return;
      canvas.current.width = buffer.width; canvas.current.height = buffer.height;
      canvas.current.getContext("2d")?.drawImage(buffer, 0, 0);
    }).catch((err) => { if (!cancelled) {
      canvas.current?.getContext("2d")?.clearRect(0, 0, canvas.current.width, canvas.current.height);
      setFailed(actionErrorMessage(err, "Preview could not render. Reload to retry."));
    } });
    return () => { cancelled = true; };
  }, [selection, profile, mode, businessId, copy]);
  return <div className={styles.preview}>
    <canvas ref={canvas} aria-label={`${DIRECTIONS[selection.selectedDirectionId].name} rendered announcement direction`} role="img" />
    {failed ? <p className={styles.previewError}>{failed}</p> : null}
  </div>;
}

export function BrandDirectionImport({ businessId, onAdopt }: {
  businessId?: string; onAdopt?: (kit: BrandKit) => void;
}) {
  const { user, generation } = useSession();
  const [source, setSource] = useState<DiscoverySelection | null>(null);
  const [selection, setSelection] = useState<DiscoverySelection | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [mode, setMode] = useState<BrandKit["mode"]>("existing_brand");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setProfile(null); setError(""); setSource(null); setSelection(null); setPending(false); setSaved(false);
    if (!businessId || !user) return;
    const gen = generation;
    const stored = readDiscovery(browserStorage());
    const local = readDiscoveryHandoff() ?? (stored.ok && stored.state === "opted_in" ? stored.envelope?.confirmed ?? null : null);
    setSource(local); setSelection(local);
    void api<{ rawProfile: BusinessProfile }>(`/api/companion/workspace?businessId=${encodeURIComponent(businessId)}`)
      .then((data) => { if (ownerFence.isCurrent(gen, user.id)) {
        setProfile(data.rawProfile); setMode(data.rawProfile.brandKit?.mode ?? "existing_brand");
        const kit = data.rawProfile.brandKit;
        if (local && kit && kit.sourceSelectionId === local.selectionId && kit.sourceRevision >= local.localRevision) {
          const restored = parseSelection({ ...local, localRevision: kit.sourceRevision,
            selectedDirectionId: kit.designSpec.directionId, designSpec: kit.designSpec,
            visualPreferences: { paletteId: kit.designSpec.paletteId, visualDirectionId: kit.designSpec.visualDirectionId,
              headline: local.visualPreferences.headline } });
          if (restored) { setSource(restored); setSelection(restored); }
        }
      } })
      .catch((err) => { if (ownerFence.isCurrent(gen, user.id)) setError(actionErrorMessage(err, "Brand direction could not load.")); });
  }, [businessId, user, generation, retry]);
  const choices = useMemo(() => source ? DIRECTION_ORDER.map((id) => id === source.selectedDirectionId ? source :
    confirmDirection(draftFromSelection(source), id, source, new Date(Number.isFinite(Date.parse(source.updatedAt)) ? source.updatedAt : 0)).selection) : [], [source]);
  const previewCopy = useMemo(() => ({
    headline: source?.visualPreferences.headline || source?.designSpec?.copy.headline || source?.businessName || "Your business",
    body: source?.intentNote || source?.audience || source?.businessName || ""
  }), [source]);
  async function adopt() {
    if (!selection || !profile || !businessId || !user || pending) return;
    const gen = generation;
    setPending(true); setError(""); setSaved(false);
    try {
      const data = await api<{ brandKit: BrandKit }>("/api/companion/brand-direction", {
        method: "POST", body: JSON.stringify({ businessId, selection, mode, locked: true, expectedProfileUpdatedAt: profile.updatedAt })
      });
      if (!ownerFence.isCurrent(gen, user.id)) return;
      setProfile({ ...profile, brandKit: data.brandKit }); setSaved(true);
      setSource(selection);
      // The account save is authoritative; local storage is only a best-effort handoff.
      writeDiscoveryHandoff(selection);
      onAdopt?.(data.brandKit);
      try {
        const latest = await api<{ rawProfile: BusinessProfile }>(`/api/companion/workspace?businessId=${encodeURIComponent(businessId)}`);
        if (ownerFence.isCurrent(gen, user.id)) setProfile(latest.rawProfile);
      } catch {
        if (ownerFence.isCurrent(gen, user.id)) setError("Direction saved. Reload before making another change; the latest profile could not be refreshed.");
      }
    } catch (err) {
      if (ownerFence.isCurrent(gen, user.id)) setError(actionErrorMessage(err, "Direction could not be saved. Review and retry."));
    } finally { if (ownerFence.isCurrent(gen, user.id)) setPending(false); }
  }
  if (!source && !profile?.brandKit && !error) return null;
  return <aside className={styles.root} aria-label="Brand direction">
    {profile?.brandKit ? <p className={styles.saved}>Saved: {DIRECTIONS[profile.brandKit.designSpec.directionId].name} · Brand kit v{profile.brandKit.revision}</p> : null}
    {source && profile && businessId ? <>
      <fieldset className={styles.approach} disabled={pending}>
        <legend>Identity approach</legend>
        <label><input type="radio" name={`identity-${businessId}`} checked={mode === "existing_brand"} onChange={() => { setMode("existing_brand"); setSaved(false); }} /> Continue existing identity</label>
        <label><input type="radio" name={`identity-${businessId}`} checked={mode === "new_brand"} onChange={() => { setMode("new_brand"); setSaved(false); }} /> Explore a new brand</label>
      </fieldset>
      <div className={styles.choices} role="group" aria-label="Compare rendered directions">
        {choices.map((choice) => <button className={styles.choice} type="button" key={choice.selectedDirectionId}
          aria-pressed={selection?.selectedDirectionId === choice.selectedDirectionId} disabled={pending}
          onClick={() => { setSelection(choice); setSaved(false); }}>
          <DirectionPreview selection={choice} profile={profile} mode={mode} businessId={businessId} copy={previewCopy} />
          <span className={styles.caption}><strong>{DIRECTIONS[choice.selectedDirectionId].name}</strong><span>{DIRECTIONS[choice.selectedDirectionId].epithet}</span></span>
        </button>)}
      </div>
      <p className={styles.detail}>{mode === "existing_brand" ? "Your profile palette and retained logo stay in place." : "Each direction brings its curated palette, typography and imagery."} Each card uses the same headline and business details. Choosing a card is a preview; your current draft stays unchanged.</p>
      {selection ? <div className={styles.lock}>
        <span><strong>{DIRECTIONS[selection.selectedDirectionId].name}</strong> for {profile.fields.name.value || "this business"}<br /><small>Discovery revision {selection.localRevision} · {selection.visualPreferences.paletteId}</small></span>
        <button type="button" className="btn btn-gold" onClick={() => void adopt()} disabled={pending || saved}>{pending ? "Saving direction…" : saved ? "Direction locked" : "Lock and save direction"}</button>
      </div> : null}
      {saved ? <p role="status" className={styles.detail}>Saved for Talk and new Studio drafts. Existing artwork keeps its own version.</p> : null}
      <p className={styles.provenance}>Curated studies · No live AI · <a href="/discover">Refine in Discovery</a>{!source.designSpec ? " · Legacy selection rebuilt from the current catalog" : ""}</p>
    </> : null}
    {error ? <div role="alert"><p>{error}</p><button type="button" className="btn btn-ghost" onClick={() => setRetry((n) => n + 1)}>Reload direction</button></div> : null}
  </aside>;
}
