import { describe, expect, it } from "vitest";
import { parseClaimedDiscovery } from "@/lib/guest/snapshot";
import { ForbiddenError } from "@/lib/domain/errors";

describe("claimed Discovery snapshot", () => {
  it("reads the stored claim payload rather than inventing a direction", () => {
    const snapshot = parseClaimedDiscovery({
      guestWorkId: "dsel_one",
      ownerId: "usr_owner",
      kind: "discovery",
      destination: "/companion/confirm",
      payloadJson: JSON.stringify({
        selectionId: "dsel_one",
        localRevision: 2,
        selectedDirectionId: "lumen",
        businessName: "Northridge",
        audience: "Returning guests",
        visualPreferences: { headline: "Considered sourcing" }
      }),
      createdAt: "2026-10-20T00:00:00.000Z"
    });
    expect(snapshot.selectedDirectionId).toBe("lumen");
    expect(snapshot.localRevision).toBe(2);
    expect(snapshot.headline).toBe("Considered sourcing");
    expect(snapshot.body).toContain("Returning guests");
  });

  it("rejects an incomplete or non-discovery claim", () => {
    expect(() =>
      parseClaimedDiscovery({
        guestWorkId: "dsel_one",
        ownerId: "usr_owner",
        kind: "brief",
        destination: "/account/adopt",
        payloadJson: "{}",
        createdAt: "2026-10-20T00:00:00.000Z"
      })
    ).toThrow(ForbiddenError);
    expect(() =>
      parseClaimedDiscovery({
        guestWorkId: "dsel_one",
        ownerId: "usr_owner",
        kind: "discovery",
        destination: "/companion/confirm",
        payloadJson: JSON.stringify({ selectedDirectionId: "lumen" }),
        createdAt: "2026-10-20T00:00:00.000Z"
      })
    ).toThrow(ForbiddenError);
  });
});
