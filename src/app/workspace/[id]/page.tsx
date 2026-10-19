import type { Metadata } from "next";
import { WorkspaceDetail } from "@/components/workspace/WorkspaceClient";

export const metadata: Metadata = { title: "Commission" };

export default async function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkspaceDetail id={id} />;
}
