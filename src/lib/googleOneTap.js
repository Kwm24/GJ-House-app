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
 * New Google users get a "customer" profile from the handle_new_user trigger
 * (no role in their metadata); the trigger also picks up Google's full_name.
 */
import { supabase } from "./supabase.js";

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
