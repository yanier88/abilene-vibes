# Local News Sync

This Supabase Edge Function collects local news RSS items from the last 7 days, asks OpenAI to keep only verified Abilene/Big Country stories, and upserts approved stories into `public.local_news_items`.

Required Supabase secrets:

```bash
supabase secrets set OPENAI_API_KEY=your_openai_key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
supabase secrets set LOCAL_NEWS_CRON_SECRET=choose_a_private_random_value
```

Optional:

```bash
supabase secrets set OPENAI_MODEL=gpt-4.1-mini
```

Optional custom sources:

```bash
supabase secrets set NEWS_SOURCE_FEEDS='[{"name":"Source","url":"https://example.com","rssUrl":"https://example.com/feed"}]'
```

Deploy:

```bash
supabase functions deploy local-news-sync
```

Run manually:

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/local-news-sync" -H "x-cron-secret: YOUR_SECRET"
```

Schedule it in Supabase Cron to run every hour or twice a day. The app only displays approved rows from the last 7 days.
