import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, Lock, Save, CheckCircle2, Shield, Code, Bug, Bell, ChevronRight } from 'lucide-react';
import AvatarUpload from '../components/profile/AvatarUpload';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Profile() {
    const { user, updateProfile, setUserDirect } = useAuth();
    const [data, setData] = useState({
        name: user?.name || '',
        nickname: user?.nickname || '',
        email: user?.email || '',
        phone_number: user?.phone_number || '',
        timezone: user?.timezone || 'Asia/Jakarta',
        password: '',
        password_confirmation: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ type: '', text: '' });

        if (data.password && data.password !== data.password_confirmation) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            setIsLoading(false);
            return;
        }

        try {
            const res = await updateProfile(data);
            if (res.success) {
                if (res.forceLogout) {
                    alert('Password changed successfully. All sessions/devices will be logged out — please log in again.');
                    window.location.href = '/login';
                    return;
                }
                setMessage({ type: 'success', text: res.message });
                setData(prev => ({ ...prev, password: '', password_confirmation: '' }));
            } else {
                setMessage({ type: 'error', text: res.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to update profile' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative min-h-full overflow-hidden bg-slate-50 transition-colors duration-200 dark:bg-[#0B192C]">
            <div className="relative z-10 w-full space-y-8 px-4 py-5 sm:px-6 lg:px-8 pb-16">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <User className="size-8 text-primary" />
                        My Profile
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Manage your personal information and security settings.</p>
                </div>
                {(() => {
                    const roleName = user?.role_name || user?.role?.name || 'Member';
                    let RoleIcon = User;
                    let roleClass = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
                    let iconClass = 'text-slate-500';
                    
                    if (roleName.includes('Manager') || roleName.includes('Admin')) { 
                        RoleIcon = Shield; 
                        roleClass = 'bg-purple-100/80 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20'; 
                        iconClass = 'text-purple-600 dark:text-purple-400';
                    } else if (roleName.includes('Developer') || roleName.includes('Programmer')) { 
                        RoleIcon = Code; 
                        roleClass = 'bg-blue-100/80 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'; 
                        iconClass = 'text-blue-600 dark:text-blue-400';
                    } else if (roleName.includes('QA') || roleName.includes('Tester')) { 
                        RoleIcon = Bug; 
                        roleClass = 'bg-amber-100/80 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'; 
                        iconClass = 'text-amber-600 dark:text-amber-400';
                    }

                    return (
                        <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 border ${roleClass}`}>
                            <RoleIcon className={`size-4 ${iconClass}`} />
                            <span className="text-xs font-bold uppercase tracking-wider">{roleName}</span>
                        </div>
                    );
                })()}
            </header>

            {message.text && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top-2 border ${
                    message.type === 'success' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                    {message.type === 'success' ? <CheckCircle2 className="size-5" /> : <Shield className="size-5" />}
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-lg">Account Information</CardTitle>
                            <CardDescription>Basic details associated with your MyActivity account.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Full Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                        <Input
                                            required
                                            className="pl-11 h-11 rounded-xl focus:ring-primary"
                                            value={data.name}
                                            onChange={e => setData({ ...data, name: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                                        Nickname <span className="normal-case text-slate-400 font-normal">(Optional)</span>
                                    </label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                        <Input
                                            className="pl-11 h-11 rounded-xl focus:ring-primary"
                                            placeholder="Nickname"
                                            value={data.nickname}
                                            onChange={e => setData({ ...data, nickname: e.target.value })}
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-400 ml-1">If set, this name is shown in the sidebar.</p>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Phone Number</label>
                                <div className="relative group">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                    <Input
                                        className="pl-11 h-11 rounded-xl focus:ring-primary"
                                        placeholder="+62 8xx xxxx xxxx"
                                        value={data.phone_number}
                                        onChange={e => setData({ ...data, phone_number: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                    <Input
                                        type="email"
                                        required
                                        className="pl-11 h-11 rounded-xl focus:ring-primary"
                                        value={data.email}
                                        onChange={e => setData({ ...data, email: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Timezone</label>
                                <Select
                                    value={data.timezone || 'Asia/Jakarta'}
                                    onValueChange={(value) => setData({ ...data, timezone: value })}
                                >
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue placeholder="Select timezone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Asia/Jakarta">Asia/Jakarta (WIB)</SelectItem>
                                        <SelectItem value="Asia/Makassar">Asia/Makassar (WITA)</SelectItem>
                                        <SelectItem value="Asia/Jayapura">Asia/Jayapura (WIT)</SelectItem>
                                        <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                                        <SelectItem value="UTC">UTC</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Link
                        to="/notification-center"
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                    >
                        <Bell className="size-5 text-primary shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notification Center</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Choose which emails you want to receive.</p>
                        </div>
                        <ChevronRight className="size-4 text-slate-400" />
                    </Link>

                    <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-lg">Change Password</CardTitle>
                            <CardDescription>Leave blank if you don't want to change your password.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">New Password</label>
                                    <div className="relative group">
                                        <Lock className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary" />
                                        <PasswordInput
                                            className="h-11 rounded-xl pl-11 focus-visible:ring-primary"
                                            placeholder="Min. 8 characters"
                                            value={data.password}
                                            onChange={e => setData({ ...data, password: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Confirm New Password</label>
                                    <div className="relative group">
                                        <Lock className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary" />
                                        <PasswordInput
                                            className="h-11 rounded-xl pl-11 focus-visible:ring-primary"
                                            value={data.password_confirmation}
                                            onChange={e => setData({ ...data, password_confirmation: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="h-12 px-8 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                        >
                            {isLoading ? (
                                <RefreshCcw className="size-4 animate-spin mr-2" />
                            ) : (
                                <Save className="size-4 mr-2" />
                            )}
                            Save Changes
                        </Button>
                    </div>
                </div>

                <div className="space-y-6">
                    <Card className="bg-primary/5 border-primary/10 overflow-hidden text-center p-8">
                        <AvatarUpload
                            avatarUrl={user?.avatar_url}
                            name={user?.name}
                            onUpdated={(nextUser) => nextUser && setUserDirect(nextUser)}
                            onError={(msg) => setMessage({ type: 'error', text: msg })}
                        />
                        <h3 className="font-black text-xl text-slate-900 dark:text-white leading-tight">{user?.name}</h3>
                        <p className="text-sm text-slate-500 font-medium">{user?.email}</p>
                        <div className="mt-6 pt-6 border-t border-primary/10">
                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Active Since</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'March 2026'}
                            </p>
                        </div>
                    </Card>
                </div>
            </form>
            </div>
        </div>
    );
}

const RefreshCcw = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></svg>
);
