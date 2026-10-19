import type { Metadata } from "next";
import { GuidedBrief } from "@/components/project/GuidedBrief";

export const metadata: Metadata = { title: "New project brief" };

export default function NewProjectPage() {
  return <GuidedBrief createNew />;
}
