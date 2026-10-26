import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms for using the Aethelios Atelier website and its Aethelios conversation."
};

const SECTIONS: LegalSection[] = [
  {
    heading: "What this site is",
    body: [
      "Aethelios Atelier is a founder-led digital studio run by Neil Stutes. This site describes the studio’s work and lets you talk a project through with Aethelios, an AI guide, and send the result to Neil."
    ]
  },
  {
    heading: "A request, not an agreement",
    body: [
      "Sending a direction or an inquiry is a request for review. It is not a booking, quote, contract, or payment, and it does not oblige either side to proceed.",
      "Work begins only under a written proposal that Neil sends and you accept. That proposal sets the scope, investment, timing, and terms, and it takes precedence over anything on this site."
    ]
  },
  {
    heading: "About Aethelios",
    body: [
      "Aethelios is an AI guide. Its replies and direction documents are starting points for a conversation, not professional, legal, or financial advice, and they can be incomplete or wrong. Aethelios cannot accept work, set a price, or promise a timeline.",
      "Sketches and previews it produces are illustrative. They are not finished designs and do not represent completed client work."
    ]
  },
  {
    heading: "Using the site",
    body: [
      "Please use the site honestly: no automated scraping, no attempts to disrupt or misuse Aethelios, and no unlawful or harmful content. Requests may be limited to keep the site available for everyone."
    ]
  },
  {
    heading: "Ownership",
    body: [
      "The Aethelios Atelier name, marks, writing, and design on this site belong to the studio. You keep ownership of what you tell Aethelios about your own business.",
      "Ownership of anything built for you is set out in your proposal."
    ]
  },
  {
    heading: "Liability",
    body: [
      "The site is provided as it is. To the extent the law allows, the studio is not liable for losses arising from use of the site or from reliance on Aethelios’s replies."
    ]
  },
  {
    heading: "Governing law",
    body: ["These terms are governed by the laws of the State of Louisiana, United States."]
  }
];

export default function TermsPage() {
  return (
    <LegalDocument
      kicker="Terms"
      title="Plain terms for a considered studio."
      updated="October 2026"
      intro="These terms cover use of this website and the Aethelios conversation. Any work itself is governed by its written proposal."
      sections={SECTIONS}
    />
  );
}
