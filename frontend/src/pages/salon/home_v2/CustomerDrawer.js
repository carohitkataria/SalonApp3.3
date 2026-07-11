/**
 * Add Guest / Customer drawer for the Home v2 page.
 *
 * Features added in v1.1:
 * - Profile photo upload (data-URL preview, synced to salon_customers.photo_url).
 *   If the guest later uploads a photo from the customer-app, it's already
 *   available on the salon side because we surface user.profile_photo → photo_url
 *   in GET /customers.
 * - Date of birth, Preferred staff (dropdown from active barbers).
 * - Custom tags — click "+" to add a new one; system tags (VIP/New/Regular) stay.
 * - Instagram + Facebook IDs — persisted to support future targeted ads.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SYSTEM_TAGS = ['VIP', 'New', 'Regular'];

export default function CustomerDrawer({
  open, onClose, onSaved, getAuthHeaders, salonId,
  stacked = false,
  presetName = '',
  presetPhone = '',
  source = 'owner',
}) {
  const [form, setForm] = useState({
    first: '', last: '', code: '+91', phone: '',
    email: '', gender: 'Female',
    tags: [],                         // combined system + custom
    customTags: [],                   // only the user-added ones
    notes: '',
    photo_url: '',                    // data-URL preview
    dob: '',                          // YYYY-MM-DD
    preferred_barber_id: '',
    instagram_id: '',
    facebook_id: '',
  });
  const [barbers, setBarbers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');
  const firstNameRef = useRef(null);
  const fileRef = useRef(null);

  // Reset & prefill when opened
  useEffect(() => {
    if (!open) return;
    const parts = (presetName || '').trim().split(/\s+/);
    setForm({
      first: parts[0] || '',
      last: parts.slice(1).join(' ') || '',
      code: '+91',
      phone: (presetPhone || '').replace(/^\+?91/, '').trim(),
      email: '', gender: 'Female',
      tags: [], customTags: [],
      notes: '',
      photo_url: '', dob: '', preferred_barber_id: '',
      instagram_id: '', facebook_id: '',
    });
    setErrors({}); setAddingTag(false); setNewTag('');
    setTimeout(() => firstNameRef.current?.focus(), 350);
    // Load barbers for Preferred staff dropdown
    (async () => {
      try {
        const res = await axios.get(`${API}/salons/${salonId}/barbers`, { headers: getAuthHeaders() });
        const list = Array.isArray(res.data) ? res.data : (res.data?.barbers || []);
        setBarbers(list.filter(b => b.is_active !== false));
      } catch (_) { setBarbers([]); }
    })();
  }, [open, presetName, presetPhone, salonId, getAuthHeaders]);

  const toggleTag = (t) => setForm(f => ({
    ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t],
  }));

  const addCustomTag = () => {
    const t = newTag.trim();
    if (!t) { setAddingTag(false); return; }
    if (t.length > 24) return;
    setForm(f => ({
      ...f,
      tags: f.tags.includes(t) ? f.tags : [...f.tags, t],
      customTags: f.customTags.includes(t) ? f.customTags : [...f.customTags, t],
    }));
    setNewTag(''); setAddingTag(false);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { // 3MB cap for data-URL
      setErrors(er => ({ ...er, photo: 'Photo must be under 3 MB' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm(f => ({ ...f, photo_url: String(reader.result || '') }));
      setErrors(er => ({ ...er, photo: null }));
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    const errs = {};
    if (!form.first.trim()) errs.first = 'First name is required';
    const cleaned = (form.phone || '').replace(/\D/g, '');
    if (cleaned.length < 10) errs.phone = 'Enter a valid 10-digit number';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const fullPhone = `${form.code}${cleaned.slice(-10)}`;
      const payload = {
        name: `${form.first} ${form.last}`.trim(),
        phone: fullPhone,
        email: form.email || null,
        gender: form.gender,
        tags: form.tags,
        notes: form.notes,
        source,
        photo_url: form.photo_url || null,
        dob: form.dob || null,
        preferred_barber_id: form.preferred_barber_id || null,
        instagram_id: form.instagram_id || null,
        facebook_id: form.facebook_id || null,
      };
      const res = await axios.post(
        `${API}/salons/${salonId}/customers`,
        payload,
        { headers: getAuthHeaders() },
      );
      const cust = res.data?.customer || res.data || {};
      setTimeout(() => {
        onSaved?.({ ...cust, phone: fullPhone, name: payload.name, photo_url: form.photo_url });
      }, 300);
      onClose?.();
    } catch (e) {
      const detail = e?.response?.data?.detail || 'Save failed';
      setErrors({ phone: typeof detail === 'string' ? detail : 'Save failed' });
    } finally { setSaving(false); }
  };

  const nameInitial = ((form.first || 'G')[0] || 'G').toUpperCase();

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
          {/* Profile photo */}
          <div className="photo-row">
            <div className="photo" style={form.photo_url ? { backgroundImage: `url(${form.photo_url})`, backgroundSize: 'cover', backgroundPosition: 'center', border: '2px solid #E7E2FF' } : {}}>
              {!form.photo_url && (
                <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22, color: '#6C4FE0' }}>{nameInitial}</div>
              )}
            </div>
            <div className="pt">
              <b>Profile photo</b>
              <span>Optional · JPG/PNG under 3 MB · syncs with guest's own profile</span>
              <div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
                <button onClick={() => fileRef.current?.click()}>{form.photo_url ? 'Change photo' : 'Upload photo'}</button>
                {form.photo_url && <button style={{ marginLeft: 6, background: '#FCEAF1', color: '#E45C86', borderColor: '#FCEAF1' }} onClick={() => setForm(f => ({ ...f, photo_url: '' }))}>Remove</button>}
              </div>
              {errors.photo && <span className="msg show">{errors.photo}</span>}
            </div>
          </div>

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
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="priya@email.com" />
            </div>
            <div className="field">
              <label>Date of birth</label>
              <input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} />
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
              <label>Preferred staff</label>
              <select value={form.preferred_barber_id} onChange={e => setForm({ ...form, preferred_barber_id: e.target.value })}>
                <option value="">— No preference —</option>
                {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="field full">
              <label>Tags <span style={{ color: '#7C8092', fontWeight: 500, fontSize: 11 }}>· click + to add custom</span></label>
              <div className="tags">
                {SYSTEM_TAGS.map(t => (
                  <button key={t} type="button" className={`tag ${form.tags.includes(t) ? 'on' : ''}`}
                          onClick={() => toggleTag(t)}>{t}</button>
                ))}
                {form.customTags.map(t => (
                  <button key={t} type="button" className={`tag ${form.tags.includes(t) ? 'on' : ''}`}
                          onClick={() => toggleTag(t)}>#{t}</button>
                ))}
                {addingTag ? (
                  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <input autoFocus value={newTag} onChange={e => setNewTag(e.target.value)}
                           onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } if (e.key === 'Escape') setAddingTag(false); }}
                           placeholder="new tag" maxLength={24}
                           style={{ fontSize: 12, padding: '5px 10px', border: '1px solid #ECECF3', borderRadius: 20, width: 110, outline: 'none' }} />
                    <button className="tag on" style={{ padding: '5px 10px' }} onClick={addCustomTag}>Add</button>
                  </span>
                ) : (
                  <button className="tag" style={{ background: '#F1EEFF', color: '#6C4FE0', borderColor: '#E7E2FF', fontWeight: 800 }} onClick={() => setAddingTag(true)}>+ Add tag</button>
                )}
              </div>
            </div>
            <div className="field">
              <label>Instagram ID <span style={{ color: '#7C8092', fontWeight: 500, fontSize: 11 }}>· for ad targeting</span></label>
              <input value={form.instagram_id} onChange={e => setForm({ ...form, instagram_id: e.target.value })} placeholder="@priya.sharma" />
            </div>
            <div className="field">
              <label>Facebook ID</label>
              <input value={form.facebook_id} onChange={e => setForm({ ...form, facebook_id: e.target.value })} placeholder="fb.me/priya" />
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
