/**
 * Isolated future billing boundary.
 *
 * This module exists so payment work has a single place to land later.
 * It is not activated. It does not import Stripe, create products,
 * collect card details, or report successful payments.
 */
export const billingBoundary = {
  enabled: false,
  provider: null,
  collectPayment: async () => {
    throw new Error("Billing is not activated. No payment was collected.");
  },
  status() {
    return {
      enabled: false,
      ready: false as const,
      message:
        "Payment is out of scope for this local candidate. Atelier is a request-and-review experience until Neil confirms a proposal."
    };
  }
};
