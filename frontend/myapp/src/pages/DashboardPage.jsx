import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client.js";
import Spinner from "../components/Spinner.jsx";
import { formatCurrency } from "../utils/formatters.js";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from "recharts";
import { Check, Target, Clock, ArrowUpRight, MoreHorizontal, ArrowRight, DollarSign, TrendingUp, ShoppingBag, Package, Activity } from "lucide-react";

const CustomDot = (props) => {
  const { cx, cy, value } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill="#fff" stroke="#000" strokeWidth={2} />
      {value > 60 && (
        <g transform={`translate(${cx - 18}, ${cy - 30})`}>
          <rect width="36" height="20" rx="4" fill="#000" />
          <text x="18" y="14" fill="#fff" fontSize="10" textAnchor="middle" fontWeight="bold">{value}</text>
          <polygon points="14,20 22,20 18,24" fill="#000" />
        </g>
      )}
    </g>
  );
};

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await api.get("/dashboard");
        if (!cancelled) setData(res.data.data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleDownloadReport = () => {
    if (!data || !data.salesTrend) return;
    const headers = ["Date", "Revenue"];
    const csvRows = [
      headers.join(","), 
      ...data.salesTrend.map(row => `${row.date},${row.sales}`)
    ];
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `weekly_sales_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) return <Spinner label="Loading dashboard..." />;
  if (error) return <div style={{color: 'red'}}>{error}</div>;

  const weeklyData = [
    { day: 'M', work: 30, med: 45 },
    { day: 'T', work: 45, med: 30 },
    { day: 'W', work: 25, med: 65 },
    { day: 'T', work: 65, med: 25 },
    { day: 'F', work: 20, med: 55 },
    { day: 'S', work: 60, med: 15 },
    { day: 'S', work: 10, med: 40 },
  ];

  return (
    <div>
      <div className="top-kpi-grid">
        {/* 1. Total Sales */}
        <div className="bento-card black" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#a1a1aa' }}>Total Sales</span>
            <div style={{ background: '#fff', color: '#000', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarSign size={16} /></div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1 }}>{formatCurrency(data?.allTime?.sales)}</div>
          <div style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '8px' }}>All time revenue</div>
        </div>

        {/* 2. Today's Sales */}
        <div className="bento-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Today's Sales</span>
            <div style={{ background: '#f4f4f5', color: '#000', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Activity size={16} /></div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1 }}>{formatCurrency(data?.today?.sales)}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Revenue today</div>
        </div>

        {/* 3. Total Profit */}
        <div className="bento-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Total Profit</span>
            <div style={{ background: '#f4f4f5', color: '#000', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={16} /></div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1 }}>{formatCurrency(data?.allTime?.salesProfit)}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Gross margin</div>
        </div>

        {/* 4. Total Orders */}
        <div className="bento-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Total Orders</span>
            <div style={{ background: '#f4f4f5', color: '#000', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShoppingBag size={16} /></div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1 }}>{data?.allTime?.salesTransactions || 0}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Completed sales</div>
        </div>

        {/* 5. Total Products */}
        <div className="bento-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Products</span>
            <div style={{ background: '#f4f4f5', color: '#000', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={16} /></div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1 }}>{data?.counts?.products || 0}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>In inventory</div>
        </div>
      </div>

      <div className="bento-grid">
        <div className="bento-card black overall-info-card">
          <div className="card-header" style={{ marginBottom: 0 }}>
            <h3 className="card-title">Store Health</h3>
            <MoreHorizontal size={20} className="text-muted" />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', marginTop: '24px' }}>
            <div>
              <div className="massive-number">{data?.allTime?.salesTransactions || 0}</div>
              <div className="text-muted" style={{ fontSize: 12, fontWeight: 500 }}>Total<br/>Orders</div>
            </div>
            <div>
              <div className="massive-number" style={{ color: data?.counts?.lowStockProducts > 0 ? '#ef4444' : '#fff' }}>
                {data?.counts?.lowStockProducts || 0}
              </div>
              <div className="text-muted" style={{ fontSize: 12, fontWeight: 500 }}>Low<br/>Stock</div>
            </div>
          </div>

          <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 99, marginTop: 24, marginBottom: 24 }}>
             <div style={{ width: '65%', height: '100%', background: '#fff', borderRadius: 99 }} />
          </div>

          <div className="sub-card-grid">
            <div className="sub-card">
              <div style={{ background: '#fff', color: '#000', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Target size={14} /></div>
              <div className="sub-card-value">{data?.counts?.suppliers || 0}</div>
              <div className="sub-card-label">Suppliers</div>
            </div>
            <div className="sub-card">
              <div style={{ background: '#fff', color: '#000', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowUpRight size={14} /></div>
              <div className="sub-card-value" style={{ fontSize: 16 }}>{formatCurrency(data?.inventory?.valueAtCost)}</div>
              <div className="sub-card-label">Inv. Value</div>
            </div>
            <div className="sub-card">
              <div style={{ background: '#fff', color: '#000', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} /></div>
              <div className="sub-card-value">{data?.inventory?.totalUnits || 0}</div>
              <div className="sub-card-label">Units</div>
            </div>
          </div>
        </div>

        <div className="bento-card weekly-chart-card">
          <div className="card-header">
            <h3 className="card-title">Weekly process</h3>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#000' }}/> Work</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d4d4d8' }}/> Med</span>
            </div>
          </div>
          
          <div style={{ flex: 1, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#f4f4f5" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 12, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 12, fontWeight: 600 }} />
                <RechartsTooltip cursor={{ stroke: '#e4e4e7', strokeWidth: 2 }} content={() => null} />
                <Line type="linear" dataKey="work" stroke="#000" strokeWidth={2} dot={<CustomDot />} activeDot={{ r: 6, fill: '#000' }} />
                <Line type="linear" dataKey="med" stroke="#d4d4d8" strokeWidth={2} dot={{ r: 0 }} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bento-card month-progress-card">
          <div className="card-header" style={{ marginBottom: 10 }}>
            <h3 className="card-title">Month Progress</h3>
            <ArrowUpRight size={20} className="text-muted" />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 800 }}>30%</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>completed to last month*</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
               <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overview</div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#000' }}/> Target</div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a1a1aa' }}/> Current</div>
            </div>
            
            <div style={{ position: 'relative', width: 100, height: 100 }}>
              <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f4f4f5" strokeWidth="12" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#000" strokeWidth="12" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * 0.65)} strokeLinecap="round" />
                <circle cx="50" cy="50" r="28" fill="none" stroke="#e4e4e7" strokeWidth="10" />
                <circle cx="50" cy="50" r="28" fill="none" stroke="#a1a1aa" strokeWidth="10" strokeDasharray="175.9" strokeDashoffset={175.9 - (175.9 * 0.4)} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
                120%
              </div>
            </div>
          </div>
          
          <button 
            className="btn-create" 
            onClick={handleDownloadReport}
            style={{ marginTop: 20, width: '100%', justifyContent: 'center' }}
          >
            Download Report
          </button>
        </div>
      </div>

      <div className="bento-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <div className="bento-card">
          <div className="card-header">
            <h3 className="card-title">Month Goals</h3>
            <div style={{ border: '1px solid #e4e4e7', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>1/4</div>
          </div>
          <div className="task-list">
            <div className="task-item"><div className="task-checkbox"><Check size={12} /></div> <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>Increase Sales</span></div>
            <div className="task-item"><div className="task-checkbox" style={{ background: 'transparent', border: '2px solid #e4e4e7' }}></div> <span>Restock Inventory</span></div>
            <div className="task-item"><div className="task-checkbox" style={{ background: 'transparent', border: '2px solid #e4e4e7' }}></div> <span>Review Suppliers</span></div>
            <div className="task-item"><div className="task-checkbox" style={{ background: 'transparent', border: '2px solid #e4e4e7' }}></div> <span>Pay Utilities</span></div>
          </div>
        </div>

        <div className="bento-card" style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}>
          <div className="card-header" style={{ padding: '0 8px' }}>
            <h3 className="card-title">Recent Orders ({data?.recent?.sales?.length || 0})</h3>
            <Link to="/sales" style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>Open Archive <ArrowRight size={14}/></Link>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {data?.recent?.sales?.slice(0, 2).map((sale, i) => (
              /* Made this a Link to /sales */
              <Link 
                to="/sales" 
                key={i} 
                className="recent-order-card"
                style={{ 
                  background: '#fff', borderRadius: 24, padding: 20, 
                  boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', 
                  justifyContent: 'space-between', textDecoration: 'none', color: 'inherit'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                     {sale.customerName?.charAt(0) || 'W'}
                  </div>
                  <MoreHorizontal size={18} color="#a1a1aa" />
                </div>
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{sale.invoiceNumber}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{sale.customerName}</div>
                </div>
                <div style={{ marginTop: 24, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={12} /> {sale.paymentMethod}
                </div>
              </Link>
            ))}
            
            <div 
              className="add-task-box" 
              onClick={() => navigate('/checkout')}
              style={{ cursor: 'pointer' }}
            >
              + New Sale
            </div>
          </div>
        </div>
      </div>

      <div className="bento-grid">
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
           <h3 className="card-title">Top Categories</h3>
        </div>
        {data?.salesByCategory?.slice(0, 3).map((cat, i) => (
          <div key={i} className="project-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="project-card-title">{cat.name}</div>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                 {Math.round((cat.value / (data.allTime.sales || 1)) * 100)}%
              </div>
            </div>
            <div>
              <div className="project-card-status" style={{ marginBottom: 6 }}>
                <span className="status-dot" style={{ background: i === 0 ? '#22c55e' : '#a1a1aa' }} /> {i === 0 ? 'Top Seller' : 'Active'}
              </div>
              <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.4 }}>
                Revenue: {formatCurrency(cat.value)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}