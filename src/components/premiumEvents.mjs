export function eventEligibility(option) {
  const premium = ["stripe", "apple", "admin_comp"].includes(option?.provider);
  const full = premium && Number(option.occupied) >= 3;
  return {
    premium,
    full,
    allowed: premium && !full && option.can_submit === true,
  };
}
export const eventFields = [
  ["title", "Title", "text", true],
  ["place", "Place", "text", true],
  ["description", "Description", "textarea", true],
  ["eventAddress", "Event Address", "text", true],
  ["websiteUrl", "Website URL", "url", false],
  ["ticketUrl", "Ticket URL", "url", false],
  ["eventDate", "Start Date", "date", true],
  ["endDate", "End Date", "date", false],
  ["eventTime", "Start Time (Abilene time)", "time", true],
  ["endTime", "End Time (Abilene time)", "time", false],
  ["eventImage", "Event image", "file", false],
];
