import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client.js";
import { useToast } from "../context/ToastContext.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Spinner from "../components/Spinner.jsx";
import Table from "../components/Table.jsx";
import { formatCurrency, formatDateTime } from "../utils/formatters.js";

const PAGE_SIZE = 10;
const PAYMENT_METHODS = ["cash", "card", "bank-transfer", "credit"];

const round2 = (n) => Math.round(n * 100) / 100;

/* =========================================================
 *  Status badge
 * ========================================================= */

const StatusBadge = ({ status }) => {
  const map = {
    pending: "badge badge-warning",
    received: "badge badge-success",
    cancelled: "badge badge-neutral",
  };
  const label = {
    pending: "Pending",
    received: "Received",
    cancelled: "Cancelled",
  };
  return <span className={map[status] || "badge"}>{label[status] || status}</span>;
};

/* =========================================================
 *  Page
 * ========================================================= */

export default function PurchasesPage() {
  const { showToast } = useToast();

  // ---- List state ----
  const [purchases, setPurchases] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ---- Reference data ----
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  // ---- Form modal ----
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // ---- Receive dialog ----
  const [receiving, setReceiving] = useState(null);
  const [receivingBusy, setReceivingBusy] = useState(false);

  // ---- Cancel dialog ----
  const [cancelling, setCancelling] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancellingBusy, setCancellingBusy] = useState(false);

  // ---- Load reference data (suppliers + products) once ----
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.get("/suppliers", { params: { limit: 100 } }),
      api.get("/products", { params: { limit: 100 } }),
    ])
      .then(([suppliersRes, productsRes]) => {
        if (cancelled) return;
        setSuppliers(suppliersRes.data.data);
        setProducts(productsRes.data.data);
      })
      .catch(() => {
        // Errors surface later if the user tries to use the form
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Load purchases ----
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { page, limit: PAGE_SIZE };
      if (search) params.search = search;
      if (statusFilter !== "all") params.status = statusFilter;
      if (supplierFilter) params.supplier = supplierFilter;

      const res = await api.get("/purchases", { params });
      setPurchases(res.data.data);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, supplierFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Filters ----
  const onSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const clearAllFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("all");
    setSupplierFilter("");
    setPage(1);
  };

  const hasAnyFilter =
    !!search || statusFilter !== "all" || !!supplierFilter;

  // ---- Form actions ----
  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (purchase) => {
    if (purchase.status === "cancelled") {
      showToast("Cancelled purchases cannot be edited", "error");
      return;
    }
    setEditing(purchase);
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
        await api.put(`/purchases/${editing._id}`, payload);
        showToast("Purchase updated", "success");
      } else {
        await api.post("/purchases", payload);
        showToast("Purchase created (pending — receive to add stock)", "success");
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

  // ---- Receive ----
  const confirmReceive = async () => {
    if (!receiving) return;
    try {
      setReceivingBusy(true);
      await api.patch(`/purchases/${receiving._id}/receive`);
      showToast("Purchase received — stock has been increased", "success");
      setReceiving(null);
      await load();
    } catch (err) {
      showToast(err.message, "error");
      setReceiving(null);
    } finally {
      setReceivingBusy(false);
    }
  };

  // ---- Cancel ----
  const confirmCancel = async () => {
    if (!cancelling) return;
    try {
      setCancellingBusy(true);
      await api.patch(`/purchases/${cancelling._id}/cancel`, {
        reason: cancelReason.trim(),
      });
      showToast(
        cancelling.stockApplied
          ? "Purchase cancelled — stock has been reversed"
          : "Purchase cancelled",
        "success"
      );
      setCancelling(null);
      setCancelReason("");
      await load();
    } catch (err) {
      showToast(err.message, "error");
      setCancelling(null);
    } finally {
      setCancellingBusy(false);
    }
  };

  // ---- Columns ----
  const columns = [
    {
      key: "purchaseNumber",
      label: "Purchase #",
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.purchaseNumber}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {formatDateTime(row.createdAt)}
          </div>
        </div>
      ),
    },
    {
      key: "supplierName",
      label: "Supplier",
      render: (row) => row.supplierName || "—",
    },
    {
      key: "items",
      label: "Items",
      render: (row) => (
        <span style={{ color: "var(--text-muted)" }}>
          {row.items?.length || 0}{" "}
          {row.items?.length === 1 ? "item" : "items"}
        </span>
      ),
    },
    {
      key: "total",
      label: "Total",
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700 }}>{formatCurrency(row.total)}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
            paid {formatCurrency(row.amountPaid)} · due{" "}
            {formatCurrency(row.balance)}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => {
        if (row.status === "cancelled") {
          return (
            <span className="empty-cell" style={{ fontSize: 12 }}>
              —
            </span>
          );
        }
        return (
          <div className="row-actions">
            {row.status === "pending" && (
              <Button
                variant="primary"
                className="btn-icon"
                onClick={() => setReceiving(row)}
              >
                Receive
              </Button>
            )}
            <Button
              variant="secondary"
              className="btn-icon"
              onClick={() => openEdit(row)}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              className="btn-icon"
              onClick={() => {
                setCancelling(row);
                setCancelReason("");
              }}
            >
              Cancel
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Purchases</h2>
          <p className="page-subtitle">
            {total} {total === 1 ? "purchase" : "purchases"}
            {hasAnyFilter ? " (filtered)" : ""}
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          + New Purchase
        </Button>
      </div>

      <form className="toolbar" onSubmit={onSearchSubmit}>
        <input
          className="input"
          placeholder="Search by purchase number..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="toolbar">
        <div className="filter-chips">
          <button
            type="button"
            className={statusFilter === "all" ? "chip chip-active" : "chip"}
            onClick={() => {
              setStatusFilter("all");
              setPage(1);
            }}
          >
            All
          </button>
          <button
            type="button"
            className={
              statusFilter === "pending" ? "chip chip-active" : "chip"
            }
            onClick={() => {
              setStatusFilter("pending");
              setPage(1);
            }}
          >
            Pending
          </button>
          <button
            type="button"
            className={
              statusFilter === "received" ? "chip chip-active" : "chip"
            }
            onClick={() => {
              setStatusFilter("received");
              setPage(1);
            }}
          >
            Received
          </button>
          <button
            type="button"
            className={
              statusFilter === "cancelled" ? "chip chip-active" : "chip"
            }
            onClick={() => {
              setStatusFilter("cancelled");
              setPage(1);
            }}
          >
            Cancelled
          </button>

          <label className={supplierFilter ? "chip chip-active" : "chip"}>
            Supplier:
            <select
              value={supplierFilter}
              onChange={(e) => {
                setSupplierFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

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

      {loading && <Spinner label="Loading purchases..." />}

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
            rows={purchases}
            emptyMessage={
              hasAnyFilter
                ? "No purchases match your filters."
                : "No purchases yet. Click 'New Purchase' to record one."
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

      <PurchaseFormModal
        open={formOpen}
        onClose={closeForm}
        onSubmit={submitForm}
        initial={editing}
        suppliers={suppliers}
        products={products}
        saving={saving}
        serverError={formError}
      />

      <ConfirmDialog
        open={!!receiving}
        onClose={() => !receivingBusy && setReceiving(null)}
        onConfirm={confirmReceive}
        title="Receive purchase"
        identifier={receiving?.purchaseNumber}
        message={
          receiving
            ? `Receiving this purchase will increase stock for ${receiving.items?.length || 0} item(s). This cannot be undone except by cancelling the purchase.`
            : ""
        }
        confirmLabel="Receive & add to stock"
        confirmVariant="primary"
        loading={receivingBusy}
      />

      <Modal
        open={!!cancelling}
        onClose={() => !cancellingBusy && setCancelling(null)}
        title="Cancel purchase"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCancelling(null)}
              disabled={cancellingBusy}
            >
              Keep purchase
            </Button>
            <Button
              variant="danger"
              onClick={confirmCancel}
              loading={cancellingBusy}
            >
              Confirm cancellation
            </Button>
          </>
        }
      >
        <p className="confirm-identifier">
          <strong>{cancelling?.purchaseNumber}</strong>
        </p>
        {cancelling?.status === "received" && (
          <div
            className="error-box"
            style={{ marginBottom: 14 }}
          >
            This purchase was already received. Cancelling will <b>reverse the
            stock</b> that was added. If any of those units have already been
            sold, the cancellation will be refused.
          </div>
        )}
        <p style={{ marginTop: 0 }}>
          The purchase record is preserved for audit; it is not deleted.
        </p>
        <div className="field">
          <label htmlFor="cancelReason">Reason (optional)</label>
          <textarea
            id="cancelReason"
            className="input"
            rows={2}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Supplier shipped wrong items"
            maxLength={500}
          />
        </div>
      </Modal>
    </div>
  );
}

/* =========================================================
 *  Create / Edit form modal
 * ========================================================= */

function PurchaseFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  suppliers,
  products,
  saving,
  serverError,
}) {
  const isEdit = !!initial;

  const [supplier, setSupplier] = useState("");
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [errors, setErrors] = useState({});

  const emptyRow = () => ({
    product: "",
    quantity: "1",
    purchasePrice: "",
  });

  // Load initial values when the modal opens
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setSupplier(initial.supplier?._id || initial.supplier || "");
      setItems(
        (initial.items || []).map((it) => ({
          product: it.product?._id || it.product || "",
          quantity: String(it.quantity),
          purchasePrice: String(it.purchasePrice),
        }))
      );
      setDiscount(String(initial.discount ?? 0));
      setTax(String(initial.tax ?? 0));
      setAmountPaid(String(initial.amountPaid ?? 0));
      setPaymentMethod(initial.paymentMethod || "cash");
    } else {
      setSupplier(suppliers[0]?._id || "");
      setItems([emptyRow()]);
      setDiscount("0");
      setTax("0");
      setAmountPaid("0");
      setPaymentMethod("cash");
    }
    setErrors({});
  }, [open, initial, suppliers]);

  /* ---------- Row helpers ---------- */

  const updateRow = (index, patch) =>
    setItems((rows) =>
      rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );

  const addRow = () => setItems((rows) => [...rows, emptyRow()]);

  const removeRow = (index) =>
    setItems((rows) =>
      rows.length > 1 ? rows.filter((_, i) => i !== index) : rows
    );

  const handleProductChange = (index, productId) => {
    const p = products.find((x) => x._id === productId);
    updateRow(index, {
      product: productId,
      // Prefill purchase price from the product, but keep it editable
      purchasePrice: p ? String(p.purchasePrice) : "",
    });
  };

  /* ---------- Totals (client preview; backend recalculates) ---------- */

  const totals = useMemo(() => {
    const subtotal = round2(
      items.reduce((sum, it) => {
        const q = Number(it.quantity) || 0;
        const p = Number(it.purchasePrice) || 0;
        return sum + q * p;
      }, 0)
    );
    const d = Number(discount) || 0;
    const t = Number(tax) || 0;
    const paid = Number(amountPaid) || 0;
    const total = round2(subtotal - d + t);
    const balance = round2(Math.max(0, total - paid));
    return { subtotal, total, balance };
  }, [items, discount, tax, amountPaid]);

  /* ---------- Validation ---------- */

  const validate = () => {
    const errs = {};

    if (!supplier) errs.supplier = "Supplier is required";

    if (!items.length) errs.items = "Add at least one item";

    items.forEach((it, i) => {
      if (!it.product) errs[`item-${i}`] = `Row ${i + 1}: select a product`;
      else if (
        !Number.isInteger(Number(it.quantity)) ||
        Number(it.quantity) < 1
      )
        errs[`item-${i}`] =
          `Row ${i + 1}: quantity must be a whole number ≥ 1`;
      else if (
        !Number.isFinite(Number(it.purchasePrice)) ||
        Number(it.purchasePrice) < 0
      )
        errs[`item-${i}`] =
          `Row ${i + 1}: price must be a non-negative number`;
    });

    const d = Number(discount);
    if (!Number.isFinite(d) || d < 0)
      errs.discount = "Discount must be a non-negative number";
    else if (d > totals.subtotal)
      errs.discount = "Discount cannot exceed the subtotal";

    const t = Number(tax);
    if (!Number.isFinite(t) || t < 0)
      errs.tax = "Tax must be a non-negative number";

    const p = Number(amountPaid);
    if (!Number.isFinite(p) || p < 0)
      errs.amountPaid = "Amount paid must be a non-negative number";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!validate()) return;

    onSubmit({
      supplier,
      items: items.map((it) => ({
        product: it.product,
        quantity: Number(it.quantity),
        purchasePrice: Number(it.purchasePrice),
      })),
      discount: Number(discount),
      tax: Number(tax),
      amountPaid: Number(amountPaid),
      paymentMethod,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Purchase" : "New Purchase"}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {isEdit ? "Save Changes" : "Create Purchase"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {/* ---------- Header fields ---------- */}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="supplier">
              Supplier<span className="required"> *</span>
            </label>
            <select
              id="supplier"
              className={errors.supplier ? "input input-error" : "input"}
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            >
              <option value="">— Select a supplier —</option>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
            {errors.supplier && (
              <span className="field-error">{errors.supplier}</span>
            )}
          </div>

          <div className="field">
            <label htmlFor="paymentMethod">Payment method</label>
            <select
              id="paymentMethod"
              className="input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ---------- Line items ---------- */}
        <div className="field">
          <label>Items</label>

          <div className="line-items">
            <div className="line-items-head">
              <span>Product</span>
              <span>Qty</span>
              <span>Unit price</span>
              <span style={{ textAlign: "right" }}>Subtotal</span>
              <span />
            </div>

            {items.map((row, i) => {
              const sub = round2(
                (Number(row.quantity) || 0) *
                  (Number(row.purchasePrice) || 0)
              );
              return (
                <div className="line-items-row" key={i}>
                  <select
                    className="input"
                    value={row.product}
                    onChange={(e) =>
                      handleProductChange(i, e.target.value)
                    }
                  >
                    <option value="">— Select product —</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} · {p.sku}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="input"
                    value={row.quantity}
                    onChange={(e) =>
                      updateRow(i, { quantity: e.target.value })
                    }
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    value={row.purchasePrice}
                    onChange={(e) =>
                      updateRow(i, { purchasePrice: e.target.value })
                    }
                  />

                  <div className="line-item-subtotal">
                    {formatCurrency(sub)}
                  </div>

                  <button
                    type="button"
                    className="line-item-remove"
                    onClick={() => removeRow(i)}
                    disabled={items.length === 1}
                    title={
                      items.length === 1
                        ? "At least one item is required"
                        : "Remove this item"
                    }
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <Button
            variant="secondary"
            className="add-line-btn"
            onClick={addRow}
          >
            + Add item
          </Button>

          {Object.entries(errors)
            .filter(([k]) => k.startsWith("item-"))
            .map(([k, v]) => (
              <div key={k} className="field-error" style={{ marginTop: 4 }}>
                {v}
              </div>
            ))}
        </div>

        {/* ---------- Discount / tax / paid / totals ---------- */}
        <div className="form-grid" style={{ alignItems: "start" }}>
          <div>
            <Input
              label="Discount"
              name="discount"
              type="number"
              step="0.01"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              error={errors.discount}
            />
            <Input
              label="Tax"
              name="tax"
              type="number"
              step="0.01"
              min="0"
              value={tax}
              onChange={(e) => setTax(e.target.value)}
              error={errors.tax}
            />
            <Input
              label="Amount paid"
              name="amountPaid"
              type="number"
              step="0.01"
              min="0"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              error={errors.amountPaid}
            />
          </div>

          <div className="totals-panel">
            <div className="totals-row">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="totals-row">
              <span>Discount</span>
              <span>− {formatCurrency(Number(discount) || 0)}</span>
            </div>
            <div className="totals-row">
              <span>Tax</span>
              <span>+ {formatCurrency(Number(tax) || 0)}</span>
            </div>
            <div className="totals-row totals-grand">
              <span>Total</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
            <div
              className={
                totals.balance > 0
                  ? "totals-row totals-balance"
                  : "totals-row totals-settled"
              }
            >
              <span>{totals.balance > 0 ? "Balance due" : "Settled"}</span>
              <span>{formatCurrency(totals.balance)}</span>
            </div>
          </div>
        </div>

        {serverError && <div className="error-box">{serverError}</div>}

        {isEdit && initial?.status === "received" && (
          <div
            className="error-box"
            style={{
              background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
              borderColor: "#fde68a",
              color: "#92400e",
            }}
          >
            This purchase has already been received. Editing will
            <b> reverse the old stock and apply the new stock</b>. If any of
            the old items have been sold, the edit may be refused.
          </div>
        )}
      </form>
    </Modal>
  );
}