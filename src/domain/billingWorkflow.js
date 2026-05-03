export function normalizeBillingPrompt(input) {
  return input.toLowerCase().trim();
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function applyBillingWorkflow(workflow, rawPrompt) {
  const prompt = normalizeBillingPrompt(rawPrompt);
  const next = structuredClone(workflow);
  let response =
    "I reviewed the request and updated the billing workflow. You can continue with another payment instruction.";

  if (prompt.includes("payment plan") || prompt.includes("installment")) {
    const monthsMatch = prompt.match(/(\d+)\s*(month|months)/);
    const months = monthsMatch ? Number(monthsMatch[1]) : 3;
    const installment = Number((next.outstandingBalance / months).toFixed(2));

    next.plan = {
      type: `${months}-month payment plan`,
      installment,
      months,
    };
    next.summary = `Prepared a ${months}-month installment plan for ${formatCurrency(installment)} per month.`;
    next.checklist = [
      { label: "Review bill", state: "done" },
      { label: "Draft payment plan", state: "done" },
      { label: "Confirm consent", state: "active" },
    ];
    next.activity.unshift({
      title: "Payment plan created",
      detail: `${months} installments of ${formatCurrency(installment)} drafted for approval.`,
      time: "Just now",
    });
    response = `I created a ${months}-month payment plan and updated the workflow panel.`;
  }

  if (prompt.includes("receipt")) {
    next.receiptSent = true;
    next.summary = "Receipt marked as sent to the customer email on file.";
    next.activity.unshift({
      title: "Receipt sent",
      detail: "Payment receipt queued to james.kelly@email.com.",
      time: "Just now",
    });
    next.checklist = next.checklist.map((item) =>
      item.label === "Send receipt" ? { ...item, state: "done" } : item,
    );
    response = "I marked the receipt as sent and updated the workflow.";
  }

  if (prompt.includes("autopay")) {
    next.autopay = true;
    next.summary = "Autopay is now enabled for future bills.";
    next.activity.unshift({
      title: "Autopay enabled",
      detail: "Future invoices will draft automatically.",
      time: "Just now",
    });
    response = "I enabled autopay for this account.";
  }

  if (prompt.includes("make a payment") || prompt.includes("outstanding bill") || prompt.includes("pay bill")) {
    next.outstandingBalance = 0;
    next.paymentStatus = "Bill paid";
    next.paymentNeededText = "No payment due";
    next.ctaLabel = "Receipt sent";
    next.summary = "Outstanding bill was paid successfully.";
    next.checklist = [
      { label: "Review bill", state: "done" },
      { label: "Collect payment", state: "done" },
      { label: "Send receipt", state: next.receiptSent ? "done" : "active" },
    ];
    next.activity.unshift({
      title: "Payment captured",
      detail: "$188.00 applied to the outstanding bill.",
      time: "Just now",
    });
    response = "I collected payment for the outstanding bill and updated the bill card.";
  }

  return { workflow: next, response };
}
