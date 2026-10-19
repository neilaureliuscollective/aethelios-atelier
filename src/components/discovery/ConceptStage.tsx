"use client";

import { useCallback } from "react";
import {
  buildConceptContent,
  conceptSectionId,
  type DirectionId,
  type DiscoveryDraft
} from "@/lib/discovery";
import { HearthConcept } from "./concepts/HearthConcept";
import { LumenConcept } from "./concepts/LumenConcept";
import { SignalConcept } from "./concepts/SignalConcept";

function scrollWithinPreview(instanceId: string, section: string) {
  const scroller = document.querySelector<HTMLElement>(`[data-preview-device="${instanceId}"]`);
  const target = document.getElementById(conceptSectionId(instanceId, section));
  if (!scroller || !target) return;
  const scrollerRect = scroller.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  scroller.scrollTo({
    top: scroller.scrollTop + (targetRect.top - scrollerRect.top),
    behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
  });
}

export function ConceptStage({
  instanceId,
  draft,
  directionId,
  onAction
}: {
  instanceId: string;
  draft: DiscoveryDraft;
  directionId: DirectionId;
  onAction: (directionId: DirectionId) => void;
}) {
  const content = buildConceptContent(draft, directionId);
  const onSection = useCallback((section: string) => {
    scrollWithinPreview(instanceId, section);
  }, [instanceId]);
  const props = {
    instanceId,
    content,
    paletteId: draft.paletteId,
    visualDirectionId: draft.visualDirectionId,
    onAction: () => onAction(directionId),
    onSection
  };
  if (directionId === "hearth") return <HearthConcept {...props} />;
  if (directionId === "signal") return <SignalConcept {...props} />;
  return <LumenConcept {...props} />;
}
