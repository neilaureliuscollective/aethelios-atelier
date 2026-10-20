import type { Metadata } from "next";
import { BusinessClient } from "@/components/cofounder/BusinessClient";

export const metadata: Metadata = { title: "Business" };

export default function BusinessPage() {
  return <BusinessClient />;
}
