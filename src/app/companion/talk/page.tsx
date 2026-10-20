import type { Metadata } from "next";
import { TalkClient } from "@/components/cofounder/TalkClient";

export const metadata: Metadata = { title: "Talk" };

export default function TalkPage() {
  return <TalkClient />;
}
