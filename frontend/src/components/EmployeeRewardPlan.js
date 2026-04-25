import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Award, Plus, Trash2, Save, Users, Calculator,
  IndianRupee, Percent, Target, ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TARGET_TYPES = [
  { value: 'salary_multiplier', label: 'Yes — Based on Monthly Compensation (Salary)' },
  { value: 'manual', label: 'No — Manual Sales Target' }
];

const SLAB_TYPES = [
  { value: 'additional_pct', label: '% of Additional Sale only', desc: 'Apply % only on the incremental sale beyond previous slab (cumulative)' },
  { value: 'total_pct', label: '% of Total Sale', desc: 'Apply % on the full actual sales (only highest matching slab applies)' },
  { value: 'fixed_amount', label: 'Fixed Amount Bonus', desc: 'Flat ₹ bonus when achievement reaches this threshold' },
];

const blankSlab = () => ({ from_pct: 100, to_pct: 110, type: 'additional_pct', value: 5 });

const blankPlan = () => ({
  target_type: 'salary_multiplier',
  multiplier: 4,
  manual_target: 0,
  slabs: [blankSlab()]
});

export default function EmployeeRewardPlan({ salonId, getAuthHeaders, isAdmin = true }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eligibleBarbers, setEligibleBarbers] = useState([]);
  const [config, setConfig] = useState({
    mode: 'all',
    global_plan: blankPlan(),
    assigned_barber_ids: [],
    individual_plans: {}
  });
  const [expandedBarbers, setExpandedBarbers] = useState({});

  useEffect(() => {
    if (salonId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [planRes, barbersRes] = await Promise.all([
        axios.get(`${API}/salons/${salonId}/reward-plan`, { headers: getAuthHeaders() }),
        axios.get(`${API}/salons/${salonId}/reward-plan/eligible-barbers`, { headers: getAuthHeaders() }),
      ]);

      const cfg = planRes.data || {};
      setConfig({
        mode: cfg.mode || 'all',
        global_plan: cfg.global_plan || blankPlan(),
        assigned_barber_ids: cfg.assigned_barber_ids || [],
        individual_plans: cfg.individual_plans || {}
      });
      setEligibleBarbers(barbersRes.data?.barbers || []);
    } catch (e) {
      console.error('Failed to load reward plan:', e);
      toast.error('Failed to load reward plan');
    } finally {
      setLoading(false);
    }
  };

  // ---------- Slab helpers ----------
  const updateGlobalPlan = (patch) => {
    setConfig(c => ({ ...c, global_plan: { ...c.global_plan, ...patch } }));
  };

  const updateGlobalSlab = (idx, patch) => {
    setConfig(c => {
      const slabs = [...(c.global_plan?.slabs || [])];
      slabs[idx] = { ...slabs[idx], ...patch };
      return { ...c, global_plan: { ...c.global_plan, slabs } };
    });
  };
  const addGlobalSlab = () => {
    setConfig(c => ({
      ...c,
      global_plan: { ...c.global_plan, slabs: [...(c.global_plan?.slabs || []), blankSlab()] }
    }));
  };
  const removeGlobalSlab = (idx) => {
    setConfig(c => {
      const slabs = (c.global_plan?.slabs || []).filter((_, i) => i !== idx);
      return { ...c, global_plan: { ...c.global_plan, slabs } };
    });
  };

  const updateIndividualPlan = (barberId, patch) => {
    setConfig(c => {
      const plan = c.individual_plans[barberId] || blankPlan();
      return {
        ...c,
        individual_plans: { ...c.individual_plans, [barberId]: { ...plan, ...patch } }
      };
    });
  };
  const updateIndividualSlab = (barberId, idx, patch) => {
    setConfig(c => {
      const plan = c.individual_plans[barberId] || blankPlan();
      const slabs = [...(plan.slabs || [])];
      slabs[idx] = { ...slabs[idx], ...patch };
      return {
        ...c,
        individual_plans: { ...c.individual_plans, [barberId]: { ...plan, slabs } }
      };
    });
  };
  const addIndividualSlab = (barberId) => {
    setConfig(c => {
      const plan = c.individual_plans[barberId] || blankPlan();
      return {
        ...c,
        individual_plans: { ...c.individual_plans, [barberId]: { ...plan, slabs: [...(plan.slabs || []), blankSlab()] } }
      };
    });
  };
  const removeIndividualSlab = (barberId, idx) => {
    setConfig(c => {
      const plan = c.individual_plans[barberId] || blankPlan();
      const slabs = (plan.slabs || []).filter((_, i) => i !== idx);
      return {
        ...c,
        individual_plans: { ...c.individual_plans, [barberId]: { ...plan, slabs } }
      };
    });
  };
  const removeIndividualPlan = (barberId) => {
    setConfig(c => {
      const ips = { ...c.individual_plans };
      delete ips[barberId];
      return { ...c, individual_plans: ips };
    });
  };
  const addIndividualPlan = (barberId) => {
    setConfig(c => ({
      ...c,
      individual_plans: { ...c.individual_plans, [barberId]: blankPlan() }
    }));
    setExpandedBarbers(s => ({ ...s, [barberId]: true }));
  };

  // ---------- Validation + save ----------
  const validatePlan = (plan, label = 'plan') => {
    if (!plan) return null;
    if (plan.target_type === 'salary_multiplier') {
      if (!plan.multiplier || plan.multiplier <= 0) return `${label}: Multiplier must be > 0`;
    } else {
      if (!plan.manual_target || plan.manual_target <= 0) return `${label}: Manual target must be > 0`;
    }
    if (!plan.slabs || plan.slabs.length === 0) return `${label}: At least one slab is required`;
    for (const s of plan.slabs) {
      if (s.from_pct == null || s.from_pct < 0) return `${label}: invalid slab range`;
      if (s.to_pct == null || s.to_pct < s.from_pct) return `${label}: slab "to" must be ≥ "from"`;
      if (s.value == null || s.value < 0) return `${label}: slab value must be ≥ 0`;
    }
    return null;
  };

  const handleSave = async () => {
    // Validate
    if (config.mode === 'all' || config.mode === 'partial') {
      const err = validatePlan(config.global_plan, 'Global plan');
      if (err) { toast.error(err); return; }
    }
    for (const [bid, plan] of Object.entries(config.individual_plans || {})) {
      const barberName = eligibleBarbers.find(b => b.id === bid)?.name || bid;
      const err = validatePlan(plan, `Plan for ${barberName}`);
      if (err) { toast.error(err); return; }
    }

    setSaving(true);
    try {
      const payload = {
        mode: config.mode,
        global_plan: (config.mode === 'individual') ? null : config.global_plan,
        assigned_barber_ids: config.assigned_barber_ids || [],
        individual_plans: config.individual_plans || {}
      };
      await axios.post(`${API}/salons/${salonId}/reward-plan`, payload, { headers: getAuthHeaders() });
      toast.success('Reward plan saved');
    } catch (e) {
      console.error('Save failed:', e);
      toast.error(e.response?.data?.detail || 'Failed to save reward plan');
    } finally {
      setSaving(false);
    }
  };

  // ---------- Render helpers ----------
  const renderPlanEditor = (plan, opts = {}) => {
    const { onChange, onSlabChange, onAddSlab, onRemoveSlab, salaryHint } = opts;

    const computedTarget = (() => {
      if (plan.target_type === 'salary_multiplier') {
        const sal = Number(salaryHint || 0);
        return sal * Number(plan.multiplier || 0);
      }
      return Number(plan.manual_target || 0);
    })();

    return (
      <div className="space-y-4">
        {/* Step 2: Target Type */}
        <div className="grid md:grid-cols-2 gap-3 items-end">
          <div>
            <Label className="text-xs">Is reward based on Monthly Compensation (Salary)?</Label>
            <Select value={plan.target_type} onValueChange={(v) => onChange({ target_type: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TARGET_TYPES.map(t => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {plan.target_type === 'salary_multiplier' ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs flex items-center gap-1"><Calculator className="w-3 h-3" /> Multiplier</Label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={plan.multiplier ?? ''}
                  onChange={(e) => onChange({ multiplier: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 4"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Target className="w-3 h-3" /> Auto Target</Label>
                <Input
                  type="text"
                  value={salaryHint != null ? `₹${computedTarget.toLocaleString('en-IN')}` : 'salary × multiplier'}
                  disabled
                  className="mt-1 bg-muted/50"
                />
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Monthly Sales Target (₹)</Label>
              <Input
                type="number"
                min="0"
                value={plan.manual_target ?? ''}
                onChange={(e) => onChange({ manual_target: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 100000"
                className="mt-1"
              />
            </div>
          )}
        </div>

        {/* Step 3: Slabs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-semibold">Incentive Slabs</Label>
            <Button type="button" size="sm" variant="outline" onClick={onAddSlab} className="text-gold border-gold hover:bg-gold/10">
              <Plus className="w-3 h-3 mr-1" /> Add Slab
            </Button>
          </div>
          <div className="space-y-2">
            {(plan.slabs || []).map((slab, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 p-3 bg-muted/40 rounded border border-border">
                <div className="col-span-12 sm:col-span-2">
                  <Label className="text-[10px]">From %</Label>
                  <Input type="number" min="0" value={slab.from_pct ?? 0} onChange={(e) => onSlabChange(idx, { from_pct: parseFloat(e.target.value) || 0 })} className="h-8" />
                </div>
                <div className="col-span-12 sm:col-span-2">
                  <Label className="text-[10px]">To %</Label>
                  <Input type="number" min="0" value={slab.to_pct ?? 0} onChange={(e) => onSlabChange(idx, { to_pct: parseFloat(e.target.value) || 0 })} className="h-8" />
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <Label className="text-[10px]">Type</Label>
                  <Select value={slab.type} onValueChange={(v) => onSlabChange(idx, { type: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SLAB_TYPES.map(t => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-10 sm:col-span-3">
                  <Label className="text-[10px]">{slab.type === 'fixed_amount' ? 'Amount (₹)' : 'Rate (%)'}</Label>
                  <Input type="number" min="0" value={slab.value ?? 0} onChange={(e) => onSlabChange(idx, { value: parseFloat(e.target.value) || 0 })} className="h-8" />
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-end">
                  <Button type="button" size="sm" variant="ghost" onClick={() => onRemoveSlab(idx)} className="text-red-500 h-8 w-full">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
            {(plan.slabs || []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No slabs yet. Click "Add Slab".</p>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 flex items-start gap-1">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            Tip: Use <span className="font-medium">% of Additional Sale</span> for cumulative tier rewards (e.g. 100-110% → 5%, 110-120% → 8%) so each slab earns only on the incremental sale.
          </p>
        </div>
      </div>
    );
  };

  // ---------- Main render ----------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gold/20 rounded-full">
            <Award className="w-6 h-6 text-gold" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Employee Reward Plan</h3>
            <p className="text-sm text-muted-foreground">Configure salary-linked monthly incentives with multi-stage slab calculations.</p>
          </div>
        </div>
        {!isAdmin && (
          <span className="text-xs px-2 py-1 bg-muted rounded">Read-only (admin can edit)</span>
        )}
      </div>

      {/* Step 1: Mode */}
      <div className="grid md:grid-cols-2 gap-3 items-end p-4 bg-muted/40 rounded-lg border border-border">
        <div>
          <Label className="text-xs">Step 1 — Is the incentive plan same for all employees?</Label>
          <Select
            value={config.mode}
            onValueChange={(v) => setConfig(c => ({ ...c, mode: v }))}
            disabled={!isAdmin}
          >
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Yes — Same plan for all barbers</SelectItem>
              <SelectItem value="individual">No — Custom plan per barber</SelectItem>
              <SelectItem value="partial">Partial — Common plan + custom override for some</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Eligible barbers picker for "all" + "partial" modes */}
        {(config.mode === 'all' || config.mode === 'partial') && (
          <div>
            <Label className="text-xs">Apply common plan to:</Label>
            <Select
              value={config.assigned_barber_ids.length === 0 ? '__all__' : '__custom__'}
              onValueChange={(v) => {
                if (v === '__all__') setConfig(c => ({ ...c, assigned_barber_ids: [] }));
                if (v === '__custom__' && config.assigned_barber_ids.length === 0) {
                  setConfig(c => ({ ...c, assigned_barber_ids: eligibleBarbers.map(b => b.id) }));
                }
              }}
              disabled={!isAdmin}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All barbers</SelectItem>
                <SelectItem value="__custom__">Selected barbers (toggle below)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Custom barber selection (only for partial / custom mode) */}
      {(config.mode === 'all' || config.mode === 'partial') && config.assigned_barber_ids.length > 0 && (
        <div className="p-3 bg-muted/30 rounded-lg border border-border">
          <Label className="text-xs mb-2 block">Barbers covered by global plan:</Label>
          <div className="flex flex-wrap gap-2">
            {eligibleBarbers.map(b => {
              const isOn = config.assigned_barber_ids.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => {
                    setConfig(c => ({
                      ...c,
                      assigned_barber_ids: isOn
                        ? c.assigned_barber_ids.filter(x => x !== b.id)
                        : [...c.assigned_barber_ids, b.id]
                    }));
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    isOn ? 'bg-gold text-black border-gold' : 'bg-background text-foreground border-border hover:border-gold/50'
                  }`}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Global plan editor (for "all" + "partial") */}
      {(config.mode === 'all' || config.mode === 'partial') && (
        <div className="border border-border rounded-lg p-4 bg-background">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-gold" /> Common Plan
          </h4>
          {renderPlanEditor(config.global_plan, {
            onChange: updateGlobalPlan,
            onSlabChange: updateGlobalSlab,
            onAddSlab: addGlobalSlab,
            onRemoveSlab: removeGlobalSlab,
          })}
        </div>
      )}

      {/* Individual / Override plans */}
      {(config.mode === 'individual' || config.mode === 'partial') && (
        <div className="border border-border rounded-lg p-4 bg-background space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-gold" />
            {config.mode === 'individual' ? 'Per-Barber Plans' : 'Per-Barber Override Plans'}
          </h4>
          {config.mode === 'partial' && (
            <p className="text-[11px] text-muted-foreground">
              Override takes priority — a barber listed below uses ONLY their custom plan, not the global one.
            </p>
          )}

          <div className="space-y-2">
            {eligibleBarbers.map(b => {
              const hasPlan = !!config.individual_plans[b.id];
              const expanded = !!expandedBarbers[b.id];
              return (
                <div key={b.id} className="border border-border rounded-lg">
                  <div className="flex items-center justify-between p-3 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{b.name}</span>
                      {b.compensation > 0 && (
                        <span className="text-[11px] text-muted-foreground">Salary: ₹{Number(b.compensation).toLocaleString('en-IN')}</span>
                      )}
                      {hasPlan && (
                        <span className="text-[10px] px-2 py-0.5 bg-gold/20 text-gold rounded">Custom</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!hasPlan ? (
                        <Button size="sm" variant="outline" onClick={() => addIndividualPlan(b.id)} disabled={!isAdmin}>
                          <Plus className="w-3 h-3 mr-1" /> Add Custom Plan
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setExpandedBarbers(s => ({ ...s, [b.id]: !expanded }))}>
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => removeIndividualPlan(b.id)} disabled={!isAdmin}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <AnimatePresence>
                    {hasPlan && expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-3 border-t border-border">
                          {renderPlanEditor(config.individual_plans[b.id], {
                            onChange: (p) => updateIndividualPlan(b.id, p),
                            onSlabChange: (i, p) => updateIndividualSlab(b.id, i, p),
                            onAddSlab: () => addIndividualSlab(b.id),
                            onRemoveSlab: (i) => removeIndividualSlab(b.id, i),
                            salaryHint: b.compensation
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {eligibleBarbers.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No barbers found. Mark staff as "Visible to Customers as Barber" first.</p>
            )}
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end pt-3 border-t border-border">
        <Button onClick={handleSave} disabled={saving || !isAdmin} className="bg-gold text-black hover:bg-gold/90">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Reward Plan'}
        </Button>
      </div>
    </div>
  );
}
