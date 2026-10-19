import { BRIEF_FIELD_KEYS, type Brief, type BriefFieldKey } from "@/lib/types";
import { FIELD_LABELS, displayFieldValue } from "@/lib/brief";

export function briefsEqual(a: Brief, b: Brief) {
  return BRIEF_FIELD_KEYS.every((key) => a[key].value === b[key].value);
}

export type BriefDifference = {
  key: BriefFieldKey;
  label: string;
  local: string;
  server: string;
};

export function briefDifferences(local: Brief, server: Brief): BriefDifference[] {
  return BRIEF_FIELD_KEYS.flatMap((key) => {
    if (local[key].value === server[key].value) return [];
    return [
      {
        key,
        label: FIELD_LABELS[key],
        local: displayFieldValue(key, local[key].value) || "Empty",
        server: displayFieldValue(key, server[key].value) || "Empty"
      }
    ];
  });
}
