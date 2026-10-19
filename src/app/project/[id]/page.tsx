import type { Metadata } from "next";
import { GuidedBrief } from "@/components/project/GuidedBrief";

export const metadata: Metadata = { title: "Project brief" };

export default async function ProjectByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GuidedBrief projectId={id} />;
}
