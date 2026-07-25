import { redirect } from "next/navigation";

// No pricing UI in the product per the Precision Instrument redesign.
// Backend billing logic is untouched; this route just no longer renders a
// pricing/plan-comparison page.
export default function EmployerPricingPage(): never {
  redirect("/employer/dashboard");
}
