import type { Metadata } from "next";
import { GuidedBrief } from "@/components/project/GuidedBrief";

export const metadata: Metadata = { title: "New project brief" };
export const dynamic = "force-dynamic";

export default function NewProjectPage() {
  return <GuidedBrief createNew />;
}
