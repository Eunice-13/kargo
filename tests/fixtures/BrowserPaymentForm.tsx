// The existing payment feature imports browser-only maps through its barrel.
// These server-render tests exercise closed cards, never the interactive form.
export function PaymentSubmitModal() {
  throw new Error("Interactive payment form requires browser integration testing");
}
