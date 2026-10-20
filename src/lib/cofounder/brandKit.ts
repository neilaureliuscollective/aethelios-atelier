import { z } from "zod";
import { trustedSpecFromDiscovery } from "@/lib/design-spec/fromDiscovery";
import { validateDesignSpec } from "@/lib/design-spec/validate";
import type { DesignSpec } from "@/lib/design-spec/types";
import { draftFromSelection, parseSelection } from "@/lib/discovery/selection";
import type { BrandAssetRef } from "@/lib/cofounder/types";

export type BrandKit = {
  version: 1;
  revision: number;
  sourceSelectionId: string;
  sourceRevision: number;
  businessName: string;
  mode: "new_brand" | "existing_brand";
  designSpec: DesignSpec;
  locked: boolean;
  provenance: "curated_local";
  retainedAssets: BrandAssetRef[];
};
const schema = z.object({
  version: z.literal(1), revision: z.number().int().positive(),
  sourceSelectionId: z.string().min(1).max(200), sourceRevision: z.number().int().positive(),
  businessName: z.string().max(160), mode: z.enum(["new_brand", "existing_brand"]),
  designSpec: z.unknown(), locked: z.boolean(), provenance: z.literal("curated_local"),
  retainedAssets: z.array(z.object({ id: z.string(), kind: z.enum(["logo", "document", "image"]), title: z.string(), documentId: z.string().optional(), assetId: z.string().optional() })).max(100)
});
export function parseBrandKit(input: unknown): BrandKit | null {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return null;
  const spec = validateDesignSpec(parsed.data.designSpec);
  return spec.ok ? { ...parsed.data, designSpec: spec.spec } : null;
}
export function brandKitFromSelection(input: unknown, options: {
  previous?: BrandKit; mode: BrandKit["mode"]; locked: boolean; retainedAssets: BrandAssetRef[];
}): BrandKit | null {
  const selection = parseSelection(input);
  if (!selection) return null;
  return {
    version: 1, revision: (options.previous?.revision ?? 0) + 1,
    sourceSelectionId: selection.selectionId, sourceRevision: selection.localRevision,
    businessName: selection.businessName, mode: options.mode,
    designSpec: selection.designSpec ?? trustedSpecFromDiscovery(draftFromSelection(selection), selection.selectedDirectionId),
    locked: options.locked, provenance: "curated_local", retainedAssets: structuredClone(options.retainedAssets)
  };
}
