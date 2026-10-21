"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { usePathname } from "next/navigation";
import { AppLink } from "@/components/ui/AppLink";
import { FIX_IT_SHOP } from "@/lib/work/fixItShop";
import styles from "./selectedWork.module.css";

type SelectedWorkVariant = "featured" | "editorial" | "preview";

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
            <p className="tiny">{project.eyebrow}</p>
            <TitleTag>{project.title}</TitleTag>
            <p className="lede">{project.description}</p>
            <p className="muted">{project.distinction.real}</p>
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

  return (
    <ShowcasePlayer>
      {({ open, triggerRef, dialog }) => (
        <section
          className={variant === "featured" ? styles.featured : styles.editorial}
          id={variant === "featured" ? "selected-work" : "real-work"}
          aria-labelledby={variant === "featured" ? "selected-work-heading" : "real-work-heading"}
          data-showcase={project.id}
          data-showcase-variant={variant}
        >
          <div className={styles.shell}>
            <div className={styles.grid}>
              <div className={styles.copy}>
                <p className="kicker">{project.eyebrow}</p>
                <TitleTag id={variant === "featured" ? "selected-work-heading" : "real-work-heading"}>
                  {project.title}
                </TitleTag>
                <p className="lede">{project.description}</p>
                <p className={variant === "featured" ? "lede lede-bright" : "muted"}>{project.business}</p>
                <ul className={styles.facts}>
                  {project.facts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
                {variant === "editorial" ? (
                  <p className={`notice ${styles.distinction}`}>
                    {project.distinction.real} {project.distinction.illustrative}
                  </p>
                ) : null}
                <div className={styles.actions}>
                  <button
                    ref={triggerRef}
                    className="btn btn-gold"
                    type="button"
                    onClick={open}
                    data-showcase-open
                  >
                    {project.watchLabel}
                  </button>
                  <a className="btn btn-emerald-glass" href={project.liveHref} rel="noreferrer">
                    {project.liveLabel}
                  </a>
                  <AppLink className="btn btn-ghost" href={briefHref}>
                    {project.inquireLabel}
                  </AppLink>
                </div>
              </div>
              <figure className={styles.media}>
                <div className={styles.frame}>
                  <Poster priority={variant === "featured"} />
                </div>
              </figure>
            </div>
            <details className={styles.notes}>
              <summary>What this silent recording shows</summary>
              <p>{project.videoDescription}</p>
            </details>
          </div>
          {dialog}
        </section>
      )}
    </ShowcasePlayer>
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

function ShowcasePlayer({
  children
}: {
  children: (api: {
    open: () => void;
    triggerRef: RefObject<HTMLButtonElement | null>;
    dialog: ReactNode;
  }) => ReactNode;
}) {
  const project = FIX_IT_SHOP;
  const [open, setOpen] = useState(false);
  const [srcReady, setSrcReady] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "blocked" | "error">("idle");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    if (open) return;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    setSrcReady(false);
    setStatus("idle");
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  async function play() {
    const video = videoRef.current;
    if (!video) return;
    setStatus("loading");
    video.src = project.media.masterSrc;
    setSrcReady(true);
    try {
      await video.play();
      setStatus("playing");
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setStatus(name === "NotAllowedError" ? "blocked" : "error");
    }
  }

  const statusCopy = {
    idle: "",
    loading: "Preparing the recording…",
    playing: "",
    blocked: "The browser blocked playback. The live website remains available.",
    error: "This recording could not be opened. The live website remains available."
  }[status];

  const dialog = (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={() => setOpen(false)}
    >
      <div className={styles.dialogHead}>
        <div>
          <p className="tiny">{project.eyebrow}</p>
          <h2 id={titleId}>{project.title}</h2>
        </div>
        <button className="btn btn-ghost" type="button" onClick={close}>
          Close
        </button>
      </div>
      <div className={styles.stageWrap}>
        <div className={styles.stage}>
          <video
            ref={videoRef}
            poster={project.media.posterSrc}
            preload="none"
            playsInline
            controls={srcReady}
            controlsList="nofullscreen nodownload noremoteplayback"
            disablePictureInPicture
            width={project.media.width}
            height={project.media.height}
            onError={() => setStatus("error")}
            data-video-src-attached={srcReady ? "true" : "false"}
          />
        </div>
        </div>
        {statusCopy ? <p className={`notice ${styles.status}`}>{statusCopy}</p> : null}
        <details className={styles.notes}>
          <summary>What this silent recording shows</summary>
          <p>{project.videoDescription}</p>
        </details>
        <div className={styles.dialogActions}>
          {srcReady ? null : (
            <button className="btn btn-gold" type="button" onClick={() => void play()}>
              Play
            </button>
          )}
          <a className="btn btn-emerald-glass" href={project.liveHref} rel="noreferrer">
            {project.liveLabel}
          </a>
        {status === "blocked" || status === "error" ? (
          <a className="btn btn-gold" href={project.liveHref} rel="noreferrer">
            Open the live website
          </a>
        ) : null}
      </div>
    </dialog>
  );

  return (
    <>
      {children({
        open: () => setOpen(true),
        triggerRef,
        dialog
      })}
    </>
  );
}
