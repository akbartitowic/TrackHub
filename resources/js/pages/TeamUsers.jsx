import { useState, useEffect, useMemo } from 'react';
import { fetchAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdminUser } from '../utils/permissions';
import { User, Shield, Code, Bug, Settings, UserPlus, Edit, Trash2, MessageSquare, Save, Loader2, KeyRound, Search } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function TeamUsers() {
    const navigate = useNavigate();
    const { user: authUser } = useAuth();
    const canResetPassword = isAdminUser(authUser);
    const [users, setUsers] = useState([]);

    // Create User Modal State

    const [isModalOpen, setIsModalOpen] = useState(false);

    // Edit User Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);

    const [roles, setRoles] = useState([]);
    const [newUser, setNewUser] = useState({
        name: '',
        nickname: '',
        email: '',
        role_id: '',
        phone_number: '',
        password: '',
        status: 'Active'
    });
    const [editingUser, setEditingUser] = useState(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredUsers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return users;
        return users.filter((user) => {
            const roleName = (user.role?.name || '').toLowerCase();
            return (
                user.name?.toLowerCase().includes(q)
                || (user.nickname || '').toLowerCase().includes(q)
                || user.email?.toLowerCase().includes(q)
                || roleName.includes(q)
                || (user.phone_number || '').toLowerCase().includes(q)
                || (user.status || '').toLowerCase().includes(q)
            );
        });
    }, [users, searchQuery]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [userRes, roleRes] = await Promise.all([
                    fetchAPI('/users'),
                    fetchAPI('/roles')
                ]);
                if (userRes.data) setUsers(userRes.data);
                if (roleRes.data) setRoles(roleRes.data);
            } catch (err) {
                console.error("Failed to load user or role data", err);
            }
        };
        loadData();
    }, []);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        if (isModalOpen) {
            setNewUser(prev => ({ ...prev, [id.replace('user-', '')]: value }));
        } else if (isEditModalOpen) {
            setEditingUser(prev => ({ ...prev, [id.replace('user-', '')]: value }));
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await fetchAPI('/users', {
                method: 'POST',
                body: JSON.stringify({ ...newUser, status: 'Active' })
            });
            setIsModalOpen(false);
            setNewUser({ name: '', nickname: '', email: '', phone_number: '', role_id: '', password: '', status: 'Active' });
            const [userRes, roleRes] = await Promise.all([
                fetchAPI('/users'),
                fetchAPI('/roles')
            ]);
            if (userRes.data) setUsers(userRes.data);
            if (roleRes.data) setRoles(roleRes.data);
        } catch (err) {
            alert("Error adding user: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditModal = (user) => {
        setEditingUserId(user.id);
        setEditingUser({
            name: user.name,
            nickname: user.nickname || '',
            email: user.email,
            phone_number: user.phone_number || '',
            role_id: user.role?.id || '',
            status: user.status,
            new_password: '',
            new_password_confirm: '',
        });
        setIsEditModalOpen(true);
    };

    const handleEditUser = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload = {
                name: editingUser.name,
                nickname: editingUser.nickname,
                email: editingUser.email,
                phone_number: editingUser.phone_number,
                role_id: editingUser.role_id,
                status: editingUser.status,
            };
            if (canResetPassword && editingUser.new_password) {
                if (editingUser.new_password !== editingUser.new_password_confirm) {
                    alert('Konfirmasi password tidak sama.');
                    setIsSubmitting(false);
                    return;
                }
                if (editingUser.new_password.length < 6) {
                    alert('Password minimal 6 karakter.');
                    setIsSubmitting(false);
                    return;
                }
                payload.password = editingUser.new_password;
            }

            await fetchAPI(`/users/${editingUserId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            setIsEditModalOpen(false);
            setEditingUserId(null);
            setEditingUser(null);
            const [userRes, roleRes] = await Promise.all([
                fetchAPI('/users'),
                fetchAPI('/roles')
            ]);
            if (userRes.data) setUsers(userRes.data);
            if (roleRes.data) setRoles(roleRes.data);
        } catch (err) {
            alert("Error updating user: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await fetchAPI(`/users/${id}`, { method: 'DELETE' });
            const [userRes, roleRes] = await Promise.all([
                fetchAPI('/users'),
                fetchAPI('/roles')
            ]);
            if (userRes.data) setUsers(userRes.data);
            if (roleRes.data) setRoles(roleRes.data);
        } catch (err) {
            alert("Error deleting user: " + err.message);
        }
    };

    const renderRoleBadge = (role) => {
        if (!role) return <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs font-bold border-opacity-50 bg-slate-200/80 text-slate-700">No Role</Badge>;

        let RoleIcon = User;
        let roleClass = 'bg-slate-200/80 text-slate-700';
        if (role.name.includes('Manager')) { RoleIcon = Shield; roleClass = 'bg-purple-100/80 text-purple-700 hover:bg-purple-200/80'; }
        if (role.name.includes('Developer')) { RoleIcon = Code; roleClass = 'bg-blue-100/80 text-blue-700 hover:bg-blue-200/80'; }
        if (role.name.includes('QA')) { RoleIcon = Bug; roleClass = 'bg-amber-100/80 text-amber-700 hover:bg-amber-200/80'; }

        return (
            <Badge variant="secondary" className={`gap-1.5 px-3 py-1 text-xs font-bold border-opacity-50 ${roleClass}`}>
                <RoleIcon className="size-3.5" />
                {role.name}
            </Badge>
        );
    };

    return (
        <div className="flex-1 flex flex-col overflow-y-auto w-full transition-colors duration-200 relative">
            <div className="z-0 flex flex-1 px-4 py-5 sm:px-6 lg:px-8 pb-16">
                <div className="flex w-full flex-col gap-6 sm:gap-8">
                    {/* Page Title & Actions */}
                    <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                        <div className="flex flex-col gap-1">
                            <h1 className="text-slate-900 dark:text-white text-3xl font-black tracking-tight">Team Directory</h1>
                            <p className="text-slate-500 dark:text-[#9da6b9] text-sm font-medium">Manage administrators, developers, and quality assurance personnel.</p>
                        </div>
                        <div className="flex gap-3">
                            <Button 
                                variant="outline" 
                                className="gap-2 h-10 px-5 shadow-sm bg-white/70 dark:bg-slate-800/70"
                                onClick={() => navigate('/roles')}
                            >
                                <Settings className="size-4" />
                                <span>Roles & Permissions</span>
                            </Button>
                            <Button className="gap-2 h-10 px-5 shadow-lg shadow-blue-900/20 bg-[#00529C] hover:bg-[#00417C] text-white transition-all" onClick={() => setIsModalOpen(true)}>
                                <UserPlus className="size-5" />
                                <span>Add New User</span>
                            </Button>
                        </div>
                    </div>

                    {/* User Table */}
                    <div className="w-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-2xl overflow-hidden shadow-xl transition-colors duration-200">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
                            <div className="relative flex-1 min-w-[200px] max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Cari nama, email, role, telepon..."
                                    className="pl-9 h-10"
                                />
                            </div>
                            <span className="text-xs text-slate-500">
                                {filteredUsers.length} / {users.length} user
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase">User</th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase">Role</th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase">Status</th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase">Contact</th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-900">
                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                                                {users.length === 0
                                                    ? 'Belum ada user.'
                                                    : 'Tidak ada user yang cocok dengan pencarian.'}
                                            </td>
                                        </tr>
                                    )}
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                        {user.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                            {user.name}
                                                            {user.nickname && (
                                                                <span className="ml-1.5 font-medium text-slate-400">"{user.nickname}"</span>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-slate-500">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {renderRoleBadge(user.role)}
                                            </td>
                                            <td className="p-4">
                                                <div className={`flex items-center gap-2 text-xs font-medium ${user.status === 'Active' ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                    <div className={`size-2 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div> {user.status}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                                                    {user.phone_number || <em className="text-slate-400 text-xs">Unset</em>}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => openEditModal(user)}>
                                                        <Edit className="size-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500" onClick={() => handleDeleteUser(user.id)}>
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add User Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <span className="bg-primary/10 p-1.5 rounded-lg text-primary">
                                <UserPlus className="size-5" />
                            </span>
                            Create New User
                        </DialogTitle>
                    </DialogHeader>
                    <form className="flex flex-col gap-6 py-4" onSubmit={handleAddUser}>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Full Name</label>
                            <Input type="text" id="user-name" value={newUser.name} onChange={handleInputChange} placeholder="John Doe" required className="py-6" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nickname</label>
                            <Input type="text" id="user-nickname" value={newUser.nickname} onChange={handleInputChange} placeholder="Johnny" className="py-6" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
                            <Input type="email" id="user-email" value={newUser.email} onChange={handleInputChange} placeholder="john.doe@executrack.io" required className="py-6" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                WhatsApp Number
                                <MessageSquare className="size-3.5 text-green-500" />
                            </label>
                            <Input type="tel" id="user-phone_number" value={newUser.phone_number} onChange={handleInputChange} placeholder="+62 812 3456 7890" className="py-6 focus-visible:ring-green-500" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Temporary Password</label>
                            <PasswordInput
                                id="user-password"
                                value={newUser.password}
                                onChange={handleInputChange}
                                placeholder="••••••••"
                                required
                                className="py-6"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">System Role</label>
                            <Select value={newUser.role_id?.toString()} onValueChange={(value) => setNewUser(prev => ({ ...prev, role_id: value }))} required>
                                <SelectTrigger className="h-12">
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map(role => (
                                        <SelectItem key={role.id} value={role.id.toString()}>{role.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter className="mt-4 border-t border-slate-200/50 dark:border-slate-700/50 pt-4">
                            <DialogClose asChild>
                                <Button type="button" variant="ghost">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting} className="bg-[#00529C] hover:bg-[#00417C] text-white shadow-lg shadow-blue-900/20 transition-all">
                                {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                                Save User
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            {/* Edit User Modal */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <span className="bg-primary/10 p-1.5 rounded-lg text-primary">
                                <Edit className="size-5" />
                            </span>
                            Edit User Profile
                        </DialogTitle>
                    </DialogHeader>
                    {editingUser && (
                        <form className="flex flex-col gap-6 py-4" onSubmit={handleEditUser}>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Full Name</label>
                                <Input type="text" id="user-name" value={editingUser.name} onChange={handleInputChange} placeholder="John Doe" required className="py-6" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nickname</label>
                                <Input type="text" id="user-nickname" value={editingUser.nickname} onChange={handleInputChange} placeholder="Johnny" className="py-6" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
                                <Input type="email" id="user-email" value={editingUser.email} onChange={handleInputChange} placeholder="john.doe@executrack.io" required className="py-6" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    WhatsApp Number
                                    <MessageSquare className="size-3.5 text-green-500" />
                                </label>
                                <Input type="tel" id="user-phone_number" value={editingUser.phone_number} onChange={handleInputChange} placeholder="+62 812 3456 7890" className="py-6 focus-visible:ring-green-500" />
                            </div>
                            {canResetPassword && (
                                <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
                                        <KeyRound className="size-4 shrink-0" />
                                        Reset password (admin)
                                    </div>
                                    <p className="mb-4 text-xs text-amber-800/90 dark:text-amber-200/80">
                                        Kosongkan jika tidak ingin mengubah password. Hanya admin sistem yang dapat mengisi bagian ini.
                                    </p>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Password baru</label>
                                            <PasswordInput
                                                id="user-new_password"
                                                value={editingUser.new_password || ''}
                                                onChange={handleInputChange}
                                                placeholder="••••••••"
                                                autoComplete="new-password"
                                                className="py-6"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Konfirmasi password</label>
                                            <PasswordInput
                                                id="user-new_password_confirm"
                                                value={editingUser.new_password_confirm || ''}
                                                onChange={handleInputChange}
                                                placeholder="••••••••"
                                                autoComplete="new-password"
                                                className="py-6"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">System Role</label>
                                    <Select value={editingUser.role_id?.toString()} onValueChange={(value) => setEditingUser(prev => ({ ...prev, role_id: value }))} required>
                                        <SelectTrigger className="h-12">
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roles.map(role => (
                                                <SelectItem key={role.id} value={role.id.toString()}>{role.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Account Status</label>
                                    <Select value={editingUser.status} onValueChange={(value) => setEditingUser(prev => ({ ...prev, status: value }))} required>
                                        <SelectTrigger className="h-12">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Active">Active</SelectItem>
                                            <SelectItem value="Inactive">Inactive</SelectItem>
                                            <SelectItem value="Suspended">Suspended</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter className="mt-4 border-t border-slate-200/50 dark:border-slate-700/50 pt-4">
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost">Cancel</Button>
                                </DialogClose>
                                <Button type="submit" disabled={isSubmitting} className="bg-[#00529C] hover:bg-[#00417C] text-white shadow-lg shadow-blue-900/20 transition-all">
                                    {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                                    Update User
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
