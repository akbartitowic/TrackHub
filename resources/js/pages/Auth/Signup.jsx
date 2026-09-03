import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import AppLogo from '../../components/AppLogo';

export default function Signup() {
    const { signup } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState({ name: '', email: '', password: '', password_confirmation: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (data.password !== data.password_confirmation) {
            setError("Passwords do not match");
            setIsLoading(false);
            return;
        }

        try {
            const res = await signup(data);
            if (res.success) {
                navigate('/');
            } else {
                setError(res.message);
            }
        } catch (err) {
            setError("Registration failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B192C] relative overflow-hidden font-sans p-4">
            <div className="relative z-10 w-full max-w-md">
                <div className="rounded-3xl border border-[#1E3A5F] bg-[#112239] p-6 shadow-2xl sm:p-8">
                    <div className="flex flex-col items-center mb-8">
                        <div className="h-14 px-5 bg-white rounded-2xl flex items-center justify-center mb-4 border border-white/20 shadow-md">
                            <AppLogo alt="MyActivity logo" className="h-9 w-auto object-contain" />
                        </div>
                        <h2 className="text-3xl font-black text-white tracking-tight text-center">Join MyActivity</h2>
                        <p className="text-slate-400 font-medium mt-1">Create your project management account</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-200 text-sm animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="size-5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider ml-1">Full Name</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-[#3FA9F5] transition-colors" />
                                <Input
                                    required
                                    placeholder="John Doe"
                                    className="pl-12 h-12 bg-[#0B192C] border-[#1E3A5F] text-white placeholder:text-slate-500 rounded-2xl focus:ring-[#3FA9F5] focus:border-[#3FA9F5] transition-all"
                                    value={data.name}
                                    onChange={e => setData({ ...data, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider ml-1">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-[#3FA9F5] transition-colors" />
                                <Input
                                    type="email"
                                    required
                                    placeholder="name@company.com"
                                    className="pl-12 h-12 bg-[#0B192C] border-[#1E3A5F] text-white placeholder:text-slate-500 rounded-2xl focus:ring-[#3FA9F5] focus:border-[#3FA9F5] transition-all"
                                    value={data.email}
                                    onChange={e => setData({ ...data, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider ml-1">Password</label>
                                <div className="relative group">
                                    <Lock className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#3FA9F5]" />
                                    <PasswordInput
                                        required
                                        placeholder="••••••••"
                                        className="h-12 rounded-2xl border-[#1E3A5F] bg-[#0B192C] pl-12 text-white placeholder:text-slate-500 transition-all focus:border-[#3FA9F5] focus:ring-[#3FA9F5]"
                                        toggleButtonClassName="text-slate-400 hover:bg-white/10 hover:text-white"
                                        value={data.password}
                                        onChange={e => setData({ ...data, password: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider ml-1">Confirm Password</label>
                                <div className="relative group">
                                    <Lock className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#3FA9F5]" />
                                    <PasswordInput
                                        required
                                        placeholder="••••••••"
                                        className="h-12 rounded-2xl border-[#1E3A5F] bg-[#0B192C] pl-12 text-white placeholder:text-slate-500 transition-all focus:border-[#3FA9F5] focus:ring-[#3FA9F5]"
                                        toggleButtonClassName="text-slate-400 hover:bg-white/10 hover:text-white"
                                        value={data.password_confirmation}
                                        onChange={e => setData({ ...data, password_confirmation: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-12 bg-[#00529C] hover:bg-[#00417C] text-white font-bold rounded-2xl shadow-lg shadow-blue-900/40 transition-all hover:scale-[1.01] active:scale-[0.99] mt-4"
                        >
                            {isLoading ? (
                                <RefreshCcw className="size-5 animate-spin mr-2" />
                            ) : (
                                <UserPlus className="size-5 mr-2" />
                            )}
                            Create Account
                        </Button>

                        <div className="pt-4 text-center">
                            <p className="text-slate-400 text-sm">
                                Already have an account? 
                                <Link to="/login" className="text-[#3FA9F5] font-bold hover:underline ml-2">Login Here</Link>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
