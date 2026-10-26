import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Aethelios Atelier handles what you share in a conversation with Aethelios or an inquiry."
};

const SECTIONS: LegalSection[] = [
  {
    heading: "What you share",
    body: [
      "When you talk with Aethelios, the messages you type are used to write replies and to shape a direction document for your project. When you send that direction or an inquiry, the name, email address, and any business details you include are sent to Neil Stutes along with the conversation and document.",
      "There are no visitor accounts on this site. Please do not share passwords, payment details, health information, or other sensitive personal information in a conversation or inquiry."
    ]
  },
  {
    heading: "How it is processed",
    body: [
      "Aethelios uses OpenAI to generate its replies and direction documents. What you type in the conversation is sent to OpenAI for that purpose and is handled under OpenAI’s API data policies.",
      "Directions and inquiries you choose to send are delivered to Neil by email through Resend, an email delivery provider. The site is hosted on Vercel, which processes standard request information such as IP addresses to serve pages and protect the site from abuse.",
      "A conversation that you do not send stays in your browser tab. Atelier does not store it once the tab is closed."
    ]
  },
  {
    heading: "How it is used",
    body: [
      "What you send is used to review your project, reply to you, and prepare a proposal. It is not sold, and it is not used for advertising.",
      "Your IP address may be used briefly to limit repeated submissions. Atelier does not run advertising trackers on this site."
    ]
  },
  {
    heading: "Keeping and removing it",
    body: [
      "Messages you send are kept in Neil’s email for as long as they are useful for your project or a related conversation. You can ask for your message to be deleted, or ask what is held about you, through the inquiry form."
    ]
  },
  {
    heading: "Changes",
    body: [
      "If the site begins collecting something new, this page will be updated before it does."
    ]
  }
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      kicker="Privacy"
      title="What you share, and where it goes."
      updated="October 2026"
      intro="Atelier collects only what you choose to share with Aethelios or in an inquiry, and uses it to understand and reply to your project."
      sections={SECTIONS}
    />
  );
}
