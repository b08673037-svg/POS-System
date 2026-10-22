export default function Toast({ message, type = "info", onClose }) {
  return (
    <div className={`toast toast-${type}`} role="status">
      <span className="toast-message">{message}</span>
      <button
        type="button"
        className="toast-close"
        onClick={onClose}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}