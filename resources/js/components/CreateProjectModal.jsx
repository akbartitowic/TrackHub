import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Users, KanbanSquare, Calendar, Clock, AlertCircle, Loader2 } from 'lucide-react';

export default function CreateProjectModal({ open, onOpenChange, onSuccess }) {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    const [projectName, setProjectName] = useState('');
    const [methodology, setMethodology] = useState('Agile Scrum');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [members, setMembers] = useState([]);
    const [roleQuotas, setRoleQuotas] = useState([]);

    const [usersList, setUsersList] = useState([]);
    const [projectRolesList, setProjectRolesList] = useState([]);
    const [loadingMaster, setLoadingMaster] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Fetch master data when modal opens
    useEffect(() => {
        if (!open) return;

        setErrorMessage('');
        setProjectName('');
        setMethodology('Agile Scrum');
        setStartDate('');
        setEndDate('');

        const loadMaster = async () => {
            setLoadingMaster(true);
            try {
                const [usersRes, rolesRes] = await Promise.all([
                    fetchAPI('/users'),
                    fetchAPI('/project-roles'),
                ]);
                const users = usersRes.data || [];
                const roles = rolesRes.data || [];
                setUsersList(users);
                setProjectRolesList(roles);

                // Default member: current logged in user with first role
                if (currentUser && users.length > 0 && roles.length > 0) {
                    const defaultRole = roles[0].id.toString();
                    setMembers([{
                        user_id: currentUser.id.toString(),
                        project_role_id: defaultRole,
                    }]);
                } else {
                    setMembers([{ user_id: '', project_role_id: '' }]);
                }
                setRoleQuotas([]);
            } catch (err) {
                console.error('Failed to load master data for new project:', err);
                setErrorMessage('Gagal memuat daftar user/role: ' + err.message);
            } finally {
                setLoadingMaster(false);
            }
        };

        loadMaster();
    }, [open, currentUser]);

    // Member management
    const handleAddMember = () => {
        const firstRole = projectRolesList[0]?.id?.toString() || '';
        setMembers(prev => [...prev, { user_id: '', project_role_id: firstRole }]);
    };

    const handleRemoveMember = (index) => {
        if (members.length <= 1) return;
        setMembers(prev => prev.filter((_, i) => i !== index));
    };

    const handleMemberChange = (index, field, value) => {
        setMembers(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    // Role Quota management
    const handleAddRoleQuota = () => {
        const unusedRole = projectRolesList.find(r => !roleQuotas.some(rq => rq.project_role_id === r.id.toString()));
        const roleId = unusedRole ? unusedRole.id.toString() : (projectRolesList[0]?.id?.toString() || '');
        setRoleQuotas(prev => [...prev, { project_role_id: roleId, hours: '' }]);
    };

    const handleRemoveRoleQuota = (index) => {
        setRoleQuotas(prev => prev.filter((_, i) => i !== index));
    };

    const handleRoleQuotaChange = (index, field, value) => {
        setRoleQuotas(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const totalManhours = roleQuotas.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        const trimmedName = projectName.trim();
        if (!trimmedName) {
            setErrorMessage('Nama proyek wajib diisi.');
            return;
        }

        const validMembers = members
            .filter(m => m.user_id && m.project_role_id)
            .map(m => ({
                user_id: parseInt(m.user_id),
                project_role_id: parseInt(m.project_role_id),
            }));

        if (validMembers.length === 0) {
            setErrorMessage('Pilih minimal 1 anggota tim untuk proyek ini.');
            return;
        }

        const formattedRoleQuotas = roleQuotas
            .filter(rq => rq.project_role_id && Number(rq.hours) > 0)
            .map(rq => ({
                project_role_id: parseInt(rq.project_role_id),
                quota_hours: parseFloat(rq.hours),
            }));

        setIsSubmitting(true);
        try {
            const payload = {
                name: trimmedName,
                status: 'Planning',
                budget_status: 'On Budget',
                completion: 0,
                methodology,
                start_date: startDate || null,
                end_date: endDate || null,
                total_manhours: methodology === 'Agile Scrum' && totalManhours > 0 ? totalManhours : null,
                members: validMembers,
                role_quotas: formattedRoleQuotas,
            };

            const res = await fetchAPI('/projects', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            if (res.id) {
                onOpenChange(false);
                if (onSuccess) {
                    onSuccess(res);
                } else {
                    navigate(`/board/${res.id}`);
                }
            } else {
                throw new Error(res.message || 'Gagal membuat proyek');
            }
        } catch (err) {
            setErrorMessage(err.message || 'Terjadi kesalahan saat menyimpan proyek.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#151b28] border-slate-200 dark:border-slate-800 p-6">
                <DialogHeader>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <KanbanSquare className="size-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                                New Project
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">
                                Buat proyek baru langsung ke Project Board
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {errorMessage && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-rose-600 dark:text-rose-400 text-sm">
                        <AlertCircle className="size-4 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {loadingMaster ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-sm">
                        <Loader2 className="size-6 animate-spin text-primary" />
                        <span>Memuat data...</span>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5 mt-2">
                        {/* Project Name */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                Nama Proyek <span className="text-rose-500">*</span>
                            </label>
                            <Input
                                required
                                placeholder="Contoh: Redesign Website Enterprise"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                className="h-10 text-sm"
                            />
                        </div>

                        {/* Methodology & Dates */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Metodologi
                                </label>
                                <Select value={methodology} onValueChange={setMethodology}>
                                    <SelectTrigger className="h-10 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Agile Scrum">Agile Scrum</SelectItem>
                                        <SelectItem value="Waterfall">Waterfall</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Tanggal Mulai
                                </label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="h-10 text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Target Selesai
                                </label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="h-10 text-sm"
                                />
                            </div>
                        </div>

                        {/* Team Members */}
                        <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Users className="size-3.5 text-primary" /> Anggota Tim Proyek <span className="text-rose-500">*</span>
                                </label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleAddMember}
                                    className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                                >
                                    <Plus className="size-3" /> Tambah Anggota
                                </Button>
                            </div>

                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {members.map((member, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                        <div className="flex-1">
                                            <Select
                                                value={member.user_id}
                                                onValueChange={(val) => handleMemberChange(idx, 'user_id', val)}
                                            >
                                                <SelectTrigger className="h-9 text-xs">
                                                    <SelectValue placeholder="Pilih User..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {usersList.map((u) => (
                                                        <SelectItem key={u.id} value={u.id.toString()}>
                                                            {u.name} ({u.email})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="w-44">
                                            <Select
                                                value={member.project_role_id}
                                                onValueChange={(val) => handleMemberChange(idx, 'project_role_id', val)}
                                            >
                                                <SelectTrigger className="h-9 text-xs">
                                                    <SelectValue placeholder="Pilih Role..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {projectRolesList.map((r) => (
                                                        <SelectItem key={r.id} value={r.id.toString()}>
                                                            {r.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {members.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-slate-400 hover:text-rose-500"
                                                onClick={() => handleRemoveMember(idx)}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Role Quotas / Manhours (Optional for Agile Scrum) */}
                        {methodology === 'Agile Scrum' && (
                            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock className="size-3.5 text-primary" /> Estimasi Kuota Manhour per Role (Opsional)
                                    </label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleAddRoleQuota}
                                        className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                                    >
                                        <Plus className="size-3" /> Tambah Kuota Role
                                    </Button>
                                </div>

                                {roleQuotas.length > 0 && (
                                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                        {roleQuotas.map((rq, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                <div className="flex-1">
                                                    <Select
                                                        value={rq.project_role_id}
                                                        onValueChange={(val) => handleRoleQuotaChange(idx, 'project_role_id', val)}
                                                    >
                                                        <SelectTrigger className="h-9 text-xs">
                                                            <SelectValue placeholder="Pilih Role..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {projectRolesList.map((r) => (
                                                                <SelectItem key={r.id} value={r.id.toString()}>
                                                                    {r.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="w-32">
                                                    <Input
                                                        type="number"
                                                        placeholder="Jam (MH)"
                                                        min="0"
                                                        value={rq.hours}
                                                        onChange={(e) => handleRoleQuotaChange(idx, 'hours', e.target.value)}
                                                        className="h-9 text-xs"
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 text-slate-400 hover:text-rose-500"
                                                    onClick={() => handleRemoveRoleQuota(idx)}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        {totalManhours > 0 && (
                                            <div className="text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                Total Manhours: <span className="text-primary font-bold">{totalManhours} Jam</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-primary hover:bg-primary/90 text-white font-semibold"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin mr-1.5" />
                                        Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="size-4 mr-1.5" />
                                        Buat Proyek
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
