import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import Button from "../components/Button.jsx";
import Spinner from "../components/Spinner.jsx";
import Table from "../components/Table.jsx";
import { formatCurrency } from "../utils/formatters.js";

const PAGE_SIZE = 10;

/* =========================================================
 *  Status helpers
 * ========================================================= */

/**
 * Classify a product's stock state.
 *   "out"     → stockQuantity === 0
 *   "low"     → 0 < stockQuantity <= minStockLevel
 *   "healthy" → stockQuantity > minStockLevel
 */
const stockStatusOf = (p) => {
  if (p.stockQuantity === 0) return "out";
  if (p.stockQuantity <= p.minStockLevel) return "low";
  return "healthy";
};

/**
 * Width of the progress bar as a percentage.
 * The bar fills completely at 2× minStockLevel, so a product sitting
 * exactly at its minimum shows a half-full bar.
 */
const barPercent = (p) => {
  if (!p.minStockLevel) return p.stockQuantity > 0 ? 100 : 0;
  const ratio = p.stockQuantity / (p.minStockLevel * 2);
  return Math.min(100, Math.max(0, ratio * 100));
};

const STATUS_LABEL = {
  healthy: "Healthy",
  low: "Low",
  out: "Out",
};

/* =========================================================
 *  Small inline SVG icons for the summary tiles
 * ========================================================= */

const Icons = {
  box: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.3 7 12 12l8.7-5" />
      <path d="M12 22V12" />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 2 9 5v10l-9 5-9-5V7z" />
      <path d="m3 7 9 5 9-5" />
      <path d="M12 22V12" />
    </svg>
  ),
  cash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

/* =========================================================
 *  Page
 * ========================================================= */

export default function InventoryPage() {
  // ---- Summary (from dashboard) ----
  const [summary, setSummary] = useState(null);

  // ---- List state ----
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | healthy | low | out
  const [sort, setSort] = useState("stock-asc"); // most urgent first by default

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ---- Load summary once ----
  useEffect(() => {
    let cancelled = false;
    api
      .get("/dashboard")
      .then((res) => {
        if (!cancelled) setSummary(res.data.data);
      })
      .catch(() => {
        /* summary is nice-to-have; ignore errors */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Load products ----
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { page, limit: PAGE_SIZE, sort };
      if (search) params.search = search;
      if (statusFilter !== "all") params.stockStatus = statusFilter;

      const res = await api.get("/products", { params });
      setProducts(res.data.data);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, sort]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Handlers ----
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

  const setStatus = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  // ---- Columns ----
  const columns = [
    {
      key: "name",
      label: "Product",
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {row.sku}
            {row.category?.name ? ` · ${row.category.name}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "stock",
      label: "Stock level",
      render: (row) => {
        const status = stockStatusOf(row);
        return (
          <div className="stock-bar-wrap">
            <div className={`stock-bar stock-bar-${status}`}>
              <div
                className="stock-bar-fill"
                style={{ width: `${barPercent(row)}%` }}
              />
            </div>
            <span className={`stock-count stock-count-${status}`}>
              {row.stockQuantity}
            </span>
          </div>
        );
      },
    },
    {
      key: "minStockLevel",
      label: "Min level",
      render: (row) => (
        <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
          {row.minStockLevel} {row.unit}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const status = stockStatusOf(row);
        const cls =
          status === "out"
            ? "badge badge-danger"
            : status === "low"
              ? "badge badge-warning"
              : "badge badge-success";
        return <span className={cls}>{STATUS_LABEL[status]}</span>;
      },
    },
    {
      key: "value",
      label: "Value at cost",
      render: (row) => {
        const value = Number(row.purchasePrice) * Number(row.stockQuantity);
        return (
          <span style={{ fontWeight: 600 }}>{formatCurrency(value)}</span>
        );
      },
    },
    {
      key: "sellingPrice",
      label: "Selling price",
      render: (row) => (
        <span style={{ color: "var(--text-muted)" }}>
          {formatCurrency(row.sellingPrice)}
        </span>
      ),
    },
  ];

  const hasAnyFilter = !!(search || statusFilter !== "all");

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Inventory</h2>
          <p className="page-subtitle">
            Track stock levels and identify what needs restocking
          </p>
        </div>
      </div>

      {/* ---------- Summary cards ---------- */}
      {summary && (
        <div className="card">
          <h3 className="card-title">Overview</h3>
          <div className="metric-grid">
            <div className="metric metric-indigo">
              <div className="metric-head">
                <span className="metric-label">Total SKUs</span>
                <span className="metric-icon">{Icons.box}</span>
              </div>
              <div className="metric-value">
                {summary.counts?.products ?? 0}
              </div>
            </div>

            <div className="metric metric-sky">
              <div className="metric-head">
                <span className="metric-label">Units in stock</span>
                <span className="metric-icon">{Icons.layers}</span>
              </div>
              <div className="metric-value">
                {summary.inventory?.totalUnits ?? 0}
              </div>
            </div>

            <div className="metric metric-violet">
              <div className="metric-head">
                <span className="metric-label">Value at cost</span>
                <span className="metric-icon">{Icons.cash}</span>
              </div>
              <div className="metric-value">
                {formatCurrency(summary.inventory?.valueAtCost)}
              </div>
            </div>

            <div className="metric metric-rose">
              <div className="metric-head">
                <span className="metric-label">Low stock items</span>
                <span className="metric-icon">{Icons.alert}</span>
              </div>
              <div className="metric-value">
                {summary.counts?.lowStockProducts ?? 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Search ---------- */}
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
        {search && (
          <Button variant="secondary" onClick={clearSearch}>
            Clear
          </Button>
        )}
      </form>

      {/* ---------- Status chips + sort ---------- */}
      <div className="toolbar">
        <div className="filter-chips">
          <button
            type="button"
            className={statusFilter === "all" ? "chip chip-active" : "chip"}
            onClick={() => setStatus("all")}
          >
            All
          </button>
          <button
            type="button"
            className={
              statusFilter === "healthy" ? "chip chip-active" : "chip"
            }
            onClick={() => setStatus("healthy")}
          >
            ✓ Healthy
          </button>
          <button
            type="button"
            className={statusFilter === "low" ? "chip chip-active" : "chip"}
            onClick={() => setStatus("low")}
          >
            ⚠ Low stock
          </button>
          <button
            type="button"
            className={statusFilter === "out" ? "chip chip-active" : "chip"}
            onClick={() => setStatus("out")}
          >
            ✕ Out of stock
          </button>
        </div>

        <div className="sort-inline">
          <label htmlFor="inv-sort">Sort:</label>
          <select
            id="inv-sort"
            className="input"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="stock-asc">Most urgent first</option>
            <option value="stock-desc">Most in stock</option>
            <option value="name">Name (A–Z)</option>
            <option value="newest">Recently added</option>
          </select>
        </div>
      </div>

      {loading && <Spinner label="Loading inventory..." />}

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
            rows={products}
            emptyMessage={
              hasAnyFilter
                ? "No products match these filters."
                : "No products in inventory yet."
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
                Page {page} of {pages} · {total} total
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
    </div>
  );
}