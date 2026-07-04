import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Megaphone, BarChart3, Ticket, Gift, Award, Sparkles, Image as ImageIcon,
  Settings as SettingsIcon, Users as UsersIcon, Send, Plus, Trash2, Eye, EyeOff, RefreshCw
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SUB_TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'campaigns', label: 'Campaigns', icon: Send },
  { id: 'coupons', label: 'Coupons', icon: Ticket },
  { id: 'rewards', label: 'Rewards', icon: Gift },
  { id: 'loyalty', label: 'Loyalty', icon: Award },
  { id: 'memberships', label: 'Memberships', icon: Sparkles },
  { id: 'gallery', label: 'Gallery', icon: ImageIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const SEGMENT_FIELDS = [
  { value: 'birthday_month', label: 'Birthday in month', operand: 'month' },
  { value: 'wedding_anniversary_month', label: 'Wedding anniversary in month', operand: 'month' },
  { value: 'spouse_birthday_month', label: "Spouse's birthday in month", operand: 'month' },
  { value: 'gender', label: 'Gender', operand: 'gender' },
  { value: 'age_min', label: 'Age ≥ (years)', operand: 'number' },
  { value: 'age_max', label: 'Age ≤ (years)', operand: 'number' },
  { value: 'last_visit_min_days', label: 'Last visit ≥ N days ago', operand: 'number' },
  { value: 'last_visit_max_days', label: 'Last visit ≤ N days ago', operand: 'number' },
  { value: 'avg_spend_min', label: 'Avg spend ≥ ₹', operand: 'number' },
  { value: 'total_spend_min', label: 'Total spend ≥ ₹', operand: 'number' },
  { value: 'visit_count_min', label: 'Visits ≥', operand: 'number' },
  { value: 'has_wallet', label: 'Has membership wallet', operand: 'bool' },
];

export default function MarketingTab({ salonId, getAuthHeaders, children, onOpenSubtab }) {
  const [activeSub, setActiveSub] = useState('overview');

  const renderPanel = () => {
    if (activeSub === 'overview') return <OverviewPanel salonId={salonId} getAuthHeaders={getAuthHeaders} />;
    if (activeSub === 'campaigns') return <CampaignsPanel salonId={salonId} getAuthHeaders={getAuthHeaders} />;
    if (activeSub === 'coupons') return <CouponsPanel salonId={salonId} getAuthHeaders={getAuthHeaders} />;
    if (activeSub === 'rewards') return <PlaceholderPanel title="Rewards" note="Scratch Card & Spin Wheel — coming in the next slice (M7)." icon={Gift} />;
    if (activeSub === 'loyalty') return <LoyaltyPanel />;
    if (activeSub === 'memberships') return <MembershipsPanel />;
    if (activeSub === 'gallery') return children /* Gallery legacy panel rendered by parent */;
    if (activeSub === 'settings') return <MarketingSettingsPanel salonId={salonId} getAuthHeaders={getAuthHeaders} />;
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="bg-card/50 backdrop-blur-sm border border-gold/20 rounded-2xl p-3 md:p-5 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30">
            <Megaphone className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-playfair font-bold text-foreground">Marketing</h2>
            <p className="text-xs text-muted-foreground">Campaigns · Coupons · Rewards · Loyalty · Memberships · Gallery · Settings</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {SUB_TABS.map(t => {
            const Icon = t.icon;
            const active = activeSub === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setActiveSub(t.id); onOpenSubtab && onOpenSubtab(t.id); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm border transition-all ${
                  active
                    ? 'bg-gold text-black border-gold shadow-sm'
                    : 'bg-background/70 text-foreground border-border hover:bg-accent/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {renderPanel()}
    </div>
  );
}


// ============ Overview ============

function OverviewPanel({ salonId, getAuthHeaders }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/salons/${salonId}/marketing/overview`, { headers: getAuthHeaders() });
      setData(res.data);
    } catch (e) {
      toast.error('Failed to load overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [salonId]);

  const cards = [
    { label: 'Messages sent (30d)', value: data?.messaging?.sent ?? 0, tone: 'from-blue-500/20 to-blue-500/5', accent: 'text-blue-500' },
    { label: 'Delivered', value: data?.messaging?.delivered ?? 0, tone: 'from-emerald-500/20 to-emerald-500/5', accent: 'text-emerald-500' },
    { label: 'Read', value: data?.messaging?.read ?? 0, tone: 'from-violet-500/20 to-violet-500/5', accent: 'text-violet-500' },
    { label: 'Coupon redemptions', value: data?.conversion?.coupon_redemptions ?? 0, tone: 'from-amber-500/20 to-amber-500/5', accent: 'text-amber-500' },
    { label: 'Discount given (₹)', value: (data?.conversion?.coupon_discount_amount ?? 0).toFixed(2), tone: 'from-rose-500/20 to-rose-500/5', accent: 'text-rose-500' },
    { label: 'Messaging spend (₹)', value: (data?.messaging?.spend_inr ?? 0).toFixed(2), tone: 'from-slate-500/20 to-slate-500/5', accent: 'text-slate-500' },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Performance & Spend — Last 30 days</CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {cards.map((c, i) => (
            <div key={i} className={`p-3 rounded-xl border border-border bg-gradient-to-br ${c.tone}`}>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className={`text-2xl font-bold ${c.accent}`}>{c.value}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-4">
          Numbers will populate as campaigns are launched via the Meta WhatsApp Cloud API and coupons are
          redeemed at checkout.
        </p>
      </CardContent>
    </Card>
  );
}


// ============ Campaigns (with embedded Segments builder) ============

function CampaignsPanel({ salonId, getAuthHeaders }) {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openBuilder, setOpenBuilder] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/salons/${salonId}/marketing/segments`, { headers: getAuthHeaders() });
      setSegments(res.data.segments || []);
    } catch (e) {
      toast.error('Failed to load segments');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [salonId]);

  const openNew = () => {
    setEditing({ name: '', description: '', rules: { logic: 'AND', conditions: [] } });
    setOpenBuilder(true);
  };
  const openEdit = (s) => {
    setEditing({ ...s, rules: s.rules || { logic: 'AND', conditions: [] } });
    setOpenBuilder(true);
  };
  const del = async (s) => {
    if (!window.confirm(`Delete segment "${s.name}"?`)) return;
    try {
      await axios.delete(`${API}/salons/${salonId}/marketing/segments/${s.id}`, { headers: getAuthHeaders() });
      toast.success('Segment deleted');
      load();
    } catch (e) { toast.error('Delete failed'); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="w-4 h-4 text-gold" /> Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            One-time or scheduled WhatsApp campaigns will be sent to a chosen segment via
            the active WhatsApp provider (currently: <b>Twilio</b>; Meta can be enabled via
            the <code>WHATSAPP_PROVIDER</code> env flag once the Meta credentials are added).
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Campaign scheduling and template composer will ship in the next slice (M5). For now,
            you can start by building the audience segments below.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-gold" /> Audience Segments
          </CardTitle>
          <Button size="sm" className="bg-gold text-black hover:bg-gold/90" onClick={openNew}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New segment
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : segments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No segments yet. Segments let you target customers by birthday/anniversary,
              last-visit-days, spend, gender and more.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {segments.map(s => (
                <div key={s.id} className="py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {(s.rules?.conditions || []).length} rule(s) · {s.rules?.logic || 'AND'} · {s.description || 'No description'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => del(s)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {openBuilder && editing && (
        <SegmentBuilderDialog
          salonId={salonId}
          getAuthHeaders={getAuthHeaders}
          initial={editing}
          onClose={() => setOpenBuilder(false)}
          onSaved={() => { setOpenBuilder(false); load(); }}
        />
      )}
    </div>
  );
}

function SegmentBuilderDialog({ salonId, getAuthHeaders, initial, onClose, onSaved }) {
  const [name, setName] = useState(initial.name || '');
  const [description, setDescription] = useState(initial.description || '');
  const [logic, setLogic] = useState(initial.rules?.logic || 'AND');
  const [conditions, setConditions] = useState(initial.rules?.conditions || []);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial.id;

  const addRule = () => setConditions([...conditions, { field: 'birthday_month', op: 'eq', value: '' }]);
  const updateRule = (i, patch) => {
    const arr = [...conditions];
    arr[i] = { ...arr[i], ...patch };
    setConditions(arr);
  };
  const removeRule = (i) => setConditions(conditions.filter((_, idx) => idx !== i));

  const rulesPayload = () => ({
    logic,
    conditions: conditions
      .filter(c => c.field && c.value !== '' && c.value !== null && c.value !== undefined)
      .map(c => ({ field: c.field, op: c.op || 'eq', value: c.value })),
  });

  const doPreview = async () => {
    try {
      const res = await axios.post(
        `${API}/salons/${salonId}/marketing/segments/preview`,
        { name: name || 'preview', description, rules: rulesPayload() },
        { headers: getAuthHeaders() }
      );
      setPreview(res.data);
    } catch (e) { toast.error('Preview failed'); }
  };

  const save = async () => {
    if (!name.trim()) return toast.error('Name is required');
    try {
      setSaving(true);
      const body = { name, description, rules: rulesPayload() };
      if (isEdit) {
        await axios.put(`${API}/salons/${salonId}/marketing/segments/${initial.id}`, body, { headers: getAuthHeaders() });
      } else {
        await axios.post(`${API}/salons/${salonId}/marketing/segments`, body, { headers: getAuthHeaders() });
      }
      toast.success(isEdit ? 'Segment updated' : 'Segment created');
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit segment' : 'New segment'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Birthday - July" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label>Match</Label>
            <select value={logic} onChange={e => setLogic(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              <option value="AND">ALL conditions (AND)</option>
              <option value="OR">ANY condition (OR)</option>
            </select>
          </div>

          <div className="space-y-2">
            {conditions.length === 0 && (
              <p className="text-xs text-muted-foreground">No rules yet — add one to filter customers.</p>
            )}
            {conditions.map((c, i) => {
              const meta = SEGMENT_FIELDS.find(f => f.value === c.field) || SEGMENT_FIELDS[0];
              return (
                <div key={i} className="flex flex-wrap gap-2 items-center">
                  <select
                    value={c.field}
                    onChange={e => updateRule(i, { field: e.target.value, value: '' })}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {SEGMENT_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  {meta.operand === 'month' && (
                    <select
                      value={c.value}
                      onChange={e => updateRule(i, { value: Number(e.target.value) })}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">— pick —</option>
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, idx) => (
                        <option key={idx} value={idx + 1}>{m}</option>
                      ))}
                    </select>
                  )}
                  {meta.operand === 'gender' && (
                    <select
                      value={c.value}
                      onChange={e => updateRule(i, { value: e.target.value })}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">— pick —</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  )}
                  {meta.operand === 'number' && (
                    <Input
                      type="number"
                      className="h-9 w-32"
                      value={c.value}
                      onChange={e => updateRule(i, { value: e.target.value === '' ? '' : Number(e.target.value) })}
                    />
                  )}
                  {meta.operand === 'bool' && (
                    <select
                      value={String(c.value)}
                      onChange={e => updateRule(i, { value: e.target.value === 'true' })}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">— pick —</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => removeRule(i)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={addRule}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add rule
            </Button>
          </div>

          <div className="p-3 rounded-lg bg-background/50 border border-border">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Live count</p>
              <Button variant="outline" size="sm" onClick={doPreview}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Preview
              </Button>
            </div>
            {preview ? (
              <>
                <p className="text-2xl font-bold text-gold">{preview.count} customer(s)</p>
                {preview.sample?.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Sample: {preview.sample.slice(0, 5).map(s => s.name || s.phone).join(', ')}
                    {preview.sample.length > 5 ? '…' : ''}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Click <i>Preview</i> to see how many customers match.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-gold text-black hover:bg-gold/90" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create segment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ============ Coupons ============

function CouponsPanel({ salonId, getAuthHeaders }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/salons/${salonId}/coupons`, { headers: getAuthHeaders() });
      setCoupons(res.data.coupons || []);
    } catch (e) { toast.error('Failed to load coupons'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [salonId]);

  const remove = async (c) => {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    try {
      await axios.delete(`${API}/salons/${salonId}/coupons/${c.id}`, { headers: getAuthHeaders() });
      toast.success('Coupon deleted');
      load();
    } catch (e) { toast.error('Delete failed'); }
  };

  const publish = async (c, visibility) => {
    try {
      const action = visibility === 'published' ? 'publish' : 'unpublish';
      await axios.post(`${API}/salons/${salonId}/coupons/${c.id}/${action}`, {}, { headers: getAuthHeaders() });
      toast.success(action === 'publish' ? 'Published to customer app' : 'Made private');
      load();
    } catch (e) { toast.error('Update failed'); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Ticket className="w-4 h-4 text-gold" /> Salon Coupons
        </CardTitle>
        <Button size="sm" className="bg-gold text-black hover:bg-gold/90" onClick={() => setEditing({})}>
          <Plus className="w-3.5 h-3.5 mr-1" /> New coupon
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No coupons yet. Create a % or flat-off coupon and publish it so it shows up in the customer app,
            or keep it private and share it via campaign messages.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {coupons.map(c => (
              <div key={c.id} className="py-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono font-bold text-gold">{c.code}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${c.visibility === 'published' ? 'border-emerald-500/50 text-emerald-600' : 'border-amber-500/50 text-amber-600'}`}>
                      {c.visibility}
                    </span>
                    {!c.is_active && <span className="text-[10px] text-red-500">inactive</span>}
                  </div>
                  <p className="text-sm">{c.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.type === 'percent' ? `${c.value}% off` : `₹${c.value} off`}
                    {c.min_bill_amount ? ` · min ₹${c.min_bill_amount}` : ''}
                    {c.max_discount_amount ? ` · cap ₹${c.max_discount_amount}` : ''}
                    {c.per_customer_limit ? ` · per-customer ${c.per_customer_limit}` : ''}
                    {c.total_cap ? ` · total ${c.total_cap}` : ''}
                    {typeof c.uses_count === 'number' ? ` · used ${c.uses_count}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {c.visibility === 'published' ? (
                    <Button variant="outline" size="sm" onClick={() => publish(c, 'private')}>
                      <EyeOff className="w-3.5 h-3.5 mr-1" /> Unpublish
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => publish(c, 'published')}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> Publish
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setEditing(c)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(c)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {editing !== null && (
        <CouponEditorDialog
          salonId={salonId}
          getAuthHeaders={getAuthHeaders}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </Card>
  );
}

function CouponEditorDialog({ salonId, getAuthHeaders, initial, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    code: initial?.code || '',
    title: initial?.title || '',
    description: initial?.description || '',
    type: initial?.type || 'percent',
    value: initial?.value ?? 10,
    min_bill_amount: initial?.min_bill_amount ?? 0,
    max_discount_amount: initial?.max_discount_amount ?? '',
    per_customer_limit: initial?.per_customer_limit ?? 1,
    total_cap: initial?.total_cap ?? '',
    valid_from: (initial?.valid_from || '').slice(0, 10) || '',
    valid_to: (initial?.valid_to || '').slice(0, 10) || '',
    stackable: !!initial?.stackable,
    visibility: initial?.visibility || 'private',
    is_active: initial?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.code || !form.title) return toast.error('Code and title are required');
    if (!form.value || Number(form.value) <= 0) return toast.error('Value must be > 0');
    try {
      setSaving(true);
      const body = {
        ...form,
        code: (form.code || '').toString().trim().replace(/\s+/g, '').toUpperCase(),
        value: Number(form.value),
        min_bill_amount: Number(form.min_bill_amount || 0),
        max_discount_amount: form.max_discount_amount === '' ? null : Number(form.max_discount_amount),
        per_customer_limit: form.per_customer_limit === '' ? null : Number(form.per_customer_limit),
        total_cap: form.total_cap === '' ? null : Number(form.total_cap),
        valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
        valid_to: form.valid_to ? new Date(form.valid_to + 'T23:59:59').toISOString() : null,
      };
      if (isEdit) {
        await axios.put(`${API}/salons/${salonId}/coupons/${initial.id}`, body, { headers: getAuthHeaders() });
      } else {
        await axios.post(`${API}/salons/${salonId}/coupons`, body, { headers: getAuthHeaders() });
      }
      toast.success(isEdit ? 'Coupon updated' : 'Coupon created');
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit coupon ${initial.code}` : 'New coupon'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code *</Label>
              <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. WELCOME10" />
            </div>
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Welcome 10% off" />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Type *</Label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="percent">Percent (%)</option>
                <option value="flat">Flat (₹)</option>
              </select>
            </div>
            <div>
              <Label>Value *</Label>
              <Input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
            </div>
            <div>
              <Label>Min bill amount (₹)</Label>
              <Input type="number" value={form.min_bill_amount} onChange={e => setForm({ ...form, min_bill_amount: e.target.value })} />
            </div>
            <div>
              <Label>Max discount cap (₹)</Label>
              <Input type="number" value={form.max_discount_amount} onChange={e => setForm({ ...form, max_discount_amount: e.target.value })} placeholder="No cap" />
            </div>
            <div>
              <Label>Per-customer limit</Label>
              <Input type="number" value={form.per_customer_limit} onChange={e => setForm({ ...form, per_customer_limit: e.target.value })} />
            </div>
            <div>
              <Label>Total uses cap</Label>
              <Input type="number" value={form.total_cap} onChange={e => setForm({ ...form, total_cap: e.target.value })} placeholder="Unlimited" />
            </div>
            <div>
              <Label>Valid from</Label>
              <Input type="date" value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} />
            </div>
            <div>
              <Label>Valid to</Label>
              <Input type="date" value={form.valid_to} onChange={e => setForm({ ...form, valid_to: e.target.value })} />
            </div>
            <div>
              <Label>Visibility</Label>
              <select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="private">Private (share via campaign)</option>
                <option value="published">Published (show in customer app)</option>
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select value={form.is_active ? 'active' : 'inactive'} onChange={e => setForm({ ...form, is_active: e.target.value === 'active' })} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-gold text-black hover:bg-gold/90" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create coupon')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ============ Placeholders ============

function PlaceholderPanel({ title, note, icon: Icon }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {Icon ? <Icon className="w-4 h-4 text-gold" /> : null}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function LoyaltyPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="w-4 h-4 text-gold" /> Loyalty Program
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Loyalty is managed under <b>Salon Settings → Loyalty Program</b>. Consolidation here comes in M8.
        </p>
      </CardContent>
    </Card>
  );
}

function MembershipsPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" /> Memberships
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Membership plans are managed under <b>Services & Offerings → Memberships</b>. Consolidation here comes in M8.
        </p>
      </CardContent>
    </Card>
  );
}


// ============ Settings ============

function MarketingSettingsPanel({ salonId, getAuthHeaders }) {
  const [channels, setChannels] = useState(null);
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [ch, st] = await Promise.all([
        axios.get(`${API}/salons/${salonId}/marketing/channels`, { headers: getAuthHeaders() }),
        axios.get(`${API}/salons/${salonId}/marketing/settings`, { headers: getAuthHeaders() }),
      ]);
      setChannels(ch.data);
      setSettings(st.data);
    } catch (e) { toast.error('Failed to load settings'); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [salonId]);

  const save = async () => {
    try {
      setSaving(true);
      await axios.put(`${API}/salons/${salonId}/marketing/settings`, settings, { headers: getAuthHeaders() });
      toast.success('Settings saved');
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-gold" /> WhatsApp Channel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!channels ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            <>
              <p className="text-sm text-foreground">Active provider: <b className="text-gold">{channels.active_provider}</b></p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {(channels.channels || []).map((c, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${c.status === 'connected' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-amber-500/50 bg-amber-500/5'}`}>
                    <p className="text-xs text-muted-foreground">{c.provider}</p>
                    <p className="text-sm font-semibold">
                      {c.status === 'connected' ? 'Connected' : c.status === 'action_needed' ? 'Action needed' : 'Not connected'}
                    </p>
                    {c.display_number && <p className="text-xs text-muted-foreground">Number: {c.display_number}</p>}
                    {c.phone_number_id && <p className="text-xs text-muted-foreground">Phone ID: {c.phone_number_id}</p>}
                    {c.note && <p className="text-[11px] text-amber-600 mt-1">{c.note}</p>}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                To switch providers, set <code>WHATSAPP_PROVIDER=meta</code> (or <code>twilio</code>) in the backend
                <code>.env</code> and restart. Meta requires <code>META_WA_PHONE_NUMBER_ID</code> and{' '}
                <code>META_WA_ACCESS_TOKEN</code>.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget & Guardrails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Monthly messaging cap (₹)</Label>
                <Input type="number" value={settings.monthly_cap_inr ?? 0} onChange={e => setSettings({ ...settings, monthly_cap_inr: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Max messages per customer / week</Label>
                <Input type="number" value={settings.freq_cap_per_customer_per_week ?? 3} onChange={e => setSettings({ ...settings, freq_cap_per_customer_per_week: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Quiet hours start</Label>
                <Input value={settings.quiet_hours_start ?? '22:00'} onChange={e => setSettings({ ...settings, quiet_hours_start: e.target.value })} />
              </div>
              <div>
                <Label>Quiet hours end</Label>
                <Input value={settings.quiet_hours_end ?? '09:00'} onChange={e => setSettings({ ...settings, quiet_hours_end: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input id="spend_brake" type="checkbox" checked={!!settings.spend_brake} onChange={e => setSettings({ ...settings, spend_brake: e.target.checked })} />
                <Label htmlFor="spend_brake">Spend brake (pause all sending)</Label>
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input id="consent_required" type="checkbox" checked={settings.consent_required !== false} onChange={e => setSettings({ ...settings, consent_required: e.target.checked })} />
                <Label htmlFor="consent_required">Require customer consent</Label>
              </div>
            </div>
            <Button className="bg-gold text-black hover:bg-gold/90" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
