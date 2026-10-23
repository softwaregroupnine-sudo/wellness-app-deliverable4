
import { quotes } from "../data/quotes";

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

// Keep the selected quote stable for each user on each day.
function getDailyIndex(items, userId, dateKey) {
  const key = `${userId || "guest"}-${dateKey}`;
  let hash = 0;

  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }

  return hash % items.length;
}

export function getQuoteOfTheDay({
  mood,
  feelings = [],
  userId = "guest",
  date = new Date(),
}) {
  // No check-in means no personalised quote yet.
  if (!mood) {
    return {
      quote: null,
      personalised: false,
      reason: "no-checkin",
    };
  }

  // Prevent errors if the quote collection is empty.
  if (!Array.isArray(quotes) || quotes.length === 0) {
    return {
      quote: null,
      personalised: false,
      reason: "no-quotes",
    };
  }

  const selectedMood = normalise(mood);

  const selectedFeelings = new Set(
    (Array.isArray(feelings) ? feelings : [])
      .map(normalise)
      .filter(Boolean)
  );

  // First find quotes that match the student's mood.
  const moodMatches = quotes.filter((item) =>
    (item.moods || []).some(
      (quoteMood) => normalise(quoteMood) === selectedMood
    )
  );

  // Prefer mood-matched quotes; otherwise use the full collection.
  const candidates =
    moodMatches.length > 0 ? moodMatches : quotes;

  // Within those candidates, prefer matching feelings.
  const feelingMatches = candidates.filter((item) =>
    (item.feelings || []).some((feeling) =>
      selectedFeelings.has(normalise(feeling))
    )
  );

  const bestMatches =
    selectedFeelings.size > 0 && feelingMatches.length > 0
      ? feelingMatches
      : candidates;

  // Use the device's local date for the daily selection.
  const dateKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

  const index = getDailyIndex(bestMatches, userId, dateKey);
  const quote = bestMatches[index];

  return {
    quote,
    personalised: moodMatches.length > 0,
    reason: "checkin",
  };
}
