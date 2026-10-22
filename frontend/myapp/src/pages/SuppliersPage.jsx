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
import"./Suppliers.css"
const PAGE_SIZE = 10;

/* ---------- Helpers ---------- */

const hashBucket = (str) => {
  if (!str) return 0;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 8;
};

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

/* Small building glyph used inside every supplier avatar */
const BuildingIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01" />
  </svg>
);

/* =========================================================
 *  Page
 * ========================================================= */

export default function SuppliersPage() {
  const { showToast } = useToast();

  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { page, limit: PAGE_SIZE };
      if (search) params.search = search;

      const res = await api.get("/suppliers", { params });
      setSuppliers(res.data.data);
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

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (supplier) => {
    setEditing(supplier);
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
        await api.put(`/suppliers/${editing._id}`, payload);
        showToast("Supplier updated", "success");
      } else {
        await api.post("/suppliers", payload);
        showToast("Supplier created", "success");
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

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      setDeletingBusy(true);
      await api.delete(`/suppliers/${deleting._id}`);
      showToast("Supplier deactivated", "success");
      setDeleting(null);
      await load();
    } catch (err) {
      showToast(err.message, "error");
      setDeleting(null);
    } finally {
      setDeletingBusy(false);
    }
  };

  const handleCopy = async (value, label) => {
    const ok = await copyToClipboard(value);
    if (ok) showToast(`${label} copied`, "success", 2000);
    else showToast("Could not copy to clipboard", "error");
  };

  const columns = [
    {
      key: "name",
      label: "Supplier",
      render: (row) => (
        <div className="cell-person">
          <div className={`avatar avatar-${hashBucket(row.name)}`}>
            <BuildingIcon />
          </div>
          <div className="cell-person-text">
            <span className="cell-primary">{row.name}</span>
            {row.contactPerson && (
              <span className="cell-secondary">
                Contact: {row.contactPerson}
              </span>
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
          <h2 className="page-title">Suppliers</h2>
          <p className="page-subtitle">
            {total} {total === 1 ? "supplier" : "suppliers"}
            {search ? " (filtered)" : ""}
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          + New Supplier
        </Button>
      </div>

      <form className="toolbar" onSubmit={onSearchSubmit}>
        <input
          className="input"
          placeholder="Search by name, contact, phone, or email..."
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

      {loading && <Spinner label="Loading suppliers..." />}

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
            rows={suppliers}
            emptyMessage={
              search
                ? "No suppliers match your search."
                : "No suppliers yet. Click 'New Supplier' to add one."
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

      <SupplierFormModal
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
        title="Deactivate supplier"
        identifier={deleting?.name}
        message="The supplier will be hidden from new purchases but past purchase records remain intact for accounting. This action cannot be undone from the interface."
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

function SupplierFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  saving,
  serverError,
}) {
  const isEdit = !!initial;

  const [form, setForm] = useState({
    name: "",
    contactPerson: "",
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
        name: initial.name || "",
        contactPerson: initial.contactPerson || "",
        phone: initial.phone || "",
        email: initial.email || "",
        address: initial.address || "",
        notes: initial.notes || "",
      });
    } else {
      setForm({
        name: "",
        contactPerson: "",
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

    if (!form.name.trim()) errs.name = "Supplier name is required";
    else if (form.name.trim().length > 120)
      errs.name = "Name cannot exceed 120 characters";

    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim()))
      errs.email = "Enter a valid email address";

    if (form.phone && form.phone.trim().length > 30)
      errs.phone = "Phone cannot exceed 30 characters";

    if (form.contactPerson && form.contactPerson.length > 100)
      errs.contactPerson = "Contact person cannot exceed 100 characters";

    if (form.address && form.address.length > 300)
      errs.address = "Address cannot exceed 300 characters";

    if (form.notes && form.notes.length > 500)
      errs.notes = "Notes cannot exceed 500 characters";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!validate()) return;

    onSubmit({
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim(),
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
      title={isEdit ? "Edit Supplier" : "New Supplier"}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {isEdit ? "Save Changes" : "Create Supplier"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field field-full">
            <Input
              label="Supplier name"
              name="name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              error={errors.name}
              required
              autoFocus
              maxLength={120}
              placeholder="e.g. Global Beverages Ltd."
            />
          </div>

          <Input
            label="Contact person"
            name="contactPerson"
            value={form.contactPerson}
            onChange={(e) => setField("contactPerson", e.target.value)}
            error={errors.contactPerson}
            maxLength={100}
            placeholder="e.g. Bilal Ahmed"
          />

          <Input
            label="Phone"
            name="phone"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
            error={errors.phone}
            maxLength={30}
            placeholder="e.g. 02112345678"
          />

          <div className="field field-full">
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              error={errors.email}
              maxLength={100}
              placeholder="e.g. sales@supplier.com"
            />
          </div>

          <div className="field field-full">
            <label htmlFor="address">Business address (optional)</label>
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
              placeholder="Payment terms, delivery schedule, etc."
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