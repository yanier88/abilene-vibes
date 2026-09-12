export const weatherMaxAge = 2 * 60 * 60 * 1000;
const refreshMs = 10 * 60 * 1000;
const cacheKey = "abilene-ios-weather-v1";

export function validObservation(value, now = Date.now()) {
  const time = Date.parse(value?.observedAt);
  return Number.isFinite(value?.temp) && Number.isFinite(time) && time <= now && now - time <= weatherMaxAge;
}

export function createWeatherLoader({ fetcher = fetch, storage, onValue, isDay, log = () => {}, now = Date.now, timeoutMs = 8000, retryMs = 1500 }) {
  let cached = null, pending = null, stopped = false, lastAttempt = -Infinity;
  try { const value = JSON.parse(storage?.getItem(cacheKey) ?? "null"); if (validObservation(value, now())) cached = value; } catch { /* Storage is optional. */ }
  const publish = (status) => {
    if (stopped) return;
    const value = validObservation(cached, now()) ? cached : { temp: null, observedAt: null, isDay: isDay() };
    onValue({ ...value, label: "Abilene, TX", status });
  };
  const load = () => {
    if (stopped) return Promise.resolve();
    if (pending) return pending;
    if (now() - lastAttempt < (validObservation(cached, now()) ? refreshMs : 30000)) {
      publish(validObservation(cached, now()) ? "ready" : "error");
      return Promise.resolve();
    }
    lastAttempt = now();
    publish("loading");
    pending = (async () => {
      for (let attempt = 0; attempt < 2 && !stopped; attempt++) {
        const start = now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let status = null;
        try {
          const response = await fetcher("https://api.weather.gov/stations/KABI/observations/latest?require_qc=false", { headers: { Accept: "application/geo+json" }, signal: controller.signal });
          status = response.status;
          if (!response.ok) throw new Error("http");
          const data = (await response.json()).properties;
          const celsius = data?.temperature?.value;
          const value = { temp: typeof celsius === "number" && Number.isFinite(celsius) ? Math.round(celsius * 9 / 5 + 32) : null, observedAt: data?.timestamp, isDay: data?.icon?.includes("/day/") ? true : data?.icon?.includes("/night/") ? false : isDay() };
          if (!validObservation(value, now())) throw new Error("invalid_observation");
          cached = value;
          try { storage?.setItem(cacheKey, JSON.stringify(value)); } catch { /* Storage is optional. */ }
          publish("ready");
          log({ result: "ready", status, durationMs: now() - start, cache: "miss" });
          return;
        } catch (error) {
          const reason = controller.signal.aborted ? "timeout" : ["http", "invalid_observation"].includes(error?.message) ? error.message : "network";
          log({ result: reason, status, durationMs: now() - start, cache: validObservation(cached, now()) ? "hit" : "miss" });
          // Do not retry rate limits or other non-transient client errors.
          if (status !== null && status >= 400 && status < 500) break;
        } finally { clearTimeout(timer); }
        if (attempt === 0 && !stopped) await new Promise((resolve) => setTimeout(resolve, retryMs));
      }
      publish("error");
    })().finally(() => { pending = null; });
    return pending;
  };
  return { load, stop() { stopped = true; } };
}
