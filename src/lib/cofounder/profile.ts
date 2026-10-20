import {
  PROFILE_FIELD_KEYS,
  type ApprovedRate,
  type BusinessProfile,
  type ProfileField,
  type ProfileFieldKey
} from "@/lib/cofounder/types";

export function emptyProfile(businessId: string, updatedAt: string): BusinessProfile {
  const fields = Object.fromEntries(
    PROFILE_FIELD_KEYS.map((key) => [
      key,
      {
        key,
        value: "",
        kind: "confirmed"
      } satisfies ProfileField
    ])
  ) as Record<ProfileFieldKey, ProfileField>;
  return {
    businessId,
    fields,
    approvedRates: [],
    brandAssets: [],
    sourceDocumentIds: [],
    updatedAt
  };
}

export function normalizeProfile(input: Partial<BusinessProfile> & { businessId: string }): BusinessProfile {
  const base = emptyProfile(input.businessId, input.updatedAt ?? new Date().toISOString());
  for (const key of PROFILE_FIELD_KEYS) {
    const incoming = input.fields?.[key];
    if (!incoming) continue;
    base.fields[key] = {
      key,
      value: typeof incoming.value === "string" ? incoming.value.slice(0, 4000) : "",
      kind: incoming.kind === "preference" || incoming.kind === "suggestion" ? incoming.kind : "confirmed",
      source: incoming.source,
      updatedAt: incoming.updatedAt
    };
  }
  base.approvedRates = (input.approvedRates ?? []).filter(isApprovedRate);
  base.brandAssets = input.brandAssets ?? [];
  base.sourceDocumentIds = input.sourceDocumentIds ?? [];
  base.updatedBy = input.updatedBy;
  return base;
}

export function confirmedFacts(profile: BusinessProfile) {
  return Object.values(profile.fields)
    .filter((field) => field.kind === "confirmed" && field.value.trim())
    .map((field) => ({
      key: field.key,
      value: field.value,
      source: field.source ?? "owner",
      updatedAt: field.updatedAt
    }));
}

export function preferences(profile: BusinessProfile) {
  return Object.values(profile.fields).filter((field) => field.kind === "preference" && field.value.trim());
}

function isApprovedRate(value: ApprovedRate): value is ApprovedRate {
  return (
    Boolean(value?.id) &&
    typeof value.label === "string" &&
    Number.isInteger(value.amountCents) &&
    value.amountCents >= 0 &&
    (value.unit === "each" || value.unit === "hour" || value.unit === "project")
  );
}
