import { redirect } from "next/navigation";

// No pricing UI in the product per the Precision Instrument redesign — the
// free-tier limit is stated as a neutral platform limit wherever it's
// enforced, never as a sales page. Backend billing logic is untouched; this
// route just no longer renders a pricing page.
export default function PricingPage(): never {
  redirect("/dashboard");
}
