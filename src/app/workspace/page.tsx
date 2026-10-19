import type { Metadata } from "next";
import { WorkspaceHome } from "@/components/workspace/WorkspaceClient";

export const metadata: Metadata = { title: "Workspace" };

export default function WorkspacePage() {
  return <WorkspaceHome />;
}
