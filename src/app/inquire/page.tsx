import type { Metadata } from "next";
import { AppLink } from "@/components/ui/AppLink";
import { InquiryForm } from "@/components/project/InquiryForm";

export const metadata: Metadata = {
  title: "Send an inquiry",
  description:
    "Send a project inquiry to Neil Stutes. No account is required. This is a request, not a booking or payment."
};

export default function InquirePage() {
  return (
    <section className="container section">
      <p className="kicker">Inquiry</p>
      <h1>Tell Neil what you need.</h1>
      <p className="lede">
        No account is required. Sending this is a request for review — not a booking, quote, or
        payment. If you would rather shape a fuller brief first, start there.
      </p>
      <div className="inquiry-page-form surface-ivory" style={{ padding: 28, marginTop: 24, maxWidth: 640 }}>
        <InquiryForm source="inquire" />
      </div>
      <div className="row" style={{ marginTop: 24 }}>
        <AppLink className="btn btn-ghost" href="/project">
          Shape a fuller brief
        </AppLink>
        <AppLink className="btn btn-ghost" href="/services">
          Review services
        </AppLink>
      </div>
    </section>
  );
}
