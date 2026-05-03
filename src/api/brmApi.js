async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`BRM API request failed: ${response.status}`);
  }

  return response.json();
}

export function getBrmBillingOverview() {
  return getJson("/api/brm/billing/overview");
}

export function runBrmBillingWorkflow(workflow, rawPrompt) {
  return getJson("/api/brm/billing/workflow", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workflow, prompt: rawPrompt }),
  });
}
