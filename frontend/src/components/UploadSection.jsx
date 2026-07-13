import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, RefreshCw, ArrowUp, FileText, Info, X } from 'lucide-react';

const UploadSection = ({ onAuditStart, isAuditing, selectedModel, setSelectedModel }) => {
  const [systemFile, setSystemFile] = useState(null);
  const [physicalFile, setPhysicalFile] = useState(null);

  const [customPrompt, setCustomPrompt] = useState('');
  const [showRulesModal, setShowRulesModal] = useState(false);

  const systemInputRef = useRef(null);
  const physicalInputRef = useRef(null);

  const handleSystemFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSystemFile(e.target.files[0]);
    }
  };

  const handlePhysicalFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setPhysicalFile(e.target.files[0]);
    }
  };

  const triggerSystemUpload = () => {
    // If we want to simulate file choosing if they don't upload a real file, we can also support that
    systemInputRef.current.click();
  };

  const triggerPhysicalUpload = () => {
    physicalInputRef.current.click();
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDropSystem = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSystemFile(e.dataTransfer.files[0]);
    }
  };

  const handleDropPhysical = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setPhysicalFile(e.dataTransfer.files[0]);
    }
  };

  const handleAuditClick = () => {
    const hasPrompt = customPrompt && customPrompt.trim();
    if (!systemFile && !physicalFile && !hasPrompt) {
      alert('Ən azı bir fayl yükləyin və ya xüsusi təlimat yazın.');
      return;
    }
    onAuditStart(systemFile, physicalFile, customPrompt, selectedModel);
  };



  const resetFiles = () => {
    setSystemFile(null);
    setPhysicalFile(null);
    setCustomPrompt('');
    // Native input-ların value-sunu sıfırla ki, eyni faylı yenidən seçəndə onChange işləsin
    if (systemInputRef.current) systemInputRef.current.value = '';
    if (physicalInputRef.current) physicalInputRef.current.value = '';
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

        {/* Left Column: File Upload Boxes (7 spans) */}
        <div className="lg:col-span-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
            {/* System File Upload */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDropSystem}
              className={`
                border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[170px]
                ${systemFile
                  ? 'border-indigo-400 bg-indigo-50/20'
                  : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50'
                }
              `}
              onClick={triggerSystemUpload}
            >
              <input
                type="file"
                ref={systemInputRef}
                onChange={handleSystemFileChange}
                className="hidden"
                accept=".csv,.xlsx,.xls,.pdf"
              />
              {systemFile ? (
                <div className="flex flex-col items-center animate-fade-in">
                  <div className="p-3 bg-indigo-50 rounded-full text-indigo-600 mb-3 border border-indigo-100">
                    {systemFile.name.toLowerCase().endsWith('.pdf') ? (
                      <FileText size={28} />
                    ) : (
                      <FileSpreadsheet size={28} />
                    )}
                  </div>
                  <span className="font-semibold text-sm text-slate-800 break-all max-w-[200px]">
                    {systemFile.name}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    {(systemFile.size / 1024).toFixed(1)} KB • Hazırdır
                  </span>
                  <div className="mt-3 flex items-center gap-1 text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-1 rounded-md">
                    <CheckCircle2 size={12} /> Sistem Faylı
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="p-3.5 bg-slate-50 rounded-full text-slate-400 mb-3 border border-slate-100">
                    <UploadCloud size={28} className="text-slate-500" />
                  </div>
                  <span className="font-semibold text-sm text-slate-700">Sistem Faylını Yüklə</span>
                  <p className="text-xs text-slate-400 mt-2 max-w-[180px] leading-relaxed">
                    Excel/CSV/PDF fayllarını sürükləyib buraxın və ya seçin
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerSystemUpload();
                    }}
                    className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Fayl Seçin
                  </button>
                </div>
              )}
            </div>

            {/* Physical File Upload */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDropPhysical}
              className={`
                border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[170px]
                ${physicalFile
                  ? 'border-indigo-400 bg-indigo-50/20'
                  : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50'
                }
              `}
              onClick={triggerPhysicalUpload}
            >
              <input
                type="file"
                ref={physicalInputRef}
                onChange={handlePhysicalFileChange}
                className="hidden"
                accept=".csv,.xlsx,.xls,.pdf"
              />
              {physicalFile ? (
                <div className="flex flex-col items-center animate-fade-in">
                  <div className="p-3 bg-indigo-50 rounded-full text-indigo-600 mb-3 border border-indigo-100">
                    {physicalFile.name.toLowerCase().endsWith('.pdf') ? (
                      <FileText size={28} />
                    ) : (
                      <FileSpreadsheet size={28} />
                    )}
                  </div>
                  <span className="font-semibold text-sm text-slate-800 break-all max-w-[200px]">
                    {physicalFile.name}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    {(physicalFile.size / 1024).toFixed(1)} KB • Hazırdır
                  </span>
                  <div className="mt-3 flex items-center gap-1 text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-1 rounded-md">
                    <CheckCircle2 size={12} /> Fiziki Fayl
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="p-3.5 bg-slate-50 rounded-full text-slate-400 mb-3 border border-slate-100">
                    <UploadCloud size={28} className="text-slate-550" />
                  </div>
                  <span className="font-semibold text-sm text-slate-700">Fiziki Faylı Yüklə</span>
                  <p className="text-xs text-slate-450 mt-2 max-w-[180px] leading-relaxed">
                    Excel/CSV/PDF fayllarını sürükləyib buraxın və ya seçin
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerPhysicalUpload();
                    }}
                    className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Fayl Seçin
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Custom Prompt & Action Buttons (5 spans) */}
        <div className="lg:col-span-5 flex flex-col justify-between h-full space-y-4 border-t lg:border-t-0 lg:border-l border-slate-100 pt-5 lg:pt-0 lg:pl-6">
          {/* Custom Prompt Input with Integrated Model Selector */}
          <div className="flex-1 flex flex-col min-h-[160px]">
            <label className="block text-xs font-bold text-slate-650 uppercase tracking-wide mb-1.5">
              Xüsusi Təlimat / Prompt (İxtiyari)
            </label>
         
            <div className="relative flex-1 group">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Məsələn: Yalnız 'yüksək' ciddilikdə olan fərqlilikləri tap, kritik xətaları və ya seçili meyarları yoxla...."
                className="w-full h-full px-4 py-3 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500/50 resize-none transition-all placeholder:text-slate-400 bg-slate-50/30"
                disabled={isAuditing}
              />

              {/* Absolute positioned Controls (Model + Audit Button) */}
              <div className="absolute bottom-3 right-3 left-3 flex items-center justify-end gap-2 pointer-events-none">
                {/* Model Selector */}
                <div className="pointer-events-auto flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-sm transition-all group-focus-within:border-indigo-200 max-w-[70%] sm:max-w-none overflow-hidden">
                  <span className="hidden sm:inline text-[9px] font-bold text-slate-400 uppercase tracking-wider">Model:</span>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={isAuditing}
                    className="bg-transparent border-none text-[10px] font-black text-slate-700 focus:ring-0 cursor-pointer py-0 pr-5 pl-0 truncate"
                  >
                    <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                  </select>
                </div>

                {/* Audit Send Button */}
                <button
                  onClick={handleAuditClick}
                  disabled={isAuditing}
                  className={`
                    pointer-events-auto w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 active:scale-90 shrink-0
                    ${isAuditing
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-slate-900 text-white hover:shadow-indigo-500/20'
                    }
                  `}
                  title="Analizi başlat"
                >
                  {isAuditing ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <ArrowUp size={20} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Control Buttons - Only Cleanup remains here if needed */}
          <div className="flex justify-between items-center px-1">
            {(systemFile || physicalFile || customPrompt) && (
              <button
                onClick={resetFiles}
                className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-rose-500 font-bold transition-colors"
              >
                Sil
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] text-slate-400 font-medium italic">
                * Ən azı bir fayl seçilməlidir. Ətraflı məlumat üçün qaydaları oxuyun.
              </p>
              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className="p-1 rounded-full hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all"
                title="Qaydalar və Təlimatlar"
              >
                <Info size={14} />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowRulesModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-md rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl">
                  <Info size={20} className="text-indigo-600" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Qaydalar və İstifadə Təlimatları</h3>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-5 text-sm text-slate-600 leading-relaxed">

              {/* Section 1 */}
              <div>
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">📄 Dəstəklənən Fayl Formatları</h4>
                <ul className="space-y-1.5 ml-1">
                  <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span><span><strong>Excel faylları:</strong> .xlsx, .xls formatları tam dəstəklənir. Cədvəl başlıqları və bütün sətrlər avtomatik oxunur.</span></li>
                  <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span><span><strong>CSV faylları:</strong> .csv formatında olan fayllar da yüklənə bilər.</span></li>
                  <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span><span><strong>PDF faylları:</strong> .pdf formatındakı sənədlər dəstəklənir. Mətni avtomatik çıxarılır və AI tərəfindən analiz edilir.</span></li>
                </ul>
              </div>

              {/* Section 2 */}
              <div>
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">📊 Analiz İmkanları</h4>
                <ul className="space-y-1.5 ml-1">
                  <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span><span><strong>Bir fayl analizi:</strong> Tək bir fayl (sistem və ya fiziki) yükləyərək onun məzmununu AI ilə analiz edə bilərsiniz.</span></li>
                  <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span><span><strong>İki fayl müqayisəsi:</strong> Həm sistem, həm də fiziki faylı yükləyərək ikisi arasındakı fərqləri, uyğunsuzluqları təhlil edə bilərsiniz.</span></li>
                  <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span><span><strong>Xüsusi prompt:</strong> Öz təlimatlarınızı yazaraq analizin istiqamətini dəyişdirə, xüsusi meyarlar müəyyən edə bilərsiniz.</span></li>
                  <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span><span><strong>Limitsiz analiz:</strong> İstədiyiniz qədər fərqli fayl və cədvəl üzərində analiz apara bilərsiniz. Hər analiz ayrıca hesabat olaraq saxlanılır.</span></li>
                </ul>
              </div>

              {/* Section 3 */}
              <div>
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">🤖 AI Modelləri</h4>
                <ul className="space-y-1.5 ml-1">
                  <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span><span><strong>Claude Sonnet 4.6 (Expert):</strong> Ən yüksək dəqiqlik və performans. Xüsusilə mürəkkəb xüsusi tələbatlar (custom prompts) və çoxlu kateqoriyalı analizlər üçün ən yaxşı seçimdir.</span></li>
                </ul>
              </div>

              {/* Section 4 */}
              <div>
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">📋 Hesabat və Nəticələr</h4>
                <ul className="space-y-1.5 ml-1">
                  <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span><span>Hər analiz nəticəsi avtomatik olaraq verilənlər bazasında saxlanılır.</span></li>
                  <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span><span>Hesabatlar "Hesabatlar" bölməsində siyahı şəklində göstərilir.</span></li>
                  <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span><span>İstənilən hesabatı Excel formatında (.xlsx) endirə bilərsiniz.</span></li>

                </ul>
              </div>

              {/* Section 5 */}
              <div>
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">⚠️ Vacib Qeydlər</h4>
                <ul className="space-y-1.5 ml-1">
                  <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span>Analiz üçün <strong>ən azı bir fayl</strong> (sistem və ya fiziki) yüklənməlidir.</span></li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span>PDF fayllarında mürəkkəb cədvəl strukturları varsa, nəticələrin dəqiqliyi fərqli ola bilər.</span></li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span>Çox böyük faylların analizi bir qədər uzun çəkə bilər, xüsusilə Sonnet modeli ilə.</span></li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span>Ən yaxşı nəticə üçün faylların düzgün formatda və oxunaqlı olması tövsiyə olunur.</span></li>
                </ul>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowRulesModal(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
              >
                Başa düşdüm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadSection;
