import { fieldLabel } from "@/lib/brief";
import { BARBERS_SALONS_OFFER } from "@/lib/offers/barbersSalons";
import { barbersSalonReviewSummary } from "@/lib/offers/intake";
import type { Brief } from "@/lib/types";

export function OfferReview({ brief }: { brief: Brief }) {
  const summary = barbersSalonReviewSummary(brief);
  if (!summary) return null;

  return (
    <aside className="surface-glass" aria-label="Focused offer review" style={{ padding: 16, marginBottom: 16 }}>
      <p className="tiny">Selected offer</p>
      <h3 style={{ marginTop: 4 }}>{summary.offerTitle}</h3>
      <p className="muted">
        A branded website and installable web app connected to an existing booking destination.
        Submission requests review. It does not buy a plan, accept a quote, or promise a delivery
        date.
      </p>
      <div className="brief-item">
        <strong>Booking destination</strong>
        <p>{summary.bookingDestination}</p>
        <p className="muted">{summary.bookingCheck.message}</p>
      </div>
      <div className="brief-item">
        <strong>Brand assets and photography</strong>
        <p>{summary.assets}</p>
      </div>
      <div className="brief-item">
        <strong>Scope</strong>
        <p>{summary.scope}</p>
      </div>
      <div className="brief-item">
        <strong>Location, hours, and constraints</strong>
        <p>{summary.location}</p>
      </div>
      {summary.unresolved.length ? (
        <div className="brief-item">
          <strong>Still unknown</strong>
          <p className="muted">
            {summary.unresolved.map((key) => fieldLabel(key, brief)).join(" · ")}. Unknown answers
            remain unknown.
          </p>
        </div>
      ) : (
        <p className="notice">The focused fields for {BARBERS_SALONS_OFFER.short} have wording.</p>
      )}
    </aside>
  );
}
