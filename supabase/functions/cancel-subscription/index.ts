const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
};

const adminEmails = new Set(["cabrerahernandezyanier@gmail.com"]);

const fetchAuthenticatedUser = async (supabaseUrl: string, anonKey: string, accessToken: string) => {
  if (!supabaseUrl || !anonKey || !accessToken) {
    return null;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
};

const isAllowedAdmin = (user: { email?: unknown } | null) => {
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  return adminEmails.has(email);
};

const fetchSubmission = async (supabaseUrl: string, serviceRoleKey: string, submissionId: string) => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/business_submissions?id=eq.${encodeURIComponent(
      submissionId,
    )}&select=id,business_name,stripe_subscription_id,payment_status,status,placement_expires_at`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Could not load business submission.");
  }

  const [submission] = await response.json();
  return submission ?? null;
};

const cancelStripeSubscription = async (secretKey: string, subscriptionId: string, cancelAtPeriodEnd: boolean) => {
  const endpoint = cancelAtPeriodEnd
    ? `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`
    : `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`;

  const body = cancelAtPeriodEnd ? new URLSearchParams({ cancel_at_period_end: "true" }) : undefined;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message ?? "Stripe subscription cancellation failed.");
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const accessToken = getBearerToken(request);
    const user = await fetchAuthenticatedUser(supabaseUrl, anonKey, accessToken);

    if (!user) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    if (!isAllowedAdmin(user)) {
      return jsonResponse({ error: "Not authorized." }, 403);
    }

    if (!serviceRoleKey || !stripeSecretKey) {
      return jsonResponse({ error: "Missing server configuration." }, 500);
    }

    const { submissionId, cancelAtPeriodEnd = true } = await request.json();

    if (!submissionId) {
      return jsonResponse({ error: "Missing submissionId." }, 400);
    }

    const submission = await fetchSubmission(supabaseUrl, serviceRoleKey, submissionId);

    if (!submission?.stripe_subscription_id) {
      return jsonResponse({ error: "This business does not have a Stripe subscription saved yet." }, 400);
    }

    const subscription = await cancelStripeSubscription(
      stripeSecretKey,
      submission.stripe_subscription_id,
      Boolean(cancelAtPeriodEnd),
    );

    const placementExpiresAt =
      subscription.cancel_at || subscription.current_period_end
        ? new Date(Number(subscription.cancel_at ?? subscription.current_period_end) * 1000).toISOString()
        : submission.placement_expires_at ?? null;
    const updateBody = {
      payment_status: subscription.cancel_at_period_end ? "cancel_pending" : "canceled",
      placement_expires_at: placementExpiresAt,
    };

    await fetch(`${supabaseUrl}/rest/v1/business_submissions?id=eq.${submissionId}`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(updateBody),
    });

    return jsonResponse({
      canceled: true,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd: subscription.current_period_end ?? null,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Cancellation failed." }, 500);
  }
});
