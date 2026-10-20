const KEY         = "printquote_gh_saves";
const DIGITAL_KEY = "digital_printquote_gh_saves";

export function loadSavedQuotes() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveQuoteToStorage(snapshot) {
  const existing = loadSavedQuotes();
  const filtered = existing.filter((q) => q.ref !== snapshot.ref);
  const next = [snapshot, ...filtered].slice(0, 20);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function deleteSavedQuote(ref) {
  const next = loadSavedQuotes().filter((q) => q.ref !== ref);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

// ── Digital print quote storage ───────────────────────────────────────────────
export function loadDigitalQuotes() {
  try { return JSON.parse(localStorage.getItem(DIGITAL_KEY) || "[]"); } catch { return []; }
}

export function saveDigitalQuoteToStorage(snapshot) {
  const existing = loadDigitalQuotes();
  const next = [snapshot, ...existing.filter((q) => q.ref !== snapshot.ref)].slice(0, 20);
  localStorage.setItem(DIGITAL_KEY, JSON.stringify(next));
  return next;
}

export function deleteDigitalQuote(ref) {
  const next = loadDigitalQuotes().filter((q) => q.ref !== ref);
  localStorage.setItem(DIGITAL_KEY, JSON.stringify(next));
  return next;
}
