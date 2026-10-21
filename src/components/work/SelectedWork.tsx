"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AppLink } from "@/components/ui/AppLink";
import {
  CINEMATIC_LOAD_RATIO,
  CINEMATIC_LOOP_RESTART_TIME,
  CINEMATIC_PLAY_RATIO,
  classifyPlayError,
  decideCinematicPlayback,
  isStalePlayGeneration,
  prefersStaticPlayback,
  readSaveData,
  shouldRestartLoop
} from "@/lib/work/cinematicPlayback";
import { FIX_IT_SHOP } from "@/lib/work/fixItShop";
import styles from "./selectedWork.module.css";

type SelectedWorkVariant = "featured" | "editorial" | "preview";
type NetworkConnection = {
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

export function SelectedWork({
  variant,
  inquireHref,
  headingLevel = "h2"
}: {
  variant: SelectedWorkVariant;
  inquireHref?: string;
  headingLevel?: "h2" | "h3";
}) {
  const project = FIX_IT_SHOP;
  const briefHref = inquireHref ?? (variant === "editorial" ? project.specialistInquireHref : project.inquireHref);
  const TitleTag = headingLevel;

  if (variant === "preview") {
    return (
      <aside className={styles.preview} data-showcase={project.id} data-showcase-variant="preview">
        <div className={styles.previewShell}>
          <AppLink className={styles.previewLink} href="/#selected-work">
            <figure className={styles.media}>
              <div className={styles.frame}>
                <Poster priority={false} />
              </div>
            </figure>
          </AppLink>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>{project.eyebrow}</p>
            <TitleTag className={styles.title}>{project.title}</TitleTag>
            <p className={styles.copyLede}>{project.description}</p>
            <p className={styles.copyNote}>{project.distinction.real}</p>
            <div className={styles.actions}>
              <AppLink className="btn btn-emerald-glass" href="/#selected-work">
                See the selected work
              </AppLink>
              <a className="btn btn-ghost" href={project.liveHref} rel="noreferrer">
                {project.liveLabel}
              </a>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const headingId = variant === "featured" ? "selected-work-heading" : "real-work-heading";

  return (
    <section
      className={variant === "featured" ? styles.featured : styles.editorial}
      id={variant === "featured" ? "selected-work" : "real-work"}
      aria-labelledby={headingId}
      data-showcase={project.id}
      data-showcase-variant={variant}
    >
      <div className={styles.shell}>
        <div className={styles.grid}>
          <div className={styles.copyHead}>
            <p className={styles.eyebrow}>{project.eyebrow}</p>
            <TitleTag id={headingId} className={styles.title}>
              {project.title}
            </TitleTag>
          </div>
          <figure className={styles.media}>
            <CinematicFilm priority={variant === "featured"} />
          </figure>
          <div className={styles.copyBody}>
            <p className={styles.copyLede}>{project.description}</p>
            {variant === "featured" ? <p className={styles.copyBusiness}>{project.business}</p> : null}
            <ul className={styles.facts}>
              {project.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
            {variant === "editorial" ? (
              <p className={styles.distinction}>
                <span className={styles.realLabel}>Completed work</span>
                {project.distinction.real} {project.distinction.illustrative}
              </p>
            ) : null}
            <div className={styles.actions}>
              <a className="btn btn-emerald-glass" href={project.liveHref} rel="noreferrer">
                {project.liveLabel}
              </a>
              <AppLink className="btn btn-ghost" href={briefHref}>
                {project.inquireLabel}
              </AppLink>
            </div>
          </div>
        </div>
        <details className={styles.notes}>
          <summary>What this silent recording shows</summary>
          <p>{project.videoDescription}</p>
        </details>
      </div>
    </section>
  );
}

function Poster({ priority }: { priority: boolean }) {
  const project = FIX_IT_SHOP;
  return (
    <picture>
      <source srcSet={priority ? project.media.posterSrc : project.media.previewSrc} type="image/webp" />
      <img
        src={project.media.posterJpg}
        alt="Poster from the live Fix It Shop homepage hero: A little time. A lot of care."
        width={project.media.width}
        height={project.media.height}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "low"}
      />
    </picture>
  );
}

function CinematicFilm({ priority }: { priority: boolean }) {
  const project = FIX_IT_SHOP;
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const playGeneration = useRef(0);
  const userPausedRef = useRef(false);
  const userRequestedRef = useRef(false);
  const srcAttachedRef = useRef(false);
  const prefersStaticRef = useRef(false);
  const nearViewportRef = useRef(false);
  const visibleRef = useRef(false);
  const descriptionId = useId();
  const [srcAttached, setSrcAttached] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [prefersStatic, setPrefersStatic] = useState(false);

  function invalidatePlays() {
    playGeneration.current += 1;
  }

  function attachSource() {
    const video = videoRef.current;
    if (!video || srcAttachedRef.current) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = project.media.loopSrc;
    srcAttachedRef.current = true;
    setSrcAttached(true);
  }

  function pauseKeepTime() {
    const video = videoRef.current;
    invalidatePlays();
    if (video && !video.paused) video.pause();
    setIsPlaying(false);
  }

  async function requestPlay() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    const generation = playGeneration.current + 1;
    playGeneration.current = generation;
    try {
      await video.play();
      if (isStalePlayGeneration(playGeneration.current, generation)) return;
      if (
        decideCinematicPlayback({
          srcAttached: srcAttachedRef.current,
          userPaused: userPausedRef.current,
          tabHidden: document.hidden,
          nearViewport: nearViewportRef.current,
          meaningfullyVisible: visibleRef.current,
          prefersStatic: prefersStaticRef.current,
          userRequestedPlay: userRequestedRef.current
        }) !== "play"
      ) {
        video.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      if (isStalePlayGeneration(playGeneration.current, generation)) return;
      const kind = classifyPlayError(error);
      if (kind === "aborted") return;
      setBlocked(kind === "blocked");
      setFallback(true);
      setIsPlaying(false);
    }
  }

  function syncPlayback() {
    const action = decideCinematicPlayback({
      srcAttached: srcAttachedRef.current,
      userPaused: userPausedRef.current,
      tabHidden: typeof document !== "undefined" && document.hidden,
      nearViewport: nearViewportRef.current,
      meaningfullyVisible: visibleRef.current,
      prefersStatic: prefersStaticRef.current,
      userRequestedPlay: userRequestedRef.current
    });
    if (action === "attach") {
      attachSource();
      const next = decideCinematicPlayback({
        srcAttached: srcAttachedRef.current,
        userPaused: userPausedRef.current,
        tabHidden: typeof document !== "undefined" && document.hidden,
        nearViewport: nearViewportRef.current,
        meaningfullyVisible: visibleRef.current,
        prefersStatic: prefersStaticRef.current,
        userRequestedPlay: userRequestedRef.current
      });
      if (next === "play") void requestPlay();
      return;
    }
    if (action === "play") {
      void requestPlay();
      return;
    }
    if (action === "pause") pauseKeepTime();
  }

  useEffect(() => {
    const frame = frameRef.current;
    const video = videoRef.current;
    if (!frame) return;

    function applyPreferences() {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const connection = (navigator as Navigator & { connection?: NetworkConnection }).connection;
      const next = prefersStaticPlayback(reducedMotion, readSaveData(connection));
      prefersStaticRef.current = next;
      setPrefersStatic(next);
      setFallback(next);
      if (next) pauseKeepTime();
    }

    applyPreferences();

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      applyPreferences();
      syncPlayback();
    };
    motion.addEventListener("change", onMotion);

    const connection = (navigator as Navigator & { connection?: NetworkConnection }).connection;
    const onConnection = () => {
      applyPreferences();
      syncPlayback();
    };
    connection?.addEventListener?.("change", onConnection);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const ratio = entry?.intersectionRatio ?? 0;
        nearViewportRef.current = Boolean(entry?.isIntersecting) && ratio >= CINEMATIC_LOAD_RATIO;
        visibleRef.current = Boolean(entry?.isIntersecting) && ratio >= CINEMATIC_PLAY_RATIO;
        syncPlayback();
      },
      {
        rootMargin: "96px 0px",
        threshold: [0, CINEMATIC_LOAD_RATIO, 0.25, CINEMATIC_PLAY_RATIO, 0.6, 0.85, 1]
      }
    );
    observer.observe(frame);

    const onVisibility = () => syncPlayback();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      invalidatePlays();
      observer.disconnect();
      motion.removeEventListener("change", onMotion);
      connection?.removeEventListener?.("change", onConnection);
      document.removeEventListener("visibilitychange", onVisibility);
      video?.pause();
    };
    // The observer owns playback; refs keep decisions current.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only media controller
  }, []);

  function onPlaying() {
    if (userPausedRef.current || document.hidden) {
      videoRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    if (!visibleRef.current && !userRequestedRef.current) {
      videoRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    setBlocked(false);
  }

  function onPause() {
    if (!userPausedRef.current) setIsPlaying(false);
  }

  function restartLoop() {
    const video = videoRef.current;
    if (!video || userPausedRef.current) return;
    video.currentTime = CINEMATIC_LOOP_RESTART_TIME;
    void requestPlay();
  }

  function onTimeUpdate() {
    const video = videoRef.current;
    if (!video || userPausedRef.current) return;
    if (shouldRestartLoop(video.currentTime, video.duration)) restartLoop();
  }

  function onControl() {
    if (isPlaying) {
      userPausedRef.current = true;
      userRequestedRef.current = false;
      setUserPaused(true);
      pauseKeepTime();
      return;
    }
    userPausedRef.current = false;
    userRequestedRef.current = true;
    setUserPaused(false);
    setFallback(false);
    attachSource();
    void requestPlay();
  }

  const controlLabel = isPlaying
    ? project.pauseLabel
    : userPaused
      ? project.resumeLabel
      : project.playPreviewLabel;
  const showControl = isPlaying || userPaused || fallback || blocked;

  return (
    <div
      ref={frameRef}
      className={styles.film}
      data-film-surface
      data-src-attached={srcAttached ? "true" : "false"}
      data-film-playing={isPlaying ? "true" : "false"}
      data-user-paused={userPaused ? "true" : "false"}
      data-film-fallback={fallback || prefersStatic || blocked ? "true" : "false"}
    >
      <div className={styles.frame}>
        <p id={descriptionId} className={styles.srOnly}>
          {project.videoDescription}
        </p>
        <video
          ref={videoRef}
          poster={project.media.posterSrc}
          preload="none"
          muted
          playsInline
          disablePictureInPicture
          controlsList="nodownload noremoteplayback nofullscreen"
          width={project.media.width}
          height={project.media.height}
          aria-describedby={descriptionId}
          aria-label="Silent recording of the live Fix It Shop website"
          onPlaying={onPlaying}
          onPause={onPause}
          onEnded={restartLoop}
          onTimeUpdate={onTimeUpdate}
          onError={() => {
            setBlocked(false);
            setFallback(true);
            setIsPlaying(false);
          }}
          data-showcase-film
        />
        {isPlaying ? null : (
          <div className={styles.posterLayer} aria-hidden="true">
            <Poster priority={priority} />
          </div>
        )}
      </div>
      {showControl ? (
        <button
          className={styles.filmControl}
          type="button"
          onClick={onControl}
          aria-label={
            isPlaying
              ? "Pause the Fix It Shop film"
              : userPaused
                ? "Resume the Fix It Shop film"
                : "Play preview of the Fix It Shop film"
          }
          data-film-control
        >
          {controlLabel}
        </button>
      ) : null}
      {blocked ? (
        <p className={styles.fallbackNote} data-film-blocked>
          This browser paused automatic playback. Play the preview here, or open the live website.
        </p>
      ) : null}
    </div>
  );
}
