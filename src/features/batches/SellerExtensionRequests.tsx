import PrimaryBtn from "@/components/shared/PrimaryBtn";
import { extensionRequestStatus, type SellerExtensionRequest } from "@/services/extensionRequests";

const sections = [
  { status: "pending", title: "Pending", empty: "No pending extension requests." },
  { status: "expired", title: "Expired", empty: "No expired extension requests." },
  { status: "approved", title: "Approved", empty: "" },
  { status: "denied", title: "Denied", empty: "" },
] as const;

export default function SellerExtensionRequests({
  requests,
  now,
  onDecision,
}: {
  requests: SellerExtensionRequest[];
  now: number;
  onDecision: (req: SellerExtensionRequest, action: "approved" | "denied") => void;
}) {
  return (
    <div className="grid gap-5">
      {sections.map((section) => {
        const items = requests.filter((req) => extensionRequestStatus(req, now) === section.status);
        if (!items.length && !section.empty) return null;
        return (
          <section key={section.status} aria-label={`${section.title} extension requests`}>
            <h4 className="mb-2 text-sm font-semibold text-gray-900">
              {section.title} <span className="text-gray-500">({items.length})</span>
            </h4>
            {section.status === "expired" && items.length > 0 && (
              <p className="mb-3 text-xs text-gray-500">
                The payment timer ran out before these requests were decided.
              </p>
            )}
            {!items.length && <p className="text-xs text-gray-500">{section.empty}</p>}
            <div className="grid gap-3">
              {items.map((req) => (
                <article key={req.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{req.buyer}</p>
                      <p className="mt-0.5 break-words text-xs text-gray-500">
                        {req.product} · {req.batch}
                      </p>
                      <p className="text-xs text-gray-500">Requested {req.requestedAt}</p>
                      {req.reason?.trim() && (
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs text-gray-500">
                          <span className="font-semibold">Reason: </span>
                          {req.reason}
                        </p>
                      )}
                      {section.status === "expired" &&
                        req.expiresAt &&
                        Number.isFinite(Date.parse(req.expiresAt)) && (
                          <p className="mt-1 text-xs text-gray-500">
                            Deadline: {new Date(req.expiresAt).toLocaleString()}
                          </p>
                        )}
                    </div>
                    {section.status === "pending" ? (
                      <div className="flex gap-2">
                        <PrimaryBtn size="sm" onClick={() => onDecision(req, "approved")}>
                          Approve
                        </PrimaryBtn>
                        <button
                          type="button"
                          className="rounded-md border border-red-500 px-2.5 py-1 text-xs font-semibold text-red-500"
                          onClick={() => onDecision(req, "denied")}
                        >
                          Deny
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          section.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {section.title}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
