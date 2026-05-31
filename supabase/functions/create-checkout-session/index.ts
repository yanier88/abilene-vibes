const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const planAmounts: Record<string, number> = {
  Featured: 1900,
  Premium: 5900,
};

const planPriceEnv: Record<string, string> = {
  Featured: "STRIPE_FEATURED_PRICE_ID",
  Premium: "STRIPE_PREMIUM_PRICE_ID",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cleanPublicUrl = (value: string) => {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/$/, "");
    return url.protocol === "https:" ? url.toString().replace(/\/$/, "") : "";
  } catch {
    return "";
  }
};

const fetchBusinessSubmission = async (supabaseUrl: string, serviceRoleKey: string, submissionId: string) => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/business_submissions?id=eq.${encodeURIComponent(submissionId)}&select=id,business_name,contact_email,plan,payment_status,status`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Could not verify business submission.");
  }

  const [submission] = await response.json();
  return submission ?? null;
};

const stripeRequest = async (secretKey: string, params: URLSearchParams) => {
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message ?? "Stripe checkout failed.");
  }

  return data;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const { submissionId, plan, businessName, contactEmail, returnUrl } = await request.json();
    const secretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const appPublicUrl = cleanPublicUrl(Deno.env.get("APP_PUBLIC_URL") ?? returnUrl ?? "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!secretKey) {
      return jsonResponse({ error: "Missing STRIPE_SECRET_KEY." }, 500);
    }

    if (!appPublicUrl || !appPublicUrl.startsWith("https://")) {
      return jsonResponse({ error: "Missing APP_PUBLIC_URL. It must be an https URL." }, 500);
    }

    if (!submissionId || !planAmounts[plan]) {
      return jsonResponse({ error: "Invalid paid plan request." }, 400);
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Supabase service configuration." }, 500);
    }

    const submission = await fetchBusinessSubmission(supabaseUrl, serviceRoleKey, submissionId);

    if (!submission || submission.plan !== plan || submission.status !== "pending") {
      return jsonResponse({ error: "Business submission does not match this checkout request." }, 400);
    }

    if (!["pending", "checkout_started"].includes(submission.payment_status)) {
      return jsonResponse({ error: "Business submission is not eligible for checkout." }, 400);
    }

    const params = new URLSearchParams({
      mode: "subscription",
      "line_items[0][quantity]": "1",
      client_reference_id: submissionId,
      success_url: `${appPublicUrl}?checkout=success`,
      cancel_url: `${appPublicUrl}?checkout=cancelled`,
      "metadata[submission_id]": submissionId,
      "metadata[plan]": plan,
      "subscription_data[metadata][submission_id]": submissionId,
      "subscription_data[metadata][plan]": plan,
      "payment_method_types[0]": "card",
    });

    if (submission.contact_email || contactEmail) {
      params.set("customer_email", String(submission.contact_email ?? contactEmail));
    }

    const priceId = Deno.env.get(planPriceEnv[plan]) ?? "";
    if (priceId) {
      params.set("line_items[0][price]", priceId);
    } else {
      params.set("line_items[0][price_data][currency]", "usd");
      params.set("line_items[0][price_data][unit_amount]", String(planAmounts[plan]));
      params.set("line_items[0][price_data][recurring][interval]", "month");
      params.set("line_items[0][price_data][product_data][name]", `Abilene Vibes ${plan} Listing`);
      params.set(
        "line_items[0][price_data][product_data][description]",
        `${submission.business_name ?? businessName ?? "Business"} monthly promotion plan`,
      );
    }

    const session = await stripeRequest(secretKey, params);

    await fetch(`${supabaseUrl}/rest/v1/business_submissions?id=eq.${submissionId}`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        payment_status: "checkout_started",
        stripe_session_id: session.id,
      }),
    });

    return jsonResponse({ url: session.url });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Checkout failed." }, 500);
  }
});
