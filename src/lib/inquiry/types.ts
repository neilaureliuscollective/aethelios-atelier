import type { InquiryBriefLine } from "@/lib/inquiry/summary";

export type InquirySource = "brief" | "inquire";

export type InquiryDeliveryKind = "email" | "capture";

export type InquiryInput = {
  name: string;
  email: string;
  business: string;
  need: string;
  source: InquirySource;
  consent: true;
  honeypot?: string;
  brief?: unknown;
  idempotencyKey?: string;
};

export type StoredInquiry = {
  id: string;
  receiptId: string;
  createdAt: string;
  name: string;
  email: string;
  business: string;
  need: string;
  source: InquirySource;
  briefTitle?: string;
  briefLines?: InquiryBriefLine[];
  delivery: InquiryDeliveryKind;
};

export type InquiryAccepted = {
  ok: true;
  submitted: true;
  delivery: InquiryDeliveryKind;
  receiptId: string;
  inquiryId: string;
  labeled: boolean;
  note: string;
};

export type InquiryUnavailable = {
  ok: false;
  error: "unconfigured" | "delivery_failed";
  message: string;
  mailto?: string;
};
