import { useEffect, useRef, useState } from "react";
import { Check, Search, UserRound } from "lucide-react";

import { Modal, PrimaryBtn, SecondaryBtn, Avatar } from "@/components/shared";
import { adminApi } from "@/services";
import type { AdminUserSearchResult } from "../adminTypes";

// Search an existing account and grant it admin, with a required reason and a
// typed-name confirmation. Never creates a new auth user.
export default function AdminAddAdminModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [selected, setSelected] = useState<AdminUserSearchResult | null>(null);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected) return;
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      setSearchFailed(false);
      return;
    }
    setSearching(true);
    setSearchFailed(false);
    timer.current = setTimeout(() => {
      adminApi
        .searchUsers(query.trim(), 8)
        .then((rows) => {
          setResults(rows);
          setSearchFailed(false);
        })
        .catch(() => {
          setResults([]);
          setSearchFailed(true);
        })
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, selected]);

  const reasonOk = reason.trim().length >= 8;
  const typedOk = !!selected && typed.trim() === selected.name.trim();
  const valid = !!selected && reasonOk && typedOk;

  return (
    <Modal
      title="Add admin"
      variant="confirm"
      width={500}
      className="admin-modal"
      overlayClassName="admin-modal-overlay"
      onClose={onClose}
    >
      <div className="admin-confirm">
        {!selected ? (
          <>
            <div className="admin-field">
              <label htmlFor="admin-search-account">Find an existing account</label>
              <div className="admin-search">
                <Search className="admin-search__icon" size={16} aria-hidden="true" />
                <input
                  className="admin-search__control"
                  id="admin-search-account"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name or email"
                  autoComplete="off"
                  aria-describedby="admin-search-hint"
                />
              </div>
              <p id="admin-search-hint" className="admin-field__hint">
                Search by name or email. This never creates a new account.
              </p>
            </div>

            {searching && (
              <p className="admin-search-state" role="status">
                Searching…
              </p>
            )}
            {!searching && searchFailed && (
              <p className="admin-search-state admin-search-state--error" role="alert">
                Couldn&apos;t search accounts. Try again.
              </p>
            )}
            {!searching && !searchFailed && query.trim().length >= 2 && results.length === 0 && (
              <p className="admin-search-state" role="status">
                No accounts match that search.
              </p>
            )}

            {results.length > 0 && (
              <ul className="admin-search-results" aria-label="Matching accounts">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      className="admin-search-result"
                      type="button"
                      onClick={() => setSelected(r)}
                    >
                      <Avatar name={r.name} size={30} />
                      <span className="admin-search-results__text">
                        <strong>{r.name}</strong>
                        <span>{r.email}</span>
                      </span>
                      <UserRound className="admin-search-result__icon" size={15} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <div className="admin-selected-account">
              <Avatar name={selected.name} size={38} />
              <div className="admin-selected-account__identity">
                <strong>{selected.name}</strong>
                <span>{selected.email}</span>
              </div>
              <button
                type="button"
                className="admin-inline-link"
                onClick={() => {
                  setSelected(null);
                  setTyped("");
                  setResults([]);
                }}
              >
                Change
              </button>
            </div>

            <div className="admin-field">
              <div className="admin-field__head">
                <label htmlFor="admin-grant-reason">Reason</label>
                <span className={`admin-field__count${reasonOk ? " is-valid" : ""}`}>
                  {reasonOk
                    ? "Ready"
                    : reason.trim().length === 0
                      ? "At least 8"
                      : `${8 - reason.trim().length} more`}
                </span>
              </div>
              <textarea
                id="admin-grant-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                placeholder="Why does this account need admin access?"
                aria-describedby="admin-grant-reason-hint"
                aria-invalid={reason.length > 0 ? !reasonOk : undefined}
              />
              <p id="admin-grant-reason-hint" className="admin-field__hint">
                Saved to the audit log with your name.
              </p>
            </div>

            <div className="admin-field">
              <label htmlFor="admin-grant-typed">
                Type <strong>{selected.name}</strong> to confirm
              </label>
              <div className="admin-field__match">
                <input
                  className="admin-field__match-control"
                  id="admin-grant-typed"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={typed.length > 0 ? !typedOk : undefined}
                />
                {typedOk && typed.length > 0 && (
                  <Check className="admin-field__match-icon" size={16} aria-hidden="true" />
                )}
              </div>
              <p className="admin-field__hint">
                Every admin can do everything, including managing the team. This is logged.
              </p>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="admin-form-error">
            {error}
          </p>
        )}
      </div>

      <div className="admin-modal-footer">
        <SecondaryBtn onClick={onClose} disabled={saving}>
          Cancel
        </SecondaryBtn>
        <PrimaryBtn
          disabled={!valid || saving}
          loading={saving}
          onClick={async () => {
            if (!selected) return;
            setSaving(true);
            setError(null);
            try {
              await adminApi.grantAdmin(selected.id, reason.trim());
              onAdded();
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not add admin.");
            } finally {
              setSaving(false);
            }
          }}
        >
          Add admin
        </PrimaryBtn>
      </div>
    </Modal>
  );
}
