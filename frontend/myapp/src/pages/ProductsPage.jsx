import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client.js";
import { useToast } from "../context/ToastContext.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Spinner from "../components/Spinner.jsx";
import Table from "../components/Table.jsx";
import { formatCurrency } from "../utils/formatters.js";

const PAGE_SIZE = 10;
const UNITS = ["pcs", "bottle", "pack", "kg", "liter", "box", "dozen"];

export default function ProductsPage() {
  const { showToast } = useToast();
  
  // Read URL params for global search (from the topbar)
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get("search") || "";

  // ---- List state ----
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // Initialize search state with the URL param if it exists
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [search, setSearch] = useState(urlSearch);
  
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Categories for the filter + form
  const [categories, setCategories] = useState([]);

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

  // Watch URL changes (if user searches from the topbar while already on this page)
  useEffect(() => {
    if (urlSearch !== search) {
      setSearchInput(urlSearch);
      setSearch(urlSearch);
      setPage(1);
    }
  }, [urlSearch]);

  // ---- Load categories once ----
  useEffect(() => {
    let cancelled = false;
    api
      .get("/categories", { params: { limit: 100 } })
      .then((res) => {
        if (!cancelled) setCategories(res.data.data);
      })
      .catch(() => {
        // Silent fail - form will show an error if they try to submit without categories
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Load product list ----
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { page, limit: PAGE_SIZE };
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (lowStockOnly) params.lowStock = "true";

      const res = await api.get("/products", { params });
      setProducts(res.data.data);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, lowStockOnly]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Filter handlers ----
  const onSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const clearAllFilters = () => {
    setSearchInput("");
    setSearch("");
    setCategoryFilter("");
    setLowStockOnly(false);
    setPage(1);
  };

  const hasAnyFilter = !!(search || categoryFilter || lowStockOnly);

  // ---- Form open/close ----
  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
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
        await api.put(`/products/${editing._id}`, payload);
        showToast("Product updated", "success");
      } else {
        await api.post("/products", payload);
        showToast("Product created", "success");
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
      await api.delete(`/products/${deleting._id}`);
      showToast("Product deactivated", "success");
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
    {
      key: "name",
      label: "Product",
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700, color: "var(--text)" }}>{row.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {row.sku}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (row) => (
        <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>
          {row.category?.name || "—"}
        </span>
      ),
    },
    {
      key: "sellingPrice",
      label: "Price",
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700 }}>{formatCurrency(row.sellingPrice)}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            cost {formatCurrency(row.purchasePrice)}
          </div>
        </div>
      ),
    },
    {
      key: "stockQuantity",
      label: "Stock",
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700 }}>
            {row.stockQuantity} <span style={{fontSize: 12, color: "var(--text-muted)", fontWeight: 500}}>{row.unit}</span>
          </div>
          {row.isLowStock && (
            <span className="badge badge-danger" style={{ marginTop: 6 }}>
              Low · min {row.minStockLevel}
            </span>
          )}
        </div>
      ),
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
          <h2 className="page-title">Products</h2>
          <p className="page-subtitle">
            {total} {total === 1 ? "product" : "products"}
            {hasAnyFilter ? " (filtered)" : ""}
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          + New Product
        </Button>
      </div>

      <form className="toolbar" onSubmit={onSearchSubmit}>
        <input
          className="input"
          placeholder="Search by name, SKU, or barcode..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="toolbar">
        <div className="filter-chips">
          <label className={categoryFilter ? "chip chip-active" : "chip"}>
            Category:
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className={lowStockOnly ? "chip chip-active" : "chip"}
            onClick={() => {
              setLowStockOnly((v) => !v);
              setPage(1);
            }}
          >
            ⚠ Low stock only
          </button>

          {hasAnyFilter && (
            <button
              type="button"
              className="chip"
              onClick={clearAllFilters}
            >
              ✕ Clear filters
            </button>
          )}
        </div>
      </div>

      {loading && <Spinner label="Loading products..." />}

      {error && !loading && (
        <div className="error-box">
          {error}
          <div style={{ marginTop: 12 }}>
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
            rows={products}
            emptyMessage={
              hasAnyFilter
                ? "No products match your filters."
                : "No products yet. Click 'New Product' to add one."
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

      <ProductFormModal
        open={formOpen}
        onClose={closeForm}
        onSubmit={submitForm}
        initial={editing}
        categories={categories}
        saving={saving}
        serverError={formError}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => !deletingBusy && setDeleting(null)}
        onConfirm={confirmDelete}
        title="Deactivate product"
        identifier={deleting ? `${deleting.name} (${deleting.sku})` : ""}
        message="The product will be hidden from new sales but kept for historical records. This action cannot be undone from the interface."
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

function ProductFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  categories,
  saving,
  serverError,
}) {
  const isEdit = !!initial;

  const [form, setForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    category: "",
    purchasePrice: "",
    sellingPrice: "",
    stockQuantity: "0",
    minStockLevel: "5",
    unit: "pcs",
    description: "",
  });
  const [errors, setErrors] = useState({});

  // Load initial values whenever the modal opens
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        name: initial.name || "",
        sku: initial.sku || "",
        barcode: initial.barcode || "",
        category: initial.category?._id || initial.category || "",
        purchasePrice: String(initial.purchasePrice ?? ""),
        sellingPrice: String(initial.sellingPrice ?? ""),
        stockQuantity: String(initial.stockQuantity ?? "0"),
        minStockLevel: String(initial.minStockLevel ?? "5"),
        unit: initial.unit || "pcs",
        description: initial.description || "",
      });
    } else {
      setForm({
        name: "",
        sku: "",
        barcode: "",
        category: categories[0]?._id || "",
        purchasePrice: "",
        sellingPrice: "",
        stockQuantity: "0",
        minStockLevel: "5",
        unit: "pcs",
        description: "",
      });
    }
    setErrors({});
  }, [open, initial, categories]);

  const setField = (key, value) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.sku.trim()) errs.sku = "SKU is required";
    if (!form.category) errs.category = "Category is required";

    const pp = Number(form.purchasePrice);
    if (!Number.isFinite(pp) || pp < 0)
      errs.purchasePrice = "Must be a non-negative number";

    const sp = Number(form.sellingPrice);
    if (!Number.isFinite(sp) || sp < 0)
      errs.sellingPrice = "Must be a non-negative number";

    const ms = Number(form.minStockLevel);
    if (!Number.isFinite(ms) || ms < 0)
      errs.minStockLevel = "Must be a non-negative number";

    if (!isEdit) {
      const sq = Number(form.stockQuantity);
      if (!Number.isInteger(sq) || sq < 0)
        errs.stockQuantity = "Must be a non-negative whole number";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim() || null,
      category: form.category,
      purchasePrice: Number(form.purchasePrice),
      sellingPrice: Number(form.sellingPrice),
      minStockLevel: Number(form.minStockLevel),
      unit: form.unit,
      description: form.description.trim(),
    };

    // Only send stockQuantity on create — the backend refuses it on update
    if (!isEdit) {
      payload.stockQuantity = Number(form.stockQuantity);
    }

    onSubmit(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Product" : "New Product"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {isEdit ? "Save Changes" : "Create Product"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field field-full">
            <Input
              label="Product name"
              name="name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              error={errors.name}
              required
              autoFocus
              maxLength={120}
              placeholder="e.g. Coca-Cola 500ml"
            />
          </div>

          <Input
            label="SKU"
            name="sku"
            value={form.sku}
            onChange={(e) => setField("sku", e.target.value)}
            error={errors.sku}
            required
            maxLength={40}
            placeholder="e.g. BEV-CC-500"
          />

          <Input
            label="Barcode (optional)"
            name="barcode"
            value={form.barcode}
            onChange={(e) => setField("barcode", e.target.value)}
            maxLength={40}
            placeholder="e.g. 5449000000996"
          />

          <div className="field">
            <label htmlFor="category">
              Category<span className="required"> *</span>
            </label>
            <select
              id="category"
              className={errors.category ? "input input-error" : "input"}
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
            >
              <option value="">— Select a category —</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.category && (
              <span className="field-error">{errors.category}</span>
            )}
            {categories.length === 0 && (
              <span className="field-hint">
                Create a category first
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="unit">Unit</label>
            <select
              id="unit"
              className="input"
              value={form.unit}
              onChange={(e) => setField("unit", e.target.value)}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Purchase price"
            name="purchasePrice"
            type="number"
            step="0.01"
            min="0"
            value={form.purchasePrice}
            onChange={(e) => setField("purchasePrice", e.target.value)}
            error={errors.purchasePrice}
            required
            placeholder="0.00"
          />

          <Input
            label="Selling price"
            name="sellingPrice"
            type="number"
            step="0.01"
            min="0"
            value={form.sellingPrice}
            onChange={(e) => setField("sellingPrice", e.target.value)}
            error={errors.sellingPrice}
            required
            placeholder="0.00"
          />

          <Input
            label="Minimum stock level"
            name="minStockLevel"
            type="number"
            step="1"
            min="0"
            value={form.minStockLevel}
            onChange={(e) => setField("minStockLevel", e.target.value)}
            error={errors.minStockLevel}
            placeholder="5"
          />

          {!isEdit && (
            <Input
              label="Initial stock quantity"
              name="stockQuantity"
              type="number"
              step="1"
              min="0"
              value={form.stockQuantity}
              onChange={(e) => setField("stockQuantity", e.target.value)}
              error={errors.stockQuantity}
              placeholder="0"
            />
          )}

          {isEdit && (
            <div className="field">
              <label>Current stock</label>
              <div
                className="input"
                style={{
                  background: "var(--bg-soft)",
                  color: "var(--text-muted)",
                  cursor: "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
                title="Stock is adjusted through sales and purchases, not manually."
              >
                <span>
                  {initial.stockQuantity} {initial.unit}
                </span>
                <span style={{ fontSize: 12 }}>read-only</span>
              </div>
              <span className="field-hint">
                Adjusted through sales and purchases
              </span>
            </div>
          )}

          <div className="field field-full">
            <label htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              className="input"
              rows={3}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              maxLength={500}
              placeholder="Optional notes about this product"
            />
            <div className="field-hint">{form.description.length} / 500</div>
          </div>
        </div>

        {serverError && <div className="error-box">{serverError}</div>}
      </form>
    </Modal>
  );
}