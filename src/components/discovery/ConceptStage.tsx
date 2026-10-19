"use client";

import { useCallback } from "react";
import { trustedSpecFromDiscovery } from "@/lib/design-spec";
import {
  buildConceptContent,
  conceptSectionId,
  type DirectionId,
  type DiscoveryDraft,
  type PreviewActionContext
} from "@/lib/discovery";
import { HearthConcept } from "./concepts/HearthConcept";
import { LumenConcept } from "./concepts/LumenConcept";
import { SignalConcept } from "./concepts/SignalConcept";
import frame from "./concepts/frame.module.css";

function scrollWithinPreview(instanceId: string, section: string) {
  const scroller = document.querySelector<HTMLElement>(`[data-preview-device="${instanceId}"]`);
  const target = document.getElementById(conceptSectionId(instanceId, section));
  if (!scroller || !target) return;
  const scrollerRect = scroller.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  scroller.scrollTo({
    top: scroller.scrollTop + (targetRect.top - scrollerRect.top),
    behavior: "auto"
  });
}

export function ConceptStage({
  instanceId,
  draft,
  directionId,
  source = "exploration",
  onAction
}: {
  instanceId: string;
  draft: DiscoveryDraft;
  directionId: DirectionId;
  source?: PreviewActionContext["source"];
  onAction: (context: PreviewActionContext) => void;
}) {
  const spec = trustedSpecFromDiscovery(draft, directionId);
  const content = buildConceptContent(draft, directionId);
  const onSection = useCallback((section: string) => {
    scrollWithinPreview(instanceId, section);
  }, [instanceId]);
  const props = {
    instanceId,
    content,
    paletteId: spec.paletteId,
    visualDirectionId: spec.visualDirectionId,
    onAction: () => onAction({ instanceId, directionId, draft, source }),
    onSection
  };
  const concept =
    directionId === "hearth" ? (
      <HearthConcept {...props} />
    ) : directionId === "signal" ? (
      <SignalConcept {...props} />
    ) : (
      <LumenConcept {...props} />
    );
  return (
    <div className={frame.frame} data-concept-container={instanceId} data-preview-source={source}>
      {concept}
    </div>
  );
}
