import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client.js";
import Button from "../components/Button.jsx";
import Spinner from "../components/Spinner.jsx";
import { formatCurrency, formatDate } from "../utils/formatters.js";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from "recharts";
import { Printer, ArrowUpRight, TrendingUp, DollarSign, Wallet, ShoppingBag, Percent } from "lucide-react";

/* ---------- Range helpers ---------- */
const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const today = () => toISODate(new Date());

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
};

const firstOfMonth = () => {
  const d = new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
};

const PRESETS = [
  { key: "today", label: "Today", from: () => today(), to: () => today() },
  { key: "7d", label: "Last 7 days", from: () => daysAgo(6), to: () => today() },
  { key: "30d", label: "Last 30 days", from: () => daysAgo(29), to: () => today() },
  { key: "month", label: "This month", from: () => firstOfMonth(), to: () => today() },
  { key: "year", label: "This year", from: () => `${new Date().getFullYear()}-01-01`, to: () => today() },
];

// Custom Tooltip for Neo-Brutalist look
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#09090b', padding: '12px 16px', borderRadius: '8px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#a1a1aa', fontWeight: 600 }}>{formatDate(label)}</p>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

export default function ReportsPage() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(today());
  const [activePreset, setActivePreset] = useState("30d");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/reports", { params: { from, to } });
      setData(res.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const applyPreset = (preset) => {
    setActivePreset(preset.key);
    setFrom(preset.from());
    setTo(preset.to());
  };

  const onCustomFrom = (value) => {
    setActivePreset("custom");
    setFrom(value);
  };

  const onCustomTo = (value) => {
    setActivePreset("custom");
    setTo(value);
  };

  /* ---------- Daily chart data processing ---------- */
  const chartData = useMemo(() => {
    if (!data?.daily) return [];
    return data.daily.map(d => ({
      ...d,
      date: d.date
    }));
  }, [data]);

  const maxPaymentRevenue = useMemo(() => {
    if (!data?.paymentBreakdown?.length) return 0;
    return Math.max(...data.paymentBreakdown.map((p) => p.revenue), 1);
  }, [data]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Reports</h2>
          <p className="page-subtitle">
            {data?.range
              ? `${formatDate(data.range.from)} → ${formatDate(data.range.to)}`
              : "Loading range…"}
          </p>
        </div>
        <Button variant="secondary" className="no-print" onClick={() => window.print()}>
          <Printer size={18} /> Print Report
        </Button>
      </div>

      {/* ---------- Date range picker ---------- */}
      <div className="range-picker no-print">
        <div className="chip-group">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={activePreset === p.key ? "chip chip-active" : "chip"}
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="date-inputs">
          <label htmlFor="from">From</label>
          <input
            id="from"
            type="date"
            className="input"
            value={from}
            max={to}
            onChange={(e) => onCustomFrom(e.target.value)}
          />
          <label htmlFor="to">To</label>
          <input
            id="to"
            type="date"
            className="input"
            value={to}
            min={from}
            max={today()}
            onChange={(e) => onCustomTo(e.target.value)}
          />
        </div>
      </div>

      {loading && <Spinner label="Building report..." />}

      {error && !loading && (
        <div className="error-box">
          {error}
          <div style={{ marginTop: 12 }}>
            <Button variant="secondary" onClick={load}>Retry</Button>
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ---------- Top Metrics Row ---------- */}
          <div className="reports-metrics">
            
            <div className="report-metric-card dark">
              <div className="metric-label">Total Revenue</div>
              <div className="metric-value">{formatCurrency(data.sales.revenue)}</div>
              <div className="metric-sub">{data.sales.count} Transactions</div>
            </div>

            <div className="report-metric-card">
              <div className="metric-label">Collected</div>
              <div className="metric-value">{formatCurrency(data.sales.collected)}</div>
              <div className="metric-sub">Cash/Card received</div>
            </div>

            <div className="report-metric-card">
              <div className="metric-label">Outstanding</div>
              <div className="metric-value">{formatCurrency(data.sales.outstanding)}</div>
              <div className="metric-sub">Credit balances</div>
            </div>

            <div className="report-metric-card">
              <div className="metric-label">Gross Profit</div>
              <div className="metric-value">{formatCurrency(data.sales.grossProfit)}</div>
              <div className="metric-sub">
                {data.sales.revenue > 0 ? `${data.sales.grossMarginPct.toFixed(1)}% margin` : "—"}
              </div>
            </div>

            <div className="report-metric-card">
              <div className="metric-label">Purchase Spend</div>
              <div className="metric-value">{formatCurrency(data.purchases.expenditure)}</div>
              <div className="metric-sub">{data.purchases.count} Orders received</div>
            </div>

          </div>

          {/* ---------- Daily Revenue Chart ---------- */}
          <div className="chart-card">
            <div className="card-header">
              <h3 className="card-title">Daily Revenue</h3>
            </div>
            {chartData.length === 0 ? (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No sales in this period.
              </div>
            ) : (
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tickFormatter={(val) => {
                        const [, m, d] = val.split("-");
                        return `${d}/${m}`;
                      }}
                      tick={{ fill: '#71717a', fontSize: 12, fontWeight: 600 }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tickFormatter={(val) => `$${val}`}
                      tick={{ fill: '#71717a', fontSize: 12, fontWeight: 600 }} 
                    />
                    <RechartsTooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                    <Bar dataKey="revenue" fill="#09090b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ---------- Two Column Layout: Products & Customers ---------- */}
          <div className="two-col-grid">
            
            {/* Top Products */}
            <div className="chart-card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <h3 className="card-title">Top Products</h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: "right" }}>Units</th>
                      <th style={{ textAlign: "right" }}>Revenue</th>
                      <th style={{ textAlign: "right" }}>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((p, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.sku}</div>
                        </td>
                        <td style={{ textAlign: "right" }}>{p.unitsSold}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(p.revenue)}</td>
                        <td style={{ textAlign: "right", color: "var(--success)", fontWeight: 600 }}>
                          {formatCurrency(p.profit)}
                        </td>
                      </tr>
                    ))}
                    {data.topProducts.length === 0 && (
                      <tr><td colSpan="4" className="table-empty">No products sold.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Customers */}
            <div className="chart-card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <h3 className="card-title">Top Customers</h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th style={{ textAlign: "right" }}>Orders</th>
                      <th style={{ textAlign: "right" }}>Revenue</th>
                      <th style={{ textAlign: "right" }}>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCustomers.map((c, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.phone || "No phone"}</div>
                        </td>
                        <td style={{ textAlign: "right" }}>{c.invoiceCount}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(c.revenue)}</td>
                        <td style={{ textAlign: "right", color: c.outstanding > 0 ? "var(--warning)" : "var(--text-muted)", fontWeight: 600 }}>
                          {formatCurrency(c.outstanding)}
                        </td>
                      </tr>
                    ))}
                    {data.topCustomers.length === 0 && (
                      <tr><td colSpan="4" className="table-empty">No customers purchased.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* ---------- Payment Breakdown ---------- */}
          <div className="chart-card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <h3 className="card-title">Payment Methods</h3>
            </div>
            {data.paymentBreakdown.length === 0 ? (
              <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "20px 0", margin: 0 }}>
                No payments recorded.
              </p>
            ) : (
              <div className="breakdown-list">
                {data.paymentBreakdown.map((p) => {
                  const pct = maxPaymentRevenue > 0 ? (p.revenue / maxPaymentRevenue) * 100 : 0;
                  return (
                    <div className="breakdown-row" key={p.method}>
                      <span className="breakdown-label">
                        {p.method.replace("-", " ")}
                      </span>
                      <div className="breakdown-track">
                        <div className="breakdown-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="breakdown-count">{p.count} txn</span>
                      <span className="breakdown-value">{formatCurrency(p.revenue)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}