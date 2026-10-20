import {
  createSampleExplorationDraft,
  hasVisitorAnswers,
  type DiscoveryDraft,
  type DiscoverySelection
} from "@/lib/discovery";

export const SAMPLE_PRESERVED_STATUS =
  "Continuing with the answers already on this visit. Sample content was not applied.";

export const SAMPLE_APPLIED_STATUS = "Sample direction for exploration. Not saved to an account.";

export function resolveSampleVisit(
  draft: DiscoveryDraft,
  confirmed: DiscoverySelection | null
): { applied: boolean; draft: DiscoveryDraft; status: string } {
  if (hasVisitorAnswers(draft) || confirmed) {
    return {
      applied: false,
      draft,
      status: SAMPLE_PRESERVED_STATUS
    };
  }
  return {
    applied: true,
    draft: createSampleExplorationDraft(),
    status: SAMPLE_APPLIED_STATUS
  };
}
