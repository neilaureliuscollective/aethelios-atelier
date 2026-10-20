export const PRICING_CURRENCY = "USD" as const;

export type MoneyUsd = {
  currency: typeof PRICING_CURRENCY;
  amountUsd: number;
};

export function isFiniteUsdAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function formatUsdAmount(amountUsd: number, currency: typeof PRICING_CURRENCY = PRICING_CURRENCY): string {
  if (!isFiniteUsdAmount(amountUsd)) {
    throw new Error("A currency amount must be a finite non-negative number.");
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(amountUsd) ? 0 : 2
  }).format(amountUsd);
}

export function formatSetupCharge(amountUsd: number): string {
  return `${formatUsdAmount(amountUsd)} one-time setup`;
}

export function formatMonthlyCharge(amountUsd: number): string {
  return `${formatUsdAmount(amountUsd)}/month`;
}

export const PUBLIC_SETUP_LABEL = "Discuss your scope";
export const PUBLIC_RECURRING_LABEL = "Request a proposal";
export const QUOTED_SETUP_LABEL = "Setup quoted";
export const TERMS_UNAVAILABLE_LABEL = "Terms unavailable";
