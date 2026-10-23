import {
  aetheliosApprovedCatalog,
  aetheliosBriefDuties,
  aetheliosPersonaPrompt
} from "@/lib/aethelios/persona";

export function aureliusSystemPrompt() {
  return [aetheliosPersonaPrompt(), aetheliosBriefDuties(), aetheliosApprovedCatalog()].join("\n");
}
