export const brmBillingOverviewResponse = {
  latestBills: [
    {
      id: "B1-B80",
      date: "20 July 2025",
      due: "$88.00 due",
      total: "$225.00 total",
    },
    {
      id: "B1-B80",
      date: "20 June 2025",
      due: "$88.00 due",
      total: "$225.00 total",
    },
  ],
  starterPrompts: [
    "Make a payment for the outstanding bill",
    "Send the payment receipt",
    "Set up a 3 month payment plan",
  ],
  initialMessages: [
    {
      id: "m1",
      role: "assistant",
      text:
        "Billing agent ready. Ask me to collect a payment, send a receipt, enable autopay, or create a payment plan. I will update the bill foldout context without changing the rest of the Customer 360 view.",
    },
  ],
  workflow: {
    outstandingBalance: 188,
    paymentStatus: "Pay pending balance",
    paymentNeededText: "$188.00 needs to be paid",
    ctaLabel: "Pay bill",
    lastPayment: "$117.00",
    lastPaymentDate: "Paid on 06/02/2024",
    receiptSent: false,
    autopay: false,
    plan: null,
    summary: "Waiting for billing instruction.",
    checklist: [
      { label: "Review bill", state: "done" },
      { label: "Collect payment", state: "pending" },
      { label: "Send receipt", state: "pending" },
    ],
    activity: [
      {
        title: "Outstanding balance detected",
        detail: "Current bill shows $188.00 due.",
        time: "Today",
      },
      {
        title: "Last payment received",
        detail: "$117.00 posted on 06/02/2024.",
        time: "06/02/2024",
      },
    ],
  },
};
