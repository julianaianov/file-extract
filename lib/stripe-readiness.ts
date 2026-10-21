import { billingMode } from "./billing-mode";
import { stripeClient } from "./billing";
let cached: { key: string; expires: number; result: Promise<boolean> } | undefined;
export async function paymentsAvailable() {
 if (billingMode() === "test") return true;
 const accountId=process.env.STRIPE_ACCOUNT_ID;
 if(!accountId) return false;
 const key = (process.env.STRIPE_SECRET_KEY || "")+":"+accountId;
 if (!cached || cached.key !== key || cached.expires <= Date.now()) {
  const result = stripeClient().accounts.retrieve(accountId).then(account => account.charges_enabled === true).catch(() => false);
  cached = { key, expires: Date.now()+60000, result };
 }
 return cached.result;
}
