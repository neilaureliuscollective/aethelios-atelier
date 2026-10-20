import { isPlaceholderBusinessName } from "@/lib/cofounder/provision";
import { CompanionStudio } from "@/lib/cofounder/studio";
import type { BusinessConfirmation, StudioDraft, StudioDirectionAdoption } from "@/lib/cofounder/types";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { ConflictError, ForbiddenError, UniqueConstraintError } from "@/lib/domain/errors";
import { GuestWorkService } from "@/lib/guest/claim";
import { parseClaimedDiscovery, type ClaimedDiscoverySnapshot } from "@/lib/guest/snapshot";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import { runWithUniqueRetry } from "@/lib/persistence/unique";
import type { User } from "@/lib/types";

export type ConfirmationInput = {
  businessName: string;
  businessContext: string;
  sourceSelectionId?: string | null;
  sourceRevision?: number | null;
  directionId?: string | null;
  replaceConfirmedDirection?: boolean;
};

export type ConfirmationResult = {
  confirmation: BusinessConfirmation;
  draft: StudioDraft | null;
  snapshot: ClaimedDiscoverySnapshot | null;
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

function companionId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export class BusinessAdoption {
  constructor(
    private readonly store: PersistenceAdapter,
    private readonly workspace = new CompanionWorkspace(store),
    private readonly guests = new GuestWorkService(store),
    private readonly studio = new CompanionStudio(store)
  ) {}

  async read(businessId: string, user: User) {
    const context = await this.workspace.requireMembership(businessId, user);
    const confirmation = await this.store.companion.getBusinessConfirmation(businessId);
    const draft = confirmation?.studioDraftId
      ? await this.store.companion.getStudioDraft(confirmation.studioDraftId)
      : null;
    return { context, confirmation, draft: draft && draft.businessId === businessId ? draft : null };
  }

  async confirm(businessId: string, user: User, input: ConfirmationInput): Promise<ConfirmationResult> {
    const context = await this.workspace.requireMutable(businessId, user);
    const snapshot = await this.resolveClaimedSnapshot(user, input);
    const existing = await this.store.companion.getBusinessConfirmation(businessId);
    this.assertRenewedConfirmation(existing, snapshot, input.replaceConfirmedDirection);

    const resolved = resolveConfirmedBusinessName({
      submittedName: input.businessName,
      existingName: context.business.name,
      displayName: user.displayName
    });

    return runWithUniqueRetry(
      () =>
        this.store.runInTransaction(async () => {
          const current = await this.store.companion.getBusinessConfirmation(businessId);
          this.assertRenewedConfirmation(current, snapshot, input.replaceConfirmedDirection);

          let draft: StudioDraft | null = null;
          if (snapshot) {
            draft = await this.resolveOrCreateDraft(businessId, user, snapshot);
          }

          const stamp = new Date().toISOString();
          const confirmation: BusinessConfirmation = {
            businessId,
            ownerId: user.id,
            businessName: resolved.name,
            businessContext: input.businessContext.trim().slice(0, 2000),
            sourceSelectionId: snapshot?.selectionId ?? current?.sourceSelectionId ?? null,
            sourceRevision: snapshot?.localRevision ?? current?.sourceRevision ?? null,
            directionId: snapshot?.selectedDirectionId ?? current?.directionId ?? null,
            studioDraftId: draft?.id ?? current?.studioDraftId ?? null,
            confirmedAt: stamp,
            confirmedBy: user.id
          };

          await this.store.companion.upsertBusinessConfirmation(confirmation);
          const nameField = context.profile.fields.name;
          const shouldWriteName =
            !nameField.value.trim() ||
            isPlaceholderBusinessName(nameField.value, user.displayName) ||
            !resolved.retainedExisting;
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
                    kind: context.profile.fields.audience.value.trim()
                      ? context.profile.fields.audience.kind
                      : "confirmed",
                    source: context.profile.fields.audience.value.trim()
                      ? context.profile.fields.audience.source
                      : "owner_confirmed",
                    updatedAt: stamp
                  }
                : context.profile.fields.audience
            }
          });
          return { confirmation, draft, snapshot };
        }),
      {
        onExhausted: () => {
          throw new UniqueConstraintError("The Studio draft could not be adopted uniquely.");
        }
      }
    );
  }

  private async resolveClaimedSnapshot(user: User, input: ConfirmationInput) {
    const requestedId = input.sourceSelectionId?.trim() || "";
    if (!requestedId && input.sourceRevision == null && !input.directionId) {
      return null;
    }
    if (!requestedId) {
      throw new ForbiddenError("A claimed Discovery selection is required to adopt a direction into Studio.");
    }
    const claim = await this.guests.requireOwnedClaim(user, requestedId);
    const snapshot = parseClaimedDiscovery(claim);
    if (snapshot.selectionId !== requestedId && snapshot.guestWorkId !== requestedId) {
      throw new ForbiddenError("The submitted selection does not match the claimed Discovery snapshot.");
    }
    if (input.sourceRevision != null && input.sourceRevision !== snapshot.localRevision) {
      throw new ForbiddenError("The submitted revision does not match the claimed Discovery snapshot.");
    }
    if (input.directionId && input.directionId !== snapshot.selectedDirectionId) {
      throw new ForbiddenError("The submitted direction does not match the claimed Discovery snapshot.");
    }
    return snapshot;
  }

  private assertRenewedConfirmation(
    existing: BusinessConfirmation | null,
    snapshot: ClaimedDiscoverySnapshot | null,
    replace?: boolean
  ) {
    if (
      existing?.sourceSelectionId &&
      snapshot &&
      (existing.sourceSelectionId !== snapshot.selectionId ||
        existing.sourceRevision !== snapshot.localRevision ||
        existing.directionId !== snapshot.selectedDirectionId) &&
      !replace
    ) {
      throw new ConflictError(
        "This workspace already confirmed a different Discovery direction. Keep the current confirmation or replace it explicitly.",
        existing.sourceRevision ?? undefined,
        existing
      );
    }
  }

  private async resolveOrCreateDraft(
    businessId: string,
    user: User,
    snapshot: ClaimedDiscoverySnapshot
  ): Promise<StudioDraft> {
    const existing = await this.store.companion.getStudioDirectionAdoption(
      businessId,
      snapshot.selectionId,
      snapshot.localRevision,
      snapshot.selectedDirectionId
    );
    if (existing) {
      if (existing.ownerId !== user.id && user.role !== "founder") {
        throw new ForbiddenError("This Discovery direction already belongs to another account.");
      }
      const draft = await this.store.companion.getStudioDraft(existing.draftId);
      if (draft && draft.businessId === businessId) return draft;
      throw new UniqueConstraintError("The adopted Studio draft is still resolving.");
    }

    const reserved: StudioDirectionAdoption = {
      businessId,
      sourceSelectionId: snapshot.selectionId,
      sourceRevision: snapshot.localRevision,
      directionId: snapshot.selectedDirectionId,
      draftId: companionId("studio"),
      ownerId: user.id,
      snapshotJson: JSON.stringify(snapshot).slice(0, 20_000),
      createdAt: new Date().toISOString()
    };
    const written = await this.store.companion.insertStudioDirectionAdoption(reserved);
    if (!written.inserted) {
      if (written.adoption.ownerId !== user.id && user.role !== "founder") {
        throw new ForbiddenError("This Discovery direction already belongs to another account.");
      }
      const raced = await this.store.companion.getStudioDraft(written.adoption.draftId);
      if (raced && raced.businessId === businessId) return raced;
      throw new UniqueConstraintError("The adopted Studio draft is still resolving.");
    }

    const created = await this.studio.createFromConfirmedSnapshot(businessId, user, reserved.draftId, {
      headline: snapshot.headline,
      body: snapshot.body,
      direction: snapshot.selectedDirectionId
    });
    return created.draft;
  }
}

export function assertConfirmationOwner(confirmation: BusinessConfirmation, user: User) {
  if (confirmation.ownerId !== user.id && user.role !== "founder") {
    throw new ForbiddenError("This confirmation belongs to another account.");
  }
}
