type NewsSource = {
  name: string;
  url: string;
  rssUrl: string;
  kind?: "rss" | "htmlReports";
};

type FeedItem = {
  title: string;
  link: string;
  description: string;
  imageUrl: string;
  publishedAt: string;
  sourceName: string;
  sourceUrl: string;
  forcedCategory?: NewsCategory;
  forcedMoodLabel?: string;
  storyFingerprint?: string;
};

type VerifiedStory = {
  title: string;
  summary: string;
  image_url?: string;
  published_at: string;
  source_name: string;
  source_url: string;
  original_url: string;
  story_fingerprint: string;
  news_category: NewsCategory;
  mood_label: string;
  verification_status: "verified" | "needs_review";
  status: "approved" | "draft";
};

type NewsCategory = "Fires" | "Arrests" | "New Spots" | "Sports" | "Campus" | "Flying Bison" | "Local Buzz";

const defaultSources: NewsSource[] = [
  {
    name: "City of Abilene",
    url: "https://www.abilenetx.gov/",
    rssUrl: "https://www.abilenetx.gov/RSSFeed.aspx?ModID=1&CID=All-news-0",
  },
  {
    name: "Abilene Police Reports",
    url: "https://www.abilenetx.gov/2196/Incident-Arrest-Reports",
    rssUrl: "https://www.abilenetx.gov/2196/Incident-Arrest-Reports",
    kind: "htmlReports",
  },
  {
    name: "KTXS Local",
    url: "https://ktxs.com/news/local",
    rssUrl: "https://ktxs.com/news/local/rss",
  },
  {
    name: "Big Country Homepage",
    url: "https://www.bigcountryhomepage.com/news/abilene-news/",
    rssUrl: "https://www.bigcountryhomepage.com/news/abilene-news/feed/",
  },
  {
    name: "KACU Local News",
    url: "https://www.kacu.org/local-news",
    rssUrl: "https://www.kacu.org/rss/local-news",
  },
  {
    name: "Abilene Flying Bison",
    url: "https://abileneflyingbison.com/",
    rssUrl: "https://abileneflyingbison.com/feed/",
  },
  {
    name: "ACU Wildcats",
    url: "https://acusports.com/",
    rssUrl: "https://acusports.com/rss.aspx",
  },
  {
    name: "Hardin-Simmons Athletics",
    url: "https://hsuathletics.com/",
    rssUrl: "https://hsuathletics.com/rss.aspx",
  },
  {
    name: "McMurry War Hawks",
    url: "https://mcmurrysports.com/",
    rssUrl: "https://mcmurrysports.com/rss.aspx",
  },
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const textFromXml = (value = "") =>
  value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const normalizeStoryFingerprint = (value: string) =>
  value
    .toLowerCase()
    .replace(/&[#a-z0-9]+;/g, " ")
    .replace(/\b(report|reports|gallery|video|update|updated|breaking)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|and|or|of|to|in|for|on|at|with|after|from)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);

const firstTag = (xml: string, tag: string) => {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return textFromXml(match?.[1] ?? "");
};

const firstAttribute = (xml: string, tag: string, attribute: string) => {
  const match = xml.match(new RegExp(`<${tag}[^>]*\\s${attribute}=["']([^"']+)["'][^>]*>`, "i"));
  return textFromXml(match?.[1] ?? "");
};

const absoluteUrl = (url: string, baseUrl: string) => {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
};

const dateFromReportTitle = (title: string) => {
  const match = title.match(/(\d{1,2})[-/=](\d{1,2})[-/=](\d{2,4})/);

  if (!match) {
    return "";
  }

  const [, month, day, yearValue] = match;
  const year = Number(yearValue.length === 2 ? `20${yearValue}` : yearValue);
  const date = new Date(year, Number(month) - 1, Number(day), 12, 0, 0);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const imageFromEntry = (entry: string) => {
  const mediaContent =
    firstAttribute(entry, "media:content", "url") ||
    firstAttribute(entry, "media:thumbnail", "url") ||
    firstAttribute(entry, "enclosure", "url");

  if (mediaContent) {
    return mediaContent;
  }

  const htmlImageMatch = entry.match(/<img[^>]+src=["']([^"']+)["']/i);
  return textFromXml(htmlImageMatch?.[1] ?? "");
};

const isWithinLastWeek = (dateValue: string) => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  return date >= weekStart && date <= new Date();
};

const categorizeStory = (item: Pick<FeedItem, "title" | "description" | "sourceName" | "forcedCategory" | "forcedMoodLabel">): {
  news_category: NewsCategory;
  mood_label: string;
} => {
  if ("forcedCategory" in item && item.forcedCategory) {
    return { news_category: item.forcedCategory, mood_label: item.forcedMoodLabel ?? "Fresh" };
  }

  const text = `${item.title} ${item.description} ${item.sourceName}`.toLowerCase();

  if (/flying bison|bison|baseball/.test(text)) {
    return { news_category: "Flying Bison", mood_label: "Game Watch" };
  }

  if (/sports|football|basketball|volleyball|soccer|softball|baseball|tennis|golf|track|athletics|tournament|game|score|coach|wildcats|cowboys|cowgirls|war hawks/.test(text)) {
    return { news_category: "Sports", mood_label: "Sports Beat" };
  }

  if (/acu|abilene christian|hardin-simmons|harden-simmons|mcmurry|college|university|campus/.test(text)) {
    return { news_category: "Campus", mood_label: "Campus Pulse" };
  }

  if (/fire|fires|smoke|wildfire|burn|burning|structure fire|firefighter|afd/.test(text)) {
    return { news_category: "Fires", mood_label: "Alert" };
  }

  if (/arrest|arrested|jail|charged|charges|police|apd|sheriff|crime|indicted|warrant/.test(text)) {
    return { news_category: "Arrests", mood_label: "Public Safety" };
  }

  if (/new business|grand opening|now open|opens|opened|opening|ribbon cutting|restaurant|store|shop|market|downtown/.test(text)) {
    return { news_category: "New Spots", mood_label: "New in Town" };
  }

  return { news_category: "Local Buzz", mood_label: "Fresh" };
};

const fetchHtmlReportItems = async (source: NewsSource): Promise<FeedItem[]> => {
  const response = await fetch(source.rssUrl, {
    headers: {
      accept: "text/html",
      "user-agent": "AbileneVibesLocalNews/1.0",
    },
  });

  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];

  return links
    .map((match) => {
      const title = textFromXml(match[2]);
      const publishedAt = dateFromReportTitle(title);

      return {
        title,
        link: absoluteUrl(match[1], source.url),
        description: "Daily report published by the Abilene Police Department.",
        imageUrl: "",
        publishedAt,
        sourceName: source.name,
        sourceUrl: source.url,
        storyFingerprint: normalizeStoryFingerprint(title),
        forcedCategory: title.toLowerCase().includes("arrest") ? "Arrests" as NewsCategory : undefined,
        forcedMoodLabel: title.toLowerCase().includes("arrest") ? "APD Report" : undefined,
      };
    })
    .filter((item) => item.forcedCategory === "Arrests" && item.title && item.link && isWithinLastWeek(item.publishedAt))
    .slice(0, 6);
};

const loadSources = () => {
  const rawSources = Deno.env.get("NEWS_SOURCE_FEEDS");

  if (!rawSources) {
    return defaultSources;
  }

  try {
    const parsedSources = JSON.parse(rawSources);
    return Array.isArray(parsedSources) ? parsedSources : defaultSources;
  } catch {
    return defaultSources;
  }
};

const fetchFeedItems = async (source: NewsSource): Promise<FeedItem[]> => {
  if (source.kind === "htmlReports") {
    return fetchHtmlReportItems(source);
  }

  const response = await fetch(source.rssUrl, {
    headers: {
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      "user-agent": "AbileneVibesLocalNews/1.0",
    },
  });

  if (!response.ok) {
    return [];
  }

  const xml = await response.text();
  const entries = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) ?? [];

  return entries
    .map((entry) => {
      const hrefMatch = entry.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
      const link = firstTag(entry, "link") || hrefMatch?.[1] || "";
      const publishedAt =
        firstTag(entry, "pubDate") || firstTag(entry, "published") || firstTag(entry, "updated") || "";

      return {
        title: firstTag(entry, "title"),
        link,
        description: firstTag(entry, "description") || firstTag(entry, "summary") || firstTag(entry, "content:encoded"),
        imageUrl: imageFromEntry(entry),
        publishedAt,
        sourceName: source.name,
        sourceUrl: source.url,
        storyFingerprint: normalizeStoryFingerprint(firstTag(entry, "title")),
      };
    })
    .filter((item) => item.title && item.link && isWithinLastWeek(item.publishedAt))
    .slice(0, 8);
};

const verifyWithOpenAI = async (items: FeedItem[]): Promise<VerifiedStory[]> => {
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  if (!apiKey || !items.length) {
    return items.map((item) => ({
      ...categorizeStory(item),
      title: item.title.slice(0, 180),
      summary: (item.description || item.title).slice(0, 220),
      image_url: item.imageUrl || undefined,
      published_at: new Date(item.publishedAt).toISOString(),
      source_name: item.sourceName,
      source_url: item.sourceUrl,
      original_url: item.link,
      story_fingerprint: item.storyFingerprint || normalizeStoryFingerprint(item.title),
      verification_status: "needs_review",
      status: "approved",
    }));
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You verify local news for an app. Use only the provided RSS item data. Do not invent facts. Keep only real Abilene, Texas or Big Country local news from the last 7 days. Return JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            instructions:
              "Return {\"stories\":[...]}. Each story must have title, summary, image_url, published_at, source_name, source_url, original_url, story_fingerprint, news_category, mood_label, verification_status, status. Use story_fingerprint from the provided item. Use image_url only from the provided item imageUrl field. news_category must be one of Fires, Arrests, New Spots, Sports, Campus, Flying Bison, Local Buzz. mood_label must be short and entertaining, never clickbait. Summaries must be 1 short sentence. Use status approved only if the source item clearly looks like a real local news item with an original URL and date. Otherwise omit it.",
            items,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.stories)
      ? parsed.stories.filter((story: VerifiedStory) =>
        story.title &&
        story.summary &&
        story.original_url &&
        story.story_fingerprint &&
        story.published_at &&
        story.news_category &&
        story.status === "approved" &&
        isWithinLastWeek(story.published_at)
      )
      : [];
  } catch {
    return [];
  }
};

const upsertStories = async (stories: VerifiedStory[]) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey || !stories.length) {
    return { inserted: 0 };
  }

  const normalizedStories = stories.map((story) => ({
    title: story.title,
    summary: story.summary,
    image_url: story.image_url ?? null,
    published_at: story.published_at,
    source_name: story.source_name,
    source_url: story.source_url,
    original_url: story.original_url,
    story_fingerprint: story.story_fingerprint || normalizeStoryFingerprint(story.title),
    news_category: story.news_category ?? "Local Buzz",
    mood_label: story.mood_label ?? "Fresh",
    verification_status: story.verification_status ?? "needs_review",
    status: story.status ?? "approved",
  }));

  const existingResponse = await fetch(
    `${supabaseUrl}/rest/v1/local_news_items?select=original_url,story_fingerprint`,
    {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!existingResponse.ok) {
    throw new Error(await existingResponse.text());
  }

  const existingRows = await existingResponse.json();
  const existingUrls = new Set(existingRows.map((row: { original_url: string }) => row.original_url));
  const existingFingerprints = new Set(
    existingRows.map((row: { story_fingerprint: string }) => row.story_fingerprint).filter(Boolean),
  );
  const newStories = normalizedStories.filter(
    (story) => !existingUrls.has(story.original_url) && !existingFingerprints.has(story.story_fingerprint),
  );

  if (!newStories.length) {
    return { inserted: 0 };
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/local_news_items`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(newStories),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return { inserted: newStories.length };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST." }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const cronSecret = Deno.env.get("LOCAL_NEWS_CRON_SECRET");

  if (cronSecret && request.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  try {
    const sourceResults = await Promise.allSettled(loadSources().map(fetchFeedItems));
    const feedItems = sourceResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const uniqueItems = [
      ...new Map(feedItems.map((item) => [item.storyFingerprint || normalizeStoryFingerprint(item.title), item])).values(),
    ].slice(0, 30);
    const stories = await verifyWithOpenAI(uniqueItems);
    const result = await upsertStories(stories);

    return new Response(
      JSON.stringify({
        checked: uniqueItems.length,
        approved: stories.length,
        ...result,
      }),
      {
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown local news sync error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }
});
