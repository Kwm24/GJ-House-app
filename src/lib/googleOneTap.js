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
import { getProfile, signOut } from "./auth.js";

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

/**
 * Finish a Google sign-in: return the user's customer profile, creating it if
 * it doesn't exist yet. Staff accounts are signed out again with a message.
 */
export async function completeGoogleSignIn(user) {
  let profile = await getProfile(user.id);

  if (!profile) {
    const { data, error } = await supabase.rpc("ensure_customer_profile");
    if (error) {
      await signOut();
      throw new Error(/ensure_customer_profile/i.test(error.message)
        ? "Google sign-in isn't fully set up yet (database update 038 is missing). Please use email for now."
        : error.message);
    }
    profile = Array.isArray(data) ? data[0] : data;
  }

  if (!profile?.role) {
    await signOut();
    throw new Error("We couldn't set up your account. Please try again or sign up with email.");
  }
  if (profile.role !== "customer") {
    await signOut();
    throw new Error("Google sign-in is for customers. Staff, please sign in with your email and password.");
  }
  if (profile.is_active === false) {
    await signOut();
    throw new Error("This account has been deactivated. Contact us for help.");
  }
  return profile;
}
