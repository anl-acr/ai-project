import React, { useState } from 'react';
import { DownloadCloud, UploadCloud, AlertTriangle, Shield, CheckCircle2, AlertCircle, HardDrive, RefreshCw } from 'lucide-react';
import { useTheme } from '../../utils/theme';

export default function BackupRestorePanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [file, setFile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  
  const [status, setStatus] = useState('idle'); // idle, success, error
  const [message, setMessage] = useState('');

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  const handleDownload = async () => {
    setDownloading(true);
    setStatus('idle');
    try {
      const response = await fetch(`${API_BASE}/api/system/backup`);
      if (!response.ok) throw new Error('Yedekleme başarısız oldu.');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Extract filename from header if possible, otherwise use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'ai_pbx_backup.tar.gz';
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      setStatus('success');
      setMessage('Yedek başarıyla oluşturuldu ve indirildi.');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Yedek indirme sırasında bir hata oluştu.');
    } finally {
      setDownloading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleRestore = async () => {
    if (!file) return;
    
    setUploading(true);
    setStatus('idle');
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API_BASE}/api/system/backup/restore`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Geri yükleme başarısız oldu.');
      }
      
      setStatus('success');
      setMessage('Sistem başarıyla geri yüklendi. Değişikliklerin etkili olması için sayfayı yenilemeniz önerilir.');
      setFile(null);
      setConfirmed(false);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Sunucuya bağlanılamadı.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <HardDrive className={text} size={24} />
            Yedekleme ve Geri Yükleme
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Sistem veritabanını ve PBX ayarlarını yedekleyebilir veya önceki bir yedeği geri yükleyebilirsiniz.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Backup Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${lightBg} ${text}`}>
              <DownloadCloud size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Yedek Al (Backup)</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Tüm santral konfigürasyonlarını (Asterisk) ve tam veritabanı yedeğini tek bir sıkıştırılmış dosya (.tar.gz) olarak bilgisayarınıza indirin.
            </p>
          </div>
          
          <button
            onClick={handleDownload}
            disabled={downloading || uploading}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              downloading || uploading
                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                : bg + " " + hover + " text-white shadow-md shadow-primary/20"
            }`}
          >
            {downloading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Yedek Oluşturuluyor...
              </>
            ) : (
              <>
                <DownloadCloud size={18} />
                Yedeği İndir
              </>
            )}
          </button>
        </div>

        {/* Restore Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex flex-col">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-450`}>
            <UploadCloud size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Geri Yükle (Restore)</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
            Daha önce aldığınız bir yedek dosyasını (.tar.gz) seçerek sistemi önceki bir duruma döndürebilirsiniz.
          </p>

          <div className="mt-auto space-y-4">
            <input 
              type="file" 
              id="backup-upload"
              className="hidden" 
              accept=".tar.gz,.gz" 
              onChange={handleFileChange}
            />
            <label 
              htmlFor="backup-upload" 
              className={`w-full flex items-center justify-center px-4 py-3 border-2 border-dashed rounded-xl text-sm font-semibold cursor-pointer transition-all ${
                file 
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400" 
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-300"
              }`}
            >
              {file ? file.name : 'Yedek Dosyası Seç (.tar.gz)'}
            </label>

            {file && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-1">DİKKAT: Tehlikeli İşlem</h4>
                    <p className="text-xs text-amber-700 dark:text-amber-500 mb-3">
                      Geri yükleme işlemi, mevcut tüm veritabanını ve santral ayarlarını silecek ve üzerine yazacaktır. Bu işlem geri alınamaz.
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className={`w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500`}
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      <span className="text-xs font-semibold text-amber-800 dark:text-amber-400">
                        Tüm mevcut verilerimin silinmesini onaylıyorum.
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleRestore}
              disabled={uploading || downloading || !file || !confirmed}
              className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                uploading || downloading || !file || !confirmed
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                  : "bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20"
              }`}
            >
              {uploading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Geri Yükleniyor...
                </>
              ) : (
                <>
                  <Shield size={18} />
                  Sistemi Geri Yükle
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {status === 'error' && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-rose-500 mt-0.5 shrink-0" size={18} />
          <div className="text-sm text-rose-600 dark:text-rose-400">
            <span className="font-semibold block mb-1">İşlem Başarısız</span>
            {message}
          </div>
        </div>
      )}

      {status === 'success' && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-start gap-3">
          <CheckCircle2 className="text-emerald-500 mt-0.5 shrink-0" size={18} />
          <div className="text-sm text-emerald-600 dark:text-emerald-400">
            <span className="font-semibold block mb-1">Başarılı</span>
            {message}
          </div>
        </div>
      )}
    </div>
  );
}
