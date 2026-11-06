/**
 * googleOneTap.js
 * Google One Tap / "Sign in with Google" via Google Identity Services, signed
 * into Supabase with the returned ID token (supabase.auth.signInWithIdToken).
 *
 * Setup (once):
 *   1. Google Cloud console → APIs & Services → Credentials → OAuth client ID
 *      (type "Web application"). Add every site origin (e.g.
 *      http://localhost:5173 and your live domain) to "Authorised JavaScript origins".
 *   2. Supabase → Authentication → Providers → Google: enable it and paste the
 *      same Client ID (and secret).
 *   3. .env.local → VITE_GOOGLE_CLIENT_ID=<the client ID>
 *
 * Google sign-in is for CUSTOMERS only (staff use the email form). After
 * Google signs someone in, completeGoogleSignIn() makes sure they have a
 * customer profile (migration 038) and turns away any staff account.
 */
import { supabase } from "./supabase.js";
import { signOut } from "./auth.js";

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const GSI_SRC = "https://accounts.google.com/gsi/client";
let scriptPromise = null;

export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload  = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error("Google sign-in failed to load.")));
    s.onerror = () => { scriptPromise = null; reject(new Error("Google sign-in failed to load.")); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

// A raw nonce goes to Supabase; its SHA-256 hex goes to Google, which embeds
// it in the ID token so Supabase can check the token was minted for us.
export async function makeNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

export async function signInWithGoogleCredential(credential, rawNonce) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: credential,
    nonce: rawNonce,
  });
  if (error) throw error;
  return data;
}

// After turning an account away, stop One Tap from auto-signing the same
// Google account straight back in (the sign-in / sign-out loop on phones).
function rejectGoogle() {
  try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* ignore */ }
  return signOut();
}

/**
 * Finish a Google sign-in: return the user's customer profile, creating it if
 * it doesn't exist yet (ensure_customer_profile, migration 038 — it returns
 * the existing profile untouched if there is one). Staff accounts are signed
 * out again with a message.
 *
 * Uses the access token from the sign-in response directly rather than
 * reading the session back from storage, so a storage hiccup can't turn this
 * request anonymous.
 */
export async function completeGoogleSignIn(user, session) {
  const token = session?.access_token;
  if (!token) {
    await rejectGoogle();
    throw new Error("Google signed you in, but no session came back. Please try again.");
  }

  // A fresh session lasts about an hour. If it already looks (nearly) expired,
  // this device's clock is ahead — the app can't keep anyone signed in then.
  if (session.expires_at && session.expires_at * 1000 - Date.now() < 60_000) {
    await rejectGoogle();
    throw new Error("Your device's date and time look wrong, so we can't keep you signed in. Set the clock to update automatically, then try again.");
  }

  const { data, error } = await supabase
    .rpc("ensure_customer_profile")
    .setHeader("Authorization", `Bearer ${token}`);

  if (error) {
    console.error("[Google sign-in] ensure_customer_profile failed:", error);
    await rejectGoogle();
    if (error.code === "PGRST202") {
      throw new Error("Google sign-in isn't fully set up yet (database update 038 is missing). Please use email for now.");
    }
    throw new Error(`We couldn't open your account (${error.message}). Please try again or sign in with email.`);
  }
  const profile = Array.isArray(data) ? data[0] : data;

  if (!profile?.role) {
    await rejectGoogle();
    throw new Error("We couldn't set up your account. Please try again or sign up with email.");
  }
  if (profile.role !== "customer") {
    await rejectGoogle();
    const email = profile.email || user?.email;
    throw new Error(`${email ? `${email} is a staff account. ` : ""}Google sign-in is for customers only. Staff, please sign in with your email and password on your lobby's login page, or use a different Google account.`);
  }
  if (profile.is_active === false) {
    await rejectGoogle();
    throw new Error("This account has been deactivated. Contact us for help.");
  }

  // The rest of the app reads the session from storage. Warn (in the console)
  // if it isn't there, so the cause is visible.
  const { data: stored } = await supabase.auth.getSession();
  if (!stored?.session) console.warn("[Google sign-in] Signed in, but the session wasn't kept in browser storage.");

  return profile;
}
