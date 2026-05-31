# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## Abilene Vibes Payments

Paid business listings use Supabase Edge Functions plus Stripe Checkout.

1. Run `supabase-schema.sql` in the Supabase SQL editor so `business_submissions` has the Stripe/payment columns.
2. Set Vite public env vars for the app:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_FEATURED_LINK=
VITE_STRIPE_PREMIUM_LINK=
```

3. Set Supabase Edge Function secrets:

```bash
supabase secrets set APP_PUBLIC_URL=https://your-site.example
supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_key
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_from_stripe
supabase secrets set STRIPE_FEATURED_PRICE_ID=price_featured_monthly
supabase secrets set STRIPE_PREMIUM_PRICE_ID=price_premium_monthly
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

4. Deploy the payment functions:

```bash
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

5. In Stripe, add a webhook endpoint:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
```

Subscribe it to `checkout.session.completed`, `checkout.session.expired`, and `invoice.payment_failed`.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
