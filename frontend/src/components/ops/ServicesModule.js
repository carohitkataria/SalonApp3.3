import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { injectZenCss, Icon, rupee } from './opsTheme';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const CATEGORIES = ['Services', 'Packages'];
const GENDERS = ['Men', 'Women', 'Unisex'];

/** Blank service template. */
const BLANK = {
  id: null,
  service_name: '',
  description: '',
  category: 'Services',
  sub_category: '',
  gender_tag: 'Unisex',
  default_duration: 30,
  base_price: 0,
  price_type: 'fixed',
  is_favorite: false,
  available_at_home: false,
  home_price: 0,
  thumbnail_url: '',
  images: [],
};

export default function ServicesModule({ salonId, getAuthHeaders }) {
  useEffect(() => { injectZenCss(); }, []);
  const [services, setServices] = useState([]);
  const [subs, setSubs] = useState({ Services: [], Packages: [] });
  const [selCat, setSelCat] = useState('Services');
  const [selSub, setSelSub] = useState(null); // null = all
  const [search, setSearch] = useState('');
  const [openCats, setOpenCats] = useState({ Services: true, Packages: true });
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null); // service being edited
  const [addingSubFor, setAddingSubFor] = useState(null); // category being added-to
  const [newSubName, setNewSubName] = useState('');

  const load = async () => {
    if (!salonId) return;
    try {
      const [svc, sub] = await Promise.all([
        axios.get(`${API}/salons/${salonId}/services/all`, { headers: getAuthHeaders() }),
        axios.get(`${API}/salons/${salonId}/services/subcategories`),
      ]);
      // /services/all can return { services: [...] } or an array
      const raw = svc.data;
      const list = Array.isArray(raw) ? raw : (raw?.services || raw?.data || []);
      setServices(list);
      setSubs({
        Services: sub.data?.Services || [],
        Packages: sub.data?.Packages || [],
      });
    } catch (e) {
      console.error('load services', e);
      toast.error('Failed to load services');
    }
  };

  useEffect(() => { load(); }, [salonId]); // eslint-disable-line

  const filtered = useMemo(() => {
    let list = services.filter((s) => (s.category || 'Services') === selCat);
    if (selSub) list = list.filter((s) => (s.sub_category || '') === selSub);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) => (s.service_name || '').toLowerCase().includes(q) ||
               (s.description || '').toLowerCase().includes(q) ||
               (s.sub_category || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [services, selCat, selSub, search]);

  const grouped = useMemo(() => {
    if (selSub) return { [selSub]: filtered };
    const g = {};
    for (const s of filtered) {
      const k = s.sub_category || 'General';
      g[k] = g[k] || [];
      g[k].push(s);
    }
    return g;
  }, [filtered, selSub]);

  const countInCat = (cat) => services.filter((s) => (s.category || 'Services') === cat).length;
  const countInSub = (cat, sub) => services.filter(
    (s) => (s.category || 'Services') === cat && (s.sub_category || '') === sub
  ).length;

  const openNew = () => { setEditing({ ...BLANK, category: selCat, sub_category: selSub || '' }); setShowAdd(true); };
  const openEdit = (svc) => { setEditing({ ...BLANK, ...svc }); setShowAdd(true); };

  const saveSubcat = async (category) => {
    const name = newSubName.trim();
    if (!name) return;
    try {
      await axios.post(
        `${API}/salons/${salonId}/services/subcategories`,
        { category, name },
        { headers: getAuthHeaders() }
      );
      setSubs((s) => ({ ...s, [category]: Array.from(new Set([...(s[category] || []), name])).sort() }));
      setNewSubName('');
      setAddingSubFor(null);
      toast.success(`Added "${name}"`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to add');
    }
  };

  const toggleFav = async (svc) => {
    try {
      await axios.put(
        `${API}/services/${svc.id}/favorite`,
        { is_favorite: !svc.is_favorite },
        { headers: getAuthHeaders() }
      );
      setServices((s) => s.map((x) => (x.id === svc.id ? { ...x, is_favorite: !svc.is_favorite } : x)));
    } catch (e) {
      // Some deployments expect no body — try query param
      try {
        await axios.put(`${API}/services/${svc.id}/favorite?is_favorite=${!svc.is_favorite}`, null, { headers: getAuthHeaders() });
        setServices((s) => s.map((x) => (x.id === svc.id ? { ...x, is_favorite: !svc.is_favorite } : x)));
      } catch (_) {
        toast.error('Could not update favourite');
      }
    }
  };

  const deleteSvc = async (svc) => {
    if (!window.confirm(`Delete "${svc.service_name}"?`)) return;
    try {
      await axios.delete(`${API}/services/${svc.id}`, { headers: getAuthHeaders() });
      setServices((s) => s.filter((x) => x.id !== svc.id));
      toast.success('Deleted');
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="zen">
      <div className="z-wrap">
        <div className="z-phead">
          <div>
            <div className="eyebrow">Operations</div>
            <h1>Services</h1>
            <p>Manage salon services and packages. Categories are fixed to Services and Packages; add your own sub-categories.</p>
          </div>
          <div className="z-actions">
            <button className="z-btn z-btn--pri" onClick={openNew}>
              <Icon name="plus" /> Add Service
            </button>
          </div>
        </div>

        <div className="z-split">
          {/* Left rail — categories & sub-categories */}
          <div className="z-cats z-card">
            <div className="z-cats-h">
              <div className="z-search"><Icon name="search" />
                <input placeholder="Search services..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="z-cat-list">
              {CATEGORIES.map((cat) => (
                <div key={cat}>
                  <div
                    className={`z-cat-row ${selCat === cat ? 'sel' : ''} ${openCats[cat] ? 'open' : ''}`}
                    onClick={() => {
                      setSelCat(cat); setSelSub(null);
                      setOpenCats((o) => ({ ...o, [cat]: !o[cat] || selCat !== cat }));
                    }}
                  >
                    <Icon name="chevR" className="chev" size={14} />
                    <div className="z-cat-ico"><Icon name={cat === 'Services' ? 'scissors' : 'gift'} /></div>
                    <div className="z-cat-name">{cat}</div>
                    <div className="z-cat-count">{countInCat(cat)}</div>
                  </div>
                  {openCats[cat] && (
                    <div className="z-subs">
                      <div
                        className={`z-sub-row ${selCat === cat && !selSub ? 'sel' : ''}`}
                        onClick={() => { setSelCat(cat); setSelSub(null); }}
                      >
                        All <span className="cnt">{countInCat(cat)}</span>
                      </div>
                      {(subs[cat] || []).map((sub) => (
                        <div
                          key={sub}
                          className={`z-sub-row ${selCat === cat && selSub === sub ? 'sel' : ''}`}
                          onClick={() => { setSelCat(cat); setSelSub(sub); }}
                        >
                          {sub} <span className="cnt">{countInSub(cat, sub)}</span>
                        </div>
                      ))}
                      {addingSubFor === cat ? (
                        <div className="z-sub-add-field">
                          <input
                            autoFocus
                            placeholder="Sub-category name..."
                            value={newSubName}
                            onChange={(e) => setNewSubName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveSubcat(cat); if (e.key === 'Escape') { setAddingSubFor(null); setNewSubName(''); } }}
                          />
                          <button className="z-btn z-btn--pri z-btn--sm" onClick={() => saveSubcat(cat)}>
                            <Icon name="check" />
                          </button>
                        </div>
                      ) : (
                        <div className="z-sub-add" onClick={() => { setAddingSubFor(cat); setNewSubName(''); }}>
                          <Icon name="plus" /> New sub-category
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right — services list */}
          <div>
            {Object.keys(grouped).length === 0 ? (
              <div className="z-empty z-card">
                <Icon name="scissors" size={40} /><br />
                No services in this category yet.<br />
                <button className="z-btn z-btn--pri" style={{ marginTop: 12 }} onClick={openNew}>
                  <Icon name="plus" /> Add your first service
                </button>
              </div>
            ) : (
              Object.entries(grouped).map(([subName, list]) => (
                <div key={subName}>
                  <div className="z-group-h">
                    <h3>{subName}</h3>
                    <span className="cnt">{list.length} service{list.length === 1 ? '' : 's'}</span>
                  </div>
                  {list.map((svc) => (
                    <ServiceCard
                      key={svc.id}
                      svc={svc}
                      onEdit={() => openEdit(svc)}
                      onDelete={() => deleteSvc(svc)}
                      onToggleFav={() => toggleFav(svc)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showAdd && (
        <ServiceDrawer
          initial={editing}
          salonId={salonId}
          getAuthHeaders={getAuthHeaders}
          subs={subs[editing?.category] || []}
          onSubCategoryCreate={(name) => saveSubcatForDrawer(editing?.category, name)}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={(saved, isNew) => {
            setServices((s) => {
              if (isNew) return [saved, ...s];
              return s.map((x) => (x.id === saved.id ? { ...x, ...saved } : x));
            });
            setShowAdd(false);
            setEditing(null);
            toast.success(isNew ? 'Service added' : 'Service updated');
          }}
        />
      )}
    </div>
  );

  async function saveSubcatForDrawer(category, name) {
    if (!name) return null;
    try {
      await axios.post(
        `${API}/salons/${salonId}/services/subcategories`,
        { category, name },
        { headers: getAuthHeaders() }
      );
      setSubs((s) => ({ ...s, [category]: Array.from(new Set([...(s[category] || []), name])).sort() }));
      return name;
    } catch (e) {
      toast.error('Failed to add sub-category');
      return null;
    }
  }
}

function ServiceCard({ svc, onEdit, onDelete, onToggleFav }) {
  const emoji = (svc.category === 'Packages') ? '🎁' : '✂️';
  return (
    <div className="z-svc-card">
      <div className="z-svc-main">
        <div className="z-svc-thumb">
          {svc.thumbnail_url ? <img src={svc.thumbnail_url} alt="" /> : <span>{emoji}</span>}
        </div>
        <div className="z-svc-body">
          <div className="z-svc-title">
            <h4>{svc.service_name}</h4>
            <div className="z-svc-price">
              {rupee(svc.base_price)}
              {svc.price_type === 'onwards' && <span className="onwards">ONWARDS</span>}
            </div>
          </div>
          {svc.description && <p className="z-svc-desc">{svc.description}</p>}
          <div className="z-svc-tags">
            <span className="z-pill z-pill--blue">{svc.default_duration || 30} min</span>
            <span className="z-pill">{svc.gender_tag || 'Unisex'}</span>
            {svc.sub_category && <span className="z-pill">{svc.sub_category}</span>}
            {svc.available_at_home && <span className="z-pill z-pill--ok">At-home</span>}
          </div>
        </div>
      </div>
      <div className="z-svc-actions">
        <button className={`z-link fav ${svc.is_favorite ? 'on' : ''}`} onClick={onToggleFav}>
          <Icon name="star" /> {svc.is_favorite ? 'Favourited' : 'Favourite'}
        </button>
        <div className="sp" />
        <button className="z-link" onClick={onEdit}><Icon name="edit" /> Edit</button>
        <button className="z-link danger" onClick={onDelete}><Icon name="trash" /> Delete</button>
      </div>
    </div>
  );
}

function ServiceDrawer({ initial, salonId, getAuthHeaders, subs, onSubCategoryCreate, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const fileRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?.id;

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onPickImage = () => fileRef.current?.click();
  const onFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be under 3 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => upd('thumbnail_url', reader.result);
    reader.readAsDataURL(file);
  };

  const handleAddSub = async () => {
    const name = window.prompt('Sub-category name:');
    if (!name) return;
    const added = await onSubCategoryCreate(name.trim());
    if (added) upd('sub_category', name.trim());
  };

  const save = async () => {
    if (!form.service_name.trim()) return toast.error('Service name required');
    setSaving(true);
    try {
      const payload = {
        service_name: form.service_name.trim(),
        description: form.description || '',
        category: form.category,
        sub_category: form.sub_category || null,
        gender_tag: form.gender_tag,
        default_duration: parseInt(form.default_duration || 30, 10),
        base_price: parseFloat(form.base_price || 0),
        price_type: form.price_type || 'fixed',
        is_favorite: !!form.is_favorite,
        available_at_home: !!form.available_at_home,
        home_price: form.available_at_home ? parseFloat(form.home_price || 0) : null,
        thumbnail_url: form.thumbnail_url || null,
        images: form.images || [],
      };
      let saved;
      if (isEdit) {
        const res = await axios.put(`${API}/services/${form.id}`, payload, { headers: getAuthHeaders() });
        saved = res.data;
      } else {
        const res = await axios.post(`${API}/services`, payload, { headers: getAuthHeaders() });
        saved = res.data;
        // Also enable for salon
        try {
          await axios.put(
            `${API}/salons/${salonId}/services/${saved.id}/toggle?is_enabled=true`,
            null,
            { headers: getAuthHeaders() }
          );
        } catch (_) { /* non-fatal */ }
      }
      onSaved(saved, !isEdit);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="z-overlay" onClick={onClose} />
      <aside className="z-drawer">
        <div className="z-drawer-h">
          <div className="dico"><Icon name={form.category === 'Packages' ? 'gift' : 'scissors'} size={20} /></div>
          <div>
            <div className="eyebrow">{isEdit ? 'Edit' : 'New'}</div>
            <h3>{isEdit ? 'Edit Service' : 'Add Service'}</h3>
            <p>Configure name, price, duration and availability.</p>
          </div>
          <button className="z-drawer-close" onClick={onClose}><Icon name="x" /></button>
        </div>

        <div className="z-drawer-body">
          {/* Photo */}
          <div className="z-field">
            <label>Photo</label>
            {form.thumbnail_url ? (
              <div className="z-photo-preview">
                <div className="pv"><img src={form.thumbnail_url} alt="" /></div>
                <div style={{ flex: 1, fontSize: 12, color: 'var(--z-muted)' }}>
                  Photo attached
                </div>
                <button className="z-btn z-btn--ghost z-btn--sm" onClick={() => upd('thumbnail_url', '')}>Remove</button>
                <button className="z-btn z-btn--soft z-btn--sm" onClick={onPickImage}>Change</button>
              </div>
            ) : (
              <div className="z-photo-up" onClick={onPickImage}>
                <Icon name="camera" size={24} /><div style={{ fontWeight: 700, marginTop: 4 }}>Upload a photo</div>
                <div style={{ fontSize: 11.5, color: 'var(--z-muted-2)', marginTop: 2 }}>PNG or JPG, up to 3&nbsp;MB</div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileSelected} />
          </div>

          <div className="z-field">
            <label>Service name</label>
            <input value={form.service_name} onChange={(e) => upd('service_name', e.target.value)} placeholder="e.g., Men's Haircut" />
          </div>

          <div className="z-field">
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => upd('description', e.target.value)} placeholder="Short description..." />
          </div>

          <div className="z-grid2">
            <div className="z-field">
              <label>Category</label>
              <select value={form.category} onChange={(e) => upd('category', e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="z-field">
              <label>Sub-category</label>
              <select value={form.sub_category || ''} onChange={(e) => { if (e.target.value === '__new__') handleAddSub(); else upd('sub_category', e.target.value); }}>
                <option value="">— none —</option>
                {(subs || []).map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="__new__">+ New sub-category…</option>
              </select>
            </div>
          </div>

          <div className="z-grid2">
            <div className="z-field">
              <label>Gender</label>
              <select value={form.gender_tag} onChange={(e) => upd('gender_tag', e.target.value)}>
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="z-field">
              <label>Duration (mins)</label>
              <input type="number" min="0" value={form.default_duration} onChange={(e) => upd('default_duration', e.target.value)} />
            </div>
          </div>

          <div className="z-grid2">
            <div className="z-field">
              <label>Base price (₹)</label>
              <input type="number" min="0" value={form.base_price} onChange={(e) => upd('base_price', e.target.value)} />
            </div>
            <div className="z-field">
              <label>Price type</label>
              <select value={form.price_type} onChange={(e) => upd('price_type', e.target.value)}>
                <option value="fixed">Fixed</option>
                <option value="onwards">Onwards</option>
              </select>
            </div>
          </div>

          <div className="z-field">
            <div className="z-togrow" onClick={() => upd('is_favorite', !form.is_favorite)}>
              <button className={`z-toggle ${form.is_favorite ? 'on' : ''}`} />
              <span>Mark as favourite</span>
            </div>
            <div className="z-togrow" onClick={() => upd('available_at_home', !form.available_at_home)}>
              <button className={`z-toggle ${form.available_at_home ? 'on' : ''}`} />
              <span>Available at home</span>
            </div>
          </div>

          {form.available_at_home && (
            <div className="z-field">
              <label>Home price (₹)</label>
              <input type="number" min="0" value={form.home_price} onChange={(e) => upd('home_price', e.target.value)} />
            </div>
          )}
        </div>

        <div className="z-drawer-foot" style={{ display: 'flex', gap: 10 }}>
          <button className="z-btn z-btn--ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="z-btn z-btn--pri" style={{ flex: 2 }} onClick={save} disabled={saving}>
            <Icon name="save" /> {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create service')}
          </button>
        </div>
      </aside>
    </>
  );
}
