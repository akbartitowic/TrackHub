import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchAPI } from '../services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { MENU_NEW_PROJECT } from '../constants/menuLabels';
import CreateProjectModal from '../components/CreateProjectModal';

const TAB_KEYS = ['Business', 'Operation'];
const TAB_TO_PATH = {
  Business: 'business',
  Operation: 'operation',
};
const PATH_TO_TAB = {
  business: 'Business',
  operation: 'Operation',
};

const formatIdr = (val) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(val) || 0);

function StepPill({ label, done, active, locked }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        done && 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
        !done && active && 'border-primary/30 bg-primary/10 text-primary',
        !done && !active && locked && 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/50',
        !done && !active && !locked && 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900/40',
      )}
    >
      {done ? <CheckCircle2 className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current opacity-50" />}
      {label}
    </span>
  );
}

/** Multi-select user search. selected = array of user ids (numbers). */
function UserMultiSearch({ selected = [], options = [], onChange, disabled = false }) {
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const rootRef             = useRef(null);

  const trimmed = query.trim();
  const ready   = trimmed.length >= 2;

  const filtered = useMemo(() => {
    if (!ready) return [];
    const q = trimmed.toLowerCase();
    return options
      .filter(u => !selected.includes(u.id) && u.name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [options, selected, trimmed, ready]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const add = (userId) => {
    onChange([...selected, userId]);
    setQuery('');
    setOpen(false);
  };

  const remove = (userId) => {
    onChange(selected.filter(id => id !== userId));
  };

  const selectedUsers = options.filter(u => selected.includes(u.id));

  return (
    <div className="space-y-2">
      {/* Selected chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map(u => (
            <span key={u.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary border border-primary/20">
              {u.name}
              {!disabled && (
                <button type="button" onClick={() => remove(u.id)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors">
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      {!disabled && (
        <div ref={rootRef} className="relative">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              placeholder="Cari dan tambah user..."
              onChange={e => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              autoComplete="off"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          {open && trimmed.length > 0 && !ready && (
            <p className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              Ketik minimal 2 karakter untuk mencari
            </p>
          )}

          {open && ready && (
            <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-400">Tidak ada hasil</li>
              ) : filtered.map(u => (
                <li key={u.id}>
                  <button type="button" onClick={() => add(u.id)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{u.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{u.role?.name || u.role || ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selected.length === 0 && disabled && (
        <p className="text-sm text-slate-400 italic">Belum ada user yang di-assign.</p>
      )}
    </div>
  );
}

export default function Presales() {
  const navigate = useNavigate();
  const { view } = useParams();
  const [loading, setLoading] = useState(true);
  const [presales, setPresales] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [projectCategories, setProjectCategories] = useState([]);
  const [projectRoles, setProjectRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [winPitches, setWinPitches] = useState([]);

  const [selectedId, setSelectedId] = useState(null);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [businessSaving, setBusinessSaving] = useState(false);
  const [feedbackDialog, setFeedbackDialog] = useState({
    open: false,
    title: '',
    message: '',
  });

  const [newForm, setNewForm] = useState({
    sales_pitch_id: '',
    company_id: '',
    project_name: '',
    project_category_id: '',
    estimated_budget: '',
    project_description: '',
  });

  const [businessForm, setBusinessForm] = useState({
    deck_url: '',
    quotation_url: '',
    drive_url: '',
    methodology: 'Agile Scrum',
    total_manhours: '',
    role_ids: [],
    role_mh: {},
  });
  const [operationAssignments, setOperationAssignments] = useState({});
  const [editForm, setEditForm] = useState({
    id: null,
    company_id: '',
    project_name: '',
    project_category_id: '',
    estimated_budget: '',
    project_description: '',
  });

  const visiblePresales = useMemo(
    () => presales.filter((item) => !item.converted_project_id),
    [presales]
  );
  const filteredPresales = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return visiblePresales;
    return visiblePresales.filter((item) => {
      const company = item.company?.name || '';
      const category = item.project_category?.name || '';
      const name = item.project_name || item.name || '';
      return (
        name.toLowerCase().includes(q)
        || company.toLowerCase().includes(q)
        || category.toLowerCase().includes(q)
      );
    });
  }, [visiblePresales, listSearch]);
  const usedWinPitchIds = useMemo(
    () => new Set((presales || []).map((item) => item.sales_pitch_id).filter((id) => id != null)),
    [presales]
  );
  const selected = useMemo(
    () => visiblePresales.find((item) => item.id?.toString() === selectedId?.toString()) || null,
    [visiblePresales, selectedId]
  );

  const canOpenOperation = !!selected?.business_acknowledged_at;
  const isProceeded = !!selected?.converted_project_id;
  const canProceed =
    !!selected?.business_acknowledged_at &&
    !!selected?.operation_acknowledged_at &&
    !isProceeded;
  const activeTab = PATH_TO_TAB[(view || '').toLowerCase()] || 'Business';
  const showFeedback = (title, message) => {
    setFeedbackDialog({
      open: true,
      title,
      message,
    });
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [presaleRes, roleRes, userRes] = await Promise.all([
        fetchAPI('/presales').catch(() => ({ data: [] })),
        fetchAPI('/project-roles').catch(() => ({ data: [] })),
        fetchAPI('/users').catch(() => ({ data: [] })),
      ]);

      const items = presaleRes?.data || [];
      const activeItems = items.filter((item) => !item.converted_project_id);
      setPresales(items);
      setCompanies([]);
      setProjectCategories([]);
      setProjectRoles(roleRes?.data || []);
      setUsers(userRes?.data || []);
      setWinPitches([]);
      if (!selectedId && activeItems.length) setSelectedId(activeItems[0].id);
    } catch (error) {
      showFeedback('Gagal Memuat Data', 'Gagal memuat data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const normalized = (view || '').toLowerCase();
    if (!normalized || !PATH_TO_TAB[normalized]) {
      navigate('/presales/business', { replace: true });
    }
  }, [view, navigate]);

  useEffect(() => {
    if (!selected) return;
    const roleReq = selected.role_requirements || [];
    const roleMh = {};
    const roleIds = roleReq.map((r) => r.project_role_id);
    roleReq.forEach((r) => {
      roleMh[r.project_role_id] = r.business_mh ?? '';
    });

    setBusinessForm({
      deck_url: selected.deck_url || '',
      quotation_url: selected.quotation_url || '',
      drive_url: selected.drive_url || '',
      methodology: selected.methodology || 'Agile Scrum',
      total_manhours: selected.total_manhours ?? '',
      role_ids: roleIds,
      role_mh: roleMh,
    });

    const opMap = {};
    (selected.operation_assignments || []).forEach((a) => {
      if (!opMap[a.project_role_id]) opMap[a.project_role_id] = [];
      opMap[a.project_role_id].push(a.user_id);
    });
    setOperationAssignments(opMap);
  }, [selected]);

  useEffect(() => {
    if (visiblePresales.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }

    const stillExists = visiblePresales.some((item) => item.id?.toString() === selectedId?.toString());
    if (!stillExists) {
      setSelectedId(visiblePresales[0].id);
    }
  }, [visiblePresales, selectedId]);

  const updateBusinessForm = (updater) => {
    setBusinessForm((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      return next;
    });
  };
  const lockManualFields = !newForm.sales_pitch_id;

  const applyPitchToNewForm = (pitchIdRaw) => {
    const pitchId = String(pitchIdRaw || '');
    if (!pitchId) {
      setNewForm((prev) => ({ ...prev, sales_pitch_id: '' }));
      return;
    }
    const picked = winPitches.find((p) => String(p.id) === pitchId);
    if (!picked) return;
    if (usedWinPitchIds.has(picked.id)) {
      showFeedback('Sudah dipakai', 'Project Win ini sudah pernah dipilih untuk New Project lain.');
      return;
    }
    setNewForm((prev) => ({
      ...prev,
      sales_pitch_id: pitchId,
      company_id: picked.company_id != null ? String(picked.company_id) : prev.company_id,
      project_name: picked.title || picked.prospect_name || prev.project_name,
      project_category_id: picked.project_category_id != null ? String(picked.project_category_id) : prev.project_category_id,
      estimated_budget:
        picked.final_deal_value != null
          ? String(picked.final_deal_value)
          : (picked.estimated_value != null ? String(picked.estimated_value) : prev.estimated_budget),
      project_description: picked.notes || prev.project_description,
    }));
  };

  const createOpportunity = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetchAPI('/presales', {
        method: 'POST',
        body: JSON.stringify({
          sales_pitch_id: newForm.sales_pitch_id ? parseInt(newForm.sales_pitch_id) : null,
          company_id: parseInt(newForm.company_id),
          project_name: newForm.project_name,
          project_category_id: parseInt(newForm.project_category_id),
          estimated_budget: Number(newForm.estimated_budget),
          project_description: newForm.project_description,
        }),
      });
      setIsNewOpen(false);
      setNewForm({
        sales_pitch_id: '',
        company_id: '',
        project_name: '',
        project_category_id: '',
        estimated_budget: '',
        project_description: '',
      });
      await loadAll();
      if (res?.id) setSelectedId(res.id);
    } catch (error) {
      showFeedback('Gagal Membuat Opportunity', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openEditOpportunity = (item) => {
    setEditForm({
      id: item.id,
      company_id: item.company_id?.toString() || '',
      project_name: item.project_name || item.name || '',
      project_category_id: item.project_category_id?.toString() || '',
      estimated_budget: item.estimated_budget ?? item.estimated_value ?? '',
      project_description: item.project_description || item.description || '',
    });
    setIsEditOpen(true);
  };

  const updateOpportunity = async (e) => {
    e.preventDefault();
    if (!editForm.id) return;
    setIsSaving(true);
    try {
      await fetchAPI(`/presales/${editForm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          company_id: editForm.company_id ? parseInt(editForm.company_id) : null,
          project_name: editForm.project_name,
          project_category_id: editForm.project_category_id ? parseInt(editForm.project_category_id) : null,
          estimated_budget: editForm.estimated_budget !== '' ? Number(editForm.estimated_budget) : null,
          project_description: editForm.project_description || null,
          // keep legacy mirrored fields in sync
          name: editForm.project_name,
          estimated_value: editForm.estimated_budget !== '' ? Number(editForm.estimated_budget) : null,
          description: editForm.project_description || null,
        }),
      });
      setIsEditOpen(false);
      await loadAll();
      showFeedback('Berhasil', 'Opportunity berhasil diupdate.');
    } catch (error) {
      showFeedback('Gagal Update Opportunity', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const saveBusiness = async () => {
    if (!selected) return;
    setBusinessSaving(true);
    try {
      await submitBusinessData();
      await loadAll();
      showFeedback('Berhasil', 'Data Business tersimpan.');
    } catch (error) {
      showFeedback('Gagal Simpan Business', `Gagal menyimpan data Business: ${error.message}`);
    } finally {
      setBusinessSaving(false);
    }
  };

  const acknowledgeBusiness = async () => {
    if (!selected) return;
    setBusinessSaving(true);
    try {
      await submitBusinessData();
      await fetchAPI(`/presales/${selected.id}/business/acknowledge`, { method: 'POST' });
      await loadAll();
      showFeedback('Berhasil', 'Business acknowledged.');
    } catch (error) {
      showFeedback('Gagal Acknowledge Business', `Gagal acknowledge Business: ${error.message}`);
    } finally {
      setBusinessSaving(false);
    }
  };

  const saveOperation = async () => {
    if (!selected) return;
    try {
      await submitOperationData();
      await loadAll();
      showFeedback('Berhasil', 'Data Operation tersimpan.');
    } catch (error) {
      showFeedback('Gagal Simpan Operation', error.message);
    }
  };

  const acknowledgeOperation = async () => {
    if (!selected) return;
    try {
      // Keep UX simple: acknowledge always persists current Operation assignments first.
      await submitOperationData();
      await fetchAPI(`/presales/${selected.id}/operation/acknowledge`, { method: 'POST' });
      await loadAll();
      showFeedback('Berhasil', 'Operation acknowledged.');
    } catch (error) {
      showFeedback('Gagal Acknowledge Operation', error.message);
    }
  };

  const proceedProject = async () => {
    if (!selected) return;
    try {
      const res = await fetchAPI(`/presales/${selected.id}/proceed-project`, { method: 'POST' });
      if (res.project_id) navigate(`/board/${res.project_id}`);
    } catch (error) {
      showFeedback('Gagal Proceed Project', error.message);
    }
  };

  const toggleRole = (roleId) => {
    updateBusinessForm((prev) => {
      const exists = prev.role_ids.includes(roleId);
      const role_ids = exists ? prev.role_ids.filter((id) => id !== roleId) : [...prev.role_ids, roleId];
      const role_mh = { ...(prev.role_mh || {}) };
      if (exists) {
        delete role_mh[roleId];
      } else if (role_mh[roleId] == null) {
        role_mh[roleId] = '';
      }
      return { ...prev, role_ids, role_mh };
    });
  };

  useEffect(() => {
    if (businessForm.methodology !== 'Agile Scrum') return;
    const total = businessForm.role_ids.reduce((sum, roleId) => {
      const raw = businessForm.role_mh?.[roleId];
      const num = raw === '' || raw == null ? 0 : Number(raw);
      return sum + (Number.isFinite(num) ? num : 0);
    }, 0);
    const nextTotal = total === 0 ? '' : String(total);
    if (String(businessForm.total_manhours ?? '') !== nextTotal) {
      setBusinessForm((prev) => ({ ...prev, total_manhours: nextTotal }));
    }
  }, [businessForm.methodology, businessForm.role_ids, businessForm.role_mh, businessForm.total_manhours]);

  const submitBusinessData = async () => {
    if (!selected) return;
    await fetchAPI(`/presales/${selected.id}/business`, {
      method: 'PUT',
      body: JSON.stringify({
        deck_url: businessForm.deck_url,
        quotation_url: businessForm.quotation_url,
        drive_url: businessForm.drive_url,
        methodology: businessForm.methodology,
        total_manhours:
          businessForm.methodology === 'Agile Scrum' ? Number(businessForm.total_manhours || 0) : null,
        project_role_ids: businessForm.role_ids,
        business_role_mh: businessForm.role_mh,
      }),
    });
  };

  const submitOperationData = async () => {
    if (!selected) return;
    const assignments = businessForm.role_ids.map((roleId) => ({
      project_role_id: roleId,
      user_ids: operationAssignments[roleId] || [],
    }));
    await fetchAPI(`/presales/${selected.id}/operation`, {
      method: 'PUT',
      body: JSON.stringify({ assignments }),
    });
  };

  const setAssignmentUsers = (roleId, userId, checked) => {
    setOperationAssignments((prev) => {
      const existing = prev[roleId] || [];
      const next = checked ? [...existing, userId] : existing.filter((id) => id !== userId);
      return { ...prev, [roleId]: Array.from(new Set(next)) };
    });
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-4.25rem)] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Memuat {MENU_NEW_PROJECT}...
      </div>
    );
  }

  const renderUrlField = (label, value, onChange, placeholder) => (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <div className="flex gap-2">
        <Input
          value={value}
          disabled={isProceeded}
          onChange={onChange}
          placeholder={placeholder}
          className="h-9"
        />
        {value?.trim() && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            asChild
          >
            <a href={value} target="_blank" rel="noopener noreferrer" aria-label={`Buka ${label}`}>
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
      </div>
    </label>
  );

  return (
    <>
    <div className="relative h-[calc(100dvh-4.25rem)] overflow-hidden bg-slate-50 transition-colors duration-200 dark:bg-[#0B192C]">
      <div className="relative z-10 flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-white/60 bg-white/70 backdrop-blur-xl px-4 py-4 sm:px-6 dark:border-white/10 dark:bg-[#151b28]/90">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Briefcase className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
                  {MENU_NEW_PROJECT}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Alur Business → Operation → Proceed ke board
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5 shadow-md shadow-primary/20 bg-primary hover:bg-primary/90 text-white font-semibold" onClick={() => setIsCreateProjectOpen(true)}>
              <Plus className="size-4" />
              New Project
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsNewOpen(true)}>
              <Layers className="size-4" />
              Opportunity baru
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden px-4 py-4 sm:flex-row sm:px-6 sm:py-5">
        <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#151b28] max-h-[40vh] sm:max-h-none sm:w-80">
          <div className="border-b border-slate-100 px-3 py-3 dark:border-slate-800">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Opportunity aktif ({visiblePresales.length})
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Cari project / company..."
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <div className="board-column-scroll min-h-0 flex-1 overflow-y-auto p-2">
            {visiblePresales.length === 0 ? (
              <div className="space-y-3 px-2 py-6 text-center">
                <p className="text-sm text-slate-500">Belum ada opportunity aktif.</p>
                <div className="flex flex-col gap-2">
                  <Button size="sm" className="gap-1.5" onClick={() => setIsCreateProjectOpen(true)}>
                    <Plus className="size-4" />
                    New Project
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate('/create-project')}>
                    Lihat List Project
                  </Button>
                </div>
              </div>
            ) : filteredPresales.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">Tidak ada hasil pencarian</p>
            ) : (
              <ul className="space-y-1">
                {filteredPresales.map((item) => {
                  const isSelected = selectedId === item.id;
                  return (
                    <li key={item.id}>
                      <div
                        className={cn(
                          'group flex w-full items-start gap-1 rounded-lg transition-colors',
                          isSelected
                            ? 'bg-primary text-white shadow-sm'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          className="min-w-0 flex-1 px-2.5 py-2.5 text-left"
                        >
                          <p className={cn('truncate text-sm font-semibold', isSelected ? 'text-white' : 'text-slate-900 dark:text-white')}>
                            {item.project_name || item.name}
                          </p>
                          <p className={cn('mt-0.5 flex items-center gap-1 truncate text-[11px]', isSelected ? 'text-white/80' : 'text-slate-500')}>
                            <Building2 className="size-3 shrink-0" />
                            {item.company?.name || '—'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.business_acknowledged_at && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'h-5 border-blue-200 px-1.5 text-[10px]',
                                  isSelected && 'border-white/40 bg-white/15 text-white',
                                )}
                              >
                                Business
                              </Badge>
                            )}
                            {item.operation_acknowledged_at && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'h-5 border-emerald-200 px-1.5 text-[10px]',
                                  isSelected && 'border-white/40 bg-white/15 text-white',
                                )}
                              >
                                Operation
                              </Badge>
                            )}
                          </div>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'mr-1 mt-1.5 h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100',
                            isSelected && 'text-white/80 hover:bg-white/20 hover:text-white opacity-100',
                          )}
                          disabled={!!item.converted_project_id}
                          onClick={() => openEditOpportunity(item)}
                          title="Edit opportunity"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#151b28]">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-slate-400">
              <Briefcase className="size-12 opacity-25" />
              <div className="text-center">
                <p className="text-base font-semibold text-slate-700 dark:text-slate-200">Mulai Proyek Baru</p>
                <p className="text-sm text-slate-500 mt-1 max-w-sm">Buat proyek baru langsung ke Project Board tanpa alur approval panjang.</p>
              </div>
              <Button size="sm" className="gap-1.5 mt-2 bg-primary hover:bg-primary/90 text-white" onClick={() => setIsCreateProjectOpen(true)}>
                <Plus className="size-4" />
                New Project
              </Button>
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-slate-800">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-slate-900 dark:text-white">
                      {selected.project_name}
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {selected.company?.name || '—'} · {selected.project_category?.name || '—'}
                    </p>
                    {selected.estimated_budget != null && Number(selected.estimated_budget) > 0 && (
                      <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                        Budget: {formatIdr(selected.estimated_budget)}
                      </p>
                    )}
                    {isProceeded && (
                      <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        Sudah di-proceed — form dikunci.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canProceed && (
                      <Button size="sm" className="gap-1.5" onClick={proceedProject}>
                        <CheckCircle2 className="size-4" />
                        Proceed Project
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StepPill label="Business" done={!!selected.business_acknowledged_at} active={activeTab === 'Business'} />
                  <StepPill
                    label="Operation"
                    done={!!selected.operation_acknowledged_at}
                    active={activeTab === 'Operation'}
                    locked={!canOpenOperation}
                  />
                </div>

                <div className="mt-3 inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
                  {TAB_KEYS.map((tab) => {
                    const disabled = tab === 'Operation' && !canOpenOperation;
                    return (
                      <Button
                        key={tab}
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'h-8 px-3',
                          activeTab === tab && 'bg-primary text-white shadow-sm hover:bg-primary hover:text-white',
                        )}
                        disabled={disabled}
                        onClick={() => navigate(`/presales/${TAB_TO_PATH[tab]}`)}
                      >
                        {tab}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="board-column-scroll min-h-0 flex-1 overflow-y-auto">
                {activeTab === 'Business' && (
                  <div className="space-y-5 p-4 sm:p-5">
                    <Card className="border-slate-200/90 shadow-none dark:border-slate-700/80">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <FileText className="size-4 text-primary" />
                          Dokumen &amp; tautan
                        </CardTitle>
                        <CardDescription>Deck, quotation, dan folder Google Drive untuk tim delivery.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          {renderUrlField(
                            'Deck URL',
                            businessForm.deck_url,
                            (e) => updateBusinessForm((prev) => ({ ...prev, deck_url: e.target.value })),
                            'https://...',
                          )}
                          {renderUrlField(
                            'Quotation URL',
                            businessForm.quotation_url,
                            (e) => updateBusinessForm((prev) => ({ ...prev, quotation_url: e.target.value })),
                            'https://...',
                          )}
                        </div>
                        {renderUrlField(
                          'Google Drive URL',
                          businessForm.drive_url,
                          (e) => updateBusinessForm((prev) => ({ ...prev, drive_url: e.target.value })),
                          'https://drive.google.com/...',
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-slate-200/90 shadow-none dark:border-slate-700/80">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Layers className="size-4 text-primary" />
                          Metodologi &amp; manhour
                        </CardTitle>
                        <CardDescription>
                          Pilih metodologi project. Untuk Agile Scrum, total MH dihitung dari jumlah MH per role.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
                          {['Agile Scrum', 'Waterfall'].map((method) => (
                            <button
                              key={method}
                              type="button"
                              disabled={isProceeded}
                              className={cn(
                                'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                                businessForm.methodology === method
                                  ? 'bg-primary text-white shadow-sm'
                                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
                              )}
                              onClick={() => updateBusinessForm((prev) => ({ ...prev, methodology: method }))}
                            >
                              {method}
                            </button>
                          ))}
                        </div>
                        {businessForm.methodology === 'Agile Scrum' && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/40">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                              Total MH (otomatis)
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                              {businessForm.total_manhours !== '' ? businessForm.total_manhours : '0'}
                              <span className="ml-1 text-sm font-normal text-slate-500">jam</span>
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-slate-200/90 shadow-none dark:border-slate-700/80">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Users className="size-4 text-primary" />
                          Kebutuhan role
                        </CardTitle>
                        <CardDescription>Pilih role yang dibutuhkan project ini.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {projectRoles.map((role) => {
                            const checked = businessForm.role_ids.includes(role.id);
                            return (
                              <label
                                key={role.id}
                                className={cn(
                                  'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
                                  checked
                                    ? 'border-primary/40 bg-primary/5 dark:bg-primary/10'
                                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/40',
                                  isProceeded && 'cursor-not-allowed opacity-60',
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled={isProceeded}
                                  onCheckedChange={() => toggleRole(role.id)}
                                />
                                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                  {role.name}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {businessForm.methodology === 'Agile Scrum' && businessForm.role_ids.length > 0 && (
                      <Card className="border-slate-200/90 shadow-none dark:border-slate-700/80">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">MH Business per role</CardTitle>
                          <CardDescription>Alokasi manhour per role untuk perhitungan kuota board.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/40">
                                <tr>
                                  <th className="px-4 py-2.5 font-medium">Role</th>
                                  <th className="px-4 py-2.5 font-medium text-right w-36">MH</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {businessForm.role_ids.map((roleId) => {
                                  const role = projectRoles.find((r) => r.id === roleId);
                                  return (
                                    <tr key={roleId}>
                                      <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                                        {role?.name || `Role ${roleId}`}
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.25"
                                          className="h-8 text-right tabular-nums"
                                          value={businessForm.role_mh?.[roleId] ?? ''}
                                          disabled={isProceeded}
                                          onChange={(e) =>
                                            updateBusinessForm((prev) => ({
                                              ...prev,
                                              role_mh: { ...(prev.role_mh || {}), [roleId]: e.target.value },
                                            }))
                                          }
                                          placeholder="0"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:-mx-5 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-slate-800 dark:bg-[#151b28]/95">
                      <p className="text-xs text-slate-500">
                        {selected.business_acknowledged_at
                          ? `Business di-acknowledge · ${new Date(selected.business_acknowledged_at).toLocaleString('id-ID')}`
                          : 'Belum di-acknowledge — simpan draft atau acknowledge setelah data lengkap.'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isProceeded || businessSaving}
                          onClick={saveBusiness}
                        >
                          {businessSaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                          Simpan draft
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isProceeded || businessSaving || !!selected.business_acknowledged_at}
                          onClick={acknowledgeBusiness}
                        >
                          Acknowledge Business
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'Operation' && (
                  <div className="space-y-5 p-4 sm:p-5">
                    {businessForm.role_ids.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                        Lengkapi kebutuhan role di tab Business terlebih dahulu.
                      </p>
                    ) : (
                      businessForm.role_ids.map((roleId) => {
                        const role = projectRoles.find((r) => r.id === roleId);
                        return (
                          <Card key={roleId} className="border-slate-200/90 shadow-none dark:border-slate-700/80">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">{role?.name || `Role ${roleId}`}</CardTitle>
                              <CardDescription>Assign anggota tim untuk role ini.</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <UserMultiSearch
                                selected={operationAssignments[roleId] || []}
                                options={users}
                                disabled={isProceeded}
                                onChange={(newIds) =>
                                  setOperationAssignments((prev) => ({ ...prev, [roleId]: newIds }))
                                }
                              />
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                    <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:-mx-5 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-slate-800 dark:bg-[#151b28]/95">
                      <p className="text-xs text-slate-500">
                        {selected.operation_acknowledged_at
                          ? `Operation di-acknowledge · ${new Date(selected.operation_acknowledged_at).toLocaleString('id-ID')}`
                          : 'Assign user per role lalu acknowledge Operation.'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={isProceeded} onClick={saveOperation}>
                          Simpan draft
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isProceeded || !!selected.operation_acknowledged_at}
                          onClick={acknowledgeOperation}
                        >
                          Acknowledge Operation
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
      </div>
    </div>

      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{MENU_NEW_PROJECT}</DialogTitle>
          </DialogHeader>
          <form onSubmit={createOpportunity} className="space-y-4">
            <label className="space-y-2 block">
              <span className="text-sm font-medium">Sumber Project Win</span>
              <select
                className="w-full border rounded-md p-2"
                value={newForm.sales_pitch_id}
                onChange={(e) => applyPitchToNewForm(e.target.value)}
              >
                <option value="">Pilih dari Sales - Project Win</option>
                {winPitches.map((pitch) => {
                  const used = usedWinPitchIds.has(pitch.id);
                  return (
                    <option key={pitch.id} value={pitch.id} disabled={used}>
                      {`${pitch.title || pitch.prospect_name || `Pitch #${pitch.id}`} - ${pitch.company_name || '-'}${used ? ' (sudah dipakai)' : ''}`}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="space-y-2 block">
              <span className="text-sm font-medium">Nama Company</span>
              <select
                className="w-full border rounded-md p-2"
                value={newForm.company_id}
                disabled={lockManualFields}
                onChange={(e) => setNewForm((prev) => ({ ...prev, company_id: e.target.value }))}
                required
              >
                <option value="">Pilih company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 block">
              <span className="text-sm font-medium">Project Name</span>
              <Input
                value={newForm.project_name}
                disabled={lockManualFields}
                onChange={(e) => setNewForm((prev) => ({ ...prev, project_name: e.target.value }))}
                required
              />
            </label>

            <label className="space-y-2 block">
              <span className="text-sm font-medium">Category Company</span>
              <select
                className="w-full border rounded-md p-2"
                value={newForm.project_category_id}
                disabled={lockManualFields}
                onChange={(e) => setNewForm((prev) => ({ ...prev, project_category_id: e.target.value }))}
                required
              >
                <option value="">Pilih category</option>
                {projectCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 block">
              <span className="text-sm font-medium">Estimasi Budget (IDR)</span>
              <Input
                type="number"
                min="0"
                value={newForm.estimated_budget}
                disabled={lockManualFields}
                onChange={(e) => setNewForm((prev) => ({ ...prev, estimated_budget: e.target.value }))}
                required
              />
            </label>

            <label className="space-y-2 block">
              <span className="text-sm font-medium">Deskripsi Project</span>
              <Textarea
                value={newForm.project_description}
                disabled={lockManualFields}
                onChange={(e) => setNewForm((prev) => ({ ...prev, project_description: e.target.value }))}
              />
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNewOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || lockManualFields}>
                {isSaving ? 'Saving...' : 'Create Opportunity'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Opportunity</DialogTitle>
            <DialogDescription>Ubah data utama opportunity dari list.</DialogDescription>
          </DialogHeader>
          <form onSubmit={updateOpportunity} className="space-y-4">
            <label className="space-y-2 block">
              <span className="text-sm font-medium">Nama Company</span>
              <select
                className="w-full border rounded-md p-2"
                value={editForm.company_id}
                onChange={(e) => setEditForm((prev) => ({ ...prev, company_id: e.target.value }))}
                required
              >
                <option value="">Pilih company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 block">
              <span className="text-sm font-medium">Project Name</span>
              <Input
                value={editForm.project_name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, project_name: e.target.value }))}
                required
              />
            </label>

            <label className="space-y-2 block">
              <span className="text-sm font-medium">Category Company</span>
              <select
                className="w-full border rounded-md p-2"
                value={editForm.project_category_id}
                onChange={(e) => setEditForm((prev) => ({ ...prev, project_category_id: e.target.value }))}
                required
              >
                <option value="">Pilih category</option>
                {projectCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 block">
              <span className="text-sm font-medium">Estimasi Budget (IDR)</span>
              <Input
                type="number"
                min="0"
                value={editForm.estimated_budget}
                onChange={(e) => setEditForm((prev) => ({ ...prev, estimated_budget: e.target.value }))}
                required
              />
            </label>

            <label className="space-y-2 block">
              <span className="text-sm font-medium">Deskripsi Project</span>
              <Textarea
                value={editForm.project_description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, project_description: e.target.value }))}
              />
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CreateProjectModal
        open={isCreateProjectOpen}
        onOpenChange={setIsCreateProjectOpen}
        onSuccess={(newProj) => navigate(`/board/${newProj.id}`)}
      />

      <Dialog
        open={feedbackDialog.open}
        onOpenChange={(open) => setFeedbackDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{feedbackDialog.title}</DialogTitle>
            <DialogDescription>{feedbackDialog.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setFeedbackDialog((prev) => ({ ...prev, open: false }))}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
