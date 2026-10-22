import Modal from "./Modal.jsx";
import Button from "./Button.jsx";

/**
 * Specialized modal for "are you sure?" confirmations.
 *
 * Props:
 *   open, onClose, onConfirm
 *   title, message, identifier
 *   confirmLabel, cancelLabel, confirmVariant
 *   loading
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  identifier,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
  loading = false,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={loading ? () => {} : onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {identifier && (
        <p className="confirm-identifier">
          <strong>{identifier}</strong>
        </p>
      )}
      <p>{message}</p>
    </Modal>
  );
}