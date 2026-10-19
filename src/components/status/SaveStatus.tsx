import type { SaveStatus } from "@/lib/client/saveQueue";

export function SaveStatusBar({
  status,
  message,
  storageNote,
  onRetry
}: {
  status: SaveStatus | "guest";
  message?: string | null;
  storageNote?: string | null;
  onRetry?: () => void;
}) {
  const label =
    status === "guest"
      ? "Device draft"
      : status === "saved"
        ? "Saved"
        : status === "saving"
          ? "Saving…"
          : status === "unsaved"
            ? "Unsaved"
            : status === "conflict"
              ? "Newer saved copy exists"
              : status === "rejected"
                ? "Save rejected"
                : "Save unconfirmed";

  return (
    <div className={`save-status save-status-${status}`} role="status">
      <p>
        <span className="tiny">{label}</span>
        {message ? <span className="save-status-msg">{message}</span> : null}
        {storageNote ? <span className="save-status-msg">{storageNote}</span> : null}
      </p>
      <div className="row">
        {(status === "uncertain" || status === "rejected") && onRetry ? (
          <button className="btn btn-ghost btn-compact" type="button" onClick={onRetry}>
            Retry save
          </button>
        ) : null}
      </div>
    </div>
  );
}
