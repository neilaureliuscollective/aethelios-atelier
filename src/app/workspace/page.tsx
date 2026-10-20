import type { Metadata } from "next";
import { WorkspaceHome } from "@/components/workspace/WorkspaceClient";

export const metadata: Metadata = { title: "Commissions" };
export const dynamic = "force-dynamic";

export default function WorkspacePage() {
  return <WorkspaceHome />;
}
