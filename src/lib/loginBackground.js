import { getSettings } from "./settings.js";

// Admin-set login background (settings.login_background = { image_url, overlay }).
// Cached so moving between login pages doesn't refetch; pass refresh after saving.
let cached = null;
export function loadLoginBackground({ refresh = false } = {}) {
  if (!cached || refresh) {
    cached = getSettings()
      .then((s) => s?.login_background ?? null)
      .catch(() => null);
  }
  return cached;
}
