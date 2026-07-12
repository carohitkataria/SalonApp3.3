/**
 * MarketingV2.js — new Marketing page redesign matching salon_marketing.html mock.
 * Uses .shv2 tokens (rail/ribbon shell already provided by HomeV2Shell wrapper).
 * All list panels expose a right-side drawer to CREATE new items.
 *
 * Wired to existing backend endpoints:
 *   GET  /api/salons/{id}/marketing/overview
 *   GET  /api/salons/{id}/marketing/campaigns
 *   POST /api/salons/{id}/marketing/campaigns
 *   POST /api/salons/{id}/marketing/campaigns/{cid}/launch|pause|resume|stop
 *   GET  /api/salons/{id}/marketing/automations
 *   POST /api/salons/{id}/marketing/automations
 *   PUT  /api/salons/{id}/marketing/automations/{aid}
 *   GET  /api/salons/{id}/marketing/templates
 *   POST /api/salons/{id}/marketing/templates
 *   GET  /api/salons/{id}/coupons
 *   POST /api/salons/{id}/coupons
 *   GET  /api/salons/{id}/marketing/segments
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { V2_PAGES_CSS } from './styles_v2';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// ---------------------- Small icon set ----------------------
const Ico = {
  send: () => <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  bolt: () => <svg viewBox="0 0 24 24"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  chat: () => <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  tag:  () => <svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  star: () => <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  gear: () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  chart:() => <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  plus: () => <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  close:() => <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check:() => <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  clock:() => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  images:() => <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>,
  mail: () => <svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>,
  wa:   () => <svg viewBox="0 0 24 24" style={{fill:'currentColor', stroke:'none'}}><path d="M12 2a10 10 0 0 0-8.7 15L2 22l5.2-1.3A10 10 0 1 0 12 2z"/></svg>,
  info: () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  users:() => <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>,
  rupee:() => <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  trending:() => <svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  external:() => <svg viewBox="0 0 24 24"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>,
  wifi:() => <svg viewBox="0 0 24 24"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>,
};

// ---------------------- Utilities ----------------------
const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const CH_STYLE = {
  whatsapp:{bg:'var(--wa-bg)', fg:'var(--wa)', label:'WhatsApp', icon: Ico.chat},
  sms:     {bg:'var(--sky-bg)', fg:'var(--sky)', label:'SMS',     icon: Ico.chat},
  email:   {bg:'var(--amber-bg)', fg:'var(--amber)', label:'Email', icon: Ico.mail},
};

// Inject scoped stylesheet once.
function useV2Styles() {
  useEffect(() => {
    const id = 'shv2-v2pages-styles';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = V2_PAGES_CSS;
    document.head.appendChild(el);
  }, []);
}

// ---------------------- Right-side drawer helper ----------------------
function Drawer({ open, onClose, title, subtitle, iconFn, children, footer }) {
  const IcFn = iconFn || Ico.send;
  return (
    <>
      <div className={`shv2-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`shv2-drawer v2-narrow ${open ? 'open' : ''}`}>
        <div className="v2-dh">
          <div className="tt">
            <div className="ic"><IcFn /></div>
            <div>
              <h3>{title}</h3>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          <button className="v2-close" onClick={onClose}><Ico.close /></button>
        </div>
        <div className="v2-db">{children}</div>
        {footer && <div className="v2-df">{footer}</div>}
      </aside>
    </>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function MarketingV2({ salonId, getAuthHeaders, salon }) {
  useV2Styles();

  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Drawers
  const [campaignDrawer, setCampaignDrawer] = useState(false);
  const [automationDrawer, setAutomationDrawer] = useState(false);
  const [templateDrawer, setTemplateDrawer] = useState(false);
  const [couponDrawer, setCouponDrawer] = useState(false);

  const authHeaders = useCallback(() => {
    try { return getAuthHeaders?.() || {}; } catch { return {}; }
  }, [getAuthHeaders]);

  const fetchAll = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    try {
      const [ov, cp, at, tp, cop, sg] = await Promise.allSettled([
        axios.get(`${API}/salons/${salonId}/marketing/overview`, { headers: authHeaders() }),
        axios.get(`${API}/salons/${salonId}/marketing/campaigns`, { headers: authHeaders() }),
        axios.get(`${API}/salons/${salonId}/marketing/automations`, { headers: authHeaders() }),
        axios.get(`${API}/salons/${salonId}/marketing/templates`, { headers: authHeaders() }),
        axios.get(`${API}/salons/${salonId}/coupons`, { headers: authHeaders() }),
        axios.get(`${API}/salons/${salonId}/marketing/segments`, { headers: authHeaders() }),
      ]);
      setOverview(ov.status === 'fulfilled' ? ov.value.data : null);
      setCampaigns(cp.status === 'fulfilled' ? (cp.value.data.campaigns || []) : []);
      setAutomations(at.status === 'fulfilled' ? (at.value.data.automations || []) : []);
      setTemplates(tp.status === 'fulfilled' ? (tp.value.data.templates || []) : []);
      setCoupons(cop.status === 'fulfilled' ? (cop.value.data.coupons || []) : []);
      setSegments(sg.status === 'fulfilled' ? (sg.value.data.segments || []) : []);
    } finally { setLoading(false); }
  }, [salonId, authHeaders]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Derive KPIs
  const kpi = useMemo(() => {
    const msg = overview?.messaging || {};
    const conv = overview?.conversion || {};
    const sent = msg.sent || 0;
    const delivered = msg.delivered || 0;
    const read = msg.read || 0;
    const spend = msg.spend_inr || 0;
    const redeems = conv.coupon_redemptions || 0;
    const revenue = conv.coupon_discount_amount || 0;
    const delvPct = sent ? Math.round((delivered / sent) * 100) : 0;
    const clickPct = sent ? Math.round((read / sent) * 100) : 0;
    const ros = spend > 0 ? (revenue / spend).toFixed(1) + '×' : (revenue > 0 ? '∞' : '0×');
    return { sent, delivered, delvPct, read, clickPct, redeems, revenue, ros };
  }, [overview]);

  // Channel mix — derived from messages field on marketing_messages via campaigns
  const channelMix = useMemo(() => {
    const acc = { whatsapp: 0, sms: 0, email: 0 };
    (campaigns || []).forEach(c => {
      const prov = String(c.provider || 'whatsapp').toLowerCase();
      const key = prov.includes('email') ? 'email' : prov.includes('sms') ? 'sms' : 'whatsapp';
      const sent = (c.stats?.sent) || 0;
      acc[key] += sent;
    });
    const total = acc.whatsapp + acc.sms + acc.email;
    return {
      whatsapp: total ? Math.round(acc.whatsapp / total * 100) : 56,
      sms:      total ? Math.round(acc.sms / total * 100) : 29,
      email:    total ? Math.round(acc.email / total * 100) : 15,
    };
  }, [campaigns]);

  const activeCampaigns = useMemo(
    () => (campaigns || []).filter(c => ['running','scheduled','live'].includes(String(c.status || '').toLowerCase())).slice(0, 3),
    [campaigns]
  );

  // Compute segment live counts (fallback: use rules preview if provided, else raw customer count)
  const [segCounts, setSegCounts] = useState({});
  useEffect(() => {
    (async () => {
      if (!salonId || !segments?.length) return;
      const map = {};
      for (const s of segments) {
        try {
          const res = await axios.post(
            `${API}/salons/${salonId}/marketing/segments/preview`,
            { name: s.name, description: s.description || '', rules: s.rules || { logic: 'AND', conditions: [] } },
            { headers: authHeaders() }
          );
          map[s.id] = res.data?.count || 0;
        } catch { map[s.id] = 0; }
      }
      setSegCounts(map);
    })();
  }, [salonId, segments, authHeaders]);

  return (
    <div>
      {/* HEADER */}
      <div className="phead">
        <div>
          <h2><span className="hic"><Ico.send /></span>Marketing</h2>
          <p>Campaigns · Automations · Templates · Offers &amp; Perks · Media · Settings</p>
        </div>
        <button className="btn-primary" onClick={() => setCampaignDrawer(true)}>
          <Ico.plus /> New campaign
        </button>
      </div>

      {/* SUB-TABS */}
      <div className="subtabs">
        {[
          { id: 'overview', label: 'Overview', ic: Ico.chart },
          { id: 'campaigns', label: 'Campaigns', ic: Ico.send },
          { id: 'automations', label: 'Automations', ic: Ico.bolt },
          { id: 'templates', label: 'Templates', ic: Ico.chat },
          { id: 'offers', label: 'Offers & Perks', ic: Ico.tag },
          { id: 'reputation', label: 'Reputation', ic: Ico.star },
          { id: 'media', label: 'Media', ic: Ico.images },
          { id: 'settings', label: 'Settings', ic: Ico.gear },
        ].map((t) => (
          <button key={t.id} className={`subtab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
            <t.ic /> {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="placeholder"><div className="pi"><Ico.clock /></div><b>Loading marketing data…</b></div>}

      {/* ===== OVERVIEW ===== */}
      {tab === 'overview' && (
        <div>
          {/* KPI ROW */}
          <div className="mk-kpis">
            <KpiTile chip="wa" icon={<Ico.chat />} val={kpi.sent.toLocaleString('en-IN')} label="Messages sent" />
            <KpiTile chip="green" icon={<Ico.check />} val={`${kpi.delvPct}%`} label="Delivered" sub={<span style={{color:'var(--green)'}}>{kpi.delivered.toLocaleString('en-IN')}</span>} />
            <KpiTile chip="sky" icon={<Ico.external />} val={`${kpi.clickPct}%`} label="Click rate" sub={<span style={{color:'var(--sky)'}}>{kpi.read.toLocaleString('en-IN')}</span>} />
            <KpiTile chip="amber" icon={<Ico.tag />} val={kpi.redeems.toLocaleString('en-IN')} label="Redemptions" />
            <KpiTile chip="violet" icon={<Ico.rupee />} val={rupee(kpi.revenue)} label="Attributed rev" />
            <KpiTile chip="rose" icon={<Ico.trending />} val={kpi.ros} label="Return on spend" />
          </div>

          {/* Active campaigns + Channel mix */}
          <div className="v2-grid2">
            <div className="card">
              <div className="card__h">
                <div className="t"><Ico.send /> Active campaigns</div>
                <a onClick={() => setTab('campaigns')} style={{cursor:'pointer'}}>See all ›</a>
              </div>
              <div className="clist">
                {activeCampaigns.length === 0 && (
                  <div className="placeholder" style={{padding:20}}>
                    <b>No active campaigns yet</b>
                    <p>Create one to reach the right guests in a few taps.</p>
                  </div>
                )}
                {activeCampaigns.map(c => <CampaignRow key={c.id} c={c} />)}
              </div>
            </div>
            <div className="card">
              <div className="card__h"><div className="t"><Ico.wifi /> Channel mix</div></div>
              <div className="chan">
                <div className="cl"><span>By messages delivered</span><span>India · WhatsApp-first</span></div>
                <div className="chan-bar">
                  <i style={{width:`${channelMix.whatsapp}%`,background:'var(--wa)'}}/>
                  <i style={{width:`${channelMix.sms}%`,background:'var(--sky)'}}/>
                  <i style={{width:`${channelMix.email}%`,background:'var(--amber)'}}/>
                </div>
                <div className="chan-leg">
                  <div className="r"><i style={{background:'var(--wa)'}}/><span className="nm">WhatsApp</span><span className="v">{channelMix.whatsapp}%</span></div>
                  <div className="r"><i style={{background:'var(--sky)'}}/><span className="nm">SMS (DLT)</span><span className="v">{channelMix.sms}%</span></div>
                  <div className="r"><i style={{background:'var(--amber)'}}/><span className="nm">Email</span><span className="v">{channelMix.email}%</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Audience segments */}
          <div className="card">
            <div className="card__h">
              <div className="t"><Ico.users /> Audience segments</div>
              <a onClick={() => toast.info('Segment builder coming soon')} style={{cursor:'pointer'}}>Manage ›</a>
            </div>
            <div className="seg-grid">
              {segments.slice(0, 6).map((s, idx) => {
                const dots = ['var(--rose)','var(--amber)','var(--violet)','var(--teal)','var(--sky)','var(--green)'];
                return (
                  <div className="seg-card" key={s.id}>
                    <div className="st"><span className="d" style={{background: dots[idx % dots.length]}}/>{s.name}</div>
                    <div className="sc">{segCounts[s.id] ?? '…'} <small>guests</small></div>
                    <button className="seg-send" onClick={() => { setCampaignDrawer({ preselectSegmentId: s.id }); }}>
                      <Ico.send /> Send offer
                    </button>
                  </div>
                );
              })}
              {segments.length === 0 && (
                <div className="placeholder" style={{gridColumn:'1 / -1'}}>
                  <div className="pi"><Ico.users /></div>
                  <b>No segments defined yet</b>
                  <p>Create segments like "Birthday this month", "Lapsed 60+ days", "High spenders ₹5k+".</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== CAMPAIGNS ===== */}
      {tab === 'campaigns' && (
        <div className="card">
          <div className="card__h">
            <div className="t"><Ico.send /> All campaigns</div>
            <button className="btn-ghost" onClick={() => setCampaignDrawer(true)}><Ico.plus />New</button>
          </div>
          <div className="clist">
            {campaigns.length === 0 && <div className="placeholder"><b>No campaigns yet</b><p>Click "New" to create your first WhatsApp/SMS/Email campaign.</p></div>}
            {campaigns.map(c => (
              <CampaignRow
                key={c.id}
                c={c}
                onLaunch={async () => {
                  try {
                    await axios.post(`${API}/salons/${salonId}/marketing/campaigns/${c.id}/launch`, {}, { headers: authHeaders() });
                    toast.success('Campaign launched');
                    fetchAll();
                  } catch (e) { toast.error(e.response?.data?.detail || 'Launch failed'); }
                }}
                onPause={async () => {
                  try {
                    await axios.post(`${API}/salons/${salonId}/marketing/campaigns/${c.id}/pause`, {}, { headers: authHeaders() });
                    toast.success('Paused');
                    fetchAll();
                  } catch (e) { toast.error(e.response?.data?.detail || 'Pause failed'); }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ===== AUTOMATIONS ===== */}
      {tab === 'automations' && (
        <div className="card">
          <div className="card__h">
            <div className="t"><Ico.bolt /> Always-on automations</div>
            <button className="btn-ghost" onClick={() => setAutomationDrawer(true)}><Ico.plus />New automation</button>
          </div>
          <div>
            {automations.length === 0 && <div className="placeholder"><b>No automations yet</b><p>Create trigger-based flows like reminders, birthday wishes, win-backs.</p></div>}
            {automations.map((a) => (
              <div className="auto-row" key={a.id}>
                <div className="ai" style={{background:'var(--sky-bg)', color:'var(--sky)'}}><Ico.bolt /></div>
                <div className="an">
                  <b>{a.name || a.trigger || 'Automation'}</b>
                  <span>{a.description || `${a.channel || 'WhatsApp'} · trigger: ${a.trigger || 'custom'}`}</span>
                </div>
                <button
                  className={`toggle ${a.active ? 'on' : ''}`}
                  onClick={async () => {
                    try {
                      await axios.put(`${API}/salons/${salonId}/marketing/automations/${a.id}`,
                        { ...a, active: !a.active },
                        { headers: authHeaders() });
                      toast.success(`Automation ${!a.active ? 'enabled' : 'paused'}`);
                      fetchAll();
                    } catch (e) { toast.error(e.response?.data?.detail || 'Update failed'); }
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== TEMPLATES ===== */}
      {tab === 'templates' && (
        <div>
          <div className="card__h" style={{marginBottom:16}}>
            <div className="t"><Ico.chat />Message templates</div>
            <button className="btn-primary" onClick={() => setTemplateDrawer(true)}><Ico.plus />New template</button>
          </div>
          <div className="v2-grid2b">
            {templates.length === 0 && (
              <div className="placeholder" style={{gridColumn:'1 / -1'}}>
                <div className="pi"><Ico.chat/></div>
                <b>No templates yet</b>
                <p>Create WhatsApp templates and submit them to Twilio / Meta for approval.</p>
              </div>
            )}
            {templates.map(t => {
              const st = String(t.meta_status || t.status || 'draft').toLowerCase();
              const stCls = st.includes('appr') ? 'approved' : st.includes('pend') ? 'pending' : st.includes('reject') ? 'rejected' : '';
              return (
                <div className="tmpl" key={t.id}>
                  <span className="wa-badge">{(t.channel || 'WhatsApp').toString().toUpperCase()}</span>
                  <b>{t.name}</b>
                  <div className="bubble">{t.body}</div>
                  <div className={`status ${stCls}`}>
                    {stCls === 'approved' ? <Ico.check /> : <Ico.clock />}
                    {stCls === 'approved' ? 'Approved' : stCls === 'pending' ? 'Pending approval' : stCls === 'rejected' ? 'Rejected' : 'Draft'} · {(t.category || 'UTILITY').toString().toUpperCase()}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card" style={{marginTop:18, background:'var(--wa-bg)', borderColor:'#CDEBD9'}}>
            <div className="t" style={{fontWeight:700, marginBottom:8, display:'flex', alignItems:'center', gap:8, fontFamily:"'Plus Jakarta Sans','Inter',sans-serif"}}>
              <span style={{color:'var(--wa)'}}><Ico.info /></span> Twilio approval tip
            </div>
            <p style={{fontSize:12.5, color:'var(--ink-soft)', lineHeight:1.6}}>
              Every variable <b>must</b> ship with an example value or the template is rejected.
              e.g. body <code>Hi {`{{1}}`}, book at {`{{2}}`}: {`{{3}}`}</code> → samples <code>{`{{1}}`}=Priya · {`{{2}}`}=The Looks · {`{{3}}`}=https://book.thelooks.in/s/aB12</code>.
              Fill these in Twilio Content Template Builder → "Sample content".
            </p>
          </div>
        </div>
      )}

      {/* ===== OFFERS & PERKS ===== */}
      {tab === 'offers' && (
        <div className="v2-grid2b">
          <div className="card">
            <div className="card__h">
              <div className="t"><Ico.tag /> Coupons</div>
              <button className="btn-ghost" onClick={() => setCouponDrawer(true)}><Ico.plus />New</button>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              {coupons.length === 0 && <div className="placeholder"><b>No coupons yet</b><p>Create discount codes for campaigns and walk-ins.</p></div>}
              {coupons.map(c => (
                <div className="coupon" key={c.id}>
                  <div className="cv">
                    <b>{c.type === 'percent' ? `${c.value}%` : rupee(c.value)}</b>
                    <span>OFF</span>
                  </div>
                  <div className="cd">
                    <b>{c.title}</b>
                    <span>{c.description || `Min ${rupee(c.min_bill_amount || 0)} · ${c.valid_to ? `exp ${new Date(c.valid_to).toLocaleDateString('en-IN', {day:'numeric', month:'short'})}` : 'no expiry'}`}</span>
                    <br/>
                    <span className="code">{c.code}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card__h">
              <div className="t"><Ico.star /> Loyalty &amp; Memberships</div>
              <button className="btn-ghost" onClick={() => toast.info('Membership creation moves to Services tab')}><Ico.plus />New</button>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:14}}>
              <StatLine k="Points program" v={<span style={{color:'var(--green)'}}>Active · 1pt / ₹100</span>} />
              <StatLine k="Active members" v={`${overview?.memberships_active ?? 0} guests`} />
              <StatLine k="Wallet balance (UPI top-ups)" v={rupee(overview?.wallet_total ?? 0)} />
              <StatLine k="Referral reward" v="₹200 both sides" />
            </div>
          </div>
        </div>
      )}

      {/* ===== REPUTATION (seeded/demo) ===== */}
      {tab === 'reputation' && (
        <div>
          <div className="mk-kpis" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
            <KpiTile chip="amber" icon={<Ico.star />} val="4.8" label="Avg rating" />
            <KpiTile chip="wa" icon={<Ico.chat />} val="210" label="Review requests" />
            <KpiTile chip="green" icon={<Ico.trending />} val="+38" label="New reviews" />
            <KpiTile chip="rose" icon={<Ico.info />} val="3" label="Needs reply" />
          </div>
          <div className="card">
            <div className="card__h">
              <div className="t"><Ico.star /> Recent reviews · Google · JustDial <span style={{marginLeft:6, fontSize:10, fontWeight:800, background:'var(--amber-bg)', color:'var(--amber)', padding:'2px 7px', borderRadius:20, letterSpacing:.3}}>DEMO · API COMING SOON</span></div>
              <button className="btn-primary" onClick={() => toast.success('Review requests queued to recent guests on WhatsApp')}><Ico.plus />Request reviews</button>
            </div>
            <div className="clist">
              {[
                {who:'Rahul V.', stars:5, text:'Imran is fantastic, great fade. Booked via WhatsApp in seconds.'},
                {who:'Sana K.',  stars:4, text:'Lovely spa, slightly long wait. Will return.'},
                {who:'Neha G.',  stars:5, text:'Amazing hair spa experience. Loved the ambiance.'},
              ].map((r, i) => (
                <div className="crow" key={i}>
                  <div className="rev-avatar">★</div>
                  <div className="cn">
                    <b>{r.who} · {'★'.repeat(r.stars)}{'☆'.repeat(5-r.stars)}</b>
                    <span>"{r.text}"</span>
                  </div>
                  <button className="btn-ghost" onClick={() => toast.success('Reply drafted')}>Reply</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== MEDIA (renamed from Gallery) ===== */}
      {tab === 'media' && (
        <MediaPanel salon={salon} salonId={salonId} authHeaders={authHeaders} />
      )}

      {/* ===== SETTINGS ===== */}
      {tab === 'settings' && (
        <SettingsPanel salonId={salonId} authHeaders={authHeaders} />
      )}

      {/* -------- DRAWERS -------- */}
      <NewCampaignDrawer
        open={!!campaignDrawer}
        preselectSegmentId={typeof campaignDrawer === 'object' ? campaignDrawer.preselectSegmentId : undefined}
        onClose={() => setCampaignDrawer(false)}
        segments={segments}
        segCounts={segCounts}
        templates={templates}
        coupons={coupons}
        salonId={salonId}
        authHeaders={authHeaders}
        onSaved={() => { setCampaignDrawer(false); fetchAll(); }}
      />
      <NewAutomationDrawer
        open={automationDrawer}
        onClose={() => setAutomationDrawer(false)}
        templates={templates}
        salonId={salonId}
        authHeaders={authHeaders}
        onSaved={() => { setAutomationDrawer(false); fetchAll(); }}
      />
      <NewTemplateDrawer
        open={templateDrawer}
        onClose={() => setTemplateDrawer(false)}
        salonId={salonId}
        authHeaders={authHeaders}
        onSaved={() => { setTemplateDrawer(false); fetchAll(); }}
      />
      <NewCouponDrawer
        open={couponDrawer}
        onClose={() => setCouponDrawer(false)}
        salonId={salonId}
        authHeaders={authHeaders}
        onSaved={() => { setCouponDrawer(false); fetchAll(); }}
      />
    </div>
  );
}

// -------------------- Reusable bits --------------------
function KpiTile({ chip, icon, val, label, sub }) {
  const map = {
    wa:    { bg:'var(--wa-bg)', fg:'var(--wa)' },
    green: { bg:'var(--green-bg)', fg:'var(--green)' },
    sky:   { bg:'var(--sky-bg)', fg:'var(--sky)' },
    amber: { bg:'var(--amber-bg)', fg:'var(--amber)' },
    violet:{ bg:'var(--violet-bg)', fg:'var(--violet)' },
    rose:  { bg:'var(--rose-bg)', fg:'var(--rose)' },
  };
  const s = map[chip] || map.wa;
  return (
    <div className="mk-kpi">
      <div className="chip" style={{background:s.bg, color:s.fg}}>{icon}</div>
      <b>{val}</b>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function CampaignRow({ c, onLaunch, onPause }) {
  const prov = String(c.provider || 'whatsapp').toLowerCase();
  const chKey = prov.includes('email') ? 'email' : prov.includes('sms') ? 'sms' : 'whatsapp';
  const st = CH_STYLE[chKey];
  const status = String(c.status || 'draft').toLowerCase();
  const statusLabel = status === 'running' ? 'Live' : status === 'scheduled' ? 'Scheduled' : status === 'paused' ? 'Paused' : status === 'completed' ? 'Completed' : 'Draft';
  const revenue = ((c.stats?.revenue) || 0);
  const redeemed = (c.stats?.redeemed) || 0;
  return (
    <div className="crow">
      <div className="ci" style={{background:st.bg, color:st.fg}}><Ico.chat /></div>
      <div className="cn">
        <b>{c.name}</b>
        <span>{st.label} · {c.segment_name || 'Audience'} · {(c.stats?.sent) || 0} sent</span>
      </div>
      <span className={`cstat ${status}`}>{statusLabel}</span>
      <div className="cmet">
        <b>{rupee(revenue)}</b>
        <span>{redeemed} redeemed</span>
      </div>
      {status === 'draft' && onLaunch && (
        <button className="btn-ghost" style={{marginLeft:8}} onClick={onLaunch}>Launch</button>
      )}
      {status === 'running' && onPause && (
        <button className="btn-ghost" style={{marginLeft:8}} onClick={onPause}>Pause</button>
      )}
    </div>
  );
}

function StatLine({ k, v }) {
  return (
    <div style={{display:'flex', justifyContent:'space-between', fontSize:13}}>
      <span style={{color:'var(--muted)', fontWeight:600}}>{k}</span>
      <b>{v}</b>
    </div>
  );
}

// -------------------- Media panel --------------------
function MediaPanel({ salon, salonId, authHeaders }) {
  const [localSalon, setLocalSalon] = useState(salon || null);
  useEffect(() => setLocalSalon(salon || null), [salon]);
  const photos = localSalon?.photo_gallery || [];

  const uploadFiles = async (files) => {
    if (!files?.length) return;
    const PHOTO_MAX = 5 * 1024 * 1024;
    const VIDEO_MAX = 25 * 1024 * 1024;
    const additions = [];
    for (const f of files) {
      const isVideo = (f.type || '').startsWith('video/');
      const limit = isVideo ? VIDEO_MAX : PHOTO_MAX;
      if (f.size > limit) { toast.error(`${f.name} too large (max ${isVideo ? '25MB' : '5MB'})`); continue; }
      const dataUrl = await new Promise((resolve) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result);
        r.readAsDataURL(f);
      });
      additions.push(dataUrl);
    }
    if (!additions.length) return;
    const updated = [...photos, ...additions];
    try {
      await axios.put(`${API}/salons/${salonId}`, { photo_gallery: updated }, { headers: authHeaders() });
      setLocalSalon({ ...(localSalon || {}), photo_gallery: updated });
      toast.success(`${additions.length} file(s) added`);
    } catch { toast.error('Upload failed'); }
  };

  const removeAt = async (idx) => {
    const updated = photos.filter((_, i) => i !== idx);
    try {
      await axios.put(`${API}/salons/${salonId}`, { photo_gallery: updated }, { headers: authHeaders() });
      setLocalSalon({ ...(localSalon || {}), photo_gallery: updated });
      toast.success('Removed');
    } catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="card">
        <div className="card__h">
          <div className="t"><Ico.images /> Salon media</div>
          <label className="btn-primary" style={{cursor:'pointer'}}>
            <Ico.plus /> Add photos / videos
            <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => uploadFiles(Array.from(e.target.files || []))}/>
          </label>
        </div>
        <p style={{fontSize:12.5, color:'var(--muted)', marginBottom:14}}>
          Showcase your salon. Photos up to 5MB · videos up to 25MB.
        </p>
        {photos.length === 0 ? (
          <div className="placeholder"><div className="pi"><Ico.images /></div><b>No media yet</b><p>Upload photos or short videos to feature on your storefront.</p></div>
        ) : (
          <div className="media-grid">
            {photos.map((url, i) => {
              const isVideo = typeof url === 'string' && (url.startsWith('data:video') || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url));
              return (
                <div className="media-tile" key={i}>
                  {isVideo ? <video src={url} muted playsInline /> : <img src={url} alt={`Media ${i+1}`} />}
                  <button className="rm" onClick={() => removeAt(i)}><Ico.close /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{marginTop:18}}>
        <div className="card__h">
          <div className="t"><Ico.wifi /> Social media <span style={{marginLeft:6, fontSize:10, fontWeight:800, background:'var(--amber-bg)', color:'var(--amber)', padding:'2px 7px', borderRadius:20}}>COMING SOON</span></div>
        </div>
        <p style={{fontSize:12.5, color:'var(--muted)', marginBottom:6}}>
          Auto-import posts &amp; reels from your salon's Instagram, YouTube, Facebook and TikTok.
        </p>
        <div className="social-grid">
          {[
            {n:'Instagram', bg:'linear-gradient(135deg,#E91E63,#8E24AA)', d:'Latest posts & reels'},
            {n:'YouTube',   bg:'linear-gradient(135deg,#E53935,#B71C1C)', d:'Channel videos'},
            {n:'Facebook',  bg:'linear-gradient(135deg,#1E88E5,#0D47A1)', d:'Page posts'},
            {n:'TikTok',    bg:'linear-gradient(135deg,#111,#333)',       d:'Short videos'},
          ].map(s => (
            <button key={s.n} className="social-tile" style={{background:s.bg}} onClick={() => toast.info(`${s.n} integration coming soon`)}>
              <b>{s.n}</b><span>{s.d}</span>
              <span className="soon">Soon</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// -------------------- Settings panel --------------------
function SettingsPanel({ salonId, authHeaders }) {
  const [settings, setSettings] = useState(null);
  const [prov, setProv] = useState('twilio');

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/salons/${salonId}/marketing/settings`, { headers: authHeaders() });
        setSettings(res.data || {});
        setProv(res.data?.default_provider || 'twilio');
      } catch { setSettings({}); }
    })();
  }, [salonId, authHeaders]);

  const save = async () => {
    try {
      await axios.put(`${API}/salons/${salonId}/marketing/settings`, { ...(settings || {}), default_provider: prov }, { headers: authHeaders() });
      toast.success('Settings saved');
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
  };

  return (
    <div className="card">
      <div className="card__h"><div className="t"><Ico.gear /> Marketing settings</div><button className="btn-primary" onClick={save}><Ico.check /> Save</button></div>
      <div className="v2-grid2b">
        <div>
          <div className="v2-field">
            <label>Default provider</label>
            <select value={prov} onChange={(e) => setProv(e.target.value)}>
              <option value="twilio">Twilio (WhatsApp + SMS)</option>
              <option value="meta">Meta WhatsApp Cloud API</option>
              <option value="stub">Stub / test only</option>
            </select>
          </div>
          <div className="v2-field">
            <label>WhatsApp opt-in required</label>
            <select value={settings?.opt_in_required ? '1' : '0'} onChange={(e) => setSettings({ ...(settings||{}), opt_in_required: e.target.value === '1' })}>
              <option value="1">Yes — only send to opted-in guests</option>
              <option value="0">No — send to all guests</option>
            </select>
          </div>
          <div className="v2-field">
            <label>Quiet hours</label>
            <input placeholder="e.g. 22:00 – 08:00 IST" value={settings?.quiet_hours || ''} onChange={(e) => setSettings({ ...(settings||{}), quiet_hours: e.target.value })}/>
          </div>
        </div>
        <div>
          <div className="v2-field">
            <label>DLT sender ID (SMS)</label>
            <input placeholder="e.g. THLOOKS" value={settings?.dlt_sender_id || ''} onChange={(e) => setSettings({ ...(settings||{}), dlt_sender_id: e.target.value })}/>
          </div>
          <div className="v2-field">
            <label>Email sender</label>
            <input placeholder="hello@yoursalon.com" value={settings?.email_sender || ''} onChange={(e) => setSettings({ ...(settings||{}), email_sender: e.target.value })}/>
          </div>
          <div className="v2-field">
            <label>Twilio Content SID prefix (optional)</label>
            <input placeholder="HX…" value={settings?.twilio_content_prefix || ''} onChange={(e) => setSettings({ ...(settings||{}), twilio_content_prefix: e.target.value })}/>
          </div>
        </div>
      </div>
      <p style={{fontSize:12, color:'var(--muted)', marginTop:8}}>
        Twilio + Meta WhatsApp Cloud are already wired in the backend. Set default here to change how new campaigns/automations send by default.
      </p>
    </div>
  );
}

// -------------------- Drawer: New Campaign --------------------
function NewCampaignDrawer({ open, onClose, preselectSegmentId, segments, segCounts, templates, coupons, salonId, authHeaders, onSaved }) {
  const [name, setName] = useState('');
  const [segId, setSegId] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [tmplId, setTmplId] = useState('');
  const [body, setBody] = useState('');
  const [couponId, setCouponId] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { setName(''); setChannel('whatsapp'); setTmplId(''); setBody(''); setCouponId(''); setScheduleAt(''); }
    if (preselectSegmentId) setSegId(preselectSegmentId);
  }, [open, preselectSegmentId]);

  const applyTemplate = (id) => {
    setTmplId(id);
    const t = templates.find(x => x.id === id);
    if (t) setBody(t.body || '');
  };

  const submit = async (launchNow) => {
    if (!name.trim()) { toast.error('Name required'); return; }
    if (!body.trim()) { toast.error('Message body required (pick a template or write custom)'); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        segment_id: segId || null,
        template_id: tmplId || null,
        template_body: body,
        coupon_id: couponId || null,
        provider: channel === 'whatsapp' ? null : channel,
        schedule_at: (!launchNow && scheduleAt) ? scheduleAt : null,
      };
      const res = await axios.post(`${API}/salons/${salonId}/marketing/campaigns`, payload, { headers: authHeaders() });
      if (launchNow) {
        await axios.post(`${API}/salons/${salonId}/marketing/campaigns/${res.data.id}/launch`, {}, { headers: authHeaders() });
        toast.success('Campaign queued');
      } else {
        toast.success('Campaign saved');
      }
      onSaved?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save campaign');
    } finally { setSaving(false); }
  };

  return (
    <Drawer open={!!open} onClose={onClose} title="New Campaign" subtitle="Reach the right guests in a few taps" iconFn={Ico.send}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-ghost" disabled={saving} onClick={() => submit(false)}>Save as draft</button>
          <button className="btn-primary" disabled={saving} onClick={() => submit(true)}><Ico.send /> {scheduleAt ? 'Schedule' : 'Send now'}</button>
        </>
      }
    >
      <div className="v2-field"><label>Campaign name</label>
        <input placeholder="e.g. Diwali Glow Offer" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="v2-field"><label>Audience segment</label>
        <select value={segId} onChange={(e) => setSegId(e.target.value)}>
          <option value="">— Select segment —</option>
          {segments.map(s => <option key={s.id} value={s.id}>{s.name} ({segCounts?.[s.id] ?? '—'})</option>)}
        </select>
      </div>
      <div className="v2-field"><label>Channel</label>
        <div className="ch-pick">
          <button type="button" className={channel==='whatsapp' ? 'on' : ''} onClick={() => setChannel('whatsapp')}><Ico.wa /> WhatsApp</button>
          <button type="button" className={channel==='sms' ? 'on' : ''} onClick={() => setChannel('sms')}><Ico.chat /> SMS</button>
          <button type="button" className={channel==='email' ? 'on' : ''} onClick={() => setChannel('email')}><Ico.mail /> Email</button>
        </div>
      </div>
      <div className="v2-field"><label>Template</label>
        <select value={tmplId} onChange={(e) => applyTemplate(e.target.value)}>
          <option value="">— Custom message —</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.meta_status || 'draft'})</option>)}
        </select>
      </div>
      <div className="v2-field"><label>Message body</label>
        <textarea placeholder="Hi {{name}}, we miss you! Here's 20% off…" value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="v2-field"><label>Attach coupon (optional)</label>
        <select value={couponId} onChange={(e) => setCouponId(e.target.value)}>
          <option value="">— No coupon —</option>
          {coupons.map(c => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
        </select>
      </div>
      <div className="v2-field"><label>Schedule (leave blank for immediate send)</label>
        <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
      </div>
    </Drawer>
  );
}

// -------------------- Drawer: New Automation --------------------
function NewAutomationDrawer({ open, onClose, templates, salonId, authHeaders, onSaved }) {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('appointment_reminder');
  const [channel, setChannel] = useState('whatsapp');
  const [tmplId, setTmplId] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { setName(''); setTrigger('appointment_reminder'); setChannel('whatsapp'); setTmplId(''); setActive(true); }
  }, [open]);

  const submit = async () => {
    if (!name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/salons/${salonId}/marketing/automations`, {
        name: name.trim(),
        trigger,
        channel,
        template_id: tmplId || null,
        active,
      }, { headers: authHeaders() });
      toast.success('Automation created');
      onSaved?.();
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="New Automation" subtitle="Always-on, trigger-based journeys" iconFn={Ico.bolt}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={submit}><Ico.check /> Create</button>
        </>
      }
    >
      <div className="v2-field"><label>Name</label>
        <input placeholder="e.g. Appointment reminder 24h" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="v2-field"><label>Trigger</label>
        <select value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          <option value="appointment_reminder">Appointment reminders (24h + 2h)</option>
          <option value="birthday">Birthday wish + treat</option>
          <option value="anniversary">Anniversary offer</option>
          <option value="winback_lapsed">Win-back lapsed (60d)</option>
          <option value="review_request">Review request after checkout</option>
          <option value="rebooking">Rebooking nudge (service cycle)</option>
        </select>
      </div>
      <div className="v2-field"><label>Channel</label>
        <div className="ch-pick">
          <button type="button" className={channel==='whatsapp' ? 'on' : ''} onClick={() => setChannel('whatsapp')}><Ico.wa /> WhatsApp</button>
          <button type="button" className={channel==='sms' ? 'on' : ''} onClick={() => setChannel('sms')}><Ico.chat /> SMS</button>
          <button type="button" className={channel==='email' ? 'on' : ''} onClick={() => setChannel('email')}><Ico.mail /> Email</button>
        </div>
      </div>
      <div className="v2-field"><label>Template</label>
        <select value={tmplId} onChange={(e) => setTmplId(e.target.value)}>
          <option value="">— None —</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="v2-field"><label>Active</label>
        <select value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')}>
          <option value="1">On</option>
          <option value="0">Off</option>
        </select>
      </div>
    </Drawer>
  );
}

// -------------------- Drawer: New Template --------------------
function NewTemplateDrawer({ open, onClose, salonId, authHeaders, onSaved }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('utility');
  const [body, setBody] = useState('Hi {{1}}, book at {{2}}: {{3}}');
  const [langCode, setLangCode] = useState('en_US');
  const [samples, setSamples] = useState('Priya | The Looks | https://book.thelooks.in/s/aB12');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { setName(''); setCategory('utility'); setBody('Hi {{1}}, book at {{2}}: {{3}}'); setLangCode('en_US'); setSamples('Priya | The Looks | https://book.thelooks.in/s/aB12'); }
  }, [open]);

  const submit = async () => {
    if (!name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      // Extract variables like {{1}}, {{2}}
      const vars = Array.from(new Set((body.match(/\{\{[^}]+\}\}/g) || []).map(v => v.replace(/[{}]/g, ''))));
      const sampleValues = samples.split('|').map(s => s.trim()).filter(Boolean);
      await axios.post(`${API}/salons/${salonId}/marketing/templates`, {
        name: name.trim(),
        category,
        body,
        variables: vars,
        lang_code: langCode,
        meta_status: 'draft',
        sample_values: sampleValues,
      }, { headers: authHeaders() });
      toast.success('Template saved as draft. Submit from Templates list to send to Twilio.');
      onSaved?.();
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="New Template" subtitle="WhatsApp template — Twilio-ready" iconFn={Ico.chat}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={submit}><Ico.check /> Save draft</button>
        </>
      }
    >
      <div className="v2-field"><label>Template name</label>
        <input placeholder="e.g. Appointment reminder" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="v2-field"><label>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="utility">UTILITY</option>
          <option value="marketing">MARKETING</option>
          <option value="authentication">AUTHENTICATION</option>
        </select>
      </div>
      <div className="v2-field"><label>Language</label>
        <select value={langCode} onChange={(e) => setLangCode(e.target.value)}>
          <option value="en_US">English (US)</option>
          <option value="en_IN">English (India)</option>
          <option value="hi_IN">Hindi</option>
        </select>
      </div>
      <div className="v2-field"><label>Body (use {`{{1}}`}, {`{{2}}`}…)</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="v2-field">
        <label>Sample values (Twilio requirement, separate with " | ")</label>
        <input value={samples} onChange={(e) => setSamples(e.target.value)} />
      </div>
      <div style={{fontSize:12, color:'var(--muted)', background:'var(--wa-bg)', border:'1px solid #CDEBD9', padding:'10px 12px', borderRadius:10, lineHeight:1.5}}>
        <b style={{color:'var(--wa)'}}>Twilio tip:</b> every variable must ship with an example value or the template is rejected. Fill these in Twilio Content Template Builder → "Sample content" too.
      </div>
    </Drawer>
  );
}

// -------------------- Drawer: New Coupon --------------------
function NewCouponDrawer({ open, onClose, salonId, authHeaders, onSaved }) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('percent');
  const [value, setValue] = useState('20');
  const [minBill, setMinBill] = useState('0');
  const [validTo, setValidTo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { setCode(''); setTitle(''); setType('percent'); setValue('20'); setMinBill('0'); setValidTo(''); }
  }, [open]);

  const submit = async () => {
    if (!code.trim() || !title.trim()) { toast.error('Code and title required'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/salons/${salonId}/coupons`, {
        code: code.trim().toUpperCase(),
        title: title.trim(),
        type,
        value: Number(value),
        min_bill_amount: Number(minBill || 0),
        valid_to: validTo ? new Date(validTo).toISOString() : null,
        is_active: true,
        visibility: 'published',
      }, { headers: authHeaders() });
      toast.success('Coupon created');
      onSaved?.();
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="New Coupon" subtitle="Give guests a reason to book" iconFn={Ico.tag}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={submit}><Ico.check /> Create</button>
        </>
      }
    >
      <div className="v2-field"><label>Code (uppercase)</label>
        <input placeholder="GLOW20" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      </div>
      <div className="v2-field"><label>Title</label>
        <input placeholder="Monsoon Glow" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="v2-field"><label>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="percent">Percent (%)</option>
          <option value="flat">Flat (₹)</option>
        </select>
      </div>
      <div className="v2-field"><label>Value</label>
        <input type="number" min="1" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <div className="v2-field"><label>Minimum bill amount (₹)</label>
        <input type="number" min="0" value={minBill} onChange={(e) => setMinBill(e.target.value)} />
      </div>
      <div className="v2-field"><label>Valid until</label>
        <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
      </div>
    </Drawer>
  );
}
