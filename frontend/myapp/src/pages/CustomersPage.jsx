import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import { useToast } from "../context/ToastContext.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Spinner from "../components/Spinner.jsx";
import Table from "../components/Table.jsx";
import { formatDateTime } from "../utils/formatters.js";
import"./Customers.css"

const PAGE_SIZE = 10;

/* =========================================================
 *  Helpers
 * ========================================================= */

/**
 * Get initials from a full name: "Ahmed Khan" → "AK".
 * Falls back to a single letter if only one word is present.
 */
const getInitials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
};

/**
 * Deterministic bucket 0–7 from a string. Same name → same avatar color.
 */
const hashBucket = (str) => {
  if (!str) return 0;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 8;
};

/**
 * Copy text to clipboard. Falls back to a hidden textarea for older
 * browsers or restricted contexts.
 */
const copyToClipboard = async (text) => {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
};

/* =========================================================
 *  Page
 * ========================================================= */

export default function CustomersPage() {
  const { showToast } = useToast();

  // ---- List state ----
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ---- Form modal ----
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // ---- Delete dialog ----
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  // ---- Load list ----
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { page, limit: PAGE_SIZE };
      if (search) params.search = search;

      const res = await api.get("/customers", { params });
      setCustomers(res.data.data);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Search ----
  const onSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  // ---- Form open/close ----
  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const submitForm = async (payload) => {
    try {
      setSaving(true);
      setFormError(null);

      if (editing) {
        await api.put(`/customers/${editing._id}`, payload);
        showToast("Customer updated", "success");
      } else {
        await api.post("/customers", payload);
        showToast("Customer created", "success");
      }

      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ---- Delete ----
  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      setDeletingBusy(true);
      await api.delete(`/customers/${deleting._id}`);
      showToast("Customer deactivated", "success");
      setDeleting(null);
      await load();
    } catch (err) {
      showToast(err.message, "error");
      setDeleting(null);
    } finally {
      setDeletingBusy(false);
    }
  };

  // ---- Copy handler ----
  const handleCopy = async (value, label) => {
    const ok = await copyToClipboard(value);
    if (ok) {
      showToast(`${label} copied`, "success", 2000);
    } else {
      showToast("Could not copy to clipboard", "error");
    }
  };

  // ---- Columns ----
  const columns = [
    {
      key: "fullName",
      label: "Customer",
      render: (row) => (
        <div className="cell-person">
          <div className={`avatar avatar-${hashBucket(row.fullName)}`}>
            {getInitials(row.fullName)}
          </div>
          <div className="cell-person-text">
            <span className="cell-primary">{row.fullName}</span>
            {row.notes && (
              <span className="cell-secondary">{row.notes}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (row) =>
        row.phone ? (
          <button
            type="button"
            className="copyable"
            onClick={() => handleCopy(row.phone, "Phone")}
            title="Click to copy"
          >
            {row.phone}
            <svg
              className="copy-icon"
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        ) : (
          <span className="empty-cell">—</span>
        ),
    },
    {
      key: "email",
      label: "Email",
      render: (row) =>
        row.email ? (
          <button
            type="button"
            className="copyable"
            onClick={() => handleCopy(row.email, "Email")}
            title="Click to copy"
          >
            {row.email}
            <svg
              className="copy-icon"
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        ) : (
          <span className="empty-cell">—</span>
        ),
    },
    {
      key: "address",
      label: "Address",
      render: (row) =>
        row.address ? (
          <span
            style={{
              display: "inline-block",
              maxWidth: 220,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              verticalAlign: "middle",
            }}
            title={row.address}
          >
            {row.address}
          </span>
        ) : (
          <span className="empty-cell">—</span>
        ),
    },
    {
      key: "createdAt",
      label: "Added",
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="row-actions">
          <Button variant="secondary" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button variant="danger" onClick={() => setDeleting(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Customers</h2>
          <p className="page-subtitle">
            {total} {total === 1 ? "customer" : "customers"}
            {search ? " (filtered)" : ""}
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          + New Customer
        </Button>
      </div>

      <form className="toolbar" onSubmit={onSearchSubmit}>
        <input
          className="input"
          placeholder="Search by name, phone, or email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {search && (
          <Button variant="secondary" onClick={clearSearch}>
            Clear
          </Button>
        )}
      </form>

      {loading && <Spinner label="Loading customers..." />}

      {error && !loading && (
        <div className="error-box">
          {error}
          <div style={{ marginTop: 8 }}>
            <Button variant="secondary" onClick={load}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          <Table
            columns={columns}
            rows={customers}
            emptyMessage={
              search
                ? "No customers match your search."
                : "No customers yet. Click 'New Customer' to add one."
            }
          />

          {pages > 1 && (
            <div className="pagination">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </Button>
              <span className="pagination-info">
                Page {page} of {pages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}

      <CustomerFormModal
        open={formOpen}
        onClose={closeForm}
        onSubmit={submitForm}
        initial={editing}
        saving={saving}
        serverError={formError}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => !deletingBusy && setDeleting(null)}
        onConfirm={confirmDelete}
        title="Deactivate customer"
        identifier={deleting?.fullName}
        message="The customer will be hidden from new sales but their past sales remain in the system for reporting. This action cannot be undone from the interface."
        confirmLabel="Deactivate"
        confirmVariant="danger"
        loading={deletingBusy}
      />
    </div>
  );
}

/* =========================================================
 *  Create / Edit form modal
 * ========================================================= */

function CustomerFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  saving,
  serverError,
}) {
  const isEdit = !!initial;

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        fullName: initial.fullName || "",
        phone: initial.phone || "",
        email: initial.email || "",
        address: initial.address || "",
        notes: initial.notes || "",
      });
    } else {
      setForm({
        fullName: "",
        phone: "",
        email: "",
        address: "",
        notes: "",
      });
    }
    setErrors({});
  }, [open, initial]);

  const setField = (key, value) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const errs = {};

    if (!form.fullName.trim()) {
      errs.fullName = "Full name is required";
    } else if (form.fullName.trim().length > 100) {
      errs.fullName = "Name cannot exceed 100 characters";
    }

    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      errs.email = "Enter a valid email address";
    }

    if (form.phone && form.phone.trim().length > 30) {
      errs.phone = "Phone cannot exceed 30 characters";
    }

    if (form.address && form.address.length > 300) {
      errs.address = "Address cannot exceed 300 characters";
    }

    if (form.notes && form.notes.length > 500) {
      errs.notes = "Notes cannot exceed 500 characters";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!validate()) return;

    onSubmit({
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim().toLowerCase(),
      address: form.address.trim(),
      notes: form.notes.trim(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Customer" : "New Customer"}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {isEdit ? "Save Changes" : "Create Customer"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field field-full">
            <Input
              label="Full name"
              name="fullName"
              value={form.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              error={errors.fullName}
              required
              autoFocus
              maxLength={100}
              placeholder="e.g. Ahmed Khan"
            />
          </div>

          <Input
            label="Phone"
            name="phone"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
            error={errors.phone}
            maxLength={30}
            placeholder="e.g. 03001234567"
          />

          <Input
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            error={errors.email}
            maxLength={100}
            placeholder="e.g. ahmed@example.com"
          />

          <div className="field field-full">
            <label htmlFor="address">Address (optional)</label>
            <input
              id="address"
              className={errors.address ? "input input-error" : "input"}
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
              maxLength={300}
              placeholder="Street, city"
            />
            {errors.address && (
              <span className="field-error">{errors.address}</span>
            )}
          </div>

          <div className="field field-full">
            <label htmlFor="notes">Notes (optional)</label>
            <textarea
              id="notes"
              className="input"
              rows={3}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              maxLength={500}
              placeholder="Internal notes about this customer"
            />
            <div className="field-hint">{form.notes.length} / 500</div>
            {errors.notes && (
              <span className="field-error">{errors.notes}</span>
            )}
          </div>
        </div>

        {serverError && <div className="error-box">{serverError}</div>}
      </form>
    </Modal>
  );
}