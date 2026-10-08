"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Archivo } from "next/font/google";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import TermsModal from "@/components/TermsModal";
import styles from "./login.module.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-archivo",
});

const URL_ERRORS: Record<string, string> = {
  UnauthorizedDomain:
    "Access restricted. Students must use their Valenzuela campus email ending in val@student.fatima.edu.ph. Faculty and staff must use @fatima.edu.ph.",
  AuthFailed: "Authentication failed. Please try again.",
  Banned:
    "This account has been suspended. If you think this is a mistake, please contact the OLFU Marketplace administrators.",
};

const GREETINGS = [
  "Hello po! Ollie here.",
  "Ready to buy, sell, or rent?",
  "Log in to see what your batchmates posted!",
  "Shhh, I was hiding from the midterms.",
];

type Role = "stu" | "fac";

function AuthPortalContent() {
  const searchParams = useSearchParams();
  const urlError = URL_ERRORS[searchParams.get("error") ?? ""] ?? "";

  const [role, setRole] = useState<Role>("stu");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Ollie the mascot
  const [say, setSay] = useState("");
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [idle, setIdle] = useState(false);
  const timerA = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const timerB = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const talk = useCallback((text: string, ms = 3500) => {
    clearTimeout(timerA.current);
    clearTimeout(timerB.current);
    setSay(text);
    setUp(true);
    setBubbleOpen(true);
    timerA.current = setTimeout(() => {
      setBubbleOpen(false);
      timerB.current = setTimeout(() => setUp(false), 250);
    }, ms);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(timerA.current);
      clearTimeout(timerB.current);
    },
    []
  );

  const pickRole = (r: Role) => {
    setRole(r);
    talk(
      r === "stu"
        ? "Student mode! Sign in with your student Google account."
        : "Faculty mode! Sign in with your @fatima.edu.ph account."
    );
  };

  const handleGoogleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!acceptedTerms) {
      setError("You must agree to the Terms and Conditions.");
      talk("Please tick the Terms and Conditions first!");
      return;
    }

    setLoading(true);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
        queryParams: { prompt: "select_account" },
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  };

  const shownError = error || urlError;

  return (
    <div className={`${styles.page} ${archivo.variable}`}>
      <main className={styles.left}>
        <div className={styles.box}>
          <h1 className={styles.title}>User Login</h1>
          <p className={styles.sub}>
            Sign in securely using your official OLFU Google account.
          </p>

          <div className={styles.role}>
            <button
              type="button"
              className={role === "stu" ? styles.on : ""}
              aria-pressed={role === "stu"}
              onClick={() => pickRole("stu")}
            >
              <span>🎓</span>
              <div>
                <b>Student</b>
                <small>...val@student.fatima.edu.ph</small>
              </div>
            </button>
            <button
              type="button"
              className={role === "fac" ? styles.on : ""}
              aria-pressed={role === "fac"}
              onClick={() => pickRole("fac")}
            >
              <span>🏛️</span>
              <div>
                <b>Faculty &amp; staff</b>
                <small>@fatima.edu.ph</small>
              </div>
            </button>
          </div>

          <form onSubmit={handleGoogleSignIn} noValidate>
            <label className={styles.chk}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked);
                  if (e.target.checked) talk("Great! Now hit Sign in with Google.");
                }}
              />
              <span>
                I agree to the OLFU Marketplace{" "}
                <button
                  type="button"
                  className={styles.link}
                  onClick={(event) => {
                    event.preventDefault();
                    setShowTerms(true);
                  }}
                >
                  Terms and Conditions
                </button>
                .
              </span>
            </label>

            {shownError && (
              <div className={styles.err} role="alert">
                {shownError}
              </div>
            )}

            <button type="submit" disabled={loading} className={styles.go}>
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  <svg className={styles.g} viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.7 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6C12.3 13.5 17.7 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
                    <path fill="#FBBC05" d="M10.4 28.8A14.5 14.5 0 0 1 9.5 24c0-1.7.3-3.3.9-4.8l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6z" />
                    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.7-4-13.6-9.8l-7.8 6C6.5 42.6 14.6 48 24 48z" />
                  </svg>
                  Mag-sign in sa Google
                </>
              )}
            </button>
          </form>

          <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />

          <p className={styles.note}>
            Enforced campus single sign-on (OAuth 2.0).
          </p>
        </div>
      </main>

      <aside
        className={styles.right}
        style={{ backgroundImage: "url(/campus.jpg)" }}
        aria-label="OLFU campus with mascot Ollie"
      >
        <div className={styles.brand}>
          <h2>OLFU Marketplace</h2>
          <p>Buy, sell, and rent items safely within the OLFU Campus.</p>
        </div>
        <div className={styles.ground} />
        <div
          className={`${styles.walker} ${up ? styles.up : ""} ${idle ? styles.idle : ""}`}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) setIdle(true);
          }}
          onClick={() => talk(GREETINGS[Math.floor(Math.random() * GREETINGS.length)])}
        >
          <div className={styles.pop}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.ollie} alt="Ollie, the OLFU mascot" src="/ollie.png" />
            <div className={`${styles.say} ${bubbleOpen ? styles.show : ""}`}>{say}</div>
          </div>
        </div>
        <div className={styles.hint}>Someone is peeking from the edge. Tap to say hi</div>
      </aside>
    </div>
  );
}

export default function AuthPortal() {
  return (
    <Suspense fallback={null}>
      <AuthPortalContent />
    </Suspense>
  );
}