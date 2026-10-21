export type BillingMode = "test" | "live";
export function billingMode(): BillingMode {
 return /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY || "") ? "live" : "test";
}
export function walletColumns(mode: BillingMode = billingMode()) {
 return mode === "live"
  ? { balance: "live_token_balance", customer: "live_stripe_customer_id" }
  : { balance: "token_balance", customer: "stripe_customer_id" };
}
