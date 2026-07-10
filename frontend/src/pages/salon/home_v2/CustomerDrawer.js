/**
 * Add Guest / Customer drawer for the Home v2 page.
 * - Slides from the right (~75vw).
 * - When opened as a "sub-drawer" (from inside the Appointment drawer) it uses
 *   `stacked` mode which raises z-index above the appointment drawer.
 * - On save it POSTs to the real backend and then calls onSaved(customer) so
 *   the parent can auto-select the new customer.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CustomerDrawer({
  open, onClose, onSaved, getAuthHeaders, salonId,
  stacked = false,               // sub-drawer above appointment drawer
  presetName = '',
  presetPhone = '',
  source = 'owner',              // source enum
}) {
  const [form, setForm] = useState({
    first: '', last: '', code: '+91', phone: '',
    email: '', gender: 'Female', tags: [], notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const firstNameRef = useRef(null);

  // Reset & prefill when opened
  useEffect(() => {
    if (open) {
      const parts = (presetName || '').trim().split(/\s+/);
      setForm({
        first: parts[0] || '',
        last: parts.slice(1).join(' ') || '',
        code: '+91',
        phone: (presetPhone || '').replace(/^\+?91/, '').trim(),
        email: '', gender: 'Female', tags: [], notes: '',
      });
      setErrors({});
      setTimeout(() => firstNameRef.current?.focus(), 350);
    }
  }, [open, presetName, presetPhone]);

  const toggleTag = (t) => setForm(f => ({
    ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t],
  }));

  const save = async () => {
    const errs = {};
    if (!form.first.trim()) errs.first = 'First name is required';
    const cleaned = (form.phone || '').replace(/\D/g, '');
    if (cleaned.length < 10) errs.phone = 'Enter a valid 10-digit number';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const fullPhone = `${form.code}${cleaned.slice(-10)}`;
      // Uses the existing customer master endpoint so the new guest shows up
      // everywhere in the app (bookings, marketing lists, wallet, etc.).
      const payload = {
        name: `${form.first} ${form.last}`.trim(),
        phone: fullPhone,
        email: form.email || null,
        gender: form.gender,
        tags: form.tags,
        notes: form.notes,
        source,               // ← online|qr|owner|direct — powers the KPI bar chip
      };
      const res = await axios.post(
        `${API}/salons/${salonId}/customers`,
        payload,
        { headers: getAuthHeaders() },
      );
      const cust = res.data?.customer || res.data || {};
      // Smooth close: wait 300ms then fire onSaved so the parent can auto-select.
      setTimeout(() => {
        onSaved?.({ ...cust, phone: fullPhone, name: payload.name });
      }, 300);
      onClose?.();
    } catch (e) {
      // Bubble up API errors as inline error under phone (dedup fallback)
      const detail = e?.response?.data?.detail || 'Save failed';
      setErrors({ phone: typeof detail === 'string' ? detail : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={`shv2-overlay ${open ? 'open' : ''}`} onClick={onClose} style={{ zIndex: stacked ? 75 : 60 }} />
      <aside className={`shv2-drawer ${stacked ? 'stacked' : 'narrow'} ${open ? 'open' : ''}`}>
        <div className="drawer__h">
          <div className="tt">
            <div className="ic">
              <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            </div>
            <div><h3>Add New Guest</h3><p>Create a customer profile</p></div>
          </div>
          <button className="drawer__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="drawer__body">
          <div className="fs-title">Basic details</div>
          <div className="grid2">
            <div className="field">
              <label>First name <span className="req">*</span></label>
              <input ref={firstNameRef} value={form.first} onChange={e => setForm({ ...form, first: e.target.value })}
                     className={errors.first ? 'err' : ''} placeholder="e.g. Priya" />
              {errors.first && <span className="msg show">{errors.first}</span>}
            </div>
            <div className="field">
              <label>Last name</label>
              <input value={form.last} onChange={e => setForm({ ...form, last: e.target.value })} placeholder="e.g. Sharma" />
            </div>
            <div className="field full">
              <label>Mobile number <span className="req">*</span></label>
              <div className="phone">
                <select value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}>
                  <option>+91</option><option>+1</option><option>+44</option>
                </select>
                <input inputMode="numeric" placeholder="98765 43210"
                       value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                       className={errors.phone ? 'err' : ''} />
              </div>
              {errors.phone && <span className="msg show">{errors.phone}</span>}
            </div>
            <div className="field full">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="priya@email.com" />
            </div>
            <div className="field full">
              <label>Gender</label>
              <div className="seg-pick">
                {['Female', 'Male', 'Other'].map(g => (
                  <button key={g} type="button" className={form.gender === g ? 'on' : ''}
                          onClick={() => setForm({ ...form, gender: g })}>{g}</button>
                ))}
              </div>
            </div>
            <div className="field full">
              <label>Tags</label>
              <div className="tags">
                {['VIP', 'New', 'Regular'].map(t => (
                  <button key={t} type="button" className={`tag ${form.tags.includes(t) ? 'on' : ''}`}
                          onClick={() => toggleTag(t)}>{t}</button>
                ))}
              </div>
            </div>
            <div className="field full">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                        placeholder="Allergies, preferences…" />
            </div>
          </div>
        </div>
        <div className="drawer__f">
          <span className="hint"><span style={{ color: '#E45C86' }}>*</span> Required</span>
          <div className="acts">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save guest'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
