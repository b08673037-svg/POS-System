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
import { printInvoice } from "../utils/printInvoice.js";

const PAGE_SIZE = 10;
const PAYMENT_METHODS = ["cash", "card", "bank-transfer", "credit"];

const round2 = (n) => Math.round(n * 100) / 100;

/* =========================================================
 *  Status badges
 * ========================================================= */

const SaleStatusBadge = ({ status }) => (
  <span
    className={
      status === "cancelled" ? "badge badge-neutral" : "badge badge-success"
    }
  >
    {status === "cancelled" ? "Cancelled" : "Completed"}
  </span>
);

const PaymentStatusBadge = ({ status }) => {
  const map = {
    paid: "badge badge-success",
    partial: "badge badge-warning",
    unpaid: "badge badge-danger",
  };
  return (
    <span className={map[status] || "badge badge-neutral"}>
      {status || "—"}
    </span>
  );
};

/* =========================================================
 *  Invoice HTML builder
 * ========================================================= */

const buildInvoiceHtml = (sale) => {
  const rows = (sale.items || [])
    .map(
      (it) => `
      <tr>
        <td>
          <div style="font-weight:600">${escapeHtml(it.name)}</div>
          <div style="font-size:11px;color:#666">${escapeHtml(it.sku)}</div>
        </td>
        <td class="num">${it.quantity}</td>
        <td class="num">${formatCurrency(it.sellingPrice)}</td>
        <td class="num">${formatCurrency(it.subtotal)}</td>
      </tr>`
    )
    .join("");

  const balanceRow =
    sale.balance > 0
      ? `<div class="print-totals-row balance"><span>Balance due</span><span>${formatCurrency(sale.balance)}</span></div>`
      : `<div class="print-totals-row settled"><span>Settled</span><span>${formatCurrency(0)}</span></div>`;

  return `
  <div class="print-root">
    <div class="print-header">
      <div class="print-brand">
        POS SYSTEM
        <small>Point of Sale</small>
      </div>
      <div class="print-title">
        <h1>Invoice</h1>
        <div class="print-inv">${escapeHtml(sale.invoiceNumber)}</div>
        <div class="print-date">${formatDateTime(sale.createdAt)}</div>
      </div>
    </div>

    <div class="print-meta">
      <div class="print-meta-block">
        <h3>Customer</h3>
        <p>
          <strong>${escapeHtml(sale.customerName || "Walk-in Customer")}</strong><br/>
          ${sale.customerPhone ? escapeHtml(sale.customerPhone) : ""}
        </p>
      </div>
      <div class="print-meta-block">
        <h3>Payment</h3>
        <p>
          Method: <strong>${escapeHtml(sale.paymentMethod || "cash")}</strong><br/>
          Status: <strong>${escapeHtml(sale.paymentStatus || "paid")}</strong>
        </p>
      </div>
    </div>

    <table class="print-table">
      <thead>
        <tr>
          <th>Item</th>
          <th class="num">Qty</th>
          <th class="num">Price</th>
          <th class="num">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="print-totals">
      <div class="print-totals-inner">
        <div class="print-totals-row"><span>Subtotal</span><span>${formatCurrency(sale.subtotal)}</span></div>
        <div class="print-totals-row"><span>Discount</span><span>− ${formatCurrency(sale.discount)}</span></div>
        <div class="print-totals-row"><span>Tax</span><span>+ ${formatCurrency(sale.tax)}</span></div>
        <div class="print-totals-row grand"><span>Total</span><span>${formatCurrency(sale.total)}</span></div>
        <div class="print-totals-row"><span>Amount paid</span><span>${formatCurrency(sale.amountPaid)}</span></div>
        ${balanceRow}
      </div>
    </div>

    <div class="print-footer">
      Thank you for your business.
    </div>
  </div>`;
};

/** Minimal HTML escaping for user-supplied strings in the print template. */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================================================
 *  Page
 * ========================================================= */

export default function SalesPage() {
  const { showToast } = useToast();

  // ---- List state ----
  const [sales, setSales] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ---- Reference data ----
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  // ---- Form modal ----
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // ---- Cancel dialog ----
  const [cancelling, setCancelling] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancellingBusy, setCancellingBusy] = useState(false);

  // ---- Load reference data ----
  const refreshReferenceData = useCallback(async () => {
    try {
      const [customersRes, productsRes] = await Promise.all([
        api.get("/customers", { params: { limit: 100 } }),
        api.get("/products", { params: { limit: 100 } }),
      ]);
      setCustomers(customersRes.data.data);
      setProducts(productsRes.data.data);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    refreshReferenceData();
  }, [refreshReferenceData]);

  // ---- Load sales list ----
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { page, limit: PAGE_SIZE };
      if (search) params.search = search;
      if (statusFilter !== "all") params.status = statusFilter;
      if (paymentStatusFilter !== "all")
        params.paymentStatus = paymentStatusFilter;
      if (paymentMethodFilter !== "all")
        params.paymentMethod = paymentMethodFilter;
      if (customerFilter) params.customer = customerFilter;

      const res = await api.get("/sales", { params });
      setSales(res.data.data);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    search,
    statusFilter,
    paymentStatusFilter,
    paymentMethodFilter,
    customerFilter,
  ]);

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
    setPaymentStatusFilter("all");
    setPaymentMethodFilter("all");
    setCustomerFilter("");
    setPage(1);
  };

  const hasAnyFilter =
    !!search ||
    statusFilter !== "all" ||
    paymentStatusFilter !== "all" ||
    paymentMethodFilter !== "all" ||
    !!customerFilter;

  // ---- Form actions ----
  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (sale) => {
    if (sale.status === "cancelled") {
      showToast("Cancelled sales cannot be edited", "error");
      return;
    }
    setEditing(sale);
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
        await api.put(`/sales/${editing._id}`, payload);
        showToast("Sale updated", "success");
      } else {
        await api.post("/sales", payload);
        showToast("Sale recorded", "success");
      }

      setFormOpen(false);
      setEditing(null);
      await Promise.all([load(), refreshReferenceData()]);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ---- Cancel ----
  const confirmCancel = async () => {
    if (!cancelling) return;
    try {
      setCancellingBusy(true);
      await api.patch(`/sales/${cancelling._id}/cancel`, {
        reason: cancelReason.trim(),
      });
      showToast("Sale cancelled — stock restored", "success");
      setCancelling(null);
      setCancelReason("");
      await Promise.all([load(), refreshReferenceData()]);
    } catch (err) {
      showToast(err.message, "error");
      setCancelling(null);
    } finally {
      setCancellingBusy(false);
    }
  };

  // ---- Print ----
  const handlePrint = (sale) => {
    printInvoice(buildInvoiceHtml(sale));
  };

  // ---- Columns ----
  const columns = [
    {
      key: "invoiceNumber",
      label: "Invoice #",
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.invoiceNumber}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {formatDateTime(row.createdAt)}
          </div>
        </div>
      ),
    },
    {
      key: "customerName",
      label: "Customer",
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.customerName}</div>
          {row.customerPhone && (
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
              {row.customerPhone}
            </div>
          )}
        </div>
      ),
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
      key: "paymentMethod",
      label: "Payment",
      render: (row) => (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: 12.5, textTransform: "capitalize" }}>
            {row.paymentMethod}
          </span>
          <PaymentStatusBadge status={row.paymentStatus} />
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <SaleStatusBadge status={row.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="row-actions">
          <Button
            variant="secondary"
            className="btn-icon"
            onClick={() => handlePrint(row)}
          >
            Print
          </Button>
          {row.status === "completed" && (
            <>
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
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Sales</h2>
          <p className="page-subtitle">
            {total} {total === 1 ? "sale" : "sales"}
            {hasAnyFilter ? " (filtered)" : ""}
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          + New Sale
        </Button>
      </div>

      <form className="toolbar" onSubmit={onSearchSubmit}>
        <input
          className="input"
          placeholder="Search by invoice number..."
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
              statusFilter === "completed" ? "chip chip-active" : "chip"
            }
            onClick={() => {
              setStatusFilter("completed");
              setPage(1);
            }}
          >
            Completed
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

          <label
            className={
              paymentStatusFilter !== "all" ? "chip chip-active" : "chip"
            }
          >
            Payment:
            <select
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </label>

          <label
            className={
              paymentMethodFilter !== "all" ? "chip chip-active" : "chip"
            }
          >
            Method:
            <select
              value={paymentMethodFilter}
              onChange={(e) => {
                setPaymentMethodFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className={customerFilter ? "chip chip-active" : "chip"}>
            Customer:
            <select
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.fullName}
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

      {loading && <Spinner label="Loading sales..." />}

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
            rows={sales}
            emptyMessage={
              hasAnyFilter
                ? "No sales match your filters."
                : "No sales yet. Click 'New Sale' to record one."
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

      <SaleFormModal
        open={formOpen}
        onClose={closeForm}
        onSubmit={submitForm}
        initial={editing}
        customers={customers}
        products={products}
        saving={saving}
        serverError={formError}
      />

      <Modal
        open={!!cancelling}
        onClose={() => !cancellingBusy && setCancelling(null)}
        title="Cancel sale"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCancelling(null)}
              disabled={cancellingBusy}
            >
              Keep sale
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
          <strong>{cancelling?.invoiceNumber}</strong>
        </p>
        <div className="error-box" style={{ marginBottom: 14 }}>
          Cancelling this sale will <b>restore the stock</b> for every item.
          The record is preserved for audit — the sale is not deleted.
        </div>
        <div className="field">
          <label htmlFor="cancelReason">Reason (optional)</label>
          <textarea
            id="cancelReason"
            className="input"
            rows={2}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Customer changed their mind"
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

function SaleFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  customers,
  products,
  saving,
  serverError,
}) {
  const isEdit = !!initial;

  const [customer, setCustomer] = useState(""); // "" → walk-in
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [errors, setErrors] = useState({});

  const emptyRow = () => ({
    product: "",
    quantity: "1",
    sellingPrice: "",
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setCustomer(initial.customer?._id || initial.customer || "");
      setItems(
        (initial.items || []).map((it) => ({
          product: it.product?._id || it.product || "",
          quantity: String(it.quantity),
          sellingPrice: String(it.sellingPrice),
        }))
      );
      setDiscount(String(initial.discount ?? 0));
      setTax(String(initial.tax ?? 0));
      setAmountPaid(String(initial.amountPaid ?? 0));
      setPaymentMethod(initial.paymentMethod || "cash");
    } else {
      setCustomer("");
      setItems([emptyRow()]);
      setDiscount("0");
      setTax("0");
      setAmountPaid("0");
      setPaymentMethod("cash");
    }
    setErrors({});
  }, [open, initial]);

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
      sellingPrice: p ? String(p.sellingPrice) : "",
    });
  };

  /* ---------- Totals ---------- */

  const totals = useMemo(() => {
    const subtotal = round2(
      items.reduce((sum, it) => {
        const q = Number(it.quantity) || 0;
        const p = Number(it.sellingPrice) || 0;
        return sum + q * p;
      }, 0)
    );
    const d = Number(discount) || 0;
    const t = Number(tax) || 0;
    const paid = Number(amountPaid) || 0;
    const total = round2(subtotal - d + t);
    const balance = round2(Math.max(0, total - paid));
    const paymentStatus =
      paid <= 0 ? "unpaid" : paid < total ? "partial" : "paid";
    return { subtotal, total, balance, paymentStatus };
  }, [items, discount, tax, amountPaid]);

  /* ---------- Stock availability helper ---------- */

  const availableStock = (productId) => {
    const p = products.find((x) => x._id === productId);
    return p ? p.stockQuantity : 0;
  };

  /* ---------- Validation ---------- */

  const validate = () => {
    const errs = {};

    if (!items.length) errs.items = "Add at least one item";

    items.forEach((it, i) => {
      if (!it.product) {
        errs[`item-${i}`] = `Row ${i + 1}: select a product`;
        return;
      }
      const qty = Number(it.quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        errs[`item-${i}`] = `Row ${i + 1}: quantity must be a whole number ≥ 1`;
        return;
      }
      if (!Number.isFinite(Number(it.sellingPrice)) || Number(it.sellingPrice) < 0) {
        errs[`item-${i}`] = `Row ${i + 1}: price must be a non-negative number`;
        return;
      }
      // Client-side oversell check. On edit, we add back the old quantity
      // for the same product so the user is not falsely blocked.
      const available = availableStock(it.product);
      let allowed = available;
      if (isEdit) {
        const old = (initial.items || []).find(
          (x) => String(x.product?._id || x.product) === String(it.product)
        );
        if (old) allowed = available + old.quantity;
      }
      if (qty > allowed) {
        errs[`item-${i}`] = `Row ${i + 1}: only ${allowed} in stock`;
      }
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

    const payload = {
      items: items.map((it) => ({
        product: it.product,
        quantity: Number(it.quantity),
      })),
      discount: Number(discount),
      tax: Number(tax),
      amountPaid: Number(amountPaid),
      paymentMethod,
    };
    if (customer) payload.customer = customer;

    onSubmit(payload);
  };

  /* ---------- Render ---------- */

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Sale" : "New Sale"}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {isEdit ? "Save Changes" : "Complete Sale"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {/* ---------- Header ---------- */}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="customer">Customer</label>
            <select
              id="customer"
              className="input"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            >
              <option value="">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.fullName}
                  {c.phone ? ` · ${c.phone}` : ""}
                </option>
              ))}
            </select>
            <span className="field-hint">
              Leave as walk-in for an unregistered customer
            </span>
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
                  (Number(row.sellingPrice) || 0)
              );
              const stock = row.product ? availableStock(row.product) : null;
              const stockClass =
                stock === null
                  ? ""
                  : stock === 0
                    ? "stock-hint-out"
                    : Number(row.quantity) > stock
                      ? "stock-hint-low"
                      : "";
              return (
                <div key={i}>
                  <div className="line-items-row">
                    <select
                      className="input"
                      value={row.product}
                      onChange={(e) =>
                        handleProductChange(i, e.target.value)
                      }
                    >
                      <option value="">— Select product —</option>
                      {products.map((p) => (
                        <option
                          key={p._id}
                          value={p._id}
                          disabled={p.stockQuantity === 0}
                        >
                          {p.name} · {p.sku} — {p.stockQuantity} in stock
                          {p.stockQuantity === 0 ? " (out)" : ""}
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
                      value={row.sellingPrice}
                      onChange={(e) =>
                        updateRow(i, { sellingPrice: e.target.value })
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

                  {stock !== null && (
                    <div className={`stock-hint ${stockClass}`}>
                      {stock === 0
                        ? "⚠ Out of stock"
                        : `Available: ${stock}`}
                    </div>
                  )}
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
            <span className="field-hint">
              {totals.paymentStatus === "paid"
                ? "Fully paid"
                : totals.paymentStatus === "partial"
                  ? `Partial — ${formatCurrency(totals.balance)} remaining`
                  : "Unpaid — will show as outstanding balance"}
            </span>
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

        {isEdit && (
          <div
            className="error-box"
            style={{
              background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
              borderColor: "#bfdbfe",
              color: "#1e40af",
            }}
          >
            Editing this sale will reverse the original stock movements and
            apply the new ones. If the new quantities exceed what is on hand,
            the edit will be refused and nothing will change.
          </div>
        )}
      </form>
    </Modal>
  );
}