import { useState } from 'react';
import { Page, User, DocFile } from '../types';
import StatusBar from '../components/StatusBar';
import BottomNav from '../components/BottomNav';
import Toast from '../components/Toast';
import {
  SettingsIcon, ShieldIcon, HelpIcon, LogOutIcon,
  BellIcon, StarIcon, ChevronRightIcon, DocsIcon, AIIcon
} from '../components/Icons';

interface Props {
  user: User;
  docs: DocFile[];
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

type Modal = null | 'settings' | 'privacy' | 'about' | 'help' | 'rate';

export default function ProfilePage({ user, docs, onNavigate, onLogout }: Props) {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode]           = useState(false);
  const [autoSave, setAutoSave]           = useState(true);
  const [toast, setToast]                 = useState<string | null>(null);
  const [modal, setModal]                 = useState<Modal>(null);

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const totalDocs  = docs.length;
  const scanned    = docs.filter(d => ['jpg','png'].includes(d.type)).length;
  const converted  = docs.filter(d => ['pdf','doc','xls','txt'].includes(d.type)).length;

  const handleLogout = () => {
    setToast('Keluar dari akun…');
    setTimeout(onLogout, 1200);
  };

  const handleRate = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Scanin Lah',
        text: 'Coba Scanin Lah – aplikasi scanner dokumen pintar!',
        url: window.location.href,
      }).catch(() => {});
    } else {
      setToast('Terima kasih atas dukunganmu! ⭐');
    }
  };

  const handleContact = () => {
    window.open('mailto:ihyakpati1144@gmail.com?subject=Scanin Lah - Feedback', '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-white page-enter relative">
      <StatusBar />
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* ── MODAL OVERLAY ── */}
      {modal && (
        <div className="absolute inset-0 z-50 bg-black/50 flex flex-col justify-end animate-fade" onClick={() => setModal(null)}>
          <div className="bg-white rounded-t-3xl p-5 max-h-[80%] overflow-y-auto" onClick={e => e.stopPropagation()}>

            {/* Settings */}
            {modal === 'settings' && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-lg font-black text-gray-900">Pengaturan Akun</p>
                  <button onClick={() => setModal(null)} className="text-gray-400 text-xl">✕</button>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nama</p>
                    <div className="bg-gray-50 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-900">{user.name}</div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Email</p>
                    <div className="bg-gray-50 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-900">{user.email}</div>
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Mode Gelap</p>
                      <p className="text-xs text-gray-400">Tampilan gelap (segera hadir)</p>
                    </div>
                    <div
                      onClick={() => setDarkMode(v => !v)}
                      className={`w-10 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${darkMode ? 'bg-gray-900' : 'bg-gray-300'}`}
                      style={{ height: '22px' }}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Simpan Otomatis</p>
                      <p className="text-xs text-gray-400">Simpan dokumen secara otomatis</p>
                    </div>
                    <div
                      onClick={() => { setAutoSave(v => !v); setToast(`Simpan otomatis ${!autoSave ? 'aktif' : 'nonaktif'}`); }}
                      className={`w-10 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${autoSave ? 'bg-gray-900' : 'bg-gray-300'}`}
                      style={{ height: '22px' }}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${autoSave ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Notifikasi</p>
                      <p className="text-xs text-gray-400">Pemberitahuan dokumen baru</p>
                    </div>
                    <div
                      onClick={() => { setNotifications(v => !v); setToast(`Notifikasi ${!notifications ? 'aktif' : 'nonaktif'}`); }}
                      className={`w-10 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${notifications ? 'bg-gray-900' : 'bg-gray-300'}`}
                      style={{ height: '22px' }}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${notifications ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 text-center pt-2">Versi 1.0.0 · Scanin Lah</p>
                </div>
              </>
            )}

            {/* Privacy */}
            {modal === 'privacy' && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-lg font-black text-gray-900">Privasi & Keamanan</p>
                  <button onClick={() => setModal(null)} className="text-gray-400 text-xl">✕</button>
                </div>
                <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
                  <div className="bg-blue-50 rounded-2xl p-4">
                    <p className="font-bold text-blue-800 mb-1">🔒 Data Tersimpan Lokal</p>
                    <p className="text-blue-700 text-xs">Semua dokumen kamu disimpan di perangkat ini saja. Kami tidak mengirim data ke server manapun.</p>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                    <p className="font-bold text-gray-800">Izin yang Digunakan:</p>
                    <p className="text-xs">📷 <span className="font-semibold">Kamera</span> — untuk memindai dokumen</p>
                    <p className="text-xs">🖼️ <span className="font-semibold">Galeri</span> — untuk mengimpor gambar</p>
                    <p className="text-xs">🎤 <span className="font-semibold">Mikrofon</span> — untuk input suara di AI</p>
                    <p className="text-xs">📤 <span className="font-semibold">Berbagi</span> — untuk membagikan dokumen</p>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4">
                    <p className="font-bold text-gray-800 mb-1">Hapus Semua Data</p>
                    <p className="text-xs text-gray-500 mb-3">Ini akan menghapus semua dokumen tersimpan secara permanen.</p>
                    <button
                      onClick={() => {
                        localStorage.clear();
                        setModal(null);
                        setToast('Semua data telah dihapus.');
                      }}
                      className="w-full py-2.5 rounded-xl bg-red-50 text-red-500 text-xs font-bold active:scale-95 transition-all"
                    >
                      🗑️ Hapus Semua Data
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* About / Developer */}
            {modal === 'about' && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-lg font-black text-gray-900">Tentang Aplikasi</p>
                  <button onClick={() => setModal(null)} className="text-gray-400 text-xl">✕</button>
                </div>
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-lg border border-gray-100">
                    <img src="/logo.svg" alt="Scanin Lah" className="w-full h-full" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-2xl font-black text-gray-900">Scanin Lah</h2>
                    <p className="text-sm text-gray-400 mt-1">Asisten Dokumen Pintar</p>
                    <span className="inline-block mt-2 px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600">Versi 1.0.0</span>
                  </div>
                  <div className="w-full bg-gray-50 rounded-3xl p-5 space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pengembang</p>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center text-white font-black text-lg">I</div>
                      <div>
                        <p className="font-bold text-gray-900">Ihya' Nashirudin Abrar</p>
                        <button
                          onClick={handleContact}
                          className="text-xs text-blue-500 font-medium hover:underline"
                        >
                          ihyakpati1144@gmail.com
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-50 rounded-3xl p-4 space-y-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Teknologi</p>
                    {[
                      ['React 19', 'UI Framework'],
                      ['Tailwind CSS v4', 'Styling'],
                      ['OpenCV.js + jscanify', 'Edge Detection'],
                      ['Tesseract.js', 'OCR Engine'],
                      ['jsPDF', 'PDF Generation'],
                      ['Capacitor', 'Native Android'],
                    ].map(([tech, desc]) => (
                      <div key={tech} className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-700">{tech}</span>
                        <span className="text-xs text-gray-400">{desc}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 text-center">© 2025 Ihya' Nashirudin Abrar. All rights reserved.</p>
                </div>
              </>
            )}

            {/* Help */}
            {modal === 'help' && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-lg font-black text-gray-900">Bantuan & Dukungan</p>
                  <button onClick={() => setModal(null)} className="text-gray-400 text-xl">✕</button>
                </div>
                <div className="space-y-3">
                  {[
                    { q: 'Cara memindai dokumen?', a: 'Tekan tombol "Pindai" di halaman utama → izinkan kamera → arahkan ke dokumen → tekan rana → sesuaikan sudut → Crop ✓ → pilih format → Simpan.' },
                    { q: 'Cara scan banyak halaman?', a: 'Setelah preview hasil scan, tekan "➕ Scan Lagi" untuk menambah halaman. Setelah semua halaman siap, tekan "💾 Simpan".' },
                    { q: 'Cara mengekstrak teks (OCR)?', a: 'Buka Dokumen → ketuk file → Edit → pilih "Kenali Teks". AI akan mengekstrak teks dari gambar secara otomatis.' },
                    { q: 'Cara konversi format?', a: 'Buka halaman Konversi → pilih dokumen → pilih format tujuan (PDF/DOCX/TXT/JPG/PNG) → Konversi → Unduh.' },
                    { q: 'Data saya aman?', a: 'Ya! Semua data tersimpan di perangkatmu saja. Tidak ada data yang dikirim ke server.' },
                    { q: 'Hubungi pengembang?', a: 'Email: ihyakpati1144@gmail.com' },
                  ].map(({ q, a }) => (
                    <div key={q} className="bg-gray-50 rounded-2xl p-4">
                      <p className="text-sm font-bold text-gray-900 mb-1">{q}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{a}</p>
                    </div>
                  ))}
                  <button
                    onClick={handleContact}
                    className="w-full py-3.5 rounded-2xl bg-gray-900 text-white text-sm font-bold active:scale-95 transition-all mt-2"
                  >
                    ✉️ Kirim Email ke Pengembang
                  </button>
                </div>
              </>
            )}

            {/* Rate */}
            {modal === 'rate' && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-lg font-black text-gray-900">Beri Penilaian</p>
                  <button onClick={() => setModal(null)} className="text-gray-400 text-xl">✕</button>
                </div>
                <div className="flex flex-col items-center gap-5 py-4">
                  <div className="text-6xl">⭐</div>
                  <div className="text-center">
                    <p className="font-black text-gray-900 text-lg">Suka Scanin Lah?</p>
                    <p className="text-sm text-gray-400 mt-1">Dukunganmu sangat berarti bagi pengembang!</p>
                  </div>
                  <div className="flex gap-2 text-4xl">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} onClick={() => { setToast(`Terima kasih atas ${s} bintang! ⭐`); setModal(null); }} className="active:scale-90 transition-all">⭐</button>
                    ))}
                  </div>
                  <button
                    onClick={() => { handleRate(); setModal(null); }}
                    className="w-full py-4 rounded-2xl bg-gray-900 text-white font-bold text-sm active:scale-95 transition-all"
                  >
                    📤 Bagikan ke Teman
                  </button>
                  <button onClick={handleContact} className="text-sm text-blue-500 font-medium">
                    Kirim masukan ke pengembang →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-2 pb-4">
          <h1 className="text-2xl font-black text-gray-900">Profil</h1>
        </div>

        {/* Avatar card */}
        <div className="mx-5 mb-5 bg-gray-900 rounded-3xl p-5 text-white">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-black truncate">{user.name}</p>
              <p className="text-white/60 text-sm truncate mt-0.5">{user.email}</p>
              <div className="inline-flex items-center gap-1 mt-2 bg-white/10 rounded-lg px-2 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-xs text-white/80 font-medium">Gratis</span>
              </div>
            </div>
          </div>
          <div className="flex mt-4 pt-4 border-t border-white/10">
            {[
              { label: 'Dokumen', value: totalDocs },
              { label: 'Dipindai', value: scanned },
              { label: 'Dikonversi', value: converted },
            ].map(({ label, value }) => (
              <div key={label} className="flex-1 text-center">
                <p className="text-2xl font-black">{value}</p>
                <p className="text-white/50 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="px-5 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onNavigate('documents')}
              className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-2xl active:scale-95 transition-all">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <DocsIcon size={18} className="text-blue-600" />
              </div>
              <span className="text-sm font-bold text-gray-700">Dokumen Saya</span>
            </button>
            <button onClick={() => onNavigate('askai')}
              className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-2xl active:scale-95 transition-all">
              <div className="w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center">
                <AIIcon size={18} className="text-yellow-600" />
              </div>
              <span className="text-sm font-bold text-gray-700">Tanya AI</span>
            </button>
          </div>
        </div>

        {/* Menu */}
        <div className="px-5 mb-5">
          <div className="bg-gray-50 rounded-3xl overflow-hidden divide-y divide-gray-100">

            {/* Pengaturan */}
            <button onClick={() => setModal('settings')}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-100 active:bg-gray-200 transition-all text-left">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <SettingsIcon size={16} className="text-gray-600" />
              </div>
              <span className="flex-1 text-sm font-semibold text-gray-700">Pengaturan</span>
              <ChevronRightIcon size={16} className="text-gray-300" />
            </button>

            {/* Notifikasi toggle */}
            <button onClick={() => { setNotifications(n => !n); setToast(`Notifikasi ${!notifications ? 'aktif' : 'nonaktif'}`); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-100 active:bg-gray-200 transition-all text-left">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <BellIcon size={16} className="text-gray-600" />
              </div>
              <span className="flex-1 text-sm font-semibold text-gray-700">Notifikasi</span>
              <div className={`w-10 rounded-full flex items-center px-0.5 transition-colors ${notifications ? 'bg-gray-900' : 'bg-gray-300'}`} style={{ height: '22px' }}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${notifications ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </button>

            {/* Privasi */}
            <button onClick={() => setModal('privacy')}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-100 active:bg-gray-200 transition-all text-left">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <ShieldIcon size={16} className="text-gray-600" />
              </div>
              <span className="flex-1 text-sm font-semibold text-gray-700">Privasi & Keamanan</span>
              <ChevronRightIcon size={16} className="text-gray-300" />
            </button>

            {/* Beri Penilaian */}
            <button onClick={() => setModal('rate')}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-100 active:bg-gray-200 transition-all text-left">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <StarIcon size={16} className="text-gray-600" />
              </div>
              <span className="flex-1 text-sm font-semibold text-gray-700">Beri Penilaian</span>
              <ChevronRightIcon size={16} className="text-gray-300" />
            </button>

            {/* Bantuan */}
            <button onClick={() => setModal('help')}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-100 active:bg-gray-200 transition-all text-left">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <HelpIcon size={16} className="text-gray-600" />
              </div>
              <span className="flex-1 text-sm font-semibold text-gray-700">Bantuan & Dukungan</span>
              <ChevronRightIcon size={16} className="text-gray-300" />
            </button>

            {/* Tentang */}
            <button onClick={() => setModal('about')}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-100 active:bg-gray-200 transition-all text-left">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <span className="flex-1 text-sm font-semibold text-gray-700">Tentang Aplikasi</span>
              <ChevronRightIcon size={16} className="text-gray-300" />
            </button>

          </div>
        </div>

        {/* Logout */}
        <div className="px-5 pb-6">
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-3xl border-2 border-red-100 text-red-500 font-bold text-sm active:scale-95 active:bg-red-50 transition-all">
            <LogOutIcon size={18} />
            Keluar
          </button>
        </div>
      </div>

      <BottomNav current="profile" onNavigate={onNavigate} />
    </div>
  );
}
