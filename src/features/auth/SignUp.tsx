import { useCallback, useRef, useState } from "react";
import { Camera, ChevronDown, MapPin, Plane, Search, ShieldCheck, ShoppingBasket } from "lucide-react";
import type { Role, UserInfo } from "@/types";

// Admin is selectable at signup, but only as an approval request — the account
// stays a plain non-seller until an existing admin approves it.
type SignupRole = Role;
import { Modal, PrimaryBtn, SecondaryBtn, Toggle } from "@/components/shared";
import LocationPinPicker, { type LocationPinValue } from "@/components/shared/LocationPinPicker";
import { isSupabaseConfigured } from "@/lib/supabase";
import { normalizeUsername, validateUsername } from "@/lib/username";
import { kargoApi } from "@/services";
import AuthInput from "./AuthInput";
import AuthLayout from "./AuthLayout";
import LegalModal, { type LegalDoc } from "./LegalDocs";
import ResendConfirmation from "./ResendConfirmation";
import { authErrorMessage } from "./authErrors";

const platforms = ["Facebook", "TikTok", "Instagram"] as const;

export default function SignUp({
  onLogin,
  onSuccess,
  fromBatchLink = false,
  initialRole = "Buyer",
}: {
  onLogin: () => void;
  onSuccess: (u: UserInfo) => void;
  fromBatchLink?: boolean;
  initialRole?: SignupRole;
}) {
  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameState, setUsernameState] = useState<"idle" | "checking" | "free" | "taken">(
    "idle",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SignupRole>(initialRole);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const photoRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const [shopName, setShopName] = useState("");
  const [socials, setSocials] = useState<Record<string, { on: boolean; url: string }>>({
    Facebook: { on: false, url: "" },
    TikTok: { on: false, url: "" },
    Instagram: { on: false, url: "" },
  });

  const [addressPin, setAddressPin] = useState<LocationPinValue>({});
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [draftPin, setDraftPin] = useState<LocationPinValue>({});
  const [paymentType, setPaymentType] = useState("");
  const [paymentMenuOpen, setPaymentMenuOpen] = useState(false);
  const [paymentName, setPaymentName] = useState("");
  const [paymentNumber, setPaymentNumber] = useState("");

  const [terms, setTerms] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  const openLegal = (doc: LegalDoc) => (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setLegalDoc(doc);
  };

  // Outcome of a signup that needs the user to do something by email, or an
  // admin request that is waiting for approval.
  const [notice, setNotice] = useState<{
    kind: "sent" | "exists" | "admin_pending";
    email: string;
  } | null>(null);

  const displayName = [
    firstName.trim(),
    middleInitial.trim() ? `${middleInitial.trim().toUpperCase()}.` : "",
    lastName.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  const checkUsername = useCallback(async (value: string) => {
    const handle = normalizeUsername(value);
    if (validateUsername(handle)) {
      setUsernameState("idle");
      return;
    }
    if (!isSupabaseConfigured) {
      setUsernameState(handle === "kargo" ? "taken" : "free");
      return;
    }
    setUsernameState("checking");
    try {
      const free = await kargoApi.isUsernameAvailable(handle);
      setUsernameState(free ? "free" : "taken");
    } catch {
      setUsernameState("idle");
    }
  }, []);

  const submit = useCallback(async () => {
    const e: Record<string, string> = {};
    const namePattern = /^\p{L}[\p{L}\s'.-]*$/u;
    const first = firstName.trim();
    const last = lastName.trim();
    const mi = middleInitial.trim();
    if (!first) e.firstName = "Enter your first name.";
    else if (!namePattern.test(first))
      e.firstName = "Remove numbers and symbols from your first name.";
    if (!last) e.lastName = "Enter your last name.";
    else if (!namePattern.test(last))
      e.lastName = "Remove numbers and symbols from your last name.";
    if (mi && !/^\p{L}$/u.test(mi)) e.middleInitial = "Use one letter only.";
    const usernameError = validateUsername(username);
    if (usernameError) e.username = usernameError;
    else if (usernameState === "taken") e.username = "That username is taken.";
    if (!email.includes("@")) e.email = "Enter a valid email address.";
    else if (email.length > 254) e.email = "That email address is too long.";
    if (password.length < 8) e.password = "Password must be at least 8 characters.";
    else if (password.length > 64) e.password = "Password must be 64 characters or fewer.";
    if (role !== "Admin") {
      if (!Object.values(socials).some((s) => s.on && s.url.trim()))
        e.social = "Turn on at least one social account and add its profile link.";
    }
    if (role === "Buyer") {
      const addressText = addressPin.address?.trim() ?? "";
      if (!addressText) e.address = "Search or pin your delivery address.";
      else if (addressText.length < 10)
        e.address = "Enter a complete delivery address (street, barangay, city).";
      else if (addressPin.lat == null || addressPin.lng == null)
        e.address = "Pick your exact location on the map.";
      else if (addressPin.isResolvingAddress)
        e.address = "Wait for the map to finish finding your address.";
    }
    if (role === "Seller") {
      if (!shopName.trim()) e.shopName = "Shop name is required.";
      if (!paymentType) e.paymentType = "Choose a payment method.";
      if (!paymentName.trim()) e.paymentName = "Enter the account name for your payment method.";
      if (!paymentNumber.trim()) e.paymentNumber = "Enter the account number or payout details.";
      if (!terms) e.terms = "You must agree to the Terms and Privacy Policy.";
    }
    setErrs(e);
    if (Object.keys(e).length > 0) return;
    setLoading(true);
    if (!isSupabaseConfigured) {
      setTimeout(() => {
        setLoading(false);
        if (role === "Admin") {
          setErrs({});
          setNotice({ kind: "admin_pending", email: email.trim() });
          return;
        }
        onSuccess({
          name: displayName,
          username: normalizeUsername(username),
          email,
          role,
          sellerEnabled: role === "Seller",
          socialLinks: Object.fromEntries(
            Object.entries(socials)
              .filter(([, value]) => value.on && value.url.trim())
              .map(([key, value]) => [key, value.url.trim()]),
          ),
        });
      }, 600);
      return;
    }
    try {
      const result = await kargoApi.signUp({
        name: displayName,
        username: normalizeUsername(username),
        email: email.trim(),
        password,
        shopName,
        socials,
        role,
        buyerAddress:
          role === "Buyer" && addressPin.lat != null && addressPin.lng != null
            ? {
                addressText: addressPin.address?.trim() ?? "",
                lat: addressPin.lat,
                lng: addressPin.lng,
              }
            : undefined,
        sellerPaymentMethod:
          role === "Seller"
            ? {
                methodType: paymentType,
                accountName: paymentName.trim(),
                accountNumber: paymentNumber.trim(),
              }
            : undefined,
      });
      setLoading(false);
      if (result.status === "already_registered") {
        // Supabase sends nothing for an address that already has an account, so
        // never claim an email is on its way.
        setErrs({});
        setNotice({ kind: "exists", email: email.trim() });
        return;
      }
      if (result.status === "confirmation_sent") {
        setErrs({});
        setNotice({
          kind: role === "Admin" ? "admin_pending" : "sent",
          email: email.trim(),
        });
        return;
      }
      setNotice(null);
      onSuccess({ ...result.user, role });
    } catch (error) {
      setLoading(false);
      const message = authErrorMessage(error, "Unable to create account. Please try again.");
      setErrs({
        general: /username/i.test(message) ? "That username was just taken. Try another." : message,
      });
    }
  }, [
    firstName,
    middleInitial,
    lastName,
    displayName,
    username,
    usernameState,
    email,
    password,
    role,
    shopName,
    socials,
    terms,
    addressPin,
    paymentType,
    paymentName,
    paymentNumber,
    onSuccess,
  ]);

  const draftAddressText = draftPin.address?.trim() ?? "";
  const draftAddressReady =
    draftAddressText.length >= 10 &&
    draftPin.lat != null &&
    draftPin.lng != null &&
    !draftPin.isResolvingAddress;
  const savedAddressText = addressPin.address?.trim() ?? "";

  const openAddressModal = () => {
    setDraftPin(addressPin);
    setAddressModalOpen(true);
  };

  const saveAddress = () => {
    if (!draftAddressReady) return;
    setAddressPin({ ...draftPin, address: draftAddressText });
    setErrs((current) => ({ ...current, address: "" }));
    setAddressModalOpen(false);
  };

  const socialIcon = (platform: (typeof platforms)[number]) => {
    if (platform === "Instagram") return <Camera size={18} strokeWidth={3} />;
    if (platform === "TikTok")
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z" />
        </svg>
      );
    return <span>f</span>;
  };

  return (
    <AuthLayout page="signup">
      <div className="auth-content auth-signup-content">
        <header className="auth-heading auth-heading--start">
          <h1>Create your account</h1>
          <p>Join Kargo to buy or sell pasabuy items</p>
        </header>

        <div className="auth-signup-fields">
          <div className={`auth-signup-grid${role === "Admin" ? " auth-signup-grid--single" : ""}`}>
            <div className="auth-signup-col auth-signup-col--main">
              <div className="auth-photo-field">
                <button
                  type="button"
                  className="auth-photo-button"
                  aria-label="Upload profile photo"
                  onClick={() => photoRef.current?.click()}
                >
                  {photoUrl ? (
                    <img src={photoUrl} alt="Profile photo preview" className="auth-photo-preview" />
                  ) : (
                    <b>＋</b>
                  )}
                </button>
                <label>
                  Profile Photo <span>(optional)</span>
                </label>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setPhoto(file.name);
                    setPhotoUrl((previous) => {
                      if (previous) URL.revokeObjectURL(previous);
                      return URL.createObjectURL(file);
                    });
                  }}
                />
              </div>

              <div className="auth-signup-name-row">
                <AuthInput
                  label="First name"
                  required
                  value={firstName}
                  onChange={setFirstName}
                  error={errs.firstName}
                  placeholder="Juan"
                  maxLength={40}
                />
                <AuthInput
                  label="Middle initial"
                  value={middleInitial}
                  onChange={(value) => setMiddleInitial(value.slice(0, 1))}
                  error={errs.middleInitial}
                  placeholder="D"
                  maxLength={1}
                />
                <AuthInput
                  label="Last name"
                  required
                  value={lastName}
                  onChange={setLastName}
                  error={errs.lastName}
                  placeholder="Dela Cruz"
                  maxLength={40}
                />
              </div>

              <div>
                <AuthInput
                  label="Username"
                  required
                  value={username}
                  onChange={(value) => {
                    setUsername(value);
                    setUsernameState("idle");
                  }}
                  error={errs.username}
                  placeholder="juandc"
                  maxLength={20}
                  onBlur={() => void checkUsername(username)}
                />
                <p
                  className={`auth-hint${usernameState === "taken" ? " auth-hint--error" : ""}`}
                  aria-live="polite"
                >
                  {usernameState === "checking"
                    ? "Checking availability…"
                    : usernameState === "taken"
                      ? "That username is taken."
                      : usernameState === "free"
                        ? `@${normalizeUsername(username)} is available.`
                        : "Your public handle. You'll still sign in with your email."}
                </p>
              </div>
              <AuthInput
                label="Email address"
                type="email"
                required
                value={email}
                onChange={setEmail}
                error={errs.email}
                placeholder="juan@gmail.com"
              />
              <AuthInput
                label="Password"
                type="password"
                required
                value={password}
                onChange={setPassword}
                error={errs.password}
                placeholder="Min. 8 characters"
              />

              {role === "Seller" && (
                <AuthInput
                  label="Shop Name"
                  required
                  value={shopName}
                  onChange={setShopName}
                  error={errs.shopName}
                  placeholder="e.g. Maria's Japan Haul Shop"
                />
              )}
            </div>

            <div className="auth-signup-col auth-signup-col--aside">
              {role === "Buyer" && (
                <div
                  className={`auth-field auth-address-field${errs.address ? " auth-field--error" : ""}`}
                >
                  <label htmlFor="signup-address-trigger">
                    Delivery address
                    <span className="auth-required-mark" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <button
                    type="button"
                    id="signup-address-trigger"
                    className="auth-address-trigger"
                    onClick={openAddressModal}
                    aria-haspopup="dialog"
                    aria-invalid={Boolean(errs.address)}
                  >
                    <Search size={16} aria-hidden="true" className="auth-address-trigger__icon" />
                    <span
                      className={`auth-address-trigger__text${savedAddressText ? "" : " is-placeholder"}`}
                    >
                      {savedAddressText || "Search address"}
                    </span>
                    <MapPin size={15} aria-hidden="true" className="auth-address-trigger__pin" />
                  </button>
                  {errs.address ? (
                    <p className="auth-error auth-error--inline fi">{errs.address}</p>
                  ) : (
                    <p className="auth-hint">
                      {savedAddressText
                        ? "Pinned address saved for delivery coordination."
                        : "Open the map to search or pin your exact delivery spot."}
                    </p>
                  )}
                </div>
              )}

              {role === "Seller" && (
                <div className="auth-payment-field">
                  <div className="auth-section-label">
                    Payment method <span>(at least one required)</span>
                  </div>
                  <div className="auth-payment-grid">
                    <div className="auth-field">
                      <label htmlFor="signup-payment-type">
                        Method
                        <span className="auth-required-mark" aria-hidden="true">
                          *
                        </span>
                      </label>
                      <div className="auth-payment-select">
                        <button
                          id="signup-payment-type"
                          type="button"
                          className="auth-payment-select__trigger"
                          aria-haspopup="listbox"
                          aria-expanded={paymentMenuOpen}
                          aria-controls="signup-payment-options"
                          aria-invalid={Boolean(errs.paymentType)}
                          onClick={() => setPaymentMenuOpen((open) => !open)}
                          onKeyDown={(event) => {
                            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                              event.preventDefault();
                              setPaymentMenuOpen(true);
                              requestAnimationFrame(() => {
                                document
                                  .querySelector<HTMLButtonElement>(
                                    "#signup-payment-options button.is-selected",
                                  )
                                  ?.focus();
                              });
                            } else if (event.key === "Escape") {
                              setPaymentMenuOpen(false);
                            }
                          }}
                        >
                          <span className={paymentType ? "" : "is-placeholder"}>
                            {paymentType || "Choose payment method"}
                          </span>
                          <ChevronDown
                            size={17}
                            aria-hidden="true"
                            className={paymentMenuOpen ? "is-open" : ""}
                          />
                        </button>
                        {paymentMenuOpen && (
                          <div
                            id="signup-payment-options"
                            className="auth-payment-select__options"
                            role="listbox"
                            aria-labelledby="signup-payment-type"
                            onKeyDown={(event) => {
                              const options = Array.from(
                                event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
                              );
                              const currentIndex = options.indexOf(
                                document.activeElement as HTMLButtonElement,
                              );
                              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                                event.preventDefault();
                                const direction = event.key === "ArrowDown" ? 1 : -1;
                                options[
                                  (currentIndex + direction + options.length) % options.length
                                ]?.focus();
                              } else if (event.key === "Home") {
                                event.preventDefault();
                                options[0]?.focus();
                              } else if (event.key === "End") {
                                event.preventDefault();
                                options.at(-1)?.focus();
                              } else if (event.key === "Escape") {
                                event.preventDefault();
                                setPaymentMenuOpen(false);
                                document.getElementById("signup-payment-type")?.focus();
                              }
                            }}
                          >
                            {["GCash", "Maya", "Bank Transfer"].map((method) => (
                              <button
                                key={method}
                                type="button"
                                role="option"
                                aria-selected={paymentType === method}
                                className={paymentType === method ? "is-selected" : ""}
                                onClick={() => {
                                  setPaymentType(method);
                                  setPaymentMenuOpen(false);
                                }}
                              >
                                {method}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {errs.paymentType && <p className="auth-error fi">{errs.paymentType}</p>}
                    </div>
                    <AuthInput
                      label="Account name"
                      required
                      value={paymentName}
                      onChange={setPaymentName}
                      error={errs.paymentName}
                      placeholder="Account holder"
                    />
                    <AuthInput
                      label="Account number"
                      required
                      value={paymentNumber}
                      onChange={setPaymentNumber}
                      error={errs.paymentNumber}
                      placeholder="Mobile or bank account"
                    />
                  </div>
                </div>
              )}

              {role !== "Admin" && (
                <div className="auth-socials">
                  <label className="auth-section-label">
                    Contact &amp; Social Links <span>(at least one required)</span>
                    <span className="auth-required-mark" aria-hidden="true">
                      *
                    </span>
                  </label>
                  {fromBatchLink && role === "Buyer" && (
                    <p className="auth-social-note">
                      Sellers check this before confirming a reservation, so use an account you
                      check often.
                    </p>
                  )}
                  <div className="auth-social-list">
                    {platforms.map((platform) => (
                      <div className="auth-social-row" key={platform}>
                        <span
                          className={`auth-social-icon auth-social-icon--${platform.toLowerCase()}`}
                        >
                          {socialIcon(platform)}
                        </span>
                        <span className="auth-social-name">{platform}</span>
                        <Toggle
                          on={socials[platform].on}
                          onChange={(on) =>
                            setSocials((current) => ({
                              ...current,
                              [platform]: { ...current[platform], on },
                            }))
                          }
                          label={`Connect ${platform}`}
                          compact
                        />
                        <input
                          value={socials[platform].url}
                          onChange={(event) =>
                            setSocials((current) => ({
                              ...current,
                              [platform]: { ...current[platform], url: event.target.value },
                            }))
                          }
                          placeholder="Profile URL or @username"
                          aria-label={`${platform} profile`}
                          disabled={!socials[platform].on}
                        />
                      </div>
                    ))}
                  </div>
                  {errs.social && <p className="auth-error fi">{errs.social}</p>}
                </div>
              )}
            </div>
          </div>

          <div className="auth-role-field">
            {role === "Admin" ? (
              <div className="auth-admin-only-label">
                <ShieldCheck size={18} aria-hidden="true" />
                <span>
                  <strong>Admin access request</strong>
                  <small>Approval is required before the admin console can be accessed.</small>
                </span>
              </div>
            ) : (
              <>
                <span className="auth-section-label" id="signup-role-label">
                  I want to join as a...
                </span>
                <div className="auth-role-options" role="group" aria-labelledby="signup-role-label">
                  {(["Buyer", "Seller"] as SignupRole[]).map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={role === option ? "is-selected" : ""}
                      onClick={() => {
                        setRole(option);
                        setErrs({});
                      }}
                      aria-pressed={role === option}
                    >
                      <strong>
                        {option === "Buyer" ? (
                          <ShoppingBasket size={17} aria-hidden="true" />
                        ) : (
                          <Plane size={17} aria-hidden="true" />
                        )}
                        {option}
                      </strong>
                      <small>
                        {option === "Buyer" ? "Claim items from batches" : "Run pasabuy batches"}
                      </small>
                    </button>
                  ))}
                </div>
              </>
            )}
            {role === "Admin" && (
              <p className="auth-hint">
                Admin signup is a request. An existing admin reviews it before the console unlocks —
                you&apos;ll still confirm your email first.
              </p>
            )}
          </div>

          {role === "Seller" && (
            <div className="auth-terms-field">
              <label className="auth-terms">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(event) => setTerms(event.target.checked)}
                />
                <span>
                  <span className="auth-required-mark" aria-hidden="true">
                    *
                  </span>{" "}
                  I agree to the{" "}
                  <button type="button" className="legal-link" onClick={openLegal("terms")}>
                    Terms of Service
                  </button>{" "}
                  and{" "}
                  <button type="button" className="legal-link" onClick={openLegal("privacy")}>
                    Privacy Policy
                  </button>
                  . Linked
                  accounts are reference indicators only and are not automatically verified by
                  Kargo.
                </span>
              </label>
              {errs.terms && <p className="auth-error fi">{errs.terms}</p>}
            </div>
          )}

          {errs.general && (
            <p role="status" className="auth-general-message">
              {errs.general}
            </p>
          )}

          {notice?.kind === "sent" && (
            <>
              <p role="status" className="auth-general-message is-success">
                Account created. We sent a confirmation link to <strong>{notice.email}</strong>.
                Open it, then log in. If it hasn&apos;t arrived in a minute, check your spam folder
                or resend it below.
              </p>
              <ResendConfirmation email={notice.email} />
            </>
          )}

          {notice?.kind === "exists" && (
            <>
              <p role="status" className="auth-general-message">
                <strong>{notice.email}</strong> already has an account, so we didn&apos;t send a new
                email. Log in instead. If you never confirmed it, resend the confirmation link
                below.
              </p>
              <ResendConfirmation email={notice.email} />
            </>
          )}

          {notice?.kind === "admin_pending" && (
            <p role="status" className="auth-general-message is-success">
              Admin request submitted. An existing admin must approve it before you can access the
              console. We sent a confirmation link to <strong>{notice.email}</strong> — open it,
              then log in.
            </p>
          )}

          <PrimaryBtn onClick={submit} loading={loading} style={{ width: "100%" }}>
            {loading
              ? role === "Seller"
                ? "Creating shop…"
                : role === "Admin"
                  ? "Submitting request…"
                  : "Creating account…"
              : role === "Seller"
                ? "Create Shop"
                : role === "Admin"
                  ? "Request admin access"
                  : "Create account"}
          </PrimaryBtn>
        </div>

        <div className="auth-switch-copy auth-signup-switch">
          <span>Already have an account? </span>
          <button onClick={onLogin} className="auth-link-button">
            Log in
          </button>
        </div>
        <p className="auth-legal-copy">
          By signing up, you agree to our{" "}
          <button type="button" className="legal-link" onClick={openLegal("terms")}>
            Terms
          </button>{" "}
          and{" "}
          <button type="button" className="legal-link" onClick={openLegal("privacy")}>
            Privacy Policy
          </button>
          .
        </p>
      </div>

      {addressModalOpen && (
        <Modal
          title="Set delivery address"
          onClose={() => setAddressModalOpen(false)}
          width={520}
          topOffset={0}
          variant="form"
          showTitleIcon={false}
          className="auth-address-modal"
        >
          <div className="auth-address-modal__fields">
            <LocationPinPicker value={draftPin} onChange={setDraftPin} />
            <label className="auth-address-complete" htmlFor="signup-address-text">
              Complete delivery address
              <textarea
                id="signup-address-text"
                className="auth-address-input"
                rows={3}
                maxLength={1000}
                value={draftPin.address ?? ""}
                onChange={(event) =>
                  setDraftPin((current) => ({ ...current, address: event.target.value }))
                }
                placeholder="House/unit, street, barangay, city, province"
                aria-invalid={draftAddressText.length > 0 && !draftAddressReady}
                aria-describedby="signup-address-modal-help"
              />
            </label>
          </div>
          <p
            id="signup-address-modal-help"
            className={`auth-hint${draftAddressReady ? "" : " is-pending"}`}
            aria-live="polite"
          >
            {draftAddressReady
              ? "Address pinned. Save it to use this spot for deliveries."
              : "Search an address or tap the map, then confirm the complete address."}
          </p>
          <div className="flex">
            <SecondaryBtn onClick={() => setAddressModalOpen(false)}>Cancel</SecondaryBtn>
            <PrimaryBtn onClick={saveAddress} disabled={!draftAddressReady}>
              Save address
            </PrimaryBtn>
          </div>
        </Modal>
      )}
      {legalDoc && <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </AuthLayout>
  );
}
