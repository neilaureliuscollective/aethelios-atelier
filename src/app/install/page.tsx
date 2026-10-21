import type { Metadata } from "next";
import { InstallGuidance } from "@/components/account/InstallGuidance";
import { readSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Install" };
export const dynamic = "force-dynamic";

export default async function InstallPage() {
  const session = await readSession();
  return <InstallGuidance signedIn={Boolean(session)} />;
}
