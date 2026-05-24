/**
 * Phase 8 — Supplier Signup (multi-step form).
 * Steps: 1) Business  2) Contact  3) Bank  4) Categories  5) Review & Submit
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package, Loader2, ArrowLeft, ArrowRight, Check, Building2, Phone,
  Landmark, Tags, FileText,
} from 'lucide-react';
import { useSupplierAuth } from '@/contexts/SupplierAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const SUGGESTED_CATEGORIES = [
  'haircare', 'skincare', 'tools', 'equipment', 'consumables', 'beard care', 'nails', 'spa',
];

const initialForm = {
  // step 1
  business_name: '',
  owner_name: '',
  gst_number: '',
  pan_number: '',
  // step 2
  mobile: '',
  email: '',
  password: '',
  confirm_password: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  // step 3 (optional)
  bank_account_no: '',
  bank_ifsc: '',
  bank_holder: '',
  // step 4
  category_tags: [],
};

const STEPS = [
  { n: 1, label: 'Business', icon: Building2 },
  { n: 2, label: 'Contact', icon: Phone },
  { n: 3, label: 'Bank (optional)', icon: Landmark },
  { n: 4, label: 'Categories', icon: Tags },
  { n: 5, label: 'Review', icon: FileText },
];

export default function SupplierSignupPage() {
  const navigate = useNavigate();
  const { signup } = useSupplierAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const validateStep = (s) => {
    if (s === 1) {
      if (!form.business_name || form.business_name.trim().length < 2) return 'Business name required';
      if (!form.owner_name || form.owner_name.trim().length < 2) return 'Owner name required';
      if (form.gst_number && !/^[0-9A-Z]{10,15}$/i.test(form.gst_number)) return 'Invalid GST format';
      if (form.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(form.pan_number)) return 'Invalid PAN format (e.g., ABCDE1234F)';
    } else if (s === 2) {
      const mobileDigits = form.mobile.replace(/\D/g, '').slice(-10);
      if (mobileDigits.length !== 10) return 'Enter a valid 10-digit mobile';
      if (!form.password || form.password.length < 6) return 'Password must be at least 6 characters';
      if (form.password !== form.confirm_password) return 'Passwords do not match';
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Invalid email';
    } else if (s === 3) {
      const anyBank = form.bank_account_no || form.bank_ifsc || form.bank_holder;
      if (anyBank && (!form.bank_account_no || !form.bank_ifsc || !form.bank_holder)) {
        return 'Fill all bank fields or leave all blank';
      }
    } else if (s === 4) {
      if (!form.category_tags || form.category_tags.length === 0) return 'Select at least one category';
    }
    return null;
  };

  const nextStep = () => {
    const err = validateStep(step);
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(s + 1, STEPS.length));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const toggleCategory = (cat) => {
    const c = cat.trim().toLowerCase();
    if (!c) return;
    setForm((p) => ({
      ...p,
      category_tags: p.category_tags.includes(c) ? p.category_tags.filter((x) => x !== c) : [...p.category_tags, c],
    }));
  };

  const addCustomCategory = () => {
    const v = categoryInput.trim().toLowerCase();
    if (!v) return;
    setForm((p) => ({
      ...p,
      category_tags: p.category_tags.includes(v) ? p.category_tags : [...p.category_tags, v],
    }));
    setCategoryInput('');
  };

  const handleSubmit = async () => {
    for (let s = 1; s <= 4; s++) {
      const err = validateStep(s);
      if (err) { toast.error(`Step ${s}: ${err}`); setStep(s); return; }
    }
    setSubmitting(true);
    try {
      const payload = {
        mobile: form.mobile,
        password: form.password,
        business_name: form.business_name.trim(),
        owner_name: form.owner_name.trim(),
        gst_number: form.gst_number ? form.gst_number.toUpperCase().trim() : null,
        pan_number: form.pan_number ? form.pan_number.toUpperCase().trim() : null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        pincode: form.pincode || null,
        email: form.email || null,
        category_tags: form.category_tags,
      };
      if (form.bank_account_no && form.bank_ifsc && form.bank_holder) {
        payload.bank_details = {
          account_no: form.bank_account_no,
          ifsc: form.bank_ifsc.toUpperCase(),
          account_holder: form.bank_holder,
        };
      }
      await signup(payload);
      toast.success('Signup received — under review!');
      navigate('/supplier/login?signup=success');
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : (detail?.message || 'Signup failed');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mx-auto mb-3">
            <Package className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Supplier Signup</h1>
          <p className="text-sm text-zinc-500 mt-1">Join SalonHub Marketplace as a verified supplier</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-6 px-2">
          {STEPS.map((s, idx) => (
            <React.Fragment key={s.n}>
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                  step > s.n ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' :
                  step === s.n ? 'bg-amber-500 border-amber-500 text-black' :
                  'bg-zinc-900 border-zinc-700 text-zinc-500'
                }`}>
                  {step > s.n ? <Check className="w-4 h-4" /> : s.n}
                </div>
                <div className={`text-[10px] uppercase tracking-widest font-bold mt-1.5 ${step === s.n ? 'text-amber-300' : 'text-zinc-500'}`}>{s.label.split(' ')[0]}</div>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${step > s.n ? 'bg-emerald-500/30' : 'bg-zinc-800'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2"><Building2 className="w-4 h-4 text-amber-400" /> Business details</h2>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Business name *</label>
                <Input value={form.business_name} onChange={(e) => set('business_name', e.target.value)} placeholder="ABC Beauty Supplies" className="mt-1 bg-zinc-950 border-zinc-800 text-white" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Owner / Contact person *</label>
                <Input value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} placeholder="Full name" className="mt-1 bg-zinc-950 border-zinc-800 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">GST number</label>
                  <Input value={form.gst_number} onChange={(e) => set('gst_number', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" className="mt-1 bg-zinc-950 border-zinc-800 text-white font-mono" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">PAN number</label>
                  <Input value={form.pan_number} onChange={(e) => set('pan_number', e.target.value.toUpperCase())} placeholder="ABCDE1234F" className="mt-1 bg-zinc-950 border-zinc-800 text-white font-mono" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2"><Phone className="w-4 h-4 text-amber-400" /> Contact &amp; login</h2>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Mobile *</label>
                <Input value={form.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="10-digit mobile" className="mt-1 bg-zinc-950 border-zinc-800 text-white" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Email</label>
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="owner@business.com" className="mt-1 bg-zinc-950 border-zinc-800 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Password *</label>
                  <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="≥6 chars" className="mt-1 bg-zinc-950 border-zinc-800 text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Confirm password *</label>
                  <Input type="password" value={form.confirm_password} onChange={(e) => set('confirm_password', e.target.value)} className="mt-1 bg-zinc-950 border-zinc-800 text-white" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Address</label>
                <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Street, locality" className="mt-1 bg-zinc-950 border-zinc-800 text-white" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">City</label>
                  <Input value={form.city} onChange={(e) => set('city', e.target.value)} className="mt-1 bg-zinc-950 border-zinc-800 text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">State</label>
                  <Input value={form.state} onChange={(e) => set('state', e.target.value)} className="mt-1 bg-zinc-950 border-zinc-800 text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Pincode</label>
                  <Input value={form.pincode} onChange={(e) => set('pincode', e.target.value)} className="mt-1 bg-zinc-950 border-zinc-800 text-white" />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2"><Landmark className="w-4 h-4 text-amber-400" /> Bank details (optional)</h2>
              <p className="text-xs text-zinc-500">Required only before your first payout. You can also fill these in later from settings.</p>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Account number</label>
                <Input value={form.bank_account_no} onChange={(e) => set('bank_account_no', e.target.value)} className="mt-1 bg-zinc-950 border-zinc-800 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">IFSC code</label>
                  <Input value={form.bank_ifsc} onChange={(e) => set('bank_ifsc', e.target.value.toUpperCase())} placeholder="HDFC0000123" className="mt-1 bg-zinc-950 border-zinc-800 text-white font-mono" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Account holder name</label>
                  <Input value={form.bank_holder} onChange={(e) => set('bank_holder', e.target.value)} className="mt-1 bg-zinc-950 border-zinc-800 text-white" />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2"><Tags className="w-4 h-4 text-amber-400" /> Product categories *</h2>
              <p className="text-xs text-zinc-500">Select categories you'll list products in. You can change these later.</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      form.category_tags.includes(cat)
                        ? 'bg-amber-500 border-amber-500 text-black'
                        : 'bg-zinc-950 border-zinc-700 text-zinc-300 hover:border-amber-500/50'
                    }`}
                  >
                    {form.category_tags.includes(cat) && <Check className="inline w-3 h-3 mr-1" />}
                    {cat}
                  </button>
                ))}
                {form.category_tags.filter((c) => !SUGGESTED_CATEGORIES.includes(c)).map((cat) => (
                  <button key={cat} type="button" onClick={() => toggleCategory(cat)} className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-amber-500 border-amber-500 text-black">
                    <Check className="inline w-3 h-3 mr-1" /> {cat} <span className="ml-1 opacity-60">×</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Input value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomCategory(); } }} placeholder="Add custom category" className="bg-zinc-950 border-zinc-800 text-white" />
                <Button type="button" onClick={addCustomCategory} variant="outline">Add</Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2"><FileText className="w-4 h-4 text-amber-400" /> Review &amp; submit</h2>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 divide-y divide-zinc-800">
                <ReviewRow label="Business" value={form.business_name} />
                <ReviewRow label="Owner" value={form.owner_name} />
                {form.gst_number && <ReviewRow label="GST" value={form.gst_number} mono />}
                {form.pan_number && <ReviewRow label="PAN" value={form.pan_number} mono />}
                <ReviewRow label="Mobile" value={form.mobile} mono />
                {form.email && <ReviewRow label="Email" value={form.email} />}
                {(form.city || form.state) && <ReviewRow label="Location" value={`${form.city || ''}${form.state ? `, ${form.state}` : ''}${form.pincode ? ` - ${form.pincode}` : ''}`} />}
                {form.bank_account_no && <ReviewRow label="Bank" value={`****${form.bank_account_no.slice(-4)} · ${form.bank_ifsc}`} mono />}
                <ReviewRow label="Categories" value={form.category_tags.join(', ')} />
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                Once submitted, your account will be in review. You'll get a WhatsApp notification once approved.
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-800">
            <Button variant="outline" onClick={prevStep} disabled={step === 1}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            {step < STEPS.length ? (
              <Button onClick={nextStep} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                Continue <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Submit application
              </Button>
            )}
          </div>
        </div>

        <div className="text-center mt-6 text-sm">
          <span className="text-zinc-500">Already a supplier? </span>
          <Link to="/supplier/login" className="text-amber-400 hover:text-amber-300 font-semibold">Login</Link>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between px-4 py-2.5 text-sm gap-3">
      <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">{label}</span>
      <span className={`text-white text-right break-words ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</span>
    </div>
  );
}
