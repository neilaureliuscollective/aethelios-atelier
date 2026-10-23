import type { Metadata } from "next";
import { RtaExperience } from "@/components/rta/RtaExperience";

export const metadata: Metadata = {
  title: "Aethelios RTA",
  description:
    "Talk with Aethelios in a full-screen voice room. Long-form conversation to help name what the business needs."
};

export default function RtaPage() {
  return <RtaExperience />;
}
