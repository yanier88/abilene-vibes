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

const fetchJobListing = async (supabaseUrl: string, serviceRoleKey: string, jobId: string) => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/job_listings?id=eq.${encodeURIComponent(jobId)}&select=id,title,company,email,plan,payment_status,status`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Could not verify job listing.");
  }

  const [job] = await response.json();
  return job ?? null;
};

const normalizeJobPlan = (plan: string) => plan.trim().toLowerCase();

const normalizeRentalPlan = (plan: string) => plan.trim().toLowerCase();

const sanitizeJobPayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const source = payload as Record<string, unknown>;
  const allowedFields = [
    "title",
    "company",
    "category",
    "job_type",
    "pay_label",
    "location",
    "phone",
    "email",
    "description",
    "requirements",
    "app_method",
    "apply_url",
    "duration",
    "image_data",
    "logo_data",
    "expires_at",
  ];
  const cleanPayload: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in source) {
      cleanPayload[field] = source[field];
    }
  }

  return cleanPayload;
};

const insertJobListing = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  jobPayload: Record<string, unknown>,
  plan: string,
) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/job_listings?select=id,title,company,email,plan,payment_status,status`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      ...jobPayload,
      status: "pending",
      plan,
      payment_status: "pending",
    }),
  });

  if (!response.ok) {
    throw new Error("Could not create job listing.");
  }

  const [job] = await response.json();
  return job ?? null;
};

const sanitizeRentalPayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const source = payload as Record<string, unknown>;
  const allowedFields = [
    "title",
    "property_type",
    "price",
    "deposit",
    "price_per_night",
    "price_per_week",
    "available_from",
    "available_to",
    "max_guests",
    "house_rules",
    "pets_allowed",
    "address",
    "bedrooms",
    "bathrooms",
    "description",
    "phone",
    "email",
    "external_url",
    "duration",
    "image_data",
    "owner_user_id",
  ];
  const cleanPayload: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in source) {
      cleanPayload[field] = source[field];
    }
  }

  return cleanPayload;
};

const insertRentalListing = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  rentalPayload: Record<string, unknown>,
  plan: string,
) => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rental_listings?select=id,title,email,plan,payment_status,status,requested_plan`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        ...rentalPayload,
        status: "pending",
        plan,
        requested_plan: plan,
        payment_status: "pending",
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Could not create rental listing.");
  }

  const [rental] = await response.json();
  return rental ?? null;
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
    const { listingType, action, submissionId, jobId, plan, businessName, contactEmail, returnUrl, jobPayload, rentalPayload } =
      await request.json();
    const cleanListingType = listingType === "job" ? "job" : listingType === "rental" ? "rental" : "business";
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

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Supabase service configuration." }, 500);
    }

    if (cleanListingType === "rental") {
      if (action !== "create_and_checkout" || !planAmounts[plan]) {
        return jsonResponse({ error: "Invalid paid rental plan request." }, 400);
      }

      const normalizedPlan = normalizeRentalPlan(plan);
      if (!["featured", "premium"].includes(normalizedPlan)) {
        return jsonResponse({ error: "Invalid paid rental plan request." }, 400);
      }

      const cleanRentalPayload = sanitizeRentalPayload(rentalPayload);
      const title = String(cleanRentalPayload?.title ?? "").trim();
      const address = String(cleanRentalPayload?.address ?? "").trim();
      const ownerUserId = String(cleanRentalPayload?.owner_user_id ?? "").trim();

      if (!cleanRentalPayload || !title || !address || !ownerUserId) {
        return jsonResponse({ error: "Missing required rental fields." }, 400);
      }

      const insertedRental = await insertRentalListing(supabaseUrl, serviceRoleKey, cleanRentalPayload, normalizedPlan);

      if (
        !insertedRental?.id ||
        insertedRental.plan !== normalizedPlan ||
        insertedRental.requested_plan !== normalizedPlan ||
        insertedRental.status !== "pending"
      ) {
        return jsonResponse({ error: "Could not create rental listing." }, 500);
      }

      const insertedRentalId = String(insertedRental.id);
      const params = new URLSearchParams({
        mode: "subscription",
        "line_items[0][quantity]": "1",
        client_reference_id: insertedRentalId,
        success_url: `${appPublicUrl}?checkout=success`,
        cancel_url: `${appPublicUrl}?checkout=cancelled`,
        "metadata[listing_type]": "rental",
        "metadata[rental_id]": insertedRentalId,
        "metadata[plan]": plan,
        "subscription_data[metadata][listing_type]": "rental",
        "subscription_data[metadata][rental_id]": insertedRentalId,
        "subscription_data[metadata][plan]": plan,
        "payment_method_types[0]": "card",
      });

      if (insertedRental.email || contactEmail) {
        params.set("customer_email", String(insertedRental.email ?? contactEmail));
      }

      const priceId = Deno.env.get(planPriceEnv[plan]) ?? "";
      if (priceId) {
        params.set("line_items[0][price]", priceId);
      } else {
        params.set("line_items[0][price_data][currency]", "usd");
        params.set("line_items[0][price_data][unit_amount]", String(planAmounts[plan]));
        params.set("line_items[0][price_data][recurring][interval]", "month");
        params.set("line_items[0][price_data][product_data][name]", `Abilene Vibes ${plan} Rental Listing`);
        params.set(
          "line_items[0][price_data][product_data][description]",
          `${insertedRental.title ?? businessName ?? "Rental"} monthly rental promotion plan`,
        );
      }

      const session = await stripeRequest(secretKey, params);

      await fetch(`${supabaseUrl}/rest/v1/rental_listings?id=eq.${insertedRentalId}`, {
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
    }

    if (cleanListingType === "job") {
      if (action === "create_and_checkout") {
        if (!planAmounts[plan]) {
          return jsonResponse({ error: "Invalid paid job plan request." }, 400);
        }

        const normalizedPlan = normalizeJobPlan(plan);
        if (!["featured", "premium"].includes(normalizedPlan)) {
          return jsonResponse({ error: "Invalid paid job plan request." }, 400);
        }

        const cleanJobPayload = sanitizeJobPayload(jobPayload);
        const title = String(cleanJobPayload?.title ?? "").trim();
        const company = String(cleanJobPayload?.company ?? "").trim();

        if (!cleanJobPayload || !title || !company) {
          return jsonResponse({ error: "Missing required job fields." }, 400);
        }

        const insertedJob = await insertJobListing(supabaseUrl, serviceRoleKey, cleanJobPayload, normalizedPlan);

        if (!insertedJob?.id || insertedJob.plan !== normalizedPlan || insertedJob.status !== "pending") {
          return jsonResponse({ error: "Could not create job listing." }, 500);
        }

        const insertedJobId = String(insertedJob.id);
        const params = new URLSearchParams({
          mode: "subscription",
          "line_items[0][quantity]": "1",
          client_reference_id: insertedJobId,
          success_url: `${appPublicUrl}?checkout=success`,
          cancel_url: `${appPublicUrl}?checkout=cancelled`,
          "metadata[listing_type]": "job",
          "metadata[job_id]": insertedJobId,
          "metadata[plan]": plan,
          "subscription_data[metadata][listing_type]": "job",
          "subscription_data[metadata][job_id]": insertedJobId,
          "subscription_data[metadata][plan]": plan,
          "payment_method_types[0]": "card",
        });

        if (insertedJob.email || contactEmail) {
          params.set("customer_email", String(insertedJob.email ?? contactEmail));
        }

        const priceId = Deno.env.get(planPriceEnv[plan]) ?? "";
        if (priceId) {
          params.set("line_items[0][price]", priceId);
        } else {
          params.set("line_items[0][price_data][currency]", "usd");
          params.set("line_items[0][price_data][unit_amount]", String(planAmounts[plan]));
          params.set("line_items[0][price_data][recurring][interval]", "month");
          params.set("line_items[0][price_data][product_data][name]", `Abilene Vibes ${plan} Job Listing`);
          params.set(
            "line_items[0][price_data][product_data][description]",
            `${insertedJob.company ?? businessName ?? insertedJob.title ?? "Job"} monthly hiring promotion plan`,
          );
        }

        const session = await stripeRequest(secretKey, params);

        await fetch(`${supabaseUrl}/rest/v1/job_listings?id=eq.${insertedJobId}`, {
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
      }

      if (!jobId || !planAmounts[plan]) {
        return jsonResponse({ error: "Invalid paid job plan request." }, 400);
      }

      const normalizedPlan = normalizeJobPlan(plan);
      if (!["featured", "premium"].includes(normalizedPlan)) {
        return jsonResponse({ error: "Invalid paid job plan request." }, 400);
      }

      const job = await fetchJobListing(supabaseUrl, serviceRoleKey, jobId);

      if (!job || job.plan !== normalizedPlan || job.status !== "pending") {
        return jsonResponse({ error: "Job listing does not match this checkout request." }, 400);
      }

      if (!["pending", "checkout_started"].includes(job.payment_status)) {
        return jsonResponse({ error: "Job listing is not eligible for checkout." }, 400);
      }

      const params = new URLSearchParams({
        mode: "subscription",
        "line_items[0][quantity]": "1",
        client_reference_id: jobId,
        success_url: `${appPublicUrl}?checkout=success`,
        cancel_url: `${appPublicUrl}?checkout=cancelled`,
        "metadata[listing_type]": "job",
        "metadata[job_id]": jobId,
        "metadata[plan]": plan,
        "subscription_data[metadata][listing_type]": "job",
        "subscription_data[metadata][job_id]": jobId,
        "subscription_data[metadata][plan]": plan,
        "payment_method_types[0]": "card",
      });

      if (job.email || contactEmail) {
        params.set("customer_email", String(job.email ?? contactEmail));
      }

      const priceId = Deno.env.get(planPriceEnv[plan]) ?? "";
      if (priceId) {
        params.set("line_items[0][price]", priceId);
      } else {
        params.set("line_items[0][price_data][currency]", "usd");
        params.set("line_items[0][price_data][unit_amount]", String(planAmounts[plan]));
        params.set("line_items[0][price_data][recurring][interval]", "month");
        params.set("line_items[0][price_data][product_data][name]", `Abilene Vibes ${plan} Job Listing`);
        params.set(
          "line_items[0][price_data][product_data][description]",
          `${job.company ?? businessName ?? job.title ?? "Job"} monthly hiring promotion plan`,
        );
      }

      const session = await stripeRequest(secretKey, params);

      await fetch(`${supabaseUrl}/rest/v1/job_listings?id=eq.${jobId}`, {
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
    }

    if (!submissionId || !planAmounts[plan]) {
      return jsonResponse({ error: "Invalid paid plan request." }, 400);
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
