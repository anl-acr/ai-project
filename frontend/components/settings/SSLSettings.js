import React, { useState } from 'react';
import { Shield, Upload, FileKey, FileCheck, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useTheme } from '../../utils/theme';

export default function SSLSettings({ backendHost }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  const [files, setFiles] = useState({
    cert: null,
    key: null,
    ca: null
  });
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileChange = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => ({ ...prev, [type]: e.target.files[0] }));
    }
  };

  const handleUpload = async () => {
    if (!files.cert || !files.key) {
      setErrorMessage("Sertifika (CRT) ve Özel Anahtar (KEY) dosyaları zorunludur.");
      setStatus('error');
      return;
    }

    setStatus('uploading');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('cert', files.cert);
    formData.append('key', files.key);
    if (files.ca) {
      formData.append('ca', files.ca);
    }

    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/settings/ssl`, {
        method: 'POST',
        // Omit headers, fetch will automatically set Content-Type to multipart/form-data with the correct boundary
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Yükleme sırasında bir hata oluştu.');
      }

      setStatus('success');
      setFiles({ cert: null, key: null, ca: null });
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Sunucuya bağlanılamadı.');
      setStatus('error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Shield className={text} size={24} />
            SSL Sertifikaları
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            WebRTC (Web Phone) ve SIP TLS bağlantıları için SSL sertifikalarınızı buradan yükleyebilirsiniz.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Certificate (CRT) */}
            <div className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-200 ${files.cert ? border + " " + lightBg : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"}`}>
              <div className="flex flex-col items-center justify-center text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${files.cert ? bg + " text-white shadow-lg" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                  <FileCheck size={24} />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-1">Sertifika (.crt, .pem)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-[200px]">Sunucu sertifikanız (Public Key).</p>
                <input 
                  type="file" 
                  id="cert-upload"
                  className="hidden" 
                  accept=".crt,.pem,.cer" 
                  onChange={(e) => handleFileChange(e, 'cert')}
                />
                <label 
                  htmlFor="cert-upload" 
                  className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${files.cert ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-slate-700" : bg + " hover:bg-opacity-90 text-white shadow-md shadow-primary/20"}`}
                >
                  {files.cert ? files.cert.name : 'Dosya Seç'}
                </label>
              </div>
            </div>

            {/* Private Key */}
            <div className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-200 ${files.key ? border + " " + lightBg : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"}`}>
              <div className="flex flex-col items-center justify-center text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${files.key ? bg + " text-white shadow-lg" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                  <FileKey size={24} />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-1">Özel Anahtar (.key)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-[200px]">Sertifikanıza ait Private Key.</p>
                <input 
                  type="file" 
                  id="key-upload"
                  className="hidden" 
                  accept=".key,.pem" 
                  onChange={(e) => handleFileChange(e, 'key')}
                />
                <label 
                  htmlFor="key-upload" 
                  className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${files.key ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-slate-700" : bg + " hover:bg-opacity-90 text-white shadow-md shadow-primary/20"}`}
                >
                  {files.key ? files.key.name : 'Dosya Seç'}
                </label>
              </div>
            </div>

          </div>

          {/* CA Bundle (Optional) */}
          <div className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-200 ${files.ca ? border + " " + lightBg : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"}`}>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${files.ca ? bg + " text-white shadow-lg" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                <Shield size={24} />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-1">CA Bundle / Chain (Opsiyonel)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Ara sertifikalarınız (Intermediate CA). Çoğu cihazın sertifikanızı güvenli olarak tanıması için önerilir.</p>
              </div>
              <input 
                type="file" 
                id="ca-upload"
                className="hidden" 
                accept=".crt,.pem,.ca-bundle" 
                onChange={(e) => handleFileChange(e, 'ca')}
              />
              <label 
                htmlFor="ca-upload" 
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all shrink-0 ${files.ca ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-slate-700" : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"}`}
              >
                {files.ca ? files.ca.name : 'İsteğe Bağlı Yükle'}
              </label>
            </div>
          </div>

          {status === 'error' && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-start gap-3">
              <AlertCircle className="text-rose-500 mt-0.5 shrink-0" size={18} />
              <div className="text-sm text-rose-600 dark:text-rose-400">
                <span className="font-semibold block mb-1">Yükleme Başarısız</span>
                {errorMessage}
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="text-emerald-500 mt-0.5 shrink-0" size={18} />
              <div className="text-sm text-emerald-600 dark:text-emerald-400">
                <span className="font-semibold block mb-1">Sertifikalar Yüklendi</span>
                Sertifikalarınız başarıyla sisteme aktarıldı. Değişikliklerin etkili olması için PBX servisinin sertifikaları yeniden okuması gerekebilir.
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleUpload}
              disabled={status === 'uploading' || !files.cert || !files.key}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md ${
                status === 'uploading' || !files.cert || !files.key
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none"
                  : bg + " " + hover + " text-white shadow-primary/20"
              }`}
            >
              {status === 'uploading' ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Yükleniyor...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Sertifikaları Kaydet
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
