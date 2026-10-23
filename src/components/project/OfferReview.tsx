import { fieldLabel } from "@/lib/brief";
import { barbersSalonReviewSummary, commerceReviewSummary } from "@/lib/offers/intake";
import type { Brief } from "@/lib/types";

export function OfferReview({ brief }: { brief: Brief }) {
  const barbers = barbersSalonReviewSummary(brief);
  const commerce = commerceReviewSummary(brief);
  if (barbers) {
    return (
      <aside className="surface-glass" aria-label="Focused offer review" style={{ padding: 16, marginBottom: 16 }}>
        <p className="tiny">Selected offer</p>
        <h3 style={{ marginTop: 4 }}>{barbers.offerTitle}</h3>
        <p className="muted">
          A branded website and installable web app connected to an existing booking destination.
          Submission requests review. It does not buy a plan, accept a quote, or promise a delivery
          date.
        </p>
        <div className="brief-item">
          <strong>Booking destination</strong>
          <p>{barbers.bookingDestination}</p>
          <p className="muted">{barbers.bookingCheck.message}</p>
        </div>
        <div className="brief-item">
          <strong>Brand assets and photography</strong>
          <p>{barbers.assets}</p>
        </div>
        <div className="brief-item">
          <strong>Scope</strong>
          <p>{barbers.scope}</p>
        </div>
        <div className="brief-item">
          <strong>Location, hours, and constraints</strong>
          <p>{barbers.location}</p>
        </div>
        {barbers.unresolved.length ? (
          <div className="brief-item">
            <strong>Still unknown</strong>
            <p className="muted">
              {barbers.unresolved.map((key) => fieldLabel(key, brief)).join(" · ")}. Unknown answers
              remain unknown.
            </p>
          </div>
        ) : (
          <p className="notice">The focused fields for this offer have wording.</p>
        )}
      </aside>
    );
  }

  if (!commerce) return null;

  return (
    <aside className="surface-glass" aria-label="Focused offer review" style={{ padding: 16, marginBottom: 16 }}>
      <p className="tiny">Selected offer</p>
      <h3 style={{ marginTop: 4 }}>{commerce.offerTitle}</h3>
      <p className="muted">
        An Atelier Commerce request. Submission asks Neil to review a storefront, sourcing help, or
        both. It does not buy a plan, collect store payments, or create an Atelier product catalog.
      </p>
      <div className="brief-item">
        <strong>Products, suppliers, and commerce tools today</strong>
        <p>{commerce.commerceSetup}</p>
      </div>
      <div className="brief-item">
        <strong>Brand assets and photography</strong>
        <p>{commerce.assets}</p>
      </div>
      <div className="brief-item">
        <strong>Scope</strong>
        <p>{commerce.scope}</p>
      </div>
      <div className="brief-item">
        <strong>Constraints</strong>
        <p>{commerce.constraints}</p>
      </div>
      {commerce.unresolved.length ? (
        <div className="brief-item">
          <strong>Still unknown</strong>
          <p className="muted">
            {commerce.unresolved.map((key) => fieldLabel(key, brief)).join(" · ")}. Unknown answers
            remain unknown.
          </p>
        </div>
      ) : (
        <p className="notice">The focused fields for {commerce.offerTitle} have wording.</p>
      )}
    </aside>
  );
}
