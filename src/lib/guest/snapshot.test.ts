import { describe, expect, it } from "vitest";
import { parseClaimedDiscovery } from "@/lib/guest/snapshot";
import { ForbiddenError } from "@/lib/domain/errors";

describe("claimed Discovery snapshot", () => {
  it("reads the stored claim payload rather than inventing a direction", () => {
    const snapshot = parseClaimedDiscovery({
      guestWorkId: "dsel_one",
      sourceRevision: 2,
      ownerId: "usr_owner",
      kind: "discovery",
      destination: "/companion/confirm",
      payloadJson: JSON.stringify({
        selectionId: "dsel_one",
        localRevision: 2,
        selectedDirectionId: "lumen",
        businessName: "Northridge",
        audience: "Returning guests",
        visualPreferences: { headline: "Considered sourcing", paletteId: "ivory_hall", visualDirectionId: "glass" }
      }),
      createdAt: "2026-10-20T00:00:00.000Z"
    });
    expect(snapshot.selectedDirectionId).toBe("lumen");
    expect(snapshot.localRevision).toBe(2);
    expect(snapshot.headline).toBe("Considered sourcing");
    expect(snapshot.body).toContain("Returning guests");
    expect(snapshot.paletteId).toBe("ivory_hall");
    expect(snapshot.visualDirectionId).toBe("glass");
  });

  it("defaults palette and visual from the selected direction when the claim omitted them", () => {
    const snapshot = parseClaimedDiscovery({
      guestWorkId: "dsel_hearth",
      sourceRevision: 1,
      ownerId: "usr_owner",
      kind: "discovery",
      destination: "/companion/confirm",
      payloadJson: JSON.stringify({
        selectionId: "dsel_hearth",
        localRevision: 1,
        selectedDirectionId: "hearth",
        businessName: "Northridge"
      }),
      createdAt: "2026-10-20T00:00:00.000Z"
    });
    expect(snapshot.paletteId).toBe("hearth_linen");
    expect(snapshot.visualDirectionId).toBe("material");
    expect(snapshot.layout).toBe("direction_board");
  });

  it("rejects an incomplete or non-discovery claim", () => {
    expect(() =>
      parseClaimedDiscovery({
        guestWorkId: "dsel_one",
        sourceRevision: 0,
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
        sourceRevision: 0,
        ownerId: "usr_owner",
        kind: "discovery",
        destination: "/companion/confirm",
        payloadJson: JSON.stringify({ selectedDirectionId: "lumen" }),
        createdAt: "2026-10-20T00:00:00.000Z"
      })
    ).toThrow(ForbiddenError);
  });
});
