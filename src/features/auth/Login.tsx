import { useCallback, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import type { UserInfo } from "@/types";
import { PrimaryBtn } from "@/components/shared";
import { isSupabaseConfigured } from "@/lib/supabase";
import { kargoApi } from "@/services";
import AuthInput from "./AuthInput";
import AuthLayout from "./AuthLayout";
import ResendConfirmation from "./ResendConfirmation";
import { authErrorMessage } from "./authErrors";

export default function Login({
  onSignUp,
  onAdminSignUp,
  onSuccess,
}: {
  onSignUp: () => void;
  onAdminSignUp: () => void;
  onSuccess: (u: UserInfo) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [passErr, setPassErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotNotice, setForgotNotice] = useState<{ tone: "sent" | "error"; text: string } | null>(
    null,
  );
  const [adminPopup, setAdminPopup] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  const submit = useCallback(async () => {
    let ok = true;
    if (!email.trim() || !email.includes("@")) {
      setEmailErr("Enter a valid email address.");
      ok = false;
    } else setEmailErr("");
    if (!password) {
      setPassErr("Password is required.");
      ok = false;
    } else if (!isSupabaseConfigured && password !== "password123") {
      setPassErr("Incorrect email or password.");
      ok = false;
    } else setPassErr("");
    if (!ok) return;
    setNeedsConfirm(false);
    setLoading(true);
    if (!isSupabaseConfigured) {
      // The in-memory demo (no Supabase) only has buyer/seller accounts, so the
      // admin console must refuse it rather than fall through to a buyer login.
      if (adminMode) {
        setLoading(false);
        setPassErr("Admin sign-in requires a connected KARGO account.");
        return;
      }
      setTimeout(() => {
        setLoading(false);
        onSuccess({ name: "Juan Dela Cruz", email, role: "Buyer" });
      }, 600);
      return;
    }
    try {
      const signedInUser = await kargoApi.signIn(email.trim(), password);
      if (adminMode && !signedInUser.adminEnabled) {
        await kargoApi.signOut();
        setLoading(false);
        setPassErr("This account does not have approved admin access.");
        return;
      }
      onSuccess(signedInUser);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      setPassErr(authErrorMessage(error, "Unable to sign in. Please try again."));
      // An unconfirmed account can never log in until a link is opened, so offer
      // a fresh one right where the user is stuck.
      const detail = `${(error as { code?: string } | null)?.code ?? ""} ${
        error instanceof Error ? error.message : ""
      }`.toLowerCase();
      setNeedsConfirm(
        detail.includes("email_not_confirmed") || detail.includes("email not confirmed"),
      );
    }
    // `adminMode` must be a dependency: without it a submit handler memoized
    // before the admin console was opened keeps `adminMode: false` (browser
    // autofill makes this easy to hit) and lets a non-admin sign in.
  }, [email, password, adminMode, onSuccess]);

  const requestReset = useCallback(async () => {
    if (!email.includes("@")) {
      setForgotNotice({
        tone: "error",
        text: "Enter your email address above, then tap Forgot password again.",
      });

      return;
    }

    if (!isSupabaseConfigured) {
      setForgotNotice({
        tone: "error",
        text: "Password recovery needs a connected KARGO account.",
      });

      return;
    }

    setForgotSending(true);

    try {
      await kargoApi.requestPasswordReset(email.trim());

      // Deliberately says nothing about whether the address is registered.
      setForgotNotice({
        tone: "sent",
        text: "If this email is registered, recovery instructions will be sent shortly.",
      });
    } catch (error) {
      setForgotNotice({
        tone: "error",
        text: authErrorMessage(error, "We couldn't send the reset email. Please try again."),
      });
    } finally {
      setForgotSending(false);
    }
  }, [email]);

  return (
    <AuthLayout page="login" onAdminAccess={() => setAdminPopup(true)}>
      {adminPopup && (
        <div className="auth-admin-access-backdrop" role="presentation">
          <section
            className="auth-admin-access-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-access-title"
          >
            <span className="auth-admin-access-handle" aria-hidden="true" />
            <button
              type="button"
              className="auth-admin-access-close"
              onClick={() => setAdminPopup(false)}
              aria-label="Close admin access"
            >
              <X size={18} />
            </button>
            <span className="auth-admin-access-icon" aria-hidden="true">
              <ShieldCheck size={24} />
            </span>
            <h2 id="admin-access-title">Admin access</h2>
            <p>
              Sign in with your admin account. New admin accounts need approval before they can log
              in.
            </p>
            <button
              type="button"
              className="auth-admin-access-primary"
              onClick={() => {
                setAdminPopup(false);
                setAdminMode(true);
              }}
            >
              Sign in as admin
            </button>
            <button
              type="button"
              className="auth-admin-access-secondary"
              onClick={() => {
                setAdminPopup(false);
                onAdminSignUp();
              }}
            >
              Request admin access
            </button>
          </section>
        </div>
      )}
      <div className={`auth-content pu${adminMode ? " auth-content--admin" : ""}`}>
        <header className="auth-heading">
          <h1>{adminMode ? "KARGO Admin Console" : "Your Budol, Our Kargo!"}</h1>
          <p>
            {adminMode
              ? "Manage Pasabuy Seller and Buyer Accounts"
              : "Sign in to your Kargo account"}
          </p>
        </header>

        <form
          className="auth-login-fields"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className={adminMode ? "auth-admin-email-field" : undefined}>
            <AuthInput
              label={adminMode ? "Admin email" : "Email address"}
              type="email"
              value={email}
              onChange={setEmail}
              error={emailErr}
              placeholder={adminMode ? "admin@kargo.com" : "juan@gmail.com"}
            />
          </div>
          <div className="auth-password-group">
            <AuthInput
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              error={passErr}
              placeholder="••••••••"
            />
            <div className="auth-forgot-row">
              <button
                type="button"
                onClick={requestReset}
                disabled={forgotSending}
                className="auth-link-button"
              >
                {forgotSending ? "Sending…" : "Forgot password?"}
              </button>
              {forgotNotice && (
                <div
                  role="status"
                  className={`auth-recovery-status${
                    forgotNotice.tone === "error" ? " is-error" : ""
                  }`}
                >
                  {forgotNotice.text}
                </div>
              )}
            </div>
          </div>
          {needsConfirm && <ResendConfirmation email={email.trim()} />}
          <PrimaryBtn loading={loading} style={{ width: "100%" }}>
            {loading ? "Signing in…" : adminMode ? "Sign in" : "Login"}
          </PrimaryBtn>
        </form>

        <div className="auth-switch-copy">
          {adminMode ? (
            <>
              <span className="auth-admin-access-line">
                <span>Need admin access? </span>
                <button type="button" onClick={onAdminSignUp} className="auth-link-button">
                  Request admin access
                </button>
              </span>
              <button
                type="button"
                onClick={() => setAdminMode(false)}
                className="auth-link-button auth-admin-back-link"
              >
                &larr; Back to regular sign in
              </button>
            </>
          ) : (
            <>
              <span>Don’t have an account? </span>
              <button onClick={onSignUp} className="auth-link-button">
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
