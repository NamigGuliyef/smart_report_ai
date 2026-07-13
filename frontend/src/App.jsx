import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardCards from './components/DashboardCards';
import UploadSection from './components/UploadSection';
import AccuracyChart from './components/AccuracyChart';
import AuthPage from './components/AuthPage';

import {
  CheckCircle2,
  Settings as SettingsIcon,
  BarChart3,
  ShieldAlert,
  FileSpreadsheet,
  Download,
  Trash2
} from 'lucide-react';



const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lang, setLang] = useState('az'); // 'az' or 'en'
  const [user, setUser] = useState(null); // Auth user state

  // Dashboard stats state — starts empty, populated from API
  const [totalItems, setTotalItems] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [discrepancies, setDiscrepancies] = useState(0);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true); // Loading state for dashboard

  // Audit loading states
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditStep, setAuditStep] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Model selection
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-6');

  // Real data from API responses
  const [auditResult, setAuditResult] = useState(null); // latest API response
  const [allAudits, setAllAudits] = useState([]); // all audits from DB
  const [selectedAudit, setSelectedAudit] = useState(null); // selected audit for detail view
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [isComparisonMode, setIsComparisonMode] = useState(false);

  const latestAudit = allAudits?.length
    ? allAudits.reduce((latest, audit) => {
        return new Date(audit.createdAt) > new Date(latest.createdAt) ? audit : latest;
      }, allAudits[0])
    : null;

  // Fetch all audits from /analys/all/:userId
  const fetchAllAudits = useCallback(async () => {
    if (!user?._id) return;
    try {
      const res = await fetch(`/api/analys/all/${user._id}`);
      if (res.ok) {
        const data = await res.json();
        setAllAudits(data);
      }
    } catch (err) {
      console.error('Auditləri yükləmək mümkün olmadı:', err);
    }
  }, [user?._id]);

  // Sonuncu cədvəl qarşılaşdırma nəticəsini çək (qalıcı card data)
  const fetchLastComparisonStats = useCallback(async () => {
    if (!user?._id) return;
    setIsDashboardLoading(true);
    try {
      const res = await fetch(`/api/user/last-comparison/${user._id}`);
      if (res.ok) {
        const stats = await res.json();
        if (stats.hasData) {
          setAccuracy(stats.accuracy);
          setDiscrepancies(stats.discrepancies);
          setTotalItems(stats.totalItems);
          // Son audit tarixini göstərmək üçün auditResult-u set et
          if (stats.lastAuditDate) {
            setAuditResult(prev => prev || { createdAt: stats.lastAuditDate });
          }
        }
      }
    } catch (err) {
      console.error('Son qarşılaşdırma statistikasını yükləmək mümkün olmadı:', err);
    } finally {
      setIsDashboardLoading(false);
    }
  }, [user?._id]);

  // Fetch audits and last comparison stats on mount
  useEffect(() => {
    fetchAllAudits();
    fetchLastComparisonStats();
  }, [fetchAllAudits, fetchLastComparisonStats]);

  const t = {
    az: {
      dashboardTitle: "Smart Report AI Paneli",
      auditLogs: [
        "Məlumatlar toplanır .. 🔍",
        "Fayl analizləri başladılır...⚖️",
        "Dəqiq hesabat hazırlanır... 📝"
      ],
      toastSuccess: "Audit uğurla tamamlandı! Panel göstəriciləri yeniləndi.",
      reportsTitle: "Hesabatlar və Analitika",
      settingsTitle: "Tolerans və Audit Ayarları",
      noPage: "Bu bölmə üzərində iş gedir.",
      langBtn: "English",
      runSim: "Yeni Audit Simulyasiyası Başlat"
    },
    en: {
      dashboardTitle: "Inventory Audit Dashboard",
      auditLogs: [
        "Gathering data... 🔍",
        "Starting analysis between 2 files... ⚖️",
        "Preparing detailed report... 📝"
      ],
      toastSuccess: "Audit completed successfully! Dashboard metrics updated.",
      reportsTitle: "Reports & Analytics",
      settingsTitle: "Tolerance & Audit Settings",
      noPage: "This section is currently under development.",
      langBtn: "Azərbaycanca",
      runSim: "Run New Audit Simulation"
    }
  }[lang];

  // Audit progress percentage
  const [auditProgress, setAuditProgress] = useState(0);

  // Audit Trigger Handler — real API call
  const handleAuditStart = async (systemFileObj, physicalFileObj, customPrompt, selectedModel) => {
    const isTwoFileComparison = Boolean(systemFileObj && physicalFileObj);
    setIsComparisonMode(isTwoFileComparison);
    setIsAuditing(true);
    setAuditProgress(0);
    setAuditStep(t.auditLogs[0]);

    // Build FormData with the available files
    const formData = new FormData();
    if (systemFileObj) {
      formData.append('systemFile', systemFileObj);
    }
    if (physicalFileObj) {
      formData.append('physicalFile', physicalFileObj);
    }
    formData.append('model', selectedModel);
    if (customPrompt) {
      formData.append('customPrompt', customPrompt);
    }
    if (user?._id) {
      formData.append('userId', user._id);
      formData.append('userName', user.name || '');
    }

    // Show progress steps and percentage while waiting
    let stepIdx = 1;
    const interval = setInterval(() => {
      setAuditProgress(prev => {
        if (prev < 92) return prev + Math.floor(Math.random() * 8) + 2;
        return prev;
      });

      if (stepIdx < t.auditLogs.length) {
        setAuditStep(t.auditLogs[stepIdx]);
        stepIdx++;
      }
    }, 1000);

    try {
      const res = await fetch('/api/analys/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(interval);
      setAuditProgress(100);

      if (!res.ok) {
        throw new BadRequestException(`Server xətası: ${res.status}`);
      }

      const result = await res.json();
      setAuditResult(result);
      await fetchAllAudits();

      // Update dashboard
      const aiData = result.dataContent;
      if (aiData && isTwoFileComparison) {
        setDiscrepancies(aiData.discrepancies?.length ?? 0);
        setAccuracy(aiData.data_quality_score ?? 0);
        setTotalItems(aiData.discrepancies?.length ?? 0);
      } else {
        setDiscrepancies(0);
        setAccuracy(0);
        setTotalItems(0);
      }

      setToastMessage(
        customPrompt && customPrompt.trim()
          ? (!systemFileObj && !physicalFileObj
            ? "Xüsusi təlimat əsasında cədvəl uğurla yaradıldı!"
            : "Xüsusi analiz uğurla tamamlandı! Nəticəni 'Hesabatlar' bölməsindən görə bilərsiniz.")
          : t.toastSuccess
      );
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } catch (err) {
      clearInterval(interval);
      setToastMessage(`Xəta baş verdi: ${err.message}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    } finally {
      setTimeout(() => {
        setIsAuditing(false);
        setAuditStep('');
        setAuditProgress(0);
      }, 500);
    }
  };

  const handleLogin = (userData) => {
    const userToSet = userData.user || userData;
    setUser(userToSet);
    localStorage.setItem('user', JSON.stringify(userToSet));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const handleDeleteAudit = async (auditId) => {
    try {
      const res = await fetch(`/api/user/${auditId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new BadRequestException(`Silinmə uğursuz oldu: ${res.status}`);
      }

      await fetchAllAudits();
      setAllAudits((prev) => prev.filter((audit) => audit._id !== auditId));
      if (selectedAudit?._id === auditId) {
        setSelectedAudit(null);
      }

      setToastMessage('Hesabat uğurla silindi.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      setToastMessage(`Xəta baş verdi: ${err.message}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } finally {
      setDeleteCandidate(null);
    }
  };

  const confirmDeleteAudit = (audit) => {
    setDeleteCandidate(audit);
  };

  const cancelDeleteAudit = () => {
    setDeleteCandidate(null);
  };

  // Check for saved user on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser && savedUser !== 'undefined') {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
  }, []);

  if (!user) {
    return (
      <div id="auth-root">
        <AuthPage onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 antialiased font-sans">
      {/* Sidebar Panel */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header bar */}
        <Header user={user} onLogout={handleLogout} />

        {/* Global Toast Alert */}
        {showToast && (
          <div className="absolute top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in border border-emerald-500">
            <CheckCircle2 size={18} className="text-emerald-100" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Delete confirmation modal */}
        {deleteCandidate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
            <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 text-slate-900">
              <div className="text-center">
                <h3 className="text-xl font-bold mb-2">Hesabatı silmək</h3>
                <p className="text-sm text-slate-600 mb-6">
                  “{deleteCandidate.fileName || 'seçilmiş hesabat'}” hesabatını silmək istədiyinizə əminsiniz?
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:justify-center">
                <button
                  onClick={() => handleDeleteAudit(deleteCandidate._id)}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-rose-600 text-white font-semibold hover:bg-rose-700 transition"
                >
                  Bəli
                </button>
                <button
                  onClick={cancelDeleteAudit}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
                >
                  Xeyr
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Body */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 pt-16">

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Header Title */}
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                    {t.dashboardTitle}
                  </h1>
                  {(latestAudit || auditResult) && (
                    <p className="text-xs text-slate-550 mt-1">
                      Son hesabat/təhlil: {new Date(latestAudit?.createdAt || auditResult?.createdAt || Date.now()).toLocaleString('az-AZ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Top Section: Cards & Accuracy Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Metrics Cards */}
                <div className="lg:col-span-8">
                  <DashboardCards
                    totalItems={totalItems}
                    accuracy={accuracy}
                    discrepancies={discrepancies}
                    isLoading={isDashboardLoading}
                    showComparisonMetrics={isComparisonMode}
                  />
                </div>
                {/* Accuracy Doughnut Chart */}
                <div className="lg:col-span-4">
                  <AccuracyChart
                    accuracy={accuracy}
                    isInitial={!isComparisonMode}
                    showComparisonMetrics={isComparisonMode}
                  />
                </div>
              </div>

              {/* Main Grid: Upload Section */}
              <div className="relative">
                <UploadSection onAuditStart={handleAuditStart} selectedModel={selectedModel} setSelectedModel={setSelectedModel} isAuditing={isAuditing} />

                {/* Audit Progress Overlay */}
                {isAuditing && (
                  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-white p-6 transition-all duration-500 animate-in fade-in zoom-in-95">
                    <div className="bg-slate-900/80 p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center max-w-sm w-full">
                      <div className="relative flex items-center justify-center mb-6">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-400"></div>
                        <div className="absolute text-indigo-300 font-bold text-xs">
                          {auditProgress}%
                        </div>
                      </div>

                      <div className="text-center space-y-2 mb-6">
                        <span className="text-sm font-bold tracking-wide text-white block">
                          {auditStep || 'Sənədlər analiz edilir...'}
                        </span>
                        <p className="text-[10px] text-slate-400 font-medium px-4">
                          Süni intellekt cədvəlləri sətir-sətir oxuyur və uyğunsuzluqları təhlil edir.
                        </p>
                      </div>

                      {/* Progress Bar Container */}
                      <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500 ease-out rounded-full"
                          style={{ width: `${auditProgress}%` }}
                        ></div>
                      </div>
                      <div className="w-full flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <span>Başladıldı</span>
                        <span>{auditProgress}% Tamamlanıb</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}



          {/* Hesabatlar — all audits from DB */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-650">
                      <BarChart3 size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-850">{t.reportsTitle}</h2>
                      <p className="text-xs text-slate-450">Bütün audit nəticələri və analiz cədvəlləri</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 font-semibold">
                    {allAudits.length} hesabat
                  </span>
                </div>

                {allAudits.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <BarChart3 size={44} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">Hələ analiz nəticəsi yoxdur</p>
                    <p className="text-xs mt-1">Dashboard-dan audit başladın, nəticələr burada görünəcək</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
                    <div className="space-y-3 min-w-[600px] lg:min-w-full">
                      {allAudits.map((audit) => (
                        <div key={audit._id} className="border border-slate-100 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-sm">
                          {/* Audit header row — clickable */}
                          <button
                            onClick={() => setSelectedAudit(selectedAudit?._id === audit._id ? null : audit)}
                            className="w-full flex justify-between items-center p-4 hover:bg-slate-50/50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <FileSpreadsheet className="text-indigo-500 flex-shrink-0" size={20} />
                              <div>
                                <p className="text-sm font-bold text-slate-800">{audit.fileName || 'Audit hesabatı'}</p>
                                <p className="text-xs text-slate-450">
                                  {audit.metadata?.user || 'Test User'} • {new Date(audit.createdAt || Date.now()).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {audit.metadata?.customPrompt ? (
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-150 px-2.5 py-1 rounded-md font-bold">
                                  Xüsusi Analiz
                                </span>
                              ) : (
                                <>
                                  <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-md font-bold">
                                    {audit.dataContent?.discrepancies?.length || 0} fərq
                                  </span>
                                  <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-md font-bold">
                                    Dəqiqlik: {audit.dataContent?.data_quality_score ?? '—'}%
                                  </span>
                                </>
                              )}
                              {audit.metadata?.model && (
                                <span className="text-[10px] bg-slate-100/80 text-slate-650 border border-slate-200 px-2.5 py-1 rounded-md font-extrabold">
                                  {'Claude Sonnet'}
                                </span>
                              )}
                              <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-100">
                                Təhlil olundu
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmDeleteAudit(audit);
                                }}
                                className="p-2.5 hover:bg-rose-100 text-rose-600 rounded-xl transition-all hover:scale-110 active:scale-95 bg-rose-50 border border-rose-100 shadow-sm"
                                title="Hesabatı sil"
                              >
                                <Trash2 size={16} />
                              </button>
                              <a
                                href={`/api/analys/download/${audit._id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-2.5 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all hover:scale-110 active:scale-95 bg-emerald-50 border border-emerald-100 shadow-sm"
                                title="Excel olaraq yüklə"
                              >
                                <Download size={16} />
                              </a>
                            </div>
                          </button>

                          {/* Expanded discrepancies table */}
                          {selectedAudit?._id === audit._id && (audit.dataContent?.discrepancies?.length > 0 || audit.dataContent?.recommendations?.length > 0) && (
                            <div className="border-t border-slate-100 bg-slate-50/30 p-4 animate-fade-in overflow-x-auto">
                              {audit.dataContent.context && (
                                <p className="text-xs text-slate-550 mb-3 italic font-medium">{audit.dataContent.context}</p>
                              )}
                              {(() => {
                                const discrepancies = audit.dataContent?.discrepancies || [];
                                const hasDiscrepancies = discrepancies.length > 0;
                                const firstRow = discrepancies[0] || {};
                                const rowKeys = Object.keys(firstRow);

                                // Standard key fields
                                const standardKeys = [
                                  'code', 'product_file1', 'product_file2', 'unit',
                                  'qty_file1', 'qty_file2', 'diff', 'status_recommendation',
                                  'item', 'issue', 'severity'
                                ];

                                // Check if we have custom keys (indicating a custom prompt layout)
                                const hasCustomKeys = rowKeys.length > 0 && rowKeys.some(k => !standardKeys.includes(k));

                                if (hasCustomKeys) {
                                  return (
                                    <table className="w-full min-w-[1000px] text-left text-xs border border-slate-200 rounded-lg overflow-hidden border-collapse bg-white">
                                      <thead>
                                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                                          {rowKeys.map((key) => (
                                            <th key={key} className="px-3 py-2.5 font-semibold border-r border-slate-200 capitalize">
                                              {key}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-200">
                                        {discrepancies.map((row, idx) => (
                                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            {rowKeys.map((key) => (
                                              <td key={key} className="px-3 py-2.5 text-slate-650 border-r border-slate-200">
                                                {row[key] !== undefined && row[key] !== null ? String(row[key]) : '—'}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  );
                                }

                                if (!hasDiscrepancies) {
                                  return (
                                    <div className="py-8 text-center text-slate-600">
                                      <p className="text-sm font-semibold">Bu hesabatda fərq tapılmadı.</p>
                                      <p className="text-xs text-slate-500 mt-2">Lakin ümumi tövsiyələr və yekun nəticələr mövcuddur.</p>
                                    </div>
                                  );
                                }

                                // Otherwise, render standard comparative table
                                return (
                                  <table className="w-full min-w-[1000px] text-left text-xs border border-slate-200 rounded-lg overflow-hidden border-collapse bg-white">
                                    <thead>
                                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                                        <th className="px-3 py-2.5 font-semibold border-r border-slate-200">Kod</th>
                                        <th className="px-3 py-2.5 font-semibold border-r border-slate-200">Məhsul-Əlavə1 cədvəli</th>
                                        <th className="px-3 py-2.5 font-semibold border-r border-slate-200">Məhsul-Əlavə2 cədvəli</th>
                                        <th className="px-3 py-2.5 font-semibold border-r border-slate-200">vahid</th>
                                        <th className="px-3 py-2.5 font-semibold border-r border-slate-200 text-right">Miqdar -Əlavə1 cədvəli</th>
                                        <th className="px-3 py-2.5 font-semibold border-r border-slate-200 text-right">Miqdar -Əlavə2 cədvəli</th>
                                        <th className="px-3 py-2.5 font-semibold border-r border-slate-200 text-right">Fərq</th>
                                        <th className="px-3 py-2.5 font-semibold">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                      {discrepancies.map((row, idx) => {
                                        // Backwards compatibility mapping for old records
                                        const code = row.code || (row.item ? row.item.split(' - ')[0] : '—');
                                        const product_file1 = row.product_file1 || (row.item ? row.item.split(' - ')[1] || row.item : '—');
                                        const product_file2 = row.product_file2 || (row.item ? row.item.split(' - ')[1] || row.item : '—');
                                        const unit = row.unit || 'əd';
                                        const qty_file1 = row.qty_file1 !== undefined ? row.qty_file1 : '—';
                                        const qty_file2 = row.qty_file2 !== undefined ? row.qty_file2 : '—';
                                        const diff = row.diff !== undefined ? row.diff : '—';
                                        const status_recommendation = row.status_recommendation || row.issue || '—';

                                        return (
                                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-3 py-2.5 font-medium text-slate-800 border-r border-slate-200 whitespace-nowrap">{code}</td>
                                            <td className="px-3 py-2.5 text-slate-650 border-r border-slate-200">{product_file1}</td>
                                            <td className="px-3 py-2.5 text-slate-650 border-r border-slate-200">{product_file2}</td>
                                            <td className="px-3 py-2.5 text-slate-550 border-r border-slate-200">{unit}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-700 border-r border-slate-200">{qty_file1}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-700 border-r border-slate-200">{qty_file2}</td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-rose-600 border-r border-slate-200">{diff}</td>
                                            <td className="px-3 py-2.5 text-slate-600 italic">{status_recommendation}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                );
                              })()}
                              {audit.dataContent.recommendations?.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-slate-200">
                                  <p className="text-xs font-bold text-slate-600 mb-2">Ümumi Tövsiyələr:</p>
                                  <ul className="space-y-1">
                                    {audit.dataContent.recommendations.map((rec, i) => (
                                      <li key={i} className="text-xs text-slate-500 flex items-start gap-2">
                                        <span className="text-indigo-500 mt-0.5">•</span>
                                        {rec}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Settings Page */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-3 bg-slate-100 rounded-2xl text-slate-700">
                  <SettingsIcon size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-850">{t.settingsTitle}</h2>
                  <p className="text-xs text-slate-450">Tolerans limitləri və xəbərdarlıq ayarları</p>
                </div>
              </div>

              <div className="max-w-xl space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Tolerans Limiti (%)</label>
                  <p className="text-xs text-slate-400 mb-2">Bu faizdən yuxarı fərq olduqda, sistem avtomatik xəbərdarlıq edir.</p>
                  <input type="number" defaultValue="2" className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Avtomatik Təsdiqləmə</label>
                  <p className="text-xs text-slate-400 mb-2">Fərqlilik sıfır (0) olan auditləri avtomatik arxivləşdir.</p>
                  <input type="checkbox" defaultChecked className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default App;
