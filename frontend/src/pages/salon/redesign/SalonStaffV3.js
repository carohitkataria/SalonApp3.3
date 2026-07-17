/**
 * SalonStaffV3.js — Redesigned Staff Management page (pink theme).
 *
 * Layout: two-pane workspace. Left = staff list with accordion sub-nav
 * (Profile / Attendance / Services / Documents / Access). Right = detail pane.
 *
 * RBAC: gated on `staff.view` (whole page). Individual sub-tabs & actions
 * respect finer permissions (attendance, salary_pay, edit, delete, documents,
 * access_control, view_all). Users without `staff.view_all` see only their
 * own linked staff record.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { STAFF_V3_CSS } from './StaffV3Styles';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AV_COLORS = ['#C6389E', '#12A594', '#3E93E8', '#E8952B', '#8A5CD1', '#2FA96A'];
const colorFor = (s = '') => AV_COLORS[(s.charCodeAt(0) || 0) % AV_COLORS.length];
const initial = (s = '') => (s || 'S').trim().charAt(0).toUpperCase();
const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const SECTIONS = [
  { key: 'profile', label: 'Profile', ico: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
  { key: 'attendance', label: 'Attendance', ico: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></> },
  { key: 'services', label: 'Services & pricing', ico: <><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/></> },
  { key: 'documents', label: 'Documents', ico: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></> },
  { key: 'access', label: 'Access', ico: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> },
];

export default function SalonStaffV3({ salonId, getAuthHeaders }) {
  const { hasModulePermission, salonUser } = useAuth();
  const isAdmin = salonUser?.role === 'admin' || salonUser?.role === 'branch_manager';
  const canViewAll = isAdmin || hasModulePermission?.('staff', 'view_all');
  const canCreate = isAdmin || hasModulePermission?.('staff', 'create');
  const canEdit = isAdmin || hasModulePermission?.('staff', 'edit');
  const canDelete = isAdmin || hasModulePermission?.('staff', 'delete');
  const canAttendance = isAdmin || hasModulePermission?.('staff', 'attendance');
  const canSalaryView = isAdmin || hasModulePermission?.('staff', 'salary_view');
  const canSalaryPay = isAdmin || hasModulePermission?.('staff', 'salary_pay');
  const canDocuments = isAdmin || hasModulePermission?.('staff', 'documents');
  const canAccess = isAdmin || hasModulePermission?.('staff', 'access_control');
  const ownStaffId = salonUser?.staffId || null;

  const [staff, setStaff] = useState([]);
  const [salonSettings, setSalonSettings] = useState({});
  const [salon, setSalon] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [section, setSection] = useState('profile');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', mobile: '', experience: 0, category: 'Junior', department: '', designation: '' });
  const [attendanceSummary, setAttendanceSummary] = useState({});
  const [services, setServices] = useState([]);
  const [barberServices, setBarberServices] = useState({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({});
  // Monthly attendance grid: { [barberId]: { month: 'YYYY-MM', days: { 'YYYY-MM-DD': {status,...} } } }
  const [attendanceGrid, setAttendanceGrid] = useState({});
  const [attMonth, setAttMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [attSaving, setAttSaving] = useState({});
  // Documents
  const [docs, setDocs] = useState({});
  const [docBusy, setDocBusy] = useState(false);
  const [preview, setPreview] = useState(null); // {doc, fileData}
  // Hidden file input ref for uploading
  const fileInputRef = React.useRef(null);
  const [pendingDocType, setPendingDocType] = useState(null);

  // Scoped CSS injection
  useEffect(() => {
    const id = 'staff-v3-styles';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = STAFF_V3_CSS;
    document.head.appendChild(el);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    try {
      const [barbersRes, salonRes, servicesRes] = await Promise.all([
        axios.get(`${API}/salons/${salonId}/barbers`, { headers: getAuthHeaders?.() || {} }),
        axios.get(`${API}/salons/${salonId}`).catch(() => ({ data: {} })),
        axios.get(`${API}/salons/${salonId}/services/enabled`).catch(() => ({ data: [] })),
      ]);
      let list = Array.isArray(barbersRes.data) ? barbersRes.data : [];
      // Enforce view scope on the client too (backend also enforces).
      if (!canViewAll && ownStaffId) list = list.filter((b) => b.id === ownStaffId);
      setStaff(list);
      setSelectedId((prev) => prev && list.find((s) => s.id === prev) ? prev : list[0]?.id || null);

      const salonData = salonRes.data?.salon || salonRes.data || {};
      setSalon(salonData);
      // Attendance settings snapshot (from salon record)
      setSalonSettings({
        attendance_method: salonData.attendance_mode || salonData.attendance_method || 'service_completion',
        shift_start: salonData.shift_start || '10:00',
        shift_end: salonData.shift_end || '20:00',
        grace_period_min: salonData.grace_period_min || 15,
        half_day_max_hours: salonData.half_day_max_hours || 4,
        min_hours_full_day: salonData.min_hours_full_day || 8,
        auto_checkout: salonData.auto_checkout ?? true,
        auto_checkout_time: salonData.auto_checkout_time || '21:00',
        allow_self_checkin: salonData.allow_self_checkin ?? true,
        geofence_required: salonData.geofence_required ?? false,
        overtime_after_hours: salonData.overtime_after_hours || 9,
        weekly_off: salonData.weekly_off || 'Sunday',
      });

      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
    } catch (err) {
      console.warn('SalonStaffV3 fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, [salonId, getAuthHeaders, canViewAll, ownStaffId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Fetch per-barber services list when a staff is selected
  useEffect(() => {
    (async () => {
      if (!selectedId) return;
      try {
        const res = await axios.get(`${API}/barbers/${selectedId}/services`).catch(() => ({ data: [] }));
        const map = {};
        (res.data || []).forEach((s) => { map[s.service_id || s.id] = { on: !!s.is_available, price: s.price ?? s.base_price }; });
        setBarberServices((prev) => ({ ...prev, [selectedId]: map }));
      } catch (_) {}
    })();
  }, [selectedId]);

  // Fetch monthly attendance summary + full grid for selected staff / month
  useEffect(() => {
    (async () => {
      if (!selectedId || !salonId) return;
      try {
        const res = await axios.get(
          `${API}/salons/${salonId}/staff-attendance/month/${attMonth}?barber_id=${selectedId}`,
          { headers: getAuthHeaders?.() || {} },
        );
        const b = (res.data?.barbers || []).find((x) => x.barber_id === selectedId);
        const arr = b?.attendance || [];
        const s = { P: 0, A: 0, H: 0, HO: 0, L: 0 };
        const days = {};
        arr.forEach((r) => {
          const st = String(r.status || '').toLowerCase();
          days[r.date] = { status: st, note: r.override_note, marked_by: r.marked_by_name };
          if (st === 'present') s.P += 1;
          else if (st === 'absent') s.A += 1;
          else if (st === 'half_day' || st === 'half-day') s.H += 1;
          else if (st === 'holiday') s.HO += 1;
          else if (st === 'leave' || st === 'on_leave') s.L += 1;
        });
        setAttendanceSummary((prev) => ({ ...prev, [selectedId]: s }));
        setAttendanceGrid((prev) => ({ ...prev, [selectedId]: { month: attMonth, days } }));
      } catch (_) { /* noop */ }
    })();
  }, [selectedId, salonId, attMonth, getAuthHeaders]);

  // Cycle attendance status on click: blank → present → half_day → absent → holiday → on_leave → blank
  const CYCLE = ['present', 'half_day', 'absent', 'holiday', 'on_leave'];
  const cycleAttendance = async (date) => {
    if (!canAttendance || !selected) return;
    // Guard: don't allow future dates
    const today = new Date().toISOString().slice(0, 10);
    if (date > today) return toast.error("Can't mark attendance for future dates");
    const key = `${selectedId}::${date}`;
    if (attSaving[key]) return;
    setAttSaving((prev) => ({ ...prev, [key]: true }));
    const grid = attendanceGrid[selectedId]?.days || {};
    const cur = (grid[date]?.status || '').toLowerCase();
    const idx = CYCLE.indexOf(cur);
    const next = idx === -1 ? CYCLE[0] : (idx === CYCLE.length - 1 ? null : CYCLE[idx + 1]);
    // Optimistic
    setAttendanceGrid((prev) => {
      const p = prev[selectedId] || { month: attMonth, days: {} };
      const days = { ...(p.days || {}) };
      if (next) days[date] = { ...(days[date] || {}), status: next };
      else delete days[date];
      return { ...prev, [selectedId]: { ...p, days } };
    });
    try {
      if (next) {
        await axios.put(
          `${API}/salons/${salonId}/staff-attendance/override/${selectedId}/${date}`,
          { status: next },
          { headers: getAuthHeaders?.() || {} },
        );
      } else {
        await axios.delete(
          `${API}/salons/${salonId}/staff-attendance/override/${selectedId}/${date}`,
          { headers: getAuthHeaders?.() || {} },
        );
      }
      // Refresh summary counts
      const days = attendanceGrid[selectedId]?.days || {};
      const merged = { ...days };
      if (next) merged[date] = { status: next }; else delete merged[date];
      const s = { P: 0, A: 0, H: 0, HO: 0, L: 0 };
      Object.values(merged).forEach((r) => {
        const st = (r.status || '').toLowerCase();
        if (st === 'present') s.P += 1;
        else if (st === 'absent') s.A += 1;
        else if (st === 'half_day') s.H += 1;
        else if (st === 'holiday') s.HO += 1;
        else if (st === 'leave' || st === 'on_leave') s.L += 1;
      });
      setAttendanceSummary((prev) => ({ ...prev, [selectedId]: s }));
    } catch (err) {
      // Revert on failure
      setAttendanceGrid((prev) => ({ ...prev, [selectedId]: { month: attMonth, days: grid } }));
      const msg = err?.response?.data?.detail || 'Could not update attendance';
      toast.error(String(msg));
    } finally {
      setAttSaving((prev) => { const p = { ...prev }; delete p[key]; return p; });
    }
  };

  // Documents: fetch list when staff selected
  useEffect(() => {
    (async () => {
      if (!selectedId || !canDocuments) return;
      try {
        const res = await axios.get(`${API}/barbers/${selectedId}/documents`, {
          headers: getAuthHeaders?.() || {},
        });
        setDocs((prev) => ({ ...prev, [selectedId]: res.data?.documents || [] }));
      } catch (_) { /* noop */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, canDocuments]);

  const uploadDoc = (docType) => {
    if (!canDocuments) return toast.error("You don't have permission");
    setPendingDocType(docType);
    // Trigger the hidden file input
    setTimeout(() => fileInputRef.current?.click(), 30);
  };

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so same file can be re-selected
    if (!file || !pendingDocType || !selectedId) return;
    if (file.size > 10 * 1024 * 1024) return toast.error('File too large (max 10 MB)');
    setDocBusy(true);
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error('read failed'));
        r.readAsDataURL(file);
      });
      const label = pendingDocType === 'aadhar_front' ? 'Aadhaar card'
        : pendingDocType === 'agreement' ? 'Employment agreement'
        : pendingDocType === 'bank_details' ? 'Bank / UPI details'
        : (pendingDocType.charAt(0).toUpperCase() + pendingDocType.slice(1).replace(/_/g, ' '));
      await axios.post(
        `${API}/barbers/${selectedId}/documents`,
        { doc_type: pendingDocType, label, file_data: dataUrl, mime_type: file.type, file_name: file.name },
        { headers: getAuthHeaders?.() || {} },
      );
      // Re-fetch list
      const res = await axios.get(`${API}/barbers/${selectedId}/documents`, {
        headers: getAuthHeaders?.() || {},
      });
      setDocs((prev) => ({ ...prev, [selectedId]: res.data?.documents || [] }));
      toast.success(label + ' uploaded');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Upload failed');
    } finally {
      setDocBusy(false);
      setPendingDocType(null);
    }
  };

  const deleteDoc = async (docId) => {
    if (!canDocuments) return;
    if (!window.confirm('Delete this document?')) return;
    try {
      await axios.delete(`${API}/barbers/${selectedId}/documents/${docId}`, {
        headers: getAuthHeaders?.() || {},
      });
      setDocs((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] || []).filter((d) => d.id !== docId),
      }));
      toast.success('Document removed');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Delete failed');
    }
  };

  const previewDoc = async (docId) => {
    try {
      const res = await axios.get(`${API}/barbers/${selectedId}/documents/${docId}`, {
        headers: getAuthHeaders?.() || {},
      });
      setPreview(res.data);
    } catch (err) {
      toast.error('Could not load document');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => (s.name || '').toLowerCase().includes(q));
  }, [staff, search]);

  const selected = staff.find((s) => s.id === selectedId);

  // ----- RBAC lock -----
  const canViewStaff = isAdmin || hasModulePermission?.('staff', 'view');
  if (!canViewStaff) {
    return (
      <div className="staffv3">
        <div className="workspace"><div className="pane-r"><div className="rbac-lock">
          <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          You don't have permission to view Staff Management.
        </div></div></div>
      </div>
    );
  }

  // ---------- Actions ----------
  const handleAddStaff = async () => {
    const name = newStaff.name.trim();
    const phone = (newStaff.mobile || '').replace(/\D/g, '');
    if (!name) return toast.error('Enter full name');
    if (phone.length < 10) return toast.error('Mobile number is required (login ID)');
    try {
      await axios.post(`${API}/salons/${salonId}/barbers`, {
        name,
        phone: `+91${phone.slice(-10)}`,
        experience: Number(newStaff.experience) || 0,
        category: newStaff.category,
        department: newStaff.department,
        designation: newStaff.designation,
        is_barber: true,
        is_active: true,
      }, { headers: getAuthHeaders?.() || {} });
      toast.success('Staff added · login ID ' + phone);
      setAddOpen(false);
      setNewStaff({ name: '', mobile: '', experience: 0, category: 'Junior', department: '', designation: '' });
      fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not add staff');
    }
  };

  const handleDeleteStaff = async () => {
    if (!selected || !canDelete) return;
    if (!window.confirm(`Delete ${selected.name}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/barbers/${selected.id}`, { headers: getAuthHeaders?.() || {} });
      toast.success('Staff removed');
      fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not delete staff');
    }
  };

  const startEditProfile = () => {
    if (!canEdit) return toast.error("You don't have permission to edit staff");
    setProfileDraft({
      name: selected?.name || '',
      experience: selected?.experience ?? 0,
      category: selected?.category || '',
      department: selected?.department || '',
      designation: selected?.designation || '',
      emergency_contact: selected?.emergency_contact || '',
      aadhar_number: selected?.aadhar_number || '',
      compensation: selected?.compensation ?? 0,
      visible_to_customers: selected?.visible_to_customers ?? true,
    });
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    if (!selected) return;
    try {
      await axios.put(`${API}/barbers/${selected.id}`, profileDraft, { headers: getAuthHeaders?.() || {} });
      toast.success('Profile saved');
      setEditingProfile(false);
      fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not save profile');
    }
  };

  const toggleService = async (svcId) => {
    if (!canEdit) return toast.error("You don't have permission");
    const map = { ...(barberServices[selectedId] || {}) };
    const cur = map[svcId] || { on: false, price: null };
    map[svcId] = { ...cur, on: !cur.on };
    setBarberServices((prev) => ({ ...prev, [selectedId]: map }));
    try {
      await axios.put(`${API}/barbers/${selectedId}/services/${svcId}/toggle?is_available=${!cur.on}`,
        {}, { headers: getAuthHeaders?.() || {} });
    } catch (err) {
      toast.error('Failed to update');
      map[svcId] = cur;
      setBarberServices((prev) => ({ ...prev, [selectedId]: map }));
    }
  };

  // ---------- Renderers ----------
  const renderStaffList = () => (
    <div className="pane-l">
      <div className="list-head">
        <div className="lt">
          <b><span className="dotg" />Active Staff</b>
          <span className="ct">{staff.length}</span>
        </div>
        <div className="searchbox" style={{ width: '100%' }}>
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Search staff…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="staff-list">
        {loading && <div style={{ padding: 20, fontSize: 12, color: '#8A7F90' }}>Loading…</div>}
        {!loading && filtered.length === 0 && <div style={{ padding: 20, fontSize: 12, color: '#8A7F90' }}>No staff yet</div>}
        {filtered.map((s) => {
          const on = s.id === selectedId;
          return (
            <div key={s.id} className={`sgroup ${on ? 'on' : ''}`}>
              <div className="sc" onClick={() => { setSelectedId(s.id); setSection('profile'); }}>
                <div className="av" style={{ background: colorFor(s.name) }}>{initial(s.name)}</div>
                <div className="si">
                  <b>{s.name}</b>
                  <span>{(s.category || 'Junior')} · {s.experience || 0} yr{s.experience === 1 ? '' : 's'}</span>
                </div>
                <svg className="chev" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
              {on && (
                <div className="subnav">
                  {SECTIONS.map((sec) => (
                    <button key={sec.key} type="button"
                      className={`subitem ${section === sec.key ? 'on' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setSection(sec.key); }}>
                      <svg viewBox="0 0 24 24">{sec.ico}</svg>{sec.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderProfileBody = () => {
    const s = selected;
    const att = attendanceSummary[s.id] || { P: 0, A: 0, H: 0, HO: 0, L: 0 };
    const rev = Number(s.month_revenue || 0);
    const inc = Number(s.month_incentives || 0);
    const cust = Number(s.customers_served || 0);
    const rating = Number(s.average_rating || 0);
    const base = Number(s.compensation || 0);
    return (
      <>
        <div className="metrics">
          <div className="metric"><div className="mi" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
            <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div><b>{rupee(rev)}</b><span>Revenue · MTD</span></div>
          <div className="metric"><div className="mi" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div><b>{rupee(inc)}</b><span>Incentives</span></div>
          <div className="metric"><div className="mi" style={{ background: 'var(--sky-bg)', color: 'var(--sky)' }}>
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div><b>{cust}</b><span>Customers served</span></div>
          <div className="metric"><div className="mi" style={{ background: 'var(--primary-050)', color: 'var(--primary)' }}>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div><b>{rating || '—'}</b><span>Avg rating</span></div>
        </div>
        {canSalaryView && (
          <div className="payline">
            <div className="pl"><b>{rupee(base + inc)}</b><span>Base {rupee(base)} + incentives {rupee(inc)}</span></div>
            {canSalaryPay && (
              <button className="btn-primary" onClick={() => toast.info('Salary drawer coming soon — please use Staff Rewards for now')}>
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Mark salary paid
              </button>
            )}
          </div>
        )}
        <div className="secttl">
          Personal information
          {canEdit && !editingProfile && (
            <button className="btn-ghost" style={{ padding: '7px 12px' }} onClick={startEditProfile}>
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>Edit
            </button>
          )}
          {editingProfile && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" style={{ padding: '7px 12px' }} onClick={() => setEditingProfile(false)}>Cancel</button>
              <button className="btn-primary" style={{ padding: '7px 12px' }} onClick={saveProfile}>Save</button>
            </div>
          )}
        </div>
        <div className="grid2">
          <div className="field"><label>Full name <span className="req">*</span></label>
            <input value={editingProfile ? profileDraft.name : (s.name || '')} disabled={!editingProfile}
              onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })} /></div>
          <div className="field"><label>Mobile number <span className="req">*</span> (login ID)</label>
            <input value={s.phone || s.mobile || '—'} disabled />
            <span className="idnote"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>Mobile number is the login ID · mandatory &amp; unique</span></div>
          <div className="field"><label>Experience (years)</label>
            <input type="number" value={editingProfile ? profileDraft.experience : (s.experience ?? 0)} disabled={!editingProfile}
              onChange={(e) => setProfileDraft({ ...profileDraft, experience: e.target.value })} /></div>
          <div className="field"><label>Category</label>
            <select value={editingProfile ? profileDraft.category : (s.category || 'Junior')} disabled={!editingProfile}
              onChange={(e) => setProfileDraft({ ...profileDraft, category: e.target.value })}>
              <option>Junior</option><option>Star</option><option>Master</option>
            </select></div>
          <div className="field"><label>Department</label>
            <input value={editingProfile ? profileDraft.department : (s.department || '')} disabled={!editingProfile}
              placeholder="e.g. Hairstyling"
              onChange={(e) => setProfileDraft({ ...profileDraft, department: e.target.value })} /></div>
          <div className="field"><label>Designation</label>
            <input value={editingProfile ? profileDraft.designation : (s.designation || '')} disabled={!editingProfile}
              placeholder="e.g. Senior Stylist"
              onChange={(e) => setProfileDraft({ ...profileDraft, designation: e.target.value })} /></div>
          <div className="field"><label>Emergency contact</label>
            <input value={editingProfile ? profileDraft.emergency_contact : (s.emergency_contact || '')} disabled={!editingProfile}
              placeholder="+91…"
              onChange={(e) => setProfileDraft({ ...profileDraft, emergency_contact: e.target.value })} /></div>
          <div className="field"><label>Aadhaar number</label>
            <input value={editingProfile ? profileDraft.aadhar_number : (s.aadhar_number || '')} disabled={!editingProfile}
              placeholder="XXXX XXXX XXXX"
              onChange={(e) => setProfileDraft({ ...profileDraft, aadhar_number: e.target.value })} /></div>
          {canSalaryView && (
            <div className="field"><label>Base salary (₹)</label>
              <input type="number" value={editingProfile ? profileDraft.compensation : (s.compensation ?? 0)} disabled={!editingProfile}
                onChange={(e) => setProfileDraft({ ...profileDraft, compensation: e.target.value })} /></div>
          )}
          <div className="field"><label>Visible to customers</label>
            <select value={editingProfile ? (profileDraft.visible_to_customers ? 'Yes' : 'No') : ((s.visible_to_customers ?? true) ? 'Yes' : 'No')} disabled={!editingProfile}
              onChange={(e) => setProfileDraft({ ...profileDraft, visible_to_customers: e.target.value === 'Yes' })}>
              <option>Yes</option><option>No</option>
            </select></div>
        </div>
      </>
    );
  };

  const renderAttendanceBody = () => {
    if (!canAttendance) {
      return <div className="rbac-lock"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>You don't have permission to view attendance.</div>;
    }
    const s = selected;
    const M = salonSettings;
    const isCI = M.attendance_method === 'checkinout' || M.attendance_method === 'geo_checkin';
    const att = attendanceSummary[s.id] || { P: 0, A: 0, H: 0, HO: 0, L: 0 };
    // Build calendar grid for attMonth
    const [yy, mm] = attMonth.split('-').map((x) => parseInt(x, 10));
    const first = new Date(Date.UTC(yy, mm - 1, 1));
    const daysInMonth = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    // Sunday=0 shifted so Mon=0 (India)
    const dowIdx = (first.getUTCDay() + 6) % 7; // 0..6, Mon start
    const gridDays = attendanceGrid[s.id]?.days || {};
    const today = new Date().toISOString().slice(0, 10);
    const cells = [];
    for (let i = 0; i < dowIdx; i += 1) cells.push({ empty: true });
    for (let d = 1; d <= daysInMonth; d += 1) {
      const dd = String(d).padStart(2, '0');
      const dateStr = `${attMonth}-${dd}`;
      const rec = gridDays[dateStr];
      cells.push({ date: dateStr, d, status: rec?.status || null, isToday: dateStr === today, isFuture: dateStr > today });
    }
    while (cells.length % 7 !== 0) cells.push({ empty: true });

    const monthLabel = first.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const nowMonth = new Date().toISOString().slice(0, 7);
    const canGoNext = attMonth < nowMonth;
    const goPrev = () => {
      const py = mm === 1 ? yy - 1 : yy;
      const pm = mm === 1 ? 12 : mm - 1;
      setAttMonth(`${py}-${String(pm).padStart(2, '0')}`);
    };
    const goNext = () => {
      if (!canGoNext) return;
      const ny = mm === 12 ? yy + 1 : yy;
      const nm = mm === 12 ? 1 : mm + 1;
      setAttMonth(`${ny}-${String(nm).padStart(2, '0')}`);
    };

    const shortTag = (st) => {
      if (st === 'present') return 'P';
      if (st === 'half_day') return 'H';
      if (st === 'absent') return 'A';
      if (st === 'holiday') return 'HO';
      if (st === 'leave' || st === 'on_leave') return 'L';
      return '';
    };

    return (
      <>
        <div className="method-note">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          Rules come from <b style={{ margin: '0 4px' }}>Settings → Staff &amp; Attendance</b>. Current method: <b style={{ marginLeft: 4 }}>{isCI ? 'Check-in / Check-out' : 'Service completion'}</b>
        </div>
        {isCI && (
          <>
            <div className="secttl">Check-in / check-out rules</div>
            <div className="shift-grid">
              <div className="shift-c"><span className="k">Shift</span><span className="v">{M.shift_start} – {M.shift_end}</span></div>
              <div className="shift-c"><span className="k">Grace period</span><span className="v">{M.grace_period_min} min</span></div>
              <div className="shift-c"><span className="k">Half-day under</span><span className="v">{M.half_day_max_hours} hrs</span></div>
              <div className="shift-c"><span className="k">Full day min</span><span className="v">{M.min_hours_full_day} hrs</span></div>
              <div className="shift-c"><span className="k">Auto check-out</span><span className="v">{M.auto_checkout ? M.auto_checkout_time : 'Off'}</span></div>
              <div className="shift-c"><span className="k">Overtime after</span><span className="v">{M.overtime_after_hours} hrs</span></div>
              <div className="shift-c"><span className="k">Self check-in</span><span className="v">{M.allow_self_checkin ? 'Allowed' : 'Admin only'}</span></div>
              <div className="shift-c"><span className="k">Geo-fence</span><span className="v">{M.geofence_required ? 'Required' : 'Off'}</span></div>
              <div className="shift-c"><span className="k">Weekly off</span><span className="v">{M.weekly_off}</span></div>
            </div>
          </>
        )}

        <div className="att-cal-head">
          <div className="mm">
            <button type="button" onClick={goPrev} aria-label="Previous month" data-testid="att-prev-month">
              <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <b>{monthLabel}</b>
            <button type="button" onClick={goNext} disabled={!canGoNext} aria-label="Next month" data-testid="att-next-month">
              <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div className="att-legend">
            <span className="lg"><span className="sw" style={{ background: 'var(--green)' }} />Present</span>
            <span className="lg"><span className="sw" style={{ background: 'var(--amber)' }} />Half-day</span>
            <span className="lg"><span className="sw" style={{ background: 'var(--red)' }} />Absent</span>
            <span className="lg"><span className="sw" style={{ background: 'var(--sky)' }} />Holiday</span>
            <span className="lg"><span className="sw" style={{ background: 'var(--violet)' }} />Leave</span>
          </div>
        </div>

        <div className="cal-grid">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="cal-dow">{d}</div>
          ))}
          {cells.map((c, i) => {
            if (c.empty) return <div key={`e${i}`} />;
            const disabled = c.isFuture;
            const cls = [
              'cal-cell',
              c.status ? `st-${c.status}` : '',
              c.isToday ? 'today' : '',
              disabled ? 'disabled' : '',
            ].filter(Boolean).join(' ');
            return (
              <div
                key={c.date}
                className={cls}
                onClick={() => !disabled && cycleAttendance(c.date)}
                title={disabled ? 'Future date' : 'Click to cycle: Present → Half-day → Absent → Holiday → Leave → Clear'}
                data-testid={`att-cell-${c.date}`}
              >
                <span className="dnum">{c.d}</span>
                {c.status && <span className="stag">{shortTag(c.status)}</span>}
              </div>
            );
          })}
        </div>

        <p className="cal-hint">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          Click any date to cycle attendance. Salary-locked months are read-only.
        </p>

        <div className="secttl" style={{ marginTop: 18 }}>This month</div>
        <div className="att-summary">
          <div className="att-s"><b style={{ color: 'var(--green)' }}>{att.P}</b><span>Present</span></div>
          <div className="att-s"><b style={{ color: 'var(--red)' }}>{att.A}</b><span>Absent</span></div>
          <div className="att-s"><b style={{ color: 'var(--amber)' }}>{att.H}</b><span>Half-day</span></div>
          <div className="att-s"><b style={{ color: 'var(--sky)' }}>{att.HO}</b><span>Holiday</span></div>
          <div className="att-s"><b style={{ color: 'var(--violet)' }}>{att.L}</b><span>Leave</span></div>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, color: 'var(--green)', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
            <path d="M23 4v6h-6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/>
          </svg>
          Home-page admin check-in/out writes this same record — always in sync.
        </p>
      </>
    );
  };

  const renderServicesBody = () => {
    if (!canEdit && !isAdmin) {
      return <div className="rbac-lock"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>You don't have permission to manage services.</div>;
    }
    const map = barberServices[selectedId] || {};
    return (
      <>
        <div className="secttl">
          Services by {selected.name}
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'none', letterSpacing: 0 }}>
            Only ticked services are bookable with this barber
          </span>
        </div>
        <table className="svc-tbl">
          <thead><tr>
            <th style={{ width: 34 }}></th><th>Service</th><th>Salon price</th><th>{selected.name}'s price</th><th></th>
          </tr></thead>
          <tbody>
            {services.map((c) => {
              const st = map[c.id] || { on: false, price: null };
              const base = Number(c.base_price || c.price || 0);
              const ovr = st.on && st.price !== null && st.price !== base;
              return (
                <tr key={c.id} className={st.on ? '' : 'off'}>
                  <td><div className={`cbx ${st.on ? 'on' : ''}`} onClick={() => toggleService(c.id)}>
                    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  </div></td>
                  <td className="svc-n"><b>{c.service_name || c.name}</b><span>{c.default_duration || c.duration || 30} min</span></td>
                  <td><span className="base-p">{rupee(base)}</span></td>
                  <td>
                    <input className="price-in" defaultValue={st.on ? (st.price ?? base) : ''}
                      placeholder={String(base)} disabled={!st.on} />
                  </td>
                  <td style={{ textAlign: 'right' }}>{ovr && <span className="ovr">Custom</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </>
    );
  };

  const renderDocumentsBody = () => {
    if (!canDocuments) {
      return <div className="rbac-lock"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>You don't have permission to view documents.</div>;
    }
    const list = docs[selectedId] || [];
    const byType = list.reduce((acc, d) => { (acc[d.doc_type] = acc[d.doc_type] || []).push(d); return acc; }, {});
    const SLOTS = [
      { type: 'aadhar_front', label: 'Aadhaar card', hint: 'Front side of Aadhaar', ico: <><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></> },
      { type: 'agreement', label: 'Employment agreement', hint: 'Signed offer / contract', ico: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></> },
      { type: 'bank_details', label: 'Bank / UPI details', hint: 'For salary transfer', ico: <><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></> },
    ];
    const otherDocs = list.filter((d) => !SLOTS.find((s) => s.type === d.doc_type));

    const renderRow = (slot) => {
      const uploaded = (byType[slot.type] || [])[0];
      const status = uploaded ? 'done' : 'empty';
      return (
        <div className="doc-row" key={slot.type}>
          <div className={`di ${status}`}>
            <svg viewBox="0 0 24 24">{slot.ico}</svg>
          </div>
          <div className="dd">
            <b>{slot.label}</b>
            <span>
              {uploaded
                ? `${uploaded.file_name || 'Uploaded'} · ${uploaded.size_kb || 0} KB`
                : slot.hint}
            </span>
          </div>
          <div className="actions">
            {uploaded && (
              <>
                <button title="Preview" onClick={() => previewDoc(uploaded.id)} data-testid={`doc-preview-${slot.type}`}>
                  <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button title="Replace" onClick={() => uploadDoc(slot.type)} data-testid={`doc-replace-${slot.type}`}>
                  <svg viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></svg>
                </button>
                <button title="Delete" className="danger" onClick={() => deleteDoc(uploaded.id)} data-testid={`doc-delete-${slot.type}`}>
                  <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </>
            )}
            {!uploaded && (
              <button title="Upload" onClick={() => uploadDoc(slot.type)} data-testid={`doc-upload-${slot.type}`}>
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
      <>
        <div className="secttl">
          Documents
          <button className="btn-ghost" style={{ padding: '7px 12px' }} onClick={() => uploadDoc('other')} disabled={docBusy} data-testid="doc-upload-other">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {docBusy ? 'Uploading…' : 'Upload other'}
          </button>
        </div>
        {SLOTS.map(renderRow)}
        {otherDocs.length > 0 && (
          <>
            <div className="secttl" style={{ marginTop: 18 }}>Other documents</div>
            {otherDocs.map((d) => (
              <div className="doc-row" key={d.id}>
                <div className="di done">
                  <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                </div>
                <div className="dd">
                  <b>{d.label || d.file_name || 'Document'}</b>
                  <span>{d.file_name || ''} · {d.size_kb || 0} KB</span>
                </div>
                <div className="actions">
                  <button title="Preview" onClick={() => previewDoc(d.id)}>
                    <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button title="Delete" className="danger" onClick={() => deleteDoc(d.id)}>
                    <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Hidden file input used by every upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          style={{ display: 'none' }}
          onChange={onFileSelected}
          data-testid="doc-file-input"
        />

        {/* Preview modal */}
        {preview && (
          <div className="doc-preview-ov" onClick={() => setPreview(null)}>
            <div className="doc-preview" onClick={(e) => e.stopPropagation()}>
              <div className="ph">
                <b>{preview.label || preview.file_name || 'Document'}</b>
                <button className="close" onClick={() => setPreview(null)} aria-label="Close">
                  <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="pb">
                {preview.file_data && preview.mime_type?.startsWith('image/') && (
                  <img src={preview.file_data} alt={preview.label || preview.file_name || ''} />
                )}
                {preview.file_data && preview.mime_type === 'application/pdf' && (
                  <iframe src={preview.file_data} title={preview.label || 'PDF'} />
                )}
                {(!preview.file_data ||
                  (!preview.mime_type?.startsWith('image/') && preview.mime_type !== 'application/pdf')) && (
                  <div className="empty">Preview not available for this file type</div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderAccessBody = () => {
    if (!canAccess) {
      return <div className="rbac-lock"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>You don't have permission to manage access. Ask your admin to open Settings → Roles &amp; Access.</div>;
    }
    return (
      <>
        <div className="secttl">Login &amp; access</div>
        <div className="grid2" style={{ marginBottom: 16 }}>
          <div className="field"><label>Login ID (mobile) <span className="req">*</span></label>
            <input value={selected.phone || selected.mobile || '—'} disabled />
            <span className="idnote"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>Mobile number is the login ID — mandatory &amp; unique.</span>
          </div>
        </div>
        <div className="note-box" style={{ background: 'var(--sky-bg)', border: '1px solid #CFE4FA', borderRadius: 11, padding: '10px 13px', color: 'var(--ink-soft)', fontSize: 12 }}>
          <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, color: 'var(--sky)', marginRight: 8, verticalAlign: 'middle', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
          </svg>
          Detailed module-level permissions are managed under <b>Settings → Roles &amp; Access → Manage Staff Access</b>.
        </div>
      </>
    );
  };

  const renderDetailPane = () => {
    if (!selected) return <div className="pane-r"><div className="rbac-lock">Select a staff member from the left to view details.</div></div>;
    return (
      <div className="pane-r">
        <div className="dhead">
          <div className="av" style={{ background: colorFor(selected.name) }}>{initial(selected.name)}</div>
          <div className="dn">
            <h3>{selected.name}</h3>
            <div className="meta">
              <span style={{ textTransform: 'capitalize' }}>
                {selected.category || 'Junior'}{selected.designation ? ' · ' + selected.designation : ''}
              </span>
              <span>
                <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.74-1.27a2 2 0 0 1 2.11-.45c.74.34 1.53.57 2.34.7A2 2 0 0 1 22 16.92z"/></svg>
                {selected.phone || selected.mobile || '—'}
              </span>
              <span>
                <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {salon?.city || 'Main Branch'}
              </span>
            </div>
          </div>
          {canDelete && (
            <button className="btn-danger" onClick={handleDeleteStaff}>
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Delete
            </button>
          )}
        </div>
        <div className="pane-body">
          {section === 'profile' && renderProfileBody()}
          {section === 'attendance' && renderAttendanceBody()}
          {section === 'services' && renderServicesBody()}
          {section === 'documents' && renderDocumentsBody()}
          {section === 'access' && renderAccessBody()}
        </div>
      </div>
    );
  };

  return (
    <div className="staffv3">
      <div className="phead">
        <h2>
          <span className="hic">
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
          </span>
          Staff Management
        </h2>
        {canCreate && (
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Staff
          </button>
        )}
      </div>

      <div className="workspace">
        {renderStaffList()}
        {renderDetailPane()}
      </div>

      {/* Add Staff drawer */}
      <div className={`staffv3-ov ${addOpen ? 'open' : ''}`} onClick={() => setAddOpen(false)} />
      <aside className={`staffv3-drawer ${addOpen ? 'open' : ''}`}>
        <div className="dh">
          <div className="tt">
            <div className="ic"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg></div>
            <div><h3>Add Staff</h3><p>Mobile number is the login ID</p></div>
          </div>
          <button className="close" onClick={() => setAddOpen(false)}>
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="db">
          <div className="grid2">
            <div className="field full"><label>Full name <span className="req">*</span></label>
              <input value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} placeholder="e.g. Ravi Kumar" /></div>
            <div className="field full"><label>Mobile number <span className="req">*</span> (login ID)</label>
              <input value={newStaff.mobile} onChange={(e) => setNewStaff({ ...newStaff, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="10-digit mobile" inputMode="numeric" />
              <span className="idnote"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>This mobile number becomes the staff login ID.</span>
            </div>
            <div className="field"><label>Experience (yrs)</label>
              <input type="number" value={newStaff.experience} onChange={(e) => setNewStaff({ ...newStaff, experience: e.target.value })} /></div>
            <div className="field"><label>Category</label>
              <select value={newStaff.category} onChange={(e) => setNewStaff({ ...newStaff, category: e.target.value })}>
                <option>Junior</option><option>Star</option><option>Master</option>
              </select></div>
            <div className="field"><label>Department</label>
              <input value={newStaff.department} onChange={(e) => setNewStaff({ ...newStaff, department: e.target.value })} placeholder="e.g. Hairstyling" /></div>
            <div className="field"><label>Designation</label>
              <input value={newStaff.designation} onChange={(e) => setNewStaff({ ...newStaff, designation: e.target.value })} placeholder="e.g. Stylist" /></div>
          </div>
        </div>
        <div className="df">
          <button className="btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleAddStaff}>
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Add staff
          </button>
        </div>
      </aside>
    </div>
  );
}
