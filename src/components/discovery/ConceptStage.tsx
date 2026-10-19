"use client";

import { buildConceptContent, type DirectionId, type DiscoveryDraft } from "@/lib/discovery";
import { HearthConcept } from "./concepts/HearthConcept";
import { LumenConcept } from "./concepts/LumenConcept";
import { SignalConcept } from "./concepts/SignalConcept";

export function ConceptStage({
  draft,
  directionId,
  onAction,
  onSection
}: {
  draft: DiscoveryDraft;
  directionId: DirectionId;
  onAction: () => void;
  onSection: (id: string) => void;
}) {
  const content = buildConceptContent(draft, directionId);
  const props = {
    content,
    paletteId: draft.paletteId,
    visualDirectionId: draft.visualDirectionId,
    onAction,
    onSection
  };
  if (directionId === "hearth") return <HearthConcept {...props} />;
  if (directionId === "signal") return <SignalConcept {...props} />;
  return <LumenConcept {...props} />;
}
