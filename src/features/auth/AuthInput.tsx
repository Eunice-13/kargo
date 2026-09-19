import { useState } from "react"
import { INDIGO } from "@/constants/theme"

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
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#374151",
          display: "block",
          marginBottom: 5,
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          fontSize: 13.5,
          border: `1.5px solid ${
            error ? "#EF4444" : focused ? INDIGO : "#E5E7EB"
          }`,
          borderRadius: 8,
          padding: "10px 13px",
          outline: "none",
          color: "#111827",
          background: "#fff",
          transition: "border-color 0.15s",
          boxSizing: "border-box",
          fontFamily: "inherit",
        }}
        className="placeholder:text-gray-400"
      />
      {error && (
        <p
          className="fi"
          style={{
            fontSize: 11.5,
            color: "#EF4444",
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
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

