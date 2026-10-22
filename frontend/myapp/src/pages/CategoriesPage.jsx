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

const PAGE_SIZE = 10;

export default function CategoriesPage() {
  const { showToast } = useToast();

  // ---- List state ----
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ---- Form modal state ----
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // ---- Delete dialog state ----
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  // ---- Load list ----
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { page, limit: PAGE_SIZE };
      if (search) params.search = search;

      const res = await api.get("/categories", { params });
      setCategories(res.data.data);
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

  const openEdit = (category) => {
    setEditing(category);
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
        await api.put(`/categories/${editing._id}`, payload);
        showToast("Category updated", "success");
      } else {
        await api.post("/categories", payload);
        showToast("Category created", "success");
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
      await api.delete(`/categories/${deleting._id}`);
      showToast("Category deleted", "success");
      setDeleting(null);
      await load();
    } catch (err) {
      showToast(err.message, "error");
      setDeleting(null);
    } finally {
      setDeletingBusy(false);
    }
  };

  // ---- Columns ----
  const columns = [
    { key: "name", label: "Name" },
    {
      key: "description",
      label: "Description",
      render: (row) => row.description || "—",
    },
    {
      key: "createdAt",
      label: "Created",
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
          <h2 className="page-title">Categories</h2>
          <p className="page-subtitle">
            {total} {total === 1 ? "category" : "categories"} in total
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          + New Category
        </Button>
      </div>

      <form className="toolbar" onSubmit={onSearchSubmit}>
        <input
          className="input"
          placeholder="Search categories by name..."
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

      {loading && <Spinner label="Loading categories..." />}

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
            rows={categories}
            emptyMessage={
              search
                ? "No categories match your search."
                : "No categories yet. Click 'New Category' to add one."
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

      <CategoryFormModal
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
        title="Delete category"
        identifier={deleting?.name}
        message="This action cannot be undone. If any products still reference this category, the deletion will be refused."
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deletingBusy}
      />
    </div>
  );
}

/* =========================================================
 *  Create / Edit form modal
 * ========================================================= */

function CategoryFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  saving,
  serverError,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setDescription(initial?.description || "");
      setErrors({});
    }
  }, [open, initial]);

  const validate = () => {
    const errs = {};
    if (!name.trim()) {
      errs.name = "Name is required";
    } else if (name.trim().length > 60) {
      errs.name = "Name cannot exceed 60 characters";
    }
    if (description.length > 300) {
      errs.description = "Description cannot exceed 300 characters";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!validate()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit Category" : "New Category"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {initial ? "Save Changes" : "Create Category"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <Input
          label="Name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
          autoFocus
          maxLength={60}
          placeholder="e.g. Beverages"
        />

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            className="input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            placeholder="Optional — what belongs in this category"
          />
          <div className="field-hint">{description.length} / 300</div>
          {errors.description && (
            <span className="field-error">{errors.description}</span>
          )}
        </div>

        {serverError && <div className="error-box">{serverError}</div>}
      </form>
    </Modal>
  );
}