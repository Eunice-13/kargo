import { LockKeyhole, UserRound } from "lucide-react"

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
  const Icon = type === "password" ? LockKeyhole : type === "email" ? UserRound : null

  return (
    <div className={`auth-field${error ? " auth-field--error" : ""}`}>
      <label>{label}</label>
      <div className="auth-input-shell">
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
        />
        {Icon && <Icon size={19} strokeWidth={2.6} aria-hidden="true" />}
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

