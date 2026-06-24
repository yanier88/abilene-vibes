const hex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const timingSafeEqual = (left: string, right: string) => {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
};

const verifyStripeSignature = async (payload: string, signatureHeader: string, secret: string) => {
  const timestamp = signatureHeader
    .split(",")
    .find((part) => part.startsWith("t="))
    ?.slice(2);
  const signatures = signatureHeader
    .split(",")
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  if (!timestamp || !signatures.length) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedPayload = `${timestamp}.${payload}`;
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload)));

  return signatures.some((signature) => timingSafeEqual(signature, expected));
};

const stripeObjectId = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : "";
  }

  return "";
};

const stripeNumber = (value: unknown, fallback = 0) => (typeof value === "number" ? value : fallback);

const updateBusinessPayment = async (submissionId: string, updates: Record<string, unknown>) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !submissionId) {
    return;
  }

  await fetch(`${supabaseUrl}/rest/v1/business_submissions?id=eq.${submissionId}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(updates),
  });
};

const updateJobPayment = async (jobId: string, updates: Record<string, unknown>) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !jobId) {
    return;
  }

  await fetch(`${supabaseUrl}/rest/v1/job_listings?id=eq.${jobId}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(updates),
  });
};

const stripeGet = async (path: string, searchParams?: URLSearchParams) => {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

  if (!secretKey) {
    return null;
  }

  const url = new URL(`https://api.stripe.com/v1/${path.replace(/^\//, "")}`);
  searchParams?.forEach((value, key) => url.searchParams.append(key, value));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
};

const fetchBusinessSubmissionIdBySubscription = async (subscriptionId: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !subscriptionId) {
    return "";
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/business_submissions?stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}&select=id&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!response.ok) {
    return "";
  }

  const [submission] = await response.json();
  return submission?.id ?? "";
};

const fetchJobListingIdBySubscription = async (subscriptionId: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !subscriptionId) {
    return "";
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/job_listings?stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}&select=id&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!response.ok) {
    return "";
  }

  const [job] = await response.json();
  return job?.id ?? "";
};

const stripeListingType = (metadata: { listing_type?: unknown } | undefined) =>
  metadata?.listing_type === "job" ? "job" : "business";

const invoiceListingType = (invoice: Record<string, unknown>) => {
  const metadata = invoice.metadata as { listing_type?: unknown } | undefined;
  const subscriptionDetails = invoice.subscription_details as { metadata?: { listing_type?: unknown } } | undefined;
  const parent = invoice.parent as { subscription_details?: { metadata?: { listing_type?: unknown } } } | undefined;

  if (stripeListingType(metadata) === "job") return "job";
  if (stripeListingType(subscriptionDetails?.metadata) === "job") return "job";
  if (stripeListingType(parent?.subscription_details?.metadata) === "job") return "job";
  return "business";
};

const invoiceSubscriptionId = (invoice: Record<string, unknown>) => {
  const directSubscriptionId = stripeObjectId(invoice.subscription);

  if (directSubscriptionId) {
    return directSubscriptionId;
  }

  const parent = invoice.parent as { subscription_details?: { subscription?: unknown } } | undefined;
  return stripeObjectId(parent?.subscription_details?.subscription);
};

const invoiceSubmissionId = (invoice: Record<string, unknown>) => {
  const metadata = invoice.metadata as { submission_id?: unknown } | undefined;
  const subscriptionDetails = invoice.subscription_details as { metadata?: { submission_id?: unknown } } | undefined;
  const parent = invoice.parent as { subscription_details?: { metadata?: { submission_id?: unknown } } } | undefined;

  return (
    (typeof metadata?.submission_id === "string" ? metadata.submission_id : "") ||
    (typeof subscriptionDetails?.metadata?.submission_id === "string" ? subscriptionDetails.metadata.submission_id : "") ||
    (typeof parent?.subscription_details?.metadata?.submission_id === "string"
      ? parent.subscription_details.metadata.submission_id
      : "")
  );
};

const fetchChargeFromPaymentIntent = async (paymentIntentId: string) => {
  if (!paymentIntentId) {
    return null;
  }

  const paymentIntent = await stripeGet(
    `payment_intents/${encodeURIComponent(paymentIntentId)}`,
    new URLSearchParams({ "expand[]": "latest_charge.balance_transaction" }),
  );

  return paymentIntent?.latest_charge ?? null;
};

const invoicePaymentIntentId = (invoice: Record<string, unknown>) => {
  const directPaymentIntentId = stripeObjectId(invoice.payment_intent);

  if (directPaymentIntentId) {
    return directPaymentIntentId;
  }

  const payments = invoice.payments as { data?: Array<{ payment?: unknown }> } | undefined;
  const invoicePayment = payments?.data?.[0]?.payment;

  if (invoicePayment && typeof invoicePayment === "object" && "payment_intent" in invoicePayment) {
    return stripeObjectId((invoicePayment as { payment_intent?: unknown }).payment_intent);
  }

  return "";
};

const fetchInvoice = async (invoiceId: string) =>
  stripeGet(
    `invoices/${encodeURIComponent(invoiceId)}`,
    new URLSearchParams({ "expand[]": "payments.data.payment" }),
  );

const fetchChargeFromInvoice = async (invoice: Record<string, unknown>) => {
  const paymentIntentId = invoicePaymentIntentId(invoice);

  if (paymentIntentId) {
    return fetchChargeFromPaymentIntent(paymentIntentId);
  }

  const chargeId = stripeObjectId(invoice.charge);

  if (!chargeId) {
    return null;
  }

  return stripeGet(
    `charges/${encodeURIComponent(chargeId)}`,
    new URLSearchParams({ "expand[]": "balance_transaction" }),
  );
};

const savePaymentRecord = async ({
  submissionId,
  stripeSessionId,
  paymentIntentId,
  charge,
  paidAt,
  status = "paid",
}: {
  submissionId: string;
  stripeSessionId?: string | null;
  paymentIntentId?: string | null;
  charge: Record<string, unknown> | null;
  paidAt?: string | null;
  status?: string;
}) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  let balanceTransaction = charge?.balance_transaction;

  if (typeof balanceTransaction === "string") {
    balanceTransaction = await stripeGet(`balance_transactions/${encodeURIComponent(balanceTransaction)}`);
  }

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !stripeObjectId(charge) ||
    !balanceTransaction ||
    typeof balanceTransaction !== "object"
  ) {
    return;
  }
  const transaction = balanceTransaction as Record<string, unknown>;

  await fetch(`${supabaseUrl}/rest/v1/payment_records?on_conflict=stripe_charge_id`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      business_submission_id: submissionId || null,
      stripe_session_id: stripeSessionId ?? null,
      stripe_payment_intent_id: (paymentIntentId ?? stripeObjectId(charge.payment_intent)) || null,
      stripe_charge_id: stripeObjectId(charge),
      stripe_balance_transaction_id: stripeObjectId(transaction),
      currency: transaction.currency ?? charge.currency ?? "usd",
      gross_amount: stripeNumber(transaction.amount, stripeNumber(charge.amount)),
      stripe_fee: stripeNumber(transaction.fee),
      net_amount: stripeNumber(transaction.net),
      paid_at: paidAt ?? (charge.created ? new Date(Number(charge.created) * 1000).toISOString() : new Date().toISOString()),
      status,
    }),
  });
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed.", { status: 405 });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const signatureHeader = request.headers.get("stripe-signature") ?? "";
  const payload = await request.text();

  if (!webhookSecret || !(await verifyStripeSignature(payload, signatureHeader, webhookSecret))) {
    return new Response("Invalid signature.", { status: 400 });
  }

  const event = JSON.parse(payload);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const listingType = stripeListingType(session.metadata);
    const jobId = session.metadata?.job_id ?? session.client_reference_id ?? "";
    const submissionId = session.client_reference_id ?? session.metadata?.submission_id ?? "";
    const paidAt = new Date().toISOString();
    const paymentIntentId = session.payment_intent ?? "";
    let charge = paymentIntentId ? await fetchChargeFromPaymentIntent(paymentIntentId) : null;

    if (!charge && session.invoice) {
      const invoice =
        typeof session.invoice === "string"
          ? await fetchInvoice(session.invoice)
          : session.invoice;
      charge = invoice ? await fetchChargeFromInvoice(invoice) : null;
    }

    if (listingType === "job") {
      await updateJobPayment(jobId, {
        payment_status: "paid",
        stripe_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent ?? null,
        stripe_customer_id: session.customer ?? null,
        stripe_subscription_id: session.subscription ?? null,
        paid_at: paidAt,
      });
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    await savePaymentRecord({
      submissionId,
      stripeSessionId: session.id,
      paymentIntentId,
      charge,
      paidAt,
    });

    await updateBusinessPayment(submissionId, {
      payment_status: "paid",
      stripe_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent ?? null,
      stripe_customer_id: session.customer ?? null,
      stripe_subscription_id: session.subscription ?? null,
      paid_at: paidAt,
    });
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const listingType = stripeListingType(session.metadata);
    const jobId = session.metadata?.job_id ?? session.client_reference_id ?? "";
    const submissionId = session.client_reference_id ?? session.metadata?.submission_id ?? "";

    if (listingType === "job") {
      await updateJobPayment(jobId, { payment_status: "expired" });
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    await updateBusinessPayment(submissionId, { payment_status: "expired" });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const subscriptionId = invoice.subscription ?? "";
    const listingType = invoiceListingType(invoice);
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (listingType === "job") {
      const jobId = await fetchJobListingIdBySubscription(subscriptionId);
      await updateJobPayment(jobId, { payment_status: "failed" });
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (supabaseUrl && serviceRoleKey && subscriptionId) {
      await fetch(`${supabaseUrl}/rest/v1/business_submissions?stripe_subscription_id=eq.${subscriptionId}`, {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ payment_status: "failed" }),
      });
    }
  }

  if (event.type === "invoice.payment_succeeded" || event.type === "invoice.paid") {
    const invoice = event.data.object;
    const fullInvoice = stripeObjectId(invoice) ? (await fetchInvoice(stripeObjectId(invoice)) ?? invoice) : invoice;
    const listingType = invoiceListingType(fullInvoice);
    const subscriptionId = invoiceSubscriptionId(fullInvoice);
    const submissionId = invoiceSubmissionId(fullInvoice) || (await fetchBusinessSubmissionIdBySubscription(subscriptionId));
    const charge = await fetchChargeFromInvoice(fullInvoice);
    const paymentIntentId = invoicePaymentIntentId(fullInvoice) || null;
    const paidAt = fullInvoice.status_transitions?.paid_at
      ? new Date(Number(fullInvoice.status_transitions.paid_at) * 1000).toISOString()
      : fullInvoice.created
        ? new Date(Number(fullInvoice.created) * 1000).toISOString()
        : new Date().toISOString();

    if (listingType === "job") {
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    await savePaymentRecord({
      submissionId,
      stripeSessionId: null,
      paymentIntentId,
      charge,
      paidAt,
      status: fullInvoice.status ?? "paid",
    });
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const subscriptionId = subscription.id ?? "";
    const listingType = stripeListingType(subscription.metadata);
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (listingType === "job") {
      const jobId = await fetchJobListingIdBySubscription(subscriptionId);
      await updateJobPayment(jobId, {
        payment_status: "canceled",
        status: "hidden",
      });
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (supabaseUrl && serviceRoleKey && subscriptionId) {
      await fetch(`${supabaseUrl}/rest/v1/business_submissions?stripe_subscription_id=eq.${subscriptionId}`, {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          payment_status: "canceled",
          status: "hidden",
          placement_expires_at: null,
        }),
      });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
