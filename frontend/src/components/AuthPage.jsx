import React, { useState } from 'react';
import { FileText, Lock, User, LogOut, CheckCircle2, Mail } from 'lucide-react';

const AuthPage = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const endpoint = isLogin ? 'http://localhost:8100/auth/login' : 'http://localhost:8100/auth/register';
        const payload = isLogin
            ? { email: formData.email, password: formData.password }
            : { name: formData.name, email: formData.email, password: formData.password };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new BadRequestException(data.message || 'Xəta baş verdi');
            }

            // If login/register is successful
            if (onLogin) {
                onLogin(data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-slate-50 font-sans">
            {/* Left Side - Visual/Marketing */}
            <div className="hidden lg:flex lg:w-1/2 bg-slate-900 p-12 flex-col justify-between relative overflow-hidden">
                {/* Abstract Background Shapes */}
                <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl opacity-50" />
                <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl opacity-30" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 text-white mb-12">
                        <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
                            <FileText size={28} className="text-white" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight">Smart Report AI</span>
                    </div>

                    <div className="space-y-6">
                        <h1 className="text-5xl font-bold text-white leading-tight">
                            Süni intellekt ilə <br />
                            <span className="text-indigo-400">ağıllı hesabatlar</span> <br />
                            indi daha sadədir.
                        </h1>
                        <p className="text-slate-400 text-lg max-w-md leading-relaxed">
                            Mürəkkəb excel cədvəllərini saniyələr içində analiz edin, fərqlilikləri tapın və dəqiq hesabatlar hazırlayın.
                        </p>
                    </div>
                </div>

                <div className="relative z-10 mt-auto">
                    <p className="text-slate-500 text-sm">
                        &copy; 2026 Smart Report AI. Bütün hüquqlar qorunur.
                    </p>
                </div>
            </div>

            {/* Right Side - Auth Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
                {/* Mobile Logo */}
                <div className="absolute top-8 left-8 lg:hidden flex items-center gap-2">
                    <div className="p-2 bg-indigo-600 rounded-lg">
                        <FileText size={20} className="text-white" />
                    </div>
                    <span className="font-bold text-slate-900 text-lg">Smart Report AI</span>
                </div>

                <div className="w-full max-w-md space-y-8 animate-fade-in">
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-extrabold text-slate-900">
                            {isLogin ? 'Xoş gəlmisiniz' : 'Hesab yaradın'}
                        </h2>
                        <p className="mt-2 text-slate-500 text-sm">
                            {isLogin
                                ? 'Sistemə daxil olmaq üçün məlumatlarınızı daxil edin'
                                : 'Başlamaq üçün bir neçə məlumatınızı bizimlə paylaşın'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                        {!isLogin && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
                                    Ad Soyad
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                                        <User size={18} />
                                    </div>
                                    <input
                                        name="name"
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="block w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                                        placeholder="Elvin Məmmədov"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
                                E-poçt ünvanı
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                                    <Mail size={18} />
                                </div>
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="block w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                                    placeholder="name@company.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Şifrə
                                </label>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                                    <Lock size={18} />
                                </div>
                                <input
                                    name="password"
                                    type="password"
                                    required
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="block w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-rose-50 text-rose-600 px-4 py-3 rounded-xl text-xs font-medium border border-rose-100 flex items-center gap-2 animate-shake">
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100 shadow-xl shadow-slate-900/10"
                        >
                            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Lock size={18} className="text-slate-500 group-hover:text-slate-400 transition-colors" />
                                )}
                            </span>
                            {loading ? 'Yüklənir...' : (isLogin ? 'Daxil ol' : 'Hesab yarat')}
                        </button>
                    </form>


                    <div className="text-center pt-2">
                        <button
                            type="button"
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors group"
                        >
                            {isLogin ? 'Hesabınız yoxdur?' : 'Artıq hesabınız var?'}
                            <span className="text-indigo-600 font-bold ml-1 group-hover:underline">
                                {isLogin ? 'Qeydiyyatdan keçin' : 'Daxil olun'}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
