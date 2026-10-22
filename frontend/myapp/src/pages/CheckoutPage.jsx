import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client.js";
import { useToast } from "../context/ToastContext.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import Modal from "../components/Modal.jsx";
import Spinner from "../components/Spinner.jsx";
import { formatCurrency, formatDateTime } from "../utils/formatters.js";
import { buildInvoiceHtml, printInvoice } from "../utils/invoice.js";
import "./CheckoutPage.css"

const PAYMENT_METHODS = ["cash", "card", "bank-transfer", "credit"];
const round2 = (n) => Math.round(n * 100) / 100;

export default function CheckoutPage() {
  const { showToast } = useToast();

  // ---- Reference data ----
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ---- Filters ----
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // ---- Cart ----
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [amountPaid, setAmountPaid] = useState("");

  // ---- Submission ----
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  // ---- Receipt ----
  const [completedSale, setCompletedSale] = useState(null);

  /* ---------- Load reference data ---------- */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [productsRes, categoriesRes, customersRes] = await Promise.all([
        api.get("/products", { params: { limit: 100 } }),
        api.get("/categories", { params: { limit: 100 } }),
        api.get("/customers", { params: { limit: 100 } }),
      ]);
      setProducts(productsRes.data.data);
      setCategories(categoriesRes.data.data);
      setCustomers(customersRes.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------- Filtered products ---------- */
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter && (p.category?._id || p.category) !== categoryFilter)
        return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.barcode || "").toLowerCase().includes(q)
      );
    });
  }, [products, search, categoryFilter]);

  /* ---------- Cart operations ---------- */
  const cartQuantityOf = (productId) => {
    const row = cart.find((c) => c.product._id === productId);
    return row ? row.quantity : 0;
  };

  const addToCart = (product) => {
    const inCart = cartQuantityOf(product._id);
    if (inCart >= product.stockQuantity) {
      showToast(
        `Only ${product.stockQuantity} in stock for "${product.name}"`,
        "error",
        2500
      );
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.product._id === product._id);
      if (existing) {
        return prev.map((c) =>
          c.product._id === product._id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const incrementQty = (productId) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.product._id !== productId) return c;
        if (c.quantity >= c.product.stockQuantity) {
          showToast(
            `Only ${c.product.stockQuantity} in stock`,
            "error",
            2000
          );
          return c;
        }
        return { ...c, quantity: c.quantity + 1 };
      })
    );
  };

  const decrementQty = (productId) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.product._id === productId
            ? { ...c, quantity: c.quantity - 1 }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const setQty = (productId, value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return;
    if (n === 0) {
      setCart((prev) => prev.filter((c) => c.product._id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((c) => {
        if (c.product._id !== productId) return c;
        if (n > c.product.stockQuantity) {
          showToast(
            `Only ${c.product.stockQuantity} in stock`,
            "error",
            2000
          );
          return { ...c, quantity: c.product.stockQuantity };
        }
        return { ...c, quantity: n };
      })
    );
  };

  const removeFromCart = (productId) =>
    setCart((prev) => prev.filter((c) => c.product._id !== productId));

  const clearCart = () => {
    if (cart.length === 0) return;
    if (!confirm("Clear all items from the cart?")) return;
    setCart([]);
    setDiscount("0");
    setTax("0");
    setAmountPaid("");
  };

  /* ---------- Totals ---------- */
  const totals = useMemo(() => {
    const subtotal = round2(
      cart.reduce((s, c) => s + c.product.sellingPrice * c.quantity, 0)
    );
    const d = Number(discount) || 0;
    const t = Number(tax) || 0;
    const paid = Number(amountPaid) || 0;
    const total = round2(subtotal - d + t);
    const change = round2(Math.max(0, paid - total));
    const balance = round2(Math.max(0, total - paid));
    const paymentStatus =
      paid <= 0 ? "unpaid" : paid < total ? "partial" : "paid";
    return { subtotal, total, change, balance, paymentStatus, paid };
  }, [cart, discount, tax, amountPaid]);

  /* ---------- Checkout ---------- */
  const completeSale = async () => {
    setServerError(null);

    if (cart.length === 0) {
      setServerError("Add at least one item to the cart");
      return;
    }
    for (const c of cart) {
      if (c.quantity > c.product.stockQuantity) {
        setServerError(
          `"${c.product.name}" — only ${c.product.stockQuantity} in stock`
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        items: cart.map((c) => ({
          product: c.product._id,
          quantity: c.quantity,
        })),
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
        amountPaid: Number(amountPaid) || 0,
        paymentMethod,
      };
      if (customerId) payload.customer = customerId;

      const res = await api.post("/sales", payload);
      const sale = res.data.data;

      setCompletedSale(sale);
      showToast("Sale completed", "success");

      setCart([]);
      setCustomerId("");
      setPaymentMethod("cash");
      setDiscount("0");
      setTax("0");
      setAmountPaid("");

      load();
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startNewSale = () => setCompletedSale(null);

  const printCompletedSale = () => {
    if (!completedSale) return;
    printInvoice(buildInvoiceHtml(completedSale));
  };

  const payExact = () => setAmountPaid(String(totals.total));

  /* ---------- Render ---------- */
  if (loading) return <Spinner label="Loading checkout..." />;
  if (error)
    return (
      <div className="error-box">
        {error}
        <div style={{ marginTop: 8 }}>
          <Button variant="secondary" onClick={load}>
            Retry
          </Button>
        </div>
      </div>
    );

  const cartItemCount = cart.reduce((s, c) => s + c.quantity, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Checkout</h2>
          <p className="page-subtitle">
            Click products to add them to the cart, then complete the sale
          </p>
        </div>
      </div>

      <div className="checkout-layout">
        {/* ---------- LEFT: products ---------- */}
        <div>
          <form className="toolbar" onSubmit={(e) => e.preventDefault()}>
            <input
              className="input"
              placeholder="Search products by name, SKU, or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </form>

          <div className="toolbar">
            <div className="filter-chips">
              <button
                type="button"
                className={!categoryFilter ? "chip chip-active" : "chip"}
                onClick={() => setCategoryFilter("")}
              >
                All categories
              </button>
              {categories.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  className={
                    categoryFilter === c._id ? "chip chip-active" : "chip"
                  }
                  onClick={() => setCategoryFilter(c._id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 40 }}>
              <p style={{ margin: 0, color: "var(--text-dim)" }}>
                No products match your search.
              </p>
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map((p) => {
                const qty = cartQuantityOf(p._id);
                const isOut = p.stockQuantity === 0;
                const isLow = !isOut && p.stockQuantity <= p.minStockLevel;
                return (
                  <button
                    key={p._id}
                    type="button"
                    className="product-card"
                    onClick={() => addToCart(p)}
                    disabled={isOut}
                    title={isOut ? "Out of stock" : `Add ${p.name} to cart`}
                  >
                    {qty > 0 && (
                      <span className="product-card-badge">{qty}</span>
                    )}
                    <div className="product-card-name">{p.name}</div>
                    <div className="product-card-sku">{p.sku}</div>
                    <div className="product-card-bottom">
                      <span className="product-card-price">
                        {formatCurrency(p.sellingPrice)}
                      </span>
                      <span
                        className={
                          isOut
                            ? "product-card-stock product-card-stock-out"
                            : isLow
                              ? "product-card-stock product-card-stock-low"
                              : "product-card-stock"
                        }
                      >
                        {isOut ? "Out" : p.stockQuantity}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ---------- RIGHT: cart ---------- */}
        <div className="cart-panel">
          {/* Header — always visible */}
          <div className="cart-header">
            <h3 className="cart-title">Cart</h3>
            <span className="cart-count">
              {cartItemCount} {cartItemCount === 1 ? "item" : "items"}
            </span>
          </div>

          {/* Scrollable middle — items + form + totals */}
          <div className="cart-scroll">
            {cart.length === 0 ? (
              <div className="cart-empty">
                Cart is empty.
                <br />
                Click a product to add it.
              </div>
            ) : (
              <div className="cart-items">
                {cart.map((c) => (
                  <div className="cart-item" key={c.product._id}>
                    <div>
                      <div className="cart-item-name">{c.product.name}</div>
                      <div className="cart-item-price">
                        {formatCurrency(c.product.sellingPrice)} each
                      </div>
                    </div>
                    <div className="cart-item-controls">
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => decrementQty(c.product._id)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        className="qty-value"
                        value={c.quantity}
                        min="0"
                        max={c.product.stockQuantity}
                        onChange={(e) => setQty(c.product._id, e.target.value)}
                      />
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => incrementQty(c.product._id)}
                        disabled={c.quantity >= c.product.stockQuantity}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <div className="cart-item-subtotal">
                      <button
                        type="button"
                        className="cart-item-remove"
                        onClick={() => removeFromCart(c.product._id)}
                      >
                        Remove
                      </button>
                      <strong>
                        {formatCurrency(c.product.sellingPrice * c.quantity)}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Form */}
            <div className="cart-form">
              <div className="field">
                <label htmlFor="co-customer">Customer</label>
                <select
                  id="co-customer"
                  className="input"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.fullName}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="co-method">Payment method</label>
                <select
                  id="co-method"
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

              <div className="cart-form-row">
                <Input
                  label="Discount"
                  name="discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
                <Input
                  label="Tax"
                  name="tax"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="co-paid">Amount paid</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    id="co-paid"
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary pay-exact-btn"
                    onClick={payExact}
                    disabled={cart.length === 0}
                  >
                    Exact
                  </button>
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="cart-totals">
              <div className="cart-totals-row">
                <span>Subtotal</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              {Number(discount) > 0 && (
                <div className="cart-totals-row">
                  <span>Discount</span>
                  <span>− {formatCurrency(Number(discount) || 0)}</span>
                </div>
              )}
              {Number(tax) > 0 && (
                <div className="cart-totals-row">
                  <span>Tax</span>
                  <span>+ {formatCurrency(Number(tax) || 0)}</span>
                </div>
              )}
              <div className="cart-totals-row cart-totals-grand">
                <span>Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
              {totals.change > 0 && (
                <div className="cart-totals-row cart-totals-change">
                  <span>Change</span>
                  <span>{formatCurrency(totals.change)}</span>
                </div>
              )}
              {totals.balance > 0 && totals.paid > 0 && (
                <div className="cart-totals-row cart-totals-balance">
                  <span>Balance due</span>
                  <span>{formatCurrency(totals.balance)}</span>
                </div>
              )}
            </div>

            {serverError && <div className="error-box">{serverError}</div>}
          </div>

          {/* Fixed footer — always visible */}
          <div className="cart-footer">
            <Button
              variant="primary"
              className="cart-checkout-btn"
              onClick={completeSale}
              loading={submitting}
              disabled={cart.length === 0}
            >
              Complete Sale · {formatCurrency(totals.total)}
            </Button>

            {cart.length > 0 && (
              <Button
                variant="ghost"
                className="cart-clear-btn"
                onClick={clearCart}
              >
                Clear cart
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Receipt modal ---------- */}
      <ReceiptModal
        sale={completedSale}
        onClose={startNewSale}
        onPrint={printCompletedSale}
      />
    </div>
  );
}

/* =========================================================
 *  Receipt modal (unchanged)
 * ========================================================= */

function ReceiptModal({ sale, onClose, onPrint }) {
  if (!sale) return null;

  const change = Math.max(0, sale.amountPaid - sale.total);
  const balance = Math.max(0, sale.total - sale.amountPaid);

  return (
    <Modal
      open={!!sale}
      onClose={onClose}
      title="Receipt"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            New Sale
          </Button>
          <Button variant="primary" onClick={onPrint}>
            Print receipt
          </Button>
        </>
      }
    >
      <div className="receipt">
        <div className="receipt-hero">
          <div className="receipt-check">
            <svg
              viewBox="0 0 24 24"
              width="32"
              height="32"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="receipt-title">Sale Complete</h3>
          <p className="receipt-subtitle">
            {sale.invoiceNumber} · {formatDateTime(sale.createdAt)}
          </p>
          <span className="receipt-amount-label">Amount charged</span>
          <div className="receipt-amount">{formatCurrency(sale.total)}</div>

          {change > 0 && (
            <span className="receipt-highlight receipt-highlight-change">
              Change: {formatCurrency(change)}
            </span>
          )}
          {balance > 0 && (
            <span className="receipt-highlight receipt-highlight-balance">
              Balance due: {formatCurrency(balance)}
            </span>
          )}
        </div>

        <div className="receipt-meta">
          <div>
            <span className="receipt-meta-label">Customer</span>
            <span className="receipt-meta-value">
              {sale.customerName || "Walk-in Customer"}
            </span>
          </div>
          <div>
            <span className="receipt-meta-label">Payment</span>
            <span
              className="receipt-meta-value"
              style={{ textTransform: "capitalize" }}
            >
              {sale.paymentMethod} · {sale.paymentStatus}
            </span>
          </div>
        </div>

        <div className="receipt-items">
          {(sale.items || []).map((it, i) => (
            <div className="receipt-item" key={i}>
              <div>
                <div className="receipt-item-name">{it.name}</div>
                <div className="receipt-item-sku">
                  {it.sku} · {formatCurrency(it.sellingPrice)}
                </div>
              </div>
              <span className="receipt-item-qty">×{it.quantity}</span>
              <span className="receipt-item-sub">
                {formatCurrency(it.subtotal)}
              </span>
            </div>
          ))}
        </div>

        <div className="receipt-totals">
          <div className="receipt-totals-row">
            <span>Subtotal</span>
            <span>{formatCurrency(sale.subtotal)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="receipt-totals-row">
              <span>Discount</span>
              <span>− {formatCurrency(sale.discount)}</span>
            </div>
          )}
          {sale.tax > 0 && (
            <div className="receipt-totals-row">
              <span>Tax</span>
              <span>+ {formatCurrency(sale.tax)}</span>
            </div>
          )}
          <div className="receipt-totals-row receipt-totals-grand">
            <span>Total</span>
            <span>{formatCurrency(sale.total)}</span>
          </div>
          <div className="receipt-totals-row">
            <span>Amount paid</span>
            <span>{formatCurrency(sale.amountPaid)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}