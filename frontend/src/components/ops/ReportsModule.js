import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { injectZenCss, Icon, rupee } from './opsTheme';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SECTIONS = [
  { id: 'snapshot', label: 'Snapshot', ico: 'grid' },
  { id: 'sales', label: 'Sales', ico: 'trendup' },
  { id: 'payments-gst', label: 'Payments & GST', ico: 'money' },
  { id: 'pnl', label: 'Expenses & P&L', ico: 'wallet' },
  { id: 'staff', label: 'Staff', ico: 'users' },
  { id: 'clients', label: 'Clients', ico: 'user' },
  { id: 'marketing', label: 'Marketing', ico: 'chart' },
  { id: 'inventory', label: 'Inventory', ico: 'box' },
];

const PAY_ICONS = { cash: 'cash', upi: 'phone', card: 'card', wallet: 'wallet' };

/**
 * ReportsModule — merged Financials + Analytics
 * Preserves the ability to add finance entries (used by admins).
 */
export default function ReportsModule({ salonId, canManageFinancials = true, getAuthHeaders }) {
  useEffect(() => { injectZenCss(); }, []);
  const [tab, setTab] = useState('snapshot');
  const [view, setView] = useState('month'); // day | week | month
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [compare, setCompare] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showTargets, setShowTargets] = useState(false);

  return (
    <div className="zen">
      <div className="z-wrap">
        <div className="z-phead">
          <div>
            <div className="eyebrow">Business intelligence</div>
            <h1>Reports</h1>
            <p>Your merged Financials + Analytics view. Track KPIs, compare periods, and drill into any card.</p>
          </div>
          <div className="z-actions">
            <div className="z-seg">
              {['day', 'week', 'month'].map((v) => (
                <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                   style={{ padding: '8px 12px', border: '1px solid var(--z-line)', borderRadius: 10, background: '#fff' }} />
            <button className={`z-btn ${compare ? 'z-btn--soft' : 'z-btn--ghost'}`} onClick={() => setCompare((c) => !c)}>
              <Icon name="layers" /> Compare
            </button>
            {canManageFinancials && (
              <button className="z-btn z-btn--pri" onClick={() => setShowAddEntry(true)}>
                <Icon name="plus" /> Add entry
              </button>
            )}
          </div>
        </div>

        {/* Section tabs */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
          {SECTIONS.map((s) => (
            <button key={s.id} className={`z-chip ${tab === s.id ? 'on' : ''}`} onClick={() => setTab(s.id)}>
              <Icon name={s.ico} size={13} /> {s.label}
            </button>
          ))}
        </div>

        {tab === 'snapshot' && (
          <SnapshotTab
            salonId={salonId} view={view} date={date} compare={compare}
            getAuthHeaders={getAuthHeaders}
            onConfigure={() => setShowConfig(true)}
            onTargets={() => setShowTargets(true)}
          />
        )}
        {tab === 'sales' && <SalesTab salonId={salonId} view={view} date={date} getAuthHeaders={getAuthHeaders} />}
        {tab === 'payments-gst' && <PaymentsTab salonId={salonId} view={view} date={date} getAuthHeaders={getAuthHeaders} />}
        {tab === 'pnl' && <PnlTab salonId={salonId} view={view} date={date} getAuthHeaders={getAuthHeaders} canManage={canManageFinancials} onAdd={() => setShowAddEntry(true)} />}
        {tab === 'staff' && <StaffTab salonId={salonId} view={view} date={date} getAuthHeaders={getAuthHeaders} />}
        {tab === 'clients' && <ClientsTab salonId={salonId} view={view} date={date} getAuthHeaders={getAuthHeaders} />}
        {tab === 'marketing' && <MarketingTab salonId={salonId} view={view} date={date} getAuthHeaders={getAuthHeaders} />}
        {tab === 'inventory' && <InventoryReportsTab salonId={salonId} view={view} date={date} getAuthHeaders={getAuthHeaders} />}
      </div>

      {showAddEntry && <AddEntryDialog salonId={salonId} getAuthHeaders={getAuthHeaders} onClose={() => setShowAddEntry(false)} />}
      {showConfig && <ConfigDialog salonId={salonId} getAuthHeaders={getAuthHeaders} onClose={() => setShowConfig(false)} />}
      {showTargets && <TargetsDialog salonId={salonId} view={view} getAuthHeaders={getAuthHeaders} onClose={() => setShowTargets(false)} />}
    </div>
  );
}

/* ---------- SNAPSHOT ---------- */
function SnapshotTab({ salonId, view, date, compare, getAuthHeaders, onConfigure, onTargets }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/salons/${salonId}/reports/snapshot?view=${view}&date=${date}&compare=${compare}`,
        { headers: getAuthHeaders() }
      );
      setCards(res.data?.cards || []);
    } catch (e) {
      toast.error('Failed to load snapshot');
    } finally { setLoading(false); }
  }, [salonId, view, date, compare, getAuthHeaders]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10 }}>
        <button className="z-btn z-btn--ghost z-btn--sm" onClick={onTargets}>
          <Icon name="gauge" /> Targets
        </button>
        <button className="z-btn z-btn--ghost z-btn--sm" onClick={onConfigure}>
          <Icon name="settings" /> Configure cards
        </button>
      </div>
      {loading ? (
        <div className="z-empty">Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 13 }}>
          {cards.map((c) => (
            <MetricCard key={c.id} card={c} onOpen={() => setDetail(c)} />
          ))}
        </div>
      )}
      {detail && (
        <MetricDetailDrawer
          card={detail} salonId={salonId} view={view} date={date}
          getAuthHeaders={getAuthHeaders}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}

function MetricCard({ card, onOpen }) {
  const attained = card.target ? Math.min(100, (card.total / card.target) * 100) : 0;
  const attainedLabel = card.target ? `${Math.round(attained)}% of target` : '';
  const grad = card.money ? 'g-blue' : (card.id === 'feedback' ? 'g-amber' : (card.lower_is_better ? 'g-rose' : 'g-mint'));
  const val = card.money ? rupee(card.total) : (card.id === 'utilization' || card.id === 'noshow' || card.id === 'rebooking' ? `${card.total}%` : card.total);
  return (
    <div className={`z-metric ${grad}`} onClick={onOpen} style={{ cursor: 'pointer' }}>
      <div className="k">
        <Icon name={card.money ? 'money' : 'chart'} /> {card.label}
      </div>
      <div className="v">{val}</div>
      <div className="sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {card.trend ? (
          <span className={`z-trend ${card.up ? 'up' : 'dn'}`}>{card.trend}</span>
        ) : null}
        {attainedLabel && <span>{attainedLabel}</span>}
      </div>
      {card.target > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ height: 4, borderRadius: 4, background: 'var(--z-line-2)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, attained)}%`, height: '100%', background: 'var(--z-primary)' }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--z-muted-2)', marginTop: 2 }}>
            Target · {card.money ? rupee(card.target) : card.target}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricDetailDrawer({ card, salonId, view, date, getAuthHeaders, onClose }) {
  const [data, setData] = useState({ breakdown: [] });
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(
          `${API}/salons/${salonId}/reports/metric/${card.id}?view=${view}&date=${date}`,
          { headers: getAuthHeaders() }
        );
        setData(res.data);
      } catch (e) { /* ignore */ }
    })();
  }, [card.id, view, date]); // eslint-disable-line
  const total = card.total || 1;
  const maxBar = Math.max(1, ...(data.breakdown || []).map((r) => r.value));

  return (
    <>
      <div className="z-overlay" onClick={onClose} />
      <aside className="z-drawer wide">
        <div className="z-drawer-h">
          <div className="dico"><Icon name="chart" size={20} /></div>
          <div>
            <div className="eyebrow">{view} · {date}</div>
            <h3>{card.label}</h3>
            <p>Detailed breakdown for this metric.</p>
          </div>
          <button className="z-drawer-close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="z-drawer-body">
          <div style={{ textAlign: 'center', padding: '12px 0 18px' }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 50, color: 'var(--z-primary)' }}>
              {card.money ? rupee(card.total) : card.total}
            </div>
            {card.trend && <span className={`z-trend ${card.up ? 'up' : 'dn'}`}>{card.trend} vs previous</span>}
          </div>
          <div className="z-dsec">{card.chart?.title || 'Breakdown'}</div>
          <div className="z-bar-chart">
            {(data.breakdown || []).map((r) => (
              <div key={r.label} className="z-bar-row">
                <div className="lbl">{r.label}</div>
                <div className="track"><div className="fill" style={{ width: `${(r.value / maxBar) * 100}%` }} /></div>
                <div className="v">{card.money ? rupee(r.value) : r.value}<br /><small style={{ fontWeight: 600, color: 'var(--z-muted-2)' }}>{r.share}%</small></div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

/* ---------- SALES ---------- */
function SalesTab({ salonId, view, date, getAuthHeaders }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/salons/${salonId}/reports/sales?view=${view}&date=${date}`, { headers: getAuthHeaders() });
        setData(res.data);
      } catch (e) { toast.error('Failed to load sales'); }
    })();
  }, [salonId, view, date]); // eslint-disable-line
  if (!data) return <div className="z-empty">Loading…</div>;
  return (
    <>
      <div className="z-metrics">
        <div className="z-metric g-blue"><div className="k"><Icon name="money" />Revenue</div>
          <div className="v">{rupee(data.total_revenue)}</div>
          <div className="sub">{data.bookings} completed bookings</div></div>
        <div className="z-metric g-mint"><div className="k"><Icon name="user" />Avg ticket</div>
          <div className="v">{rupee(data.bookings ? data.total_revenue / data.bookings : 0)}</div>
          <div className="sub">Per booking</div></div>
        <div className="z-metric g-amber"><div className="k"><Icon name="scissors" />Services sold</div>
          <div className="v">{data.by_service?.length || 0}</div>
          <div className="sub">Distinct services</div></div>
        <div className="z-metric g-rose"><div className="k"><Icon name="users" />Staff</div>
          <div className="v">{data.by_staff?.length || 0}</div>
          <div className="sub">Staff who served</div></div>
      </div>
      <div className="z-card" style={{ padding: 16, marginBottom: 14 }}>
        <div className="z-dsec">Revenue by staff</div>
        <TopTable rows={(data.by_staff || []).map((r) => ({ name: r.name, value: rupee(r.revenue), sub: `${r.bookings} bookings` }))} />
      </div>
      <div className="z-card" style={{ padding: 16 }}>
        <div className="z-dsec">Top services</div>
        <TopTable rows={(data.by_service || []).slice(0, 15).map((r) => ({ name: r.name, value: rupee(r.revenue), sub: `× ${r.count}` }))} />
      </div>
    </>
  );
}

function TopTable({ rows }) {
  if (!rows.length) return <div className="z-empty" style={{ padding: 16 }}>No data</div>;
  const max = Math.max(...rows.map((r) => {
    const v = typeof r.value === 'string' ? parseInt(r.value.replace(/[^0-9]/g, ''), 10) : r.value;
    return v || 1;
  }));
  return (
    <div className="z-bar-chart">
      {rows.map((r, i) => {
        const v = typeof r.value === 'string' ? parseInt(r.value.replace(/[^0-9]/g, ''), 10) : r.value;
        return (
          <div key={i} className="z-bar-row">
            <div className="lbl" style={{ width: 130 }}>{r.name}</div>
            <div className="track"><div className="fill" style={{ width: `${(v / max) * 100}%` }} /></div>
            <div className="v" style={{ width: 130 }}>{r.value}<br /><small style={{ fontWeight: 600, color: 'var(--z-muted-2)' }}>{r.sub}</small></div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- PAYMENTS & GST ---------- */
function PaymentsTab({ salonId, view, date, getAuthHeaders }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/salons/${salonId}/reports/payments-gst?view=${view}&date=${date}`, { headers: getAuthHeaders() });
        setData(res.data);
      } catch (e) { toast.error('Failed to load payments'); }
    })();
  }, [salonId, view, date]); // eslint-disable-line
  if (!data) return <div className="z-empty">Loading…</div>;
  return (
    <>
      <div className="z-metrics">
        <div className="z-metric g-blue"><div className="k"><Icon name="money" />Collected</div>
          <div className="v">{rupee(data.total_collected)}</div>
          <div className="sub">All payment modes</div></div>
        <div className="z-metric g-mint"><div className="k"><Icon name="gauge" />Taxable</div>
          <div className="v">{rupee(data.gst?.taxable || 0)}</div>
          <div className="sub">Excl. GST</div></div>
        <div className="z-metric g-amber"><div className="k"><Icon name="tag" />CGST + SGST</div>
          <div className="v">{rupee((data.gst?.cgst || 0) + (data.gst?.sgst || 0))}</div>
          <div className="sub">Estimated at 18%</div></div>
        <div className="z-metric g-rose"><div className="k"><Icon name="chart" />Total tax</div>
          <div className="v">{rupee(data.gst?.total_tax || 0)}</div>
          <div className="sub">Gross {rupee(data.gst?.gross || 0)}</div></div>
      </div>
      <div className="z-card" style={{ padding: 16 }}>
        <div className="z-dsec">By payment mode</div>
        <div className="z-pay-grid">
          {(data.by_mode || []).map((m) => (
            <div key={m.mode} className="z-pay-opt">
              <Icon name={PAY_ICONS[m.mode.toLowerCase()] || 'money'} />
              <div style={{ flex: 1 }}>
                <div>{m.mode}</div>
                <div style={{ fontSize: 11, color: 'var(--z-muted)' }}>{rupee(m.amount)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- P&L ---------- */
function PnlTab({ salonId, view, date, getAuthHeaders, canManage, onAdd }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/salons/${salonId}/reports/pnl?view=${view}&date=${date}`, { headers: getAuthHeaders() });
        setData(res.data);
      } catch (e) { toast.error('Failed to load P&L'); }
    })();
  }, [salonId, view, date]); // eslint-disable-line
  if (!data) return <div className="z-empty">Loading…</div>;
  return (
    <>
      <div className="z-metrics">
        <div className="z-metric g-mint"><div className="k"><Icon name="trendup" />Revenue</div>
          <div className="v">{rupee(data.revenue)}</div></div>
        <div className="z-metric g-rose"><div className="k"><Icon name="wallet" />Expenses</div>
          <div className="v">{rupee(data.expenses_total)}</div></div>
        <div className="z-metric g-blue"><div className="k"><Icon name="chart" />Profit</div>
          <div className="v" style={{ color: data.profit >= 0 ? 'var(--z-ok)' : 'var(--z-bad)' }}>{rupee(data.profit)}</div></div>
        <div className="z-metric g-amber"><div className="k"><Icon name="gauge" />Margin</div>
          <div className="v">{data.revenue ? Math.round((data.profit / data.revenue) * 100) : 0}%</div></div>
      </div>
      <div className="z-card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="z-dsec" style={{ margin: 0 }}>Expenses by category</div>
          {canManage && (
            <button className="z-btn z-btn--soft z-btn--sm" onClick={onAdd}>
              <Icon name="plus" /> Add entry
            </button>
          )}
        </div>
        <TopTable rows={(data.expenses_by_category || []).map((r) => ({ name: r.category, value: rupee(r.amount), sub: '' }))} />
      </div>
    </>
  );
}

/* ---------- STAFF ---------- */
function StaffTab({ salonId, view, date, getAuthHeaders }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    // Reuse Sales endpoint's by_staff for a quick staff view.
    (async () => {
      try {
        const res = await axios.get(`${API}/salons/${salonId}/reports/sales?view=${view}&date=${date}`, { headers: getAuthHeaders() });
        setData(res.data);
      } catch (e) { /* noop */ }
    })();
  }, [salonId, view, date]); // eslint-disable-line
  if (!data) return <div className="z-empty">Loading…</div>;
  return (
    <div className="z-card" style={{ padding: 16 }}>
      <div className="z-dsec">Staff performance</div>
      <TopTable rows={(data.by_staff || []).map((r) => ({ name: r.name, value: rupee(r.revenue), sub: `${r.bookings} bookings · avg ${rupee(r.bookings ? r.revenue / r.bookings : 0)}` }))} />
    </div>
  );
}

/* ---------- CLIENTS ---------- */
function ClientsTab({ salonId, view, date, getAuthHeaders }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/salons/${salonId}/reports/clients?view=${view}&date=${date}`, { headers: getAuthHeaders() });
        setData(res.data);
      } catch (e) { /* noop */ }
    })();
  }, [salonId, view, date]); // eslint-disable-line
  if (!data) return <div className="z-empty">Loading…</div>;
  return (
    <>
      <div className="z-metrics">
        <div className="z-metric g-blue"><div className="k"><Icon name="users" />Unique guests</div>
          <div className="v">{data.unique_guests}</div></div>
        <div className="z-metric g-mint"><div className="k"><Icon name="user" />New</div>
          <div className="v">{data.new_guests}</div></div>
        <div className="z-metric g-amber"><div className="k"><Icon name="ret" />Returning</div>
          <div className="v">{data.returning_guests}</div></div>
        <div className="z-metric g-rose"><div className="k"><Icon name="gauge" />Retention</div>
          <div className="v">{data.unique_guests ? Math.round((data.returning_guests / data.unique_guests) * 100) : 0}%</div></div>
      </div>
      <div className="z-card" style={{ padding: 16 }}>
        <div className="z-dsec">Top spenders</div>
        <TopTable rows={(data.top_spenders || []).map((r) => ({ name: r.name, value: rupee(r.spend), sub: `${r.visits} visits · ${r.phone}` }))} />
      </div>
    </>
  );
}

/* ---------- MARKETING ---------- */
function MarketingTab({ salonId, view, date, getAuthHeaders }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/salons/${salonId}/reports/marketing?view=${view}&date=${date}`, { headers: getAuthHeaders() });
        setData(res.data);
      } catch (e) { /* noop */ }
    })();
  }, [salonId, view, date]); // eslint-disable-line
  if (!data) return <div className="z-empty">Loading…</div>;
  return (
    <div className="z-metrics">
      <div className="z-metric g-blue"><div className="k"><Icon name="chart" />Messages sent</div>
        <div className="v">{data.messages_sent}</div>
        <div className="sub">{data.delivered} delivered</div></div>
      <div className="z-metric g-mint"><div className="k"><Icon name="tag" />Coupons</div>
        <div className="v">{data.coupon_redemptions}</div>
        <div className="sub">Redemptions</div></div>
      <div className="z-metric g-amber"><div className="k"><Icon name="wallet" />Coupon value</div>
        <div className="v">{rupee(data.coupon_value)}</div>
        <div className="sub">Total discount</div></div>
      <div className="z-metric g-rose"><div className="k"><Icon name="money" />Cost</div>
        <div className="v">{rupee(data.cost)}</div>
        <div className="sub">Messaging spend</div></div>
    </div>
  );
}

/* ---------- INVENTORY ---------- */
function InventoryReportsTab({ salonId, view, date, getAuthHeaders }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/salons/${salonId}/reports/inventory?view=${view}&date=${date}`, { headers: getAuthHeaders() });
        setData(res.data);
      } catch (e) { /* noop */ }
    })();
  }, [salonId, view, date]); // eslint-disable-line
  if (!data) return <div className="z-empty">Loading…</div>;
  return (
    <>
      <div className="z-metrics">
        <div className="z-metric g-blue"><div className="k"><Icon name="box" />On hand</div>
          <div className="v">{rupee(data.on_hand_value)}</div></div>
        <div className="z-metric g-mint"><div className="k"><Icon name="cart" />Purchases</div>
          <div className="v">{rupee(data.purchases_value)}</div></div>
        <div className="z-metric g-amber"><div className="k"><Icon name="scissors" />Consumed</div>
          <div className="v">{rupee(data.consumed_value)}</div></div>
        <div className="z-metric g-rose"><div className="k"><Icon name="alert" />Below reorder</div>
          <div className="v">{data.below_reorder?.length || 0}</div></div>
      </div>
      <div className="z-card" style={{ padding: 16 }}>
        <div className="z-dsec">Items below reorder level</div>
        {(!data.below_reorder || data.below_reorder.length === 0) ? (
          <div className="z-empty" style={{ padding: 20 }}>All items are healthy.</div>
        ) : (
          data.below_reorder.map((r, i) => (
            <div key={i} className="z-cline">
              <div className="ci">📦</div>
              <div className="cn">
                <div className="t">{r.name}</div>
                <div className="s">Qty {r.qty} · Reorder at {r.reorder_level}</div>
              </div>
              <span className="z-pill z-pill--warn">Low</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/* ---------- ADD ENTRY (Finance) ---------- */
function AddEntryDialog({ salonId, getAuthHeaders, onClose }) {
  const [f, setF] = useState({
    type: 'outflow',
    category: 'consumables',
    amount: '',
    payment_mode: 'cash',
    narration: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [busy, setBusy] = useState(false);
  const upd = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    if (!f.amount || Number(f.amount) <= 0) return toast.error('Enter amount');
    setBusy(true);
    try {
      await axios.post(`${API}/salons/${salonId}/financials/transactions`, {
        ...f, amount: parseFloat(f.amount),
      }, { headers: getAuthHeaders() });
      toast.success('Entry saved');
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Save failed');
    } finally { setBusy(false); }
  };
  return (
    <>
      <div className="z-overlay" onClick={onClose} />
      <aside className="z-drawer">
        <div className="z-drawer-h">
          <div className="dico"><Icon name="wallet" size={20} /></div>
          <div><div className="eyebrow">Finance</div><h3>Add entry</h3><p>Record an expense, deposit, or adjustment.</p></div>
          <button className="z-drawer-close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="z-drawer-body">
          <div className="z-field"><label>Type</label>
            <div className="z-seg" style={{ display: 'flex', width: '100%' }}>
              {[{ v: 'inflow', l: 'Inflow' }, { v: 'outflow', l: 'Outflow' }, { v: 'deposit', l: 'Deposit' }, { v: 'withdrawal', l: 'Withdrawal' }, { v: 'adjustment', l: 'Adjustment' }].map((t) => (
                <button key={t.v} className={f.type === t.v ? 'on' : ''} onClick={() => upd('type', t.v)} style={{ flex: 1 }}>{t.l}</button>
              ))}
            </div>
          </div>
          <div className="z-field"><label>Category</label>
            <select value={f.category} onChange={(e) => upd('category', e.target.value)}>
              {['consumables', 'salary', 'staff_refreshment', 'utilities', 'rent', 'maintenance', 'products', 'marketing', 'equipment', 'custom'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="z-grid2">
            <div className="z-field"><label>Amount (₹)</label>
              <input type="number" value={f.amount} onChange={(e) => upd('amount', e.target.value)} autoFocus />
            </div>
            <div className="z-field"><label>Date</label>
              <input type="date" value={f.date} onChange={(e) => upd('date', e.target.value)} />
            </div>
          </div>
          <div className="z-field"><label>Payment mode</label>
            <select value={f.payment_mode} onChange={(e) => upd('payment_mode', e.target.value)}>
              {['cash', 'upi', 'card', 'wallet'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="z-field"><label>Narration</label>
            <textarea value={f.narration} onChange={(e) => upd('narration', e.target.value)} placeholder="Optional note…" />
          </div>
        </div>
        <div className="z-drawer-foot" style={{ display: 'flex', gap: 10 }}>
          <button className="z-btn z-btn--ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="z-btn z-btn--pri" style={{ flex: 2 }} onClick={save} disabled={busy}>
            <Icon name="save" /> {busy ? 'Saving…' : 'Save entry'}
          </button>
        </div>
      </aside>
    </>
  );
}

/* ---------- CONFIGURE CARDS ---------- */
function ConfigDialog({ salonId, getAuthHeaders, onClose }) {
  const [prefs, setPrefs] = useState({ all_cards: [], cards: [], order: [] });
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/salons/${salonId}/reports/prefs`, { headers: getAuthHeaders() });
        setPrefs(res.data);
      } catch (e) { toast.error('Load failed'); }
    })();
  }, []); // eslint-disable-line
  const toggle = (id) => {
    setPrefs((p) => {
      const set = new Set(p.cards);
      if (set.has(id)) set.delete(id); else set.add(id);
      return { ...p, cards: Array.from(set) };
    });
  };
  const save = async () => {
    try {
      await axios.put(`${API}/salons/${salonId}/reports/prefs`, {
        cards: prefs.cards, order: prefs.order,
      }, { headers: getAuthHeaders() });
      toast.success('Saved — reload to see changes');
      onClose();
    } catch (e) { toast.error('Save failed'); }
  };
  return (
    <>
      <div className="z-overlay" onClick={onClose} />
      <aside className="z-drawer">
        <div className="z-drawer-h">
          <div className="dico"><Icon name="settings" size={20} /></div>
          <div><div className="eyebrow">Snapshot</div><h3>Configure cards</h3><p>Choose which KPIs appear on your snapshot.</p></div>
          <button className="z-drawer-close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="z-drawer-body">
          {(prefs.all_cards || []).map((c) => (
            <div key={c.id} className="z-togrow" onClick={() => toggle(c.id)}>
              <button className={`z-toggle ${prefs.cards.includes(c.id) ? 'on' : ''}`} />
              <span>{c.label}</span>
            </div>
          ))}
        </div>
        <div className="z-drawer-foot" style={{ display: 'flex', gap: 10 }}>
          <button className="z-btn z-btn--ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="z-btn z-btn--pri" style={{ flex: 2 }} onClick={save}><Icon name="save" /> Save</button>
        </div>
      </aside>
    </>
  );
}

/* ---------- TARGETS ---------- */
function TargetsDialog({ salonId, view, getAuthHeaders, onClose }) {
  const [cards, setCards] = useState([]);
  const [targets, setTargets] = useState({});
  useEffect(() => {
    (async () => {
      try {
        const [snap, prefs] = await Promise.all([
          axios.get(`${API}/salons/${salonId}/reports/snapshot?view=${view}`, { headers: getAuthHeaders() }),
          axios.get(`${API}/salons/${salonId}/reports/prefs`, { headers: getAuthHeaders() }),
        ]);
        setCards(snap.data?.cards || []);
        const t = {};
        (snap.data?.cards || []).forEach((c) => { t[c.id] = c.target; });
        setTargets(t);
      } catch (e) { /* noop */ }
    })();
  }, [view]); // eslint-disable-line
  const save = async (id) => {
    try {
      await axios.put(`${API}/salons/${salonId}/reports/targets`, {
        metric_id: id, period_type: view, target: Number(targets[id]) || 0,
      }, { headers: getAuthHeaders() });
      toast.success('Target saved');
    } catch (e) { toast.error('Save failed'); }
  };
  return (
    <>
      <div className="z-overlay" onClick={onClose} />
      <aside className="z-drawer">
        <div className="z-drawer-h">
          <div className="dico"><Icon name="gauge" size={20} /></div>
          <div><div className="eyebrow">{view} targets</div><h3>Edit targets</h3><p>Set the goal for each visible metric.</p></div>
          <button className="z-drawer-close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="z-drawer-body">
          {cards.map((c) => (
            <div key={c.id} className="z-field">
              <label>{c.label}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="number" value={targets[c.id] ?? ''} onChange={(e) => setTargets((t) => ({ ...t, [c.id]: e.target.value }))} style={{ flex: 1 }} />
                <button className="z-btn z-btn--soft z-btn--sm" onClick={() => save(c.id)}><Icon name="save" /></button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--z-muted-2)', marginTop: 3 }}>Current: {c.money ? rupee(c.total) : c.total}</div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
