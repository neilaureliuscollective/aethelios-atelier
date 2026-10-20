import { isPlaceholderBusinessName } from "@/lib/cofounder/provision";
import type { BusinessConfirmation } from "@/lib/cofounder/types";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { ConflictError, ForbiddenError } from "@/lib/domain/errors";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import type { User } from "@/lib/types";

export type ConfirmationInput = {
  businessName: string;
  businessContext: string;
  sourceSelectionId?: string | null;
  sourceRevision?: number | null;
  directionId?: string | null;
  replaceConfirmedDirection?: boolean;
};

export function resolveConfirmedBusinessName(input: {
  submittedName: string;
  existingName: string;
  displayName?: string;
}): { name: string; retainedExisting: boolean } {
  const submitted = input.submittedName.trim().slice(0, 160);
  const existing = input.existingName.trim();
  const placeholder = isPlaceholderBusinessName(existing, input.displayName);
  if (!placeholder && submitted && submitted !== existing) {
    return { name: submitted, retainedExisting: false };
  }
  if (!placeholder) {
    return { name: existing, retainedExisting: true };
  }
  return { name: submitted || existing || "Your business", retainedExisting: false };
}

export class BusinessAdoption {
  constructor(
    private readonly store: PersistenceAdapter,
    private readonly workspace = new CompanionWorkspace(store)
  ) {}

  async read(businessId: string, user: User) {
    const context = await this.workspace.requireMembership(businessId, user);
    const confirmation = await this.store.companion.getBusinessConfirmation(businessId);
    return { context, confirmation };
  }

  async confirm(businessId: string, user: User, input: ConfirmationInput) {
    const context = await this.workspace.requireMutable(businessId, user);
    const existing = await this.store.companion.getBusinessConfirmation(businessId);
    if (
      existing?.sourceSelectionId &&
      input.sourceSelectionId &&
      (existing.sourceSelectionId !== input.sourceSelectionId ||
        existing.sourceRevision !== (input.sourceRevision ?? null)) &&
      !input.replaceConfirmedDirection
    ) {
      throw new ConflictError(
        "This workspace already confirmed a different Discovery direction. Keep the current confirmation or replace it explicitly.",
        existing.sourceRevision ?? undefined,
        existing
      );
    }

    const resolved = resolveConfirmedBusinessName({
      submittedName: input.businessName,
      existingName: context.business.name,
      displayName: user.displayName
    });
    const stamp = new Date().toISOString();
    const confirmation: BusinessConfirmation = {
      businessId,
      ownerId: user.id,
      businessName: resolved.name,
      businessContext: input.businessContext.trim().slice(0, 2000),
      sourceSelectionId: input.sourceSelectionId ?? existing?.sourceSelectionId ?? null,
      sourceRevision: input.sourceRevision ?? existing?.sourceRevision ?? null,
      directionId: input.directionId ?? existing?.directionId ?? null,
      confirmedAt: stamp,
      confirmedBy: user.id
    };

    return this.store.runInTransaction(async () => {
      await this.store.companion.upsertBusinessConfirmation(confirmation);
      const nameField = context.profile.fields.name;
      const shouldWriteName =
        !nameField.value.trim() || isPlaceholderBusinessName(nameField.value, user.displayName) || !resolved.retainedExisting;
      await this.workspace.updateProfile(businessId, user, {
        fields: {
          ...context.profile.fields,
          name: shouldWriteName
            ? {
                ...nameField,
                value: resolved.name,
                kind: "confirmed",
                source: "owner_confirmed",
                updatedAt: stamp
              }
            : nameField,
          audience: input.businessContext.trim()
            ? {
                ...context.profile.fields.audience,
                value: context.profile.fields.audience.value.trim() || input.businessContext.trim().slice(0, 4000),
                kind: context.profile.fields.audience.value.trim() ? context.profile.fields.audience.kind : "confirmed",
                source: context.profile.fields.audience.value.trim() ? context.profile.fields.audience.source : "owner_confirmed",
                updatedAt: stamp
              }
            : context.profile.fields.audience
        }
      });
      return confirmation;
    });
  }
}

export function assertConfirmationOwner(confirmation: BusinessConfirmation, user: User) {
  if (confirmation.ownerId !== user.id && user.role !== "founder") {
    throw new ForbiddenError("This confirmation belongs to another account.");
  }
}
