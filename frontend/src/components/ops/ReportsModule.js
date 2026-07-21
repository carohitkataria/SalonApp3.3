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
function exportCardsToCsv(cards, windowMeta) {
  if (!cards || !cards.length) { toast.info('Nothing to export'); return; }
  const rows = [['Metric', 'Achieved', 'Projected', 'Target', 'Trend']];
  cards.forEach((c) => {
    rows.push([
      (c.label || '').replace(/,/g, ' '),
      c.total ?? '',
      c.projected ?? '',
      c.target ?? '',
      c.trend ?? '',
    ]);
  });
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob(
    [`# Reports snapshot ${windowMeta?.view || ''} ${windowMeta?.start || ''} to ${windowMeta?.end || ''}\n`, csv],
    { type: 'text/csv' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reports-snapshot-${windowMeta?.start || Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('CSV exported');
}

export default function ReportsModule({ salonId, canManageFinancials = true, getAuthHeaders }) {
  useEffect(() => { injectZenCss(); }, []);
  const [tab, setTab] = useState('snapshot');
  const [view, setView] = useState('month'); // day | week | month
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [compare, setCompare] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showTargets, setShowTargets] = useState(false);
  // Snapshot data lifted for the export button in header
  const [snapshotData, setSnapshotData] = useState({ cards: [], window: null });
  // Branch filter — 'all' means aggregate across all branches
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('all');

  useEffect(() => {
    if (!salonId) return;
    (async () => {
      try {
        const res = await axios.get(`${API}/salons/${salonId}/branches`, { headers: getAuthHeaders() });
        setBranches(res.data || []);
      } catch (_) { /* single-branch mode is fine */ }
    })();
  }, [salonId, getAuthHeaders]);

  const effectiveBranch = branchId === 'all' ? null : branchId;

  return (
    <div className="zen">
      <div className="z-wrap">
        <div className="z-phead">
          <div>
            <div className="eyebrow">Business intelligence</div>
            <h1>Reports</h1>
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
            {branches.length > 1 && (
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                data-testid="reports-branch-filter"
                title="Filter by branch"
                style={{ padding: '8px 12px', border: '1px solid var(--z-line)', borderRadius: 10, background: '#fff', fontWeight: 700, fontSize: 13, color: 'var(--z-ink-soft)', cursor: 'pointer' }}
              >
                <option value="all">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.branch_name || b.name}</option>
                ))}
              </select>
            )}
            <button className={`z-btn ${compare ? 'z-btn--soft' : 'z-btn--ghost'}`} onClick={() => setCompare((c) => !c)}>
              <Icon name="layers" /> Compare
            </button>
            <button className="z-btn z-btn--ghost"
                    onClick={() => exportCardsToCsv(snapshotData.cards, snapshotData.window)}
                    data-testid="reports-export-btn"
                    title="Download snapshot as CSV">
              <Icon name="save" /> Export
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
            salonId={salonId} view={view} date={date} compare={compare} branchId={effectiveBranch}
            getAuthHeaders={getAuthHeaders}
            onConfigure={() => setShowConfig(true)}
            onTargets={() => setShowTargets(true)}
            onLoaded={setSnapshotData}
          />
        )}
        {tab === 'sales' && <SalesTab salonId={salonId} view={view} date={date} branchId={effectiveBranch} getAuthHeaders={getAuthHeaders} />}
        {tab === 'payments-gst' && <PaymentsTab salonId={salonId} view={view} date={date} branchId={effectiveBranch} getAuthHeaders={getAuthHeaders} />}
        {tab === 'pnl' && <PnlTab salonId={salonId} view={view} date={date} branchId={effectiveBranch} getAuthHeaders={getAuthHeaders} canManage={canManageFinancials} onAdd={() => setShowAddEntry(true)} />}
        {tab === 'staff' && <StaffTab salonId={salonId} view={view} date={date} branchId={effectiveBranch} getAuthHeaders={getAuthHeaders} />}
        {tab === 'clients' && <ClientsTab salonId={salonId} view={view} date={date} branchId={effectiveBranch} getAuthHeaders={getAuthHeaders} />}
        {tab === 'marketing' && <MarketingTab salonId={salonId} view={view} date={date} branchId={effectiveBranch} getAuthHeaders={getAuthHeaders} />}
        {tab === 'inventory' && <InventoryReportsTab salonId={salonId} view={view} date={date} branchId={effectiveBranch} getAuthHeaders={getAuthHeaders} />}
      </div>

      {showAddEntry && <AddEntryDialog salonId={salonId} getAuthHeaders={getAuthHeaders} onClose={() => setShowAddEntry(false)} />}
      {showConfig && <ConfigDialog salonId={salonId} getAuthHeaders={getAuthHeaders} onClose={() => setShowConfig(false)} />}
      {showTargets && <TargetsDialog salonId={salonId} view={view} getAuthHeaders={getAuthHeaders} onClose={() => setShowTargets(false)} />}
    </div>
  );
}

/* ---------- SNAPSHOT (Zenoti-style split view — gradient KPI cards on left, animated pie + table on right) ---------- */
const GRADS = [
  ['linear-gradient(135deg,#EDE9FE 0%,#DCE4FD 100%)', '#6D5AE0'],
  ['linear-gradient(135deg,#FDECD9 0%,#FBD8C1 100%)', '#DB8433'],
  ['linear-gradient(135deg,#FCE0EC 0%,#F8C9DC 100%)', '#D24C86'],
  ['linear-gradient(135deg,#FDE3DD 0%,#F9C6BE 100%)', '#DF6350'],
  ['linear-gradient(135deg,#D8F2EA 0%,#C1EADB 100%)', '#149A80'],
  ['linear-gradient(135deg,#E2EFFD 0%,#C9E0FB 100%)', '#3A7ED4'],
  ['linear-gradient(135deg,#EEE4FC 0%,#DFCFFA 100%)', '#7A5CD1'],
  ['linear-gradient(135deg,#FBF1D3 0%,#F6E1A8 100%)', '#C0941C'],
];
const PIE_COLORS = ['#2145C7', '#7CB342', '#D9A82C', '#A61E4D', '#E5556E', '#3E93E8', '#7A5CD1', '#12A594', '#DB8433', '#E5484D'];
const CARD_ICON = {
  appointments: 'calendar', collections: 'money', revenue: 'trendup', source: 'chart',
  guests: 'users', avgticket: 'tag', utilization: 'gauge', wait: 'clock',
  products: 'box', addons: 'plus', noshow: 'bell', rebooking: 'refresh',
  feedback: 'star', membership: 'wallet', discounts: 'scissors',
};
const BAR_IDS = new Set(['wait', 'feedback']);

function formatCardValue(card) {
  const v = card.total;
  if (card.money) return rupee(v);
  const label = (card.label || '').toLowerCase();
  if (card.id === 'utilization' || card.id === 'noshow' || card.id === 'rebooking' || label.includes('rate') || label.includes('%')) return `${Math.round(v || 0)}%`;
  if (card.id === 'wait') return `${Math.round(v || 0)} min`;
  if (card.id === 'feedback') return `${(v || 0).toFixed(1)}`;
  return `${v}`;
}

function AnimatedPie({ data, centerLabel, centerValue }) {
  const total = data.reduce((s, d) => s + Number(d[1] || 0), 0) || 1;
  const R = 60, sw = 28, cx = 85, cy = 85, circ = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="z-pie">
      <svg viewBox="0 0 170 170" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--z-line-2)" strokeWidth={sw} />
        {data.map(([name, value], i) => {
          const frac = Number(value || 0) / total;
          const len = frac * circ;
          const rot = acc * 360;
          acc += frac;
          const col = PIE_COLORS[i % PIE_COLORS.length];
          return (
            <circle
              key={name + i}
              className="z-pieseg"
              cx={cx} cy={cy} r={R}
              fill="none"
              stroke={col}
              strokeWidth={sw}
              strokeDasharray={`0 ${circ.toFixed(1)}`}
              style={{
                '--len': `${len.toFixed(1)}`,
                '--gap': `${(circ - len).toFixed(1)}`,
                transform: `rotate(${rot.toFixed(2)}deg)`,
                transformOrigin: `${cx}px ${cy}px`,
                animationDelay: `${(i * 0.09).toFixed(2)}s`,
              }}
            >
              <title>{`${name}: ${Math.round(frac * 100)}%`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="z-pie-c">
        <div className="z-pie-c-v">{centerValue}</div>
        <div className="z-pie-c-l">{centerLabel || 'total'}</div>
      </div>
    </div>
  );
}

function AnimatedBars({ data }) {
  const max = Math.max(1, ...data.map((d) => Number(d[1] || 0)));
  const ticks = [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0];
  return (
    <div className="z-bars">
      <div className="yaxis">{ticks.map((t, i) => <span key={i}>{t}</span>)}</div>
      {data.map(([name, value], i) => {
        const h = Math.max(2, (Number(value || 0) / max) * 100);
        const col = PIE_COLORS[i % PIE_COLORS.length];
        return (
          <div key={name + i} className="z-bcol">
            <div className="bar" data-v={value} style={{ height: `${h}%`, background: col }} />
            <div className="bl">{name}</div>
          </div>
        );
      })}
    </div>
  );
}

function GaugeRing({ pct }) {
  const R = 26, circ = 2 * Math.PI * R;
  const color = pct >= 80 ? 'var(--z-ok)' : pct >= 40 ? 'var(--z-warn)' : 'var(--z-bad)';
  return (
    <div className="z-gauge">
      <svg width="60" height="60">
        <circle cx="30" cy="30" r={R} fill="none" stroke="var(--z-line)" strokeWidth="5" />
        <circle cx="30" cy="30" r={R} fill="none" stroke={color} strokeWidth="5"
                strokeLinecap="round" strokeDasharray={circ}
                strokeDashoffset={circ - (circ * pct) / 100} />
      </svg>
      <span className="gv" style={{ color }}>{pct}%</span>
    </div>
  );
}

function SnapshotTab({ salonId, view, date, compare, branchId, getAuthHeaders, onConfigure, onTargets, onLoaded }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [drill, setDrill] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const bp = branchId ? `&branch_id=${branchId}` : '';
      const res = await axios.get(
        `${API}/salons/${salonId}/reports/snapshot?view=${view}&date=${date}&compare=${compare}${bp}`,
        { headers: getAuthHeaders() }
      );
      const list = res.data?.cards || [];
      setCards(list);
      if (list.length && !list.find((c) => c.id === sel)) setSel(list[0].id);
      if (onLoaded) onLoaded({ cards: list, window: res.data?.window });
    } catch (e) {
      toast.error('Failed to load snapshot');
    } finally { setLoading(false); }
  }, [salonId, view, date, compare, branchId, getAuthHeaders, sel, onLoaded]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [salonId, view, date, compare, branchId]);

  const active = useMemo(() => cards.find((c) => c.id === sel) || cards[0], [cards, sel]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10 }}>
        <button className="z-btn z-btn--ghost z-btn--sm" onClick={onTargets} data-testid="reports-targets-btn">
          <Icon name="gauge" /> Targets
        </button>
        <button className="z-btn z-btn--ghost z-btn--sm" onClick={onConfigure} data-testid="reports-configure-btn">
          <Icon name="settings" /> Configure cards
        </button>
      </div>

      {loading ? (
        <div className="z-empty">Loading…</div>
      ) : cards.length === 0 ? (
        <div className="z-empty z-card"><Icon name="chart" size={40} /><br />No metrics available.</div>
      ) : (
        <div className="z-snap">
          <div className="z-snap-l">
            <div className="z-kgrid" data-testid="reports-kgrid">
              {cards.map((c, i) => {
                const [bg, acc] = GRADS[i % GRADS.length];
                const trendUp = c.up === true;
                const trendDown = c.up === false;
                return (
                  <button
                    key={c.id}
                    className={`z-kcard ${c.id === (active?.id) ? 'on' : ''}`}
                    style={{ background: bg }}
                    onClick={() => setSel(c.id)}
                    data-testid={`reports-card-${c.id}`}
                  >
                    <div className="kt">
                      <span className="kl">{c.label}</span>
                      <span className="kchip" style={{ color: acc }}>
                        <Icon name={CARD_ICON[c.id] || 'chart'} />
                      </span>
                    </div>
                    <div className="kv">{formatCardValue(c)}</div>
                    {c.trend && (
                      <div className={`kd ${trendUp ? 'up' : trendDown ? 'down' : 'flat'}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          {trendUp ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
                        </svg>
                        {c.trend}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="z-snap-r">
            {active && (
              <SnapshotDetail
                card={active}
                salonId={salonId} view={view} date={date}
                getAuthHeaders={getAuthHeaders}
                onEditTarget={() => setDetail(active)}
                onDrill={() => setDrill(active)}
              />
            )}
          </div>
        </div>
      )}

      {detail && (
        <TargetEditDrawer
          card={detail} salonId={salonId} view={view}
          getAuthHeaders={getAuthHeaders}
          onClose={() => setDetail(null)}
          onSaved={() => { setDetail(null); load(); }}
        />
      )}
      {drill && (
        <MetricDrillDrawer
          card={drill} salonId={salonId} view={view} date={date}
          getAuthHeaders={getAuthHeaders}
          onClose={() => setDrill(null)}
        />
      )}
    </>
  );
}

/* ------ Detail panel showing pie chart + achievement gauge + share table ------ */
function SnapshotDetail({ card, salonId, view, date, getAuthHeaders, onEditTarget, onDrill }) {
  const [breakdown, setBreakdown] = useState(card.chart?.data || []);
  useEffect(() => {
    setBreakdown(card.chart?.data || []);
    (async () => {
      try {
        const res = await axios.get(
          `${API}/salons/${salonId}/reports/metric/${card.id}?view=${view}&date=${date}`,
          { headers: getAuthHeaders() }
        );
        if (res.data?.breakdown) {
          setBreakdown(res.data.breakdown.map((r) => [r.label, r.value]));
        }
      } catch (_) { /* keep existing chart data */ }
    })();
  }, [card.id, view, date]); // eslint-disable-line

  const useBars = BAR_IDS.has(card.id) || card.chart?.kind === 'bar';
  const pct = card.target > 0 ? Math.min(100, Math.round((card.total / card.target) * 100)) : 0;
  const total = breakdown.reduce((s, d) => s + Number(d[1] || 0), 0);

  return (
    <>
      <div className="z-dtop">
        <div>
          <h3>{card.label.replace(' (₹)', '')}</h3>
          <p>{card.description || 'Detailed breakdown for this metric.'}</p>
        </div>
        <div className="z-tgt">
          <div className="tc">
            <span className="k">Achieved</span>
            <span className="v">{formatCardValue(card)}</span>
          </div>
          <div className="sep" />
          <div className="tc">
            <span className="k">Projected</span>
            <span className="v">{formatCardValue({ ...card, total: card.projected || 0 })}</span>
          </div>
          <div className="sep" />
          <div className="tc">
            <span className="k">Target</span>
            <span className="v">
              {formatCardValue({ ...card, total: card.target || 0 })}
              <button onClick={onEditTarget} title="Edit target" data-testid={`reports-edit-target-${card.id}`}>
                <Icon name="edit" size={14} />
              </button>
            </span>
          </div>
          <GaugeRing pct={pct} />
        </div>
      </div>

      <div className="z-dbody">
        <div className="z-chartbox">
          <div className="z-chart-ttl">{card.chart?.title || 'Breakdown'}</div>
          {breakdown.length === 0 ? (
            <div className="z-empty" style={{ padding: '30px 10px' }}>No data for this period.</div>
          ) : useBars ? (
            <AnimatedBars data={breakdown} />
          ) : (
            <>
              <div className="z-pieholder">
                <AnimatedPie
                  data={breakdown}
                  centerLabel="Total"
                  centerValue={card.money ? rupee(total) : Math.round(total)}
                />
              </div>
              <div className="z-legend">
                {breakdown.map(([n], i) => (
                  <span key={n + i}>
                    <i style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{n}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="z-dtable">
          <table>
            <thead>
              <tr><th>{(card.chart?.title || 'Item')}</th><th>Value</th></tr>
            </thead>
            <tbody>
              {breakdown.map(([n, v], i) => (
                <tr key={n + i}>
                  <td>
                    <span className="sw" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {n}
                  </td>
                  <td>{card.money ? rupee(v) : Math.round(Number(v || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="z-dfoot">
        <a onClick={() => toast.info('Feedback noted — thanks!')} data-testid="reports-feedback-link">Give feedback</a>
        <a onClick={onDrill} data-testid={`reports-drill-${card.id}`}>View details ›</a>
      </div>
    </>
  );
}

/* ------ Target edit drawer (per metric) ------ */
function TargetEditDrawer({ card, salonId, view, getAuthHeaders, onClose, onSaved }) {
  const [value, setValue] = useState(card.target || 0);
  const save = async () => {
    try {
      await axios.put(
        `${API}/salons/${salonId}/reports/targets`,
        { metric_id: card.id, period_type: view, target: Number(value) },
        { headers: getAuthHeaders() }
      );
      toast.success('Target updated');
      onSaved();
    } catch (e) { toast.error('Could not save target'); }
  };
  return (
    <>
      <div className="z-overlay" onClick={onClose} />
      <aside className="z-drawer" style={{ zIndex: 2000, maxWidth: 460 }}>
        <div className="z-drawer-h">
          <div className="dico"><Icon name="gauge" /></div>
          <div>
            <div className="eyebrow">Set target</div>
            <h3>{card.label}</h3>
            <p>{view.charAt(0).toUpperCase() + view.slice(1)} target</p>
          </div>
          <button className="z-drawer-close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="z-drawer-body">
          <div className="z-field">
            <label>Target value</label>
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)}
                   data-testid={`reports-target-input-${card.id}`} />
          </div>
        </div>
        <div className="z-drawer-foot" style={{ display: 'flex', gap: 10 }}>
          <button className="z-btn z-btn--ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="z-btn z-btn--pri" style={{ flex: 2 }} onClick={save} data-testid={`reports-target-save-${card.id}`}>
            <Icon name="save" /> Save target
          </button>
        </div>
      </aside>
    </>
  );
}

/* ------ Drill-down: full breakdown with per-row share and bar mini ------ */
function MetricDrillDrawer({ card, salonId, view, date, getAuthHeaders, onClose }) {
  const [data, setData] = useState({ breakdown: [] });
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(
          `${API}/salons/${salonId}/reports/metric/${card.id}?view=${view}&date=${date}`,
          { headers: getAuthHeaders() }
        );
        setData(res.data);
      } catch (_) { /* ignore */ }
    })();
  }, [card.id, view, date]); // eslint-disable-line

  const rows = data.breakdown || (card.chart?.data || []).map(([label, value]) => ({ label, value, share: 0 }));
  const maxV = Math.max(1, ...rows.map((r) => Number(r.value || 0)));
  return (
    <>
      <div className="z-overlay" onClick={onClose} />
      <aside className="z-drawer wide" style={{ zIndex: 2000 }}>
        <div className="z-drawer-h">
          <div className="dico"><Icon name="chart" /></div>
          <div>
            <div className="eyebrow">Detail</div>
            <h3>{card.label.replace(' (₹)', '')} — details</h3>
            <p>Full share breakdown</p>
          </div>
          <button className="z-drawer-close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="z-drawer-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
            <div className="z-metric g-blue"><div className="k">Achieved</div><div className="v">{formatCardValue(card)}</div></div>
            <div className="z-metric g-mint"><div className="k">Projected</div><div className="v">{formatCardValue({ ...card, total: card.projected || 0 })}</div></div>
            <div className="z-metric g-amber"><div className="k">Target</div><div className="v">{formatCardValue({ ...card, total: card.target || 0 })}</div></div>
          </div>
          <div className="z-dtable">
            <table>
              <thead>
                <tr><th>Item</th><th>Bar</th><th>Value</th><th>Share</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.label + i}>
                    <td><span className="sw" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{r.label}</td>
                    <td style={{ minWidth: 100 }}>
                      <div style={{ height: 7, background: 'var(--z-line-2)', borderRadius: 20, overflow: 'hidden', minWidth: 70 }}>
                        <div style={{ height: '100%', width: `${(Number(r.value || 0) / maxV) * 100}%`, background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 20 }} />
                      </div>
                    </td>
                    <td>{card.money ? rupee(r.value) : Math.round(Number(r.value || 0))}</td>
                    <td>{r.share || Math.round((Number(r.value || 0) / (rows.reduce((s, x) => s + Number(x.value || 0), 0) || 1)) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ---------- SALES ---------- */
function SalesTab({ salonId, view, date, branchId, getAuthHeaders }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const bp = branchId ? `&branch_id=${branchId}` : '';
        const res = await axios.get(`${API}/salons/${salonId}/reports/sales?view=${view}&date=${date}${bp}`, { headers: getAuthHeaders() });
        setData(res.data);
      } catch (e) { toast.error('Failed to load sales'); }
    })();
  }, [salonId, view, date, branchId]); // eslint-disable-line
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
function PaymentsTab({ salonId, view, date, branchId, getAuthHeaders }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const bp = branchId ? `&branch_id=${branchId}` : '';
        const res = await axios.get(`${API}/salons/${salonId}/reports/payments-gst?view=${view}&date=${date}${bp}`, { headers: getAuthHeaders() });
        setData(res.data);
      } catch (e) { toast.error('Failed to load payments'); }
    })();
  }, [salonId, view, date, branchId]); // eslint-disable-line
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
function PnlTab({ salonId, view, date, branchId, getAuthHeaders, canManage, onAdd }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const bp = branchId ? `&branch_id=${branchId}` : '';
        const res = await axios.get(`${API}/salons/${salonId}/reports/pnl?view=${view}&date=${date}${bp}`, { headers: getAuthHeaders() });
        setData(res.data);
      } catch (e) { toast.error('Failed to load P&L'); }
    })();
  }, [salonId, view, date, branchId]); // eslint-disable-line
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
function StaffTab({ salonId, view, date, branchId, getAuthHeaders }) {
  const [sub, setSub] = useState('performance');
  return (
    <div>
      {/* Sub-tabs */}
      <div className="z-seg" style={{ display: 'inline-flex', marginBottom: 12 }} data-testid="staff-report-subtabs">
        {[
          { id: 'performance', l: 'Performance', ico: 'trendup' },
          { id: 'attendance', l: 'Attendance', ico: 'calendar' },
          { id: 'incentives', l: 'Incentives', ico: 'money' },
        ].map((t) => (
          <button
            key={t.id}
            className={sub === t.id ? 'on' : ''}
            onClick={() => setSub(t.id)}
            data-testid={`staff-report-tab-${t.id}`}
          >
            <Icon name={t.ico} /> {t.l}
          </button>
        ))}
      </div>
      {sub === 'performance' && <StaffPerformanceSub salonId={salonId} view={view} date={date} branchId={branchId} getAuthHeaders={getAuthHeaders} />}
      {sub === 'attendance' && <StaffAttendanceSub salonId={salonId} date={date} branchId={branchId} getAuthHeaders={getAuthHeaders} />}
      {sub === 'incentives' && <StaffIncentiveSub salonId={salonId} date={date} branchId={branchId} getAuthHeaders={getAuthHeaders} />}
    </div>
  );
}

function StaffPerformanceSub({ salonId, view, date, branchId, getAuthHeaders }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    // Reuse Sales endpoint's by_staff for a quick staff view.
    (async () => {
      try {
        const bp = branchId ? `&branch_id=${branchId}` : '';
        const res = await axios.get(`${API}/salons/${salonId}/reports/sales?view=${view}&date=${date}${bp}`, { headers: getAuthHeaders() });
        setData(res.data);
      } catch (e) { /* noop */ }
    })();
  }, [salonId, view, date, branchId]); // eslint-disable-line
  if (!data) return <div className="z-empty">Loading…</div>;
  return (
    <div className="z-card" style={{ padding: 16 }}>
      <div className="z-dsec">Staff performance</div>
      <TopTable rows={(data.by_staff || []).map((r) => ({ name: r.name, value: rupee(r.revenue), sub: `${r.bookings} bookings · avg ${rupee(r.bookings ? r.revenue / r.bookings : 0)}` }))} />
    </div>
  );
}

function StaffAttendanceSub({ salonId, date, branchId, getAuthHeaders }) {
  const month = (date || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/salons/${salonId}/staff-attendance/month/${month}`, { headers: getAuthHeaders() });
        setRows(res.data?.barbers || []);
      } catch (e) {
        setErr(e?.response?.data?.detail || 'Failed to load attendance');
      } finally { setLoading(false); }
    })();
  }, [salonId, month]); // eslint-disable-line
  if (loading) return <div className="z-empty">Loading attendance…</div>;
  if (err) return <div className="z-empty">Could not load: {String(err)}</div>;
  const summarise = (arr) => {
    const s = { P: 0, A: 0, H: 0, HO: 0, L: 0 };
    (arr || []).forEach((r) => {
      const st = (r.status || '').toLowerCase();
      if (st === 'present') s.P += 1;
      else if (st === 'absent') s.A += 1;
      else if (st === 'half_day' || st === 'half-day') s.H += 1;
      else if (st === 'holiday') s.HO += 1;
      else if (st === 'leave' || st === 'on_leave') s.L += 1;
    });
    return s;
  };
  const filtered = branchId ? rows.filter((r) => r.branch_id === branchId) : rows;
  const exportCsv = () => {
    const rowsCsv = [['Staff', 'Present', 'Half-day', 'Absent', 'Holiday', 'Leave', 'Total working']];
    filtered.forEach((r) => {
      const s = summarise(r.attendance);
      rowsCsv.push([r.name || r.barber_name || '—', s.P, s.H, s.A, s.HO, s.L, s.P + 0.5 * s.H]);
    });
    const csv = rowsCsv.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `staff-attendance-${month}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  return (
    <div className="z-card" style={{ padding: 16 }} data-testid="staff-attendance-report">
      <div className="z-dsec" style={{ display: 'flex', alignItems: 'center' }}>
        Staff attendance — {month}
        <button className="z-btn z-btn--ghost z-btn--sm" style={{ marginLeft: 'auto' }} onClick={exportCsv}>
          <Icon name="download" /> Export CSV
        </button>
      </div>
      {(filtered.length === 0) && <div className="z-empty" style={{ padding: 20 }}>No staff attendance for this month.</div>}
      {filtered.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="z-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--z-line, #E5DDE7)' }}>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 12 }}>Staff</th>
                <th style={{ padding: '10px 8px', fontSize: 12 }}>Present</th>
                <th style={{ padding: '10px 8px', fontSize: 12 }}>Half-day</th>
                <th style={{ padding: '10px 8px', fontSize: 12 }}>Absent</th>
                <th style={{ padding: '10px 8px', fontSize: 12 }}>Holiday</th>
                <th style={{ padding: '10px 8px', fontSize: 12 }}>Leave</th>
                <th style={{ padding: '10px 8px', fontSize: 12 }}>Working days</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const s = summarise(r.attendance);
                return (
                  <tr key={r.barber_id} style={{ borderBottom: '1px solid #F4EEF6' }}>
                    <td style={{ padding: '9px 8px', fontWeight: 600 }}>{r.name || r.barber_name || '—'}</td>
                    <td style={{ textAlign: 'center', padding: '9px 8px' }}><span className="z-pill z-pill--ok">{s.P}</span></td>
                    <td style={{ textAlign: 'center', padding: '9px 8px' }}><span className="z-pill z-pill--warn">{s.H}</span></td>
                    <td style={{ textAlign: 'center', padding: '9px 8px' }}><span className="z-pill">{s.A}</span></td>
                    <td style={{ textAlign: 'center', padding: '9px 8px' }}>{s.HO}</td>
                    <td style={{ textAlign: 'center', padding: '9px 8px' }}>{s.L}</td>
                    <td style={{ textAlign: 'center', padding: '9px 8px', fontWeight: 700 }}>{(s.P + 0.5 * s.H).toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StaffIncentiveSub({ salonId, date, branchId, getAuthHeaders }) {
  const month = (date || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/salons/${salonId}/reward-plan/incentives?month=${month}`, { headers: getAuthHeaders() });
        setRows(res.data?.records || res.data?.items || res.data || []);
      } catch (e) {
        setErr(e?.response?.data?.detail || 'Failed to load incentives');
      } finally { setLoading(false); }
    })();
  }, [salonId, month]); // eslint-disable-line
  if (loading) return <div className="z-empty">Loading incentives…</div>;
  if (err) return <div className="z-empty">Could not load: {String(err)}</div>;
  const totalIncentive = rows.reduce((a, r) => a + Number(r.incentive_amount || r.amount || 0), 0);
  const totalSales = rows.reduce((a, r) => a + Number(r.actual_sales || r.total_sales || 0), 0);
  const totalTarget = rows.reduce((a, r) => a + Number(r.target || r.target_amount || 0), 0);
  const exportCsv = () => {
    const rowsCsv = [['Staff', 'Target', 'Actual Sales', 'Achievement %', 'Incentive', 'Status']];
    rows.forEach((r) => {
      const actual = Number(r.actual_sales || r.total_sales || 0);
      const target = Number(r.target || r.target_amount || 0);
      const ach = target > 0 ? (actual / target) * 100 : 0;
      rowsCsv.push([r.barber_name || r.name || '—', target, actual, ach.toFixed(1) + '%', r.incentive_amount || r.amount || 0, r.status || 'Pending']);
    });
    const csv = rowsCsv.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `staff-incentives-${month}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  return (
    <div data-testid="staff-incentive-report">
      <div className="z-metrics" style={{ marginBottom: 12 }}>
        <div className="z-metric g-mint"><div className="k"><Icon name="trendup" />Sales</div><div className="v">{rupee(totalSales)}</div></div>
        <div className="z-metric g-blue"><div className="k"><Icon name="gauge" />Target</div><div className="v">{rupee(totalTarget)}</div></div>
        <div className="z-metric g-amber"><div className="k"><Icon name="money" />Total incentives</div><div className="v">{rupee(totalIncentive)}</div></div>
        <div className="z-metric g-rose"><div className="k"><Icon name="users" />Eligible staff</div><div className="v">{rows.length}</div></div>
      </div>
      <div className="z-card" style={{ padding: 16 }}>
        <div className="z-dsec" style={{ display: 'flex', alignItems: 'center' }}>
          Incentive breakup — {month}
          <button className="z-btn z-btn--ghost z-btn--sm" style={{ marginLeft: 'auto' }} onClick={exportCsv}>
            <Icon name="download" /> Export CSV
          </button>
        </div>
        {rows.length === 0 && <div className="z-empty" style={{ padding: 20 }}>No incentive records for this month. Configure a reward plan first.</div>}
        {rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="z-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--z-line, #E5DDE7)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 12 }}>Staff</th>
                  <th style={{ padding: '10px 8px', fontSize: 12 }}>Target</th>
                  <th style={{ padding: '10px 8px', fontSize: 12 }}>Actual Sales</th>
                  <th style={{ padding: '10px 8px', fontSize: 12 }}>Achievement</th>
                  <th style={{ padding: '10px 8px', fontSize: 12 }}>Incentive</th>
                  <th style={{ padding: '10px 8px', fontSize: 12 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const actual = Number(r.actual_sales || r.total_sales || 0);
                  const target = Number(r.target || r.target_amount || 0);
                  const ach = target > 0 ? (actual / target) * 100 : 0;
                  const st = String(r.status || 'Pending').toLowerCase();
                  const stCls = st === 'paid' ? 'z-pill--ok' : (st === 'approved' ? '' : 'z-pill--warn');
                  return (
                    <tr key={r.barber_id || i} style={{ borderBottom: '1px solid #F4EEF6' }}>
                      <td style={{ padding: '9px 8px', fontWeight: 600 }}>{r.barber_name || r.name || '—'}</td>
                      <td style={{ textAlign: 'center', padding: '9px 8px' }}>{rupee(target)}</td>
                      <td style={{ textAlign: 'center', padding: '9px 8px', fontWeight: 700 }}>{rupee(actual)}</td>
                      <td style={{ textAlign: 'center', padding: '9px 8px' }}>{ach.toFixed(1)}%</td>
                      <td style={{ textAlign: 'center', padding: '9px 8px', fontWeight: 700, color: 'var(--z-primary, #C6389E)' }}>{rupee(Number(r.incentive_amount || r.amount || 0))}</td>
                      <td style={{ textAlign: 'center', padding: '9px 8px' }}>
                        <span className={`z-pill ${stCls}`}>{r.status || 'Pending'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- CLIENTS ---------- */
function ClientsTab({ salonId, view, date, branchId, getAuthHeaders }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const bp = branchId ? `&branch_id=${branchId}` : '';
        const res = await axios.get(`${API}/salons/${salonId}/reports/clients?view=${view}&date=${date}${bp}`, { headers: getAuthHeaders() });
        setData(res.data);
      } catch (e) { /* noop */ }
    })();
  }, [salonId, view, date, branchId]); // eslint-disable-line
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
function MarketingTab({ salonId, view, date, branchId, getAuthHeaders }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const bp = branchId ? `&branch_id=${branchId}` : '';
        const res = await axios.get(`${API}/salons/${salonId}/reports/marketing?view=${view}&date=${date}${bp}`, { headers: getAuthHeaders() });
        setData(res.data);
      } catch (e) { /* noop */ }
    })();
  }, [salonId, view, date, branchId]); // eslint-disable-line
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
function InventoryReportsTab({ salonId, view, date, branchId, getAuthHeaders }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const bp = branchId ? `&branch_id=${branchId}` : '';
        const res = await axios.get(`${API}/salons/${salonId}/reports/inventory?view=${view}&date=${date}${bp}`, { headers: getAuthHeaders() });
        setData(res.data);
      } catch (e) { /* noop */ }
    })();
  }, [salonId, view, date, branchId]); // eslint-disable-line
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
          <div><div className="eyebrow">Finance</div><h3>Add entry</h3></div>
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
      const order = Array.isArray(p.order) ? [...p.order] : [];
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
        // Ensure order includes the newly enabled card — otherwise the backend
        // (which iterates `order` and filters by `cards`) will silently omit it
        // even though the toggle looks enabled.
        if (!order.includes(id)) order.push(id);
      }
      return { ...p, cards: Array.from(set), order };
    });
  };
  const save = async () => {
    try {
      // Reconcile order so it contains every enabled card at least once.
      const enabled = prefs.cards || [];
      const order = Array.isArray(prefs.order) ? [...prefs.order] : [];
      enabled.forEach((id) => { if (!order.includes(id)) order.push(id); });
      await axios.put(`${API}/salons/${salonId}/reports/prefs`, {
        cards: enabled, order,
      }, { headers: getAuthHeaders() });
      toast.success('Saved');
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
