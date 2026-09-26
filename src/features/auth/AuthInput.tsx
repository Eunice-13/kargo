import { useState } from "react"
import { Eye, EyeOff, UserRound } from "lucide-react"

export default function AuthInput({
  label,
  type = "text",
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder?: string
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === "password"
  const PasswordIcon = showPassword ? Eye : EyeOff
  const Icon = isPassword ? PasswordIcon : type === "email" ? UserRound : null

  return (
    <div className={`auth-field${error ? " auth-field--error" : ""}`}>
      <label>{label}</label>
      <div className="auth-input-shell">
        <input
          type={isPassword && showPassword ? "text" : type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
        />
        {isPassword ? (
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            title={showPassword ? "Hide password" : "Show password"}
          >
            <PasswordIcon size={17} strokeWidth={2.4} aria-hidden="true" />
          </button>
        ) : (
          Icon && <Icon size={17} strokeWidth={2.4} aria-hidden="true" />
        )}
      </div>
      {error && (
        <p className="auth-error fi">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5.5" stroke="#EF4444" />
            <path
              d="M6 3.5v3M6 8h.01"
              stroke="#EF4444"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}

