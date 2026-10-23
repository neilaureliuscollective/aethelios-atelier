import {
  aetheliosCompanionCatalog,
  aetheliosCompanionDuties,
  aetheliosPersonaPrompt
} from "@/lib/aethelios/persona";

export function companionSystemPrompt() {
  return [aetheliosPersonaPrompt(), aetheliosCompanionDuties(), aetheliosCompanionCatalog()].join("\n");
}
