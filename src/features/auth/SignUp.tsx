import { useCallback, useRef, useState } from "react";
import { Camera, ChevronDown, MapPin, Plane, Search, ShoppingBasket } from "lucide-react";
import type { Role, UserInfo } from "@/types";

// Signup can only ever create a Buyer or Seller; Admin is granted out-of-band.
type SignupRole = Exclude<Role, "Admin">;
import { Modal, PrimaryBtn, SecondaryBtn, Toggle } from "@/components/shared";
import LocationPinPicker, { type LocationPinValue } from "@/components/shared/LocationPinPicker";
import { isSupabaseConfigured } from "@/lib/supabase";
import { kargoApi } from "@/services";
import AuthInput from "./AuthInput";
import AuthLayout from "./AuthLayout";
import ResendConfirmation from "./ResendConfirmation";
import { authErrorMessage } from "./authErrors";

const platforms = ["Facebook", "TikTok", "Instagram"] as const;

export default function SignUp({
  onLogin,
  onSuccess,
  fromBatchLink = false,
}: {
  onLogin: () => void;
  onSuccess: (u: UserInfo) => void;
  fromBatchLink?: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SignupRole>("Buyer");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const photoRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState("");

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

  // Outcome of a signup that needs the user to do something by email.
  const [notice, setNotice] = useState<{ kind: "sent" | "exists"; email: string } | null>(null);

  const submit = useCallback(async () => {
    const e: Record<string, string> = {};
    if (!name.trim() || name.trim().split(" ").length < 2)
      e.name = "Enter your full name (first and last).";
    if (!email.includes("@")) e.email = "Enter a valid email address.";
    if (password.length < 8) e.password = "Password must be at least 8 characters.";
    if (!Object.values(socials).some((s) => s.on && s.url.trim()))
      e.social = "Turn on at least one social account and add its profile link.";
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
        onSuccess({
          name: name.trim(),
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
        name: name.trim(),
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
        setNotice({ kind: "sent", email: email.trim() });
        return;
      }
      setNotice(null);
      onSuccess({ ...result.user, role });
    } catch (error) {
      setLoading(false);
      setErrs({
        general: authErrorMessage(error, "Unable to create account. Please try again."),
      });
    }
  }, [
    name,
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
    return <span>{platform === "Facebook" ? "f" : "♪"}</span>;
  };

  return (
    <AuthLayout page="signup">
      <div className="auth-content auth-signup-content">
        <header className="auth-heading auth-heading--start">
          <h1>Create your account</h1>
          <p>Join Kargo to buy or sell pasabuy items</p>
        </header>

        <div className="auth-signup-fields">
          <div className="auth-signup-grid">
            <div className="auth-signup-col auth-signup-col--main">
              <div className="auth-photo-field">
                <button
                  type="button"
                  className="auth-photo-button"
                  aria-label="Upload profile photo"
                  onClick={() => photoRef.current?.click()}
                >
                  {photo ? <span>{photo}</span> : <b>＋</b>}
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
                    if (event.target.files?.[0]) setPhoto(event.target.files[0].name);
                  }}
                />
              </div>

              <AuthInput
                label="Full Name"
                required
                value={name}
                onChange={setName}
                error={errs.name}
                placeholder="Juan Dela Cruz"
              />
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
                    Delivery address <span className="auth-required-mark" aria-hidden="true">*</span>
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
                        Method <span className="auth-required-mark" aria-hidden="true">*</span>
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
                                options[(currentIndex + direction + options.length) % options.length]?.focus();
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
                      {errs.paymentType && (
                        <p className="auth-error fi">{errs.paymentType}</p>
                      )}
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

              <div className="auth-socials">
                <label className="auth-section-label">
                  Contact &amp; Social Links <span>(at least one required)</span>
                  <span className="auth-required-mark" aria-hidden="true">*</span>
                </label>
                {fromBatchLink && role === "Buyer" && (
                  <p className="auth-social-note">
                    Sellers check this before confirming a reservation, so use an account you check
                    often.
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
            </div>
          </div>

          <div className="auth-role-field">
            <span className="auth-section-label" id="signup-role-label">
              I want to join as a...
            </span>
            <div className="auth-role-options" role="group" aria-labelledby="signup-role-label">
              {(["Buyer", "Seller"] as SignupRole[]).map((option) => (
                <button
                  type="button"
                  key={option}
                  className={role === option ? "is-selected" : ""}
                  onClick={() => setRole(option)}
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
                  <span className="auth-required-mark" aria-hidden="true">*</span>{" "}
                  I agree to the <em>Terms of Service</em> and <em>Privacy Policy</em>. Linked
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

          <PrimaryBtn onClick={submit} loading={loading} style={{ width: "100%" }}>
            {loading
              ? role === "Seller"
                ? "Creating shop…"
                : "Creating account…"
              : role === "Seller"
                ? "Create Shop"
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
          By signing up, you agree to our <span>Terms</span> and <span>Privacy Policy</span>.
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
    </AuthLayout>
  );
}
