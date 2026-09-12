const hasControl = (text) => [...text].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);

export function websiteUrl(value) {
  if (typeof value !== "string") return "";
  let text = value.trim();
  if (!text || /[\s\\]/u.test(text) || hasControl(text)) return "";
  if (/^@[a-zA-Z0-9._]+$/.test(text)) text = `https://instagram.com/${text.slice(1)}`;
  if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:\/\//i.test(text)) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    if (!url.hostname.includes(".") || !url.hostname.split(".").every((part) => /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(part))) return "";
    return url.href;
  } catch { return ""; }
}

export function directionsUrl(business) {
  const coordinate = (value, limit) => {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (String(value).trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
  };
  const lat = coordinate(business?.latitude, 90);
  const lng = coordinate(business?.longitude, 180);
  const text = (value) => typeof value === "string" && !hasControl(value) ? value.trim() : "";
  const address = text(business?.address);
  const name = text(business?.name);
  const destination = lat !== null && lng !== null ? `${lat},${lng}` : address;
  if (destination) return `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}`;
  // Existing seed listings have a name but no street address: use a map search.
  return name ? `https://maps.apple.com/?q=${encodeURIComponent(`${name}, Abilene TX`)}` : "";
}

export function openBusinessUrl(event, business, action, { open, track }) {
  event.preventDefault();
  const url = action === "directions" ? directionsUrl(business) : websiteUrl(business?.social);
  if (!url) return false;
  try {
    // Stay inside the user gesture; analytics must never delay navigation.
    open(url, "_blank", "noopener,noreferrer");
  } catch { return false; }
  try { Promise.resolve(track(business, action)).catch(() => {}); } catch { /* Optional analytics. */ }
  return true;
}
