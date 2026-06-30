const KEY = "printquote_gh_saves";

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
