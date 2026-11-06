/**
 * GoogleSignIn.jsx
 * Shows Google One Tap on page load plus a "Sign in with Google" button (for
 * when One Tap is dismissed or blocked). On success the user is signed into
 * Supabase and `onSignedIn(user, session)` is called. Renders nothing when
 * VITE_GOOGLE_CLIENT_ID isn't configured.
 */
import { useEffect, useRef, useState } from "react";
import {
  GOOGLE_CLIENT_ID, loadGoogleIdentity, makeNonce, signInWithGoogleCredential,
} from "../lib/googleOneTap.js";

export function GoogleSignIn({ mode = "signin", onSignedIn, onError, oneTap = true }) {
  const buttonRef = useRef(null);
  const [busy, setBusy] = useState(false);
  // Latest callbacks without re-initialising Google on every render
  const cb = useRef({ onSignedIn, onError });
  useEffect(() => { cb.current = { onSignedIn, onError }; });

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    let google = null;

    (async () => {
      try {
        const [g, nonce] = await Promise.all([loadGoogleIdentity(), makeNonce()]);
        if (cancelled) return;
        google = g;
        g.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hashed,
          use_fedcm_for_prompt: true,
          cancel_on_tap_outside: true,
          context: mode === "signup" ? "signup" : "signin",
          callback: async ({ credential }) => {
            setBusy(true);
            try {
              const { user, session } = await signInWithGoogleCredential(credential, nonce.raw);
              await cb.current.onSignedIn?.(user, session);
            } catch (err) {
              cb.current.onError?.(err.message ?? "Google sign-in failed.");
            } finally {
              setBusy(false);
            }
          },
        });
        if (buttonRef.current) {
          g.accounts.id.renderButton(buttonRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            shape: "rectangular",
            text: mode === "signup" ? "signup_with" : "signin_with",
            logo_alignment: "center",
            width: Math.min(400, buttonRef.current.offsetWidth || 320),
          });
        }
        if (oneTap) g.accounts.id.prompt();
      } catch (err) {
        if (!cancelled) cb.current.onError?.(err.message);
      }
    })();

    return () => {
      cancelled = true;
      google?.accounts.id.cancel();
    };
  }, [mode, oneTap]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="space-y-3">
      <div ref={buttonRef} className={`flex min-h-[44px] w-full justify-center ${busy ? "pointer-events-none opacity-60" : ""}`} />
      {busy && <p className="text-center text-xs text-gray-500">Signing you in with Google…</p>}
    </div>
  );
}

// "or" divider between Google and the email form
export function OrDivider() {
  if (!GOOGLE_CLIENT_ID) return null;
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-gray-300" />
      <span className="text-xs text-gray-500">or use your email</span>
      <span className="h-px flex-1 bg-gray-300" />
    </div>
  );
}
