import { useState } from 'react';
import { Page, User, DocFile } from '../types';
import StatusBar from '../components/StatusBar';
import BottomNav from '../components/BottomNav';
import Toast from '../components/Toast';
import { SearchIcon, FileIcon, TrashIcon, ShareIcon, EditIcon, ConvertIcon, ArrowLeftIcon } from '../components/Icons';

interface Props {
  user: User;
  docs: DocFile[];
  deleteDoc: (id: string) => void;
  getDataUrl: (id: string) => string | undefined;
  onNavigate: (page: Page) => void;
  onEditDoc: (docId: string) => void;
  updateDoc: (id: string, updates: Partial<DocFile>) => void;
}

type Filter = 'all' | 'pdf' | 'doc' | 'xls' | 'img';

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'pdf', label: 'PDF' },
  { id: 'doc', label: 'DOC' },
  { id: 'xls', label: 'XLS' },
  { id: 'img', label: 'Gambar' },
];

function typeColor(type: string) {
  const map: Record<string, string> = {
    pdf: '#e8d5f5', doc: '#d4e9f7', xls: '#d4f0e0',
    jpg: '#fdf0c4', png: '#ffe4e6', txt: '#e0e7ff',
  };
  return map[type] ?? '#f3f4f6';
}

function typeIcon(type: string) {
  const icons: Record<string, string> = {
    pdf: '📄', doc: '📝', xls: '📊', jpg: '🖼️', png: '🖼️', txt: '📃',
  };
  return icons[type] ?? '📁';
}

export default function DocumentsPage({ docs, deleteDoc, getDataUrl, onNavigate, onEditDoc, updateDoc }: Props) {
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<Filter>('all');
  const [toast, setToast]     = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [viewer, setViewer]   = useState<DocFile | null>(null);
  const [confirmDel, setConfirmDel] = useState<DocFile | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal]   = useState('');

  const filtered = docs.filter(d => {
    const matchFilter =
      filter === 'all' ? true :
      filter === 'img' ? ['jpg','png'].includes(d.type) :
      d.type === filter;
    return matchFilter && d.name.toLowerCase().includes(search.toLowerCase());
  });

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleDownload = (doc: DocFile) => {
    const dataUrl = getDataUrl(doc.id);
    if (!dataUrl) { setToast({ msg: 'File tidak tersedia untuk diunduh.', type: 'error' }); return; }
    const a = document.createElement('a');
    a.href = dataUrl; a.download = doc.name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setToast({ msg: `⬇ ${doc.name} diunduh!`, type: 'success' });
  };

  const handleShare = async (doc: DocFile) => {
    const dataUrl = getDataUrl(doc.id);
    if (navigator.share) {
      try {
        if (dataUrl) {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          await navigator.share({ title: doc.name, files: [new File([blob], doc.name, { type: blob.type })] });
        } else {
          await navigator.share({ title: doc.name, text: doc.content ?? doc.name });
        }
        setToast({ msg: 'Berhasil dibagikan!', type: 'success' });
      } catch { setToast({ msg: 'Batal membagikan.', type: 'info' }); }
    } else {
      try {
        await navigator.clipboard.writeText(doc.content ?? doc.name);
        setToast({ msg: 'Disalin ke clipboard!', type: 'info' });
      } catch { setToast({ msg: 'Bagikan tidak didukung.', type: 'error' }); }
    }
  };

  const handleDelete = (doc: DocFile) => {
    deleteDoc(doc.id);
    setViewer(null);
    setConfirmDel(null);
    setToast({ msg: 'Dokumen dihapus.', type: 'success' });
  };

  // Sync viewer dengan docs terbaru (kalau doc di-update dari luar)
  const viewerDoc = viewer ? (docs.find(d => d.id === viewer.id) ?? viewer) : null;

  // ── Fullscreen Viewer ──────────────────────────────────────────────────────
  if (viewerDoc) {
    const viewer = viewerDoc; // use synced version
    // Always call getDataUrl fresh — it reads from in-memory map
    const dataUrl = getDataUrl(viewer.id);
    const isImage = ['jpg','png'].includes(viewer.type);
    // PDF with dataUrl that starts with data:image → it's actually an image scan saved as PDF
    const dataUrlIsImage = dataUrl?.startsWith('data:image');
    const showImage = (isImage || dataUrlIsImage) && !!dataUrl;
    const showPdfDownload = viewer.type === 'pdf' && !dataUrlIsImage && !!dataUrl;
    const showPdfNoData   = viewer.type === 'pdf' && !dataUrl;

    return (
      <div className="flex flex-col h-full bg-gray-950 page-enter">
        <StatusBar dark />

        {/* Confirm delete overlay */}
        {confirmDel && (
          <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-6 animate-fade">
            <div className="bg-white rounded-3xl p-6 w-full">
              <p className="font-black text-gray-900 text-base mb-1">Hapus Dokumen?</p>
              <p className="text-xs text-gray-400 mb-5">"{confirmDel.name}" akan dihapus permanen.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDel(null)}
                  className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 text-sm font-bold active:scale-95 transition-all">
                  Batal
                </button>
                <button onClick={() => handleDelete(confirmDel)}
                  className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-bold active:scale-95 transition-all">
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0">
          <button onClick={() => setViewer(null)} aria-label="Kembali"
            className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center active:scale-90 transition-all">
            <ArrowLeftIcon size={18} className="text-white" />
          </button>
          <div className="flex-1 min-w-0">
            {renamingId === viewer.id ? (
              <input
                autoFocus
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onBlur={() => {
                  if (renameVal.trim()) {
                    updateDoc(viewer.id, { name: renameVal.trim() });
                    setViewer({ ...viewer, name: renameVal.trim() });
                  }
                  setRenamingId(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (renameVal.trim()) {
                      updateDoc(viewer.id, { name: renameVal.trim() });
                      setViewer({ ...viewer, name: renameVal.trim() });
                    }
                    setRenamingId(null);
                  }
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="w-full bg-white/10 text-white text-sm font-bold rounded-xl px-3 py-1.5 focus:outline-none border border-white/30"
              />
            ) : (
              <button onClick={() => { setRenamingId(viewer.id); setRenameVal(viewer.name); }}
                className="text-left w-full">
                <p className="text-white font-bold text-sm truncate">{viewer.name} ✎</p>
                <p className="text-white/40 text-xs">{viewer.size} · {viewer.date}</p>
              </button>
            )}
          </div>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-lg uppercase flex-shrink-0"
            style={{ backgroundColor: typeColor(viewer.type), color: '#374151' }}>
            {viewer.type}
          </span>
        </div>

        {/* Content area — always show image if dataUrl exists */}
        <div className="flex-1 overflow-auto mx-3 mb-3 rounded-2xl bg-black flex items-center justify-center">
          {showImage ? (
            <img src={dataUrl!} alt={viewer.name} className="w-full h-full object-contain" />
          ) : showPdfDownload ? (
            <div className="flex flex-col items-center gap-4 p-8">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl" style={{ backgroundColor: typeColor(viewer.type) }}>📄</div>
              <p className="text-white font-bold text-center">{viewer.name}</p>
              <p className="text-white/40 text-xs">{viewer.size}</p>
              <button onClick={() => handleDownload(viewer)} className="px-8 py-3 bg-white text-gray-900 rounded-2xl text-sm font-bold active:scale-95 transition-all">⬇ Buka / Unduh PDF</button>
            </div>
          ) : showPdfNoData ? (
            <div className="flex flex-col items-center gap-3 p-8">
              <span className="text-6xl">📄</span>
              <p className="text-white/60 text-sm text-center">File tidak tersedia di memori.</p>
              <p className="text-white/30 text-xs text-center mt-1">Scan ulang untuk menyimpan ulang.</p>
            </div>
          ) : viewer.content ? (
            <div className="w-full h-full overflow-auto p-4">
              <pre className="text-white/80 text-xs whitespace-pre-wrap font-mono leading-relaxed">{viewer.content}</pre>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 p-8">
              <span className="text-6xl">{typeIcon(viewer.type)}</span>
              <p className="text-white/60 text-sm text-center">Tidak ada pratinjau tersedia.</p>
            </div>
          )}
        </div>


        {/* Action toolbar — like tap scanner */}
        <div className="px-4 pb-5 flex-shrink-0">
          <div className="bg-white/10 rounded-3xl p-3 flex items-center justify-around gap-1">
            {/* Download */}
            <button onClick={() => handleDownload(viewer)}
              className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl active:bg-white/10 transition-all active:scale-90">
              <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </div>
              <span className="text-[10px] text-white/70 font-medium">Unduh</span>
            </button>

            {/* Edit */}
            <button onClick={() => { setViewer(null); onEditDoc(viewer.id); }}
              className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl active:bg-white/10 transition-all active:scale-90">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/30 flex items-center justify-center">
                <EditIcon size={18} className="text-blue-300" />
              </div>
              <span className="text-[10px] text-white/70 font-medium">Edit</span>
            </button>

            {/* Convert */}
            <button onClick={() => { setViewer(null); onNavigate('convert'); }}
              className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl active:bg-white/10 transition-all active:scale-90">
              <div className="w-10 h-10 rounded-2xl bg-green-500/30 flex items-center justify-center">
                <ConvertIcon size={18} className="text-green-300" />
              </div>
              <span className="text-[10px] text-white/70 font-medium">Konversi</span>
            </button>

            {/* Share */}
            <button onClick={() => handleShare(viewer)}
              className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl active:bg-white/10 transition-all active:scale-90">
              <div className="w-10 h-10 rounded-2xl bg-yellow-500/30 flex items-center justify-center">
                <ShareIcon size={18} className="text-yellow-300" />
              </div>
              <span className="text-[10px] text-white/70 font-medium">Bagikan</span>
            </button>

            {/* Delete */}
            <button onClick={() => setConfirmDel(viewer)}
              className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl active:bg-white/10 transition-all active:scale-90">
              <div className="w-10 h-10 rounded-2xl bg-red-500/30 flex items-center justify-center">
                <TrashIcon size={18} className="text-red-300" />
              </div>
              <span className="text-[10px] text-white/70 font-medium">Hapus</span>
            </button>
          </div>
        </div>

        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  // ── Document List ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white page-enter relative">
      <StatusBar />
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="px-5 pt-2 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black text-gray-900">Dokumen</h1>
          <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-xl">
            {docs.length} file
          </span>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 mb-3">
          <SearchIcon size={16} className="text-gray-400 flex-shrink-0" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari dokumen…"
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-300 focus:outline-none" />
          {search && <button onClick={() => setSearch('')} className="text-gray-300 text-xs">✕</button>}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filters.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95
                ${filter === f.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid / List */}
      <div className="flex-1 overflow-y-auto px-5 pb-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
            <div className="w-24 h-24 rounded-3xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center">
              <FileIcon size={40} className="text-gray-200" />
            </div>
            <div className="text-center">
              <p className="text-base font-black text-gray-800">Belum ada dokumen</p>
              <p className="text-xs text-gray-400 mt-1">
                {search ? `Tidak ada hasil untuk "${search}"` : 'Pindai atau unggah dokumen pertama Anda'}
              </p>
            </div>
            {!search && (
              <button onClick={() => onNavigate('scan')}
                className="mt-1 px-6 py-2.5 rounded-2xl bg-gray-900 text-white text-sm font-bold active:scale-95 transition-all">
                Pindai Dokumen
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-2">
            {filtered.map(doc => {
              const dataUrl = getDataUrl(doc.id);
              const isImage = ['jpg','png'].includes(doc.type);
              return (
                <button key={doc.id} onClick={() => setViewer(doc)}
                  className="flex flex-col rounded-3xl overflow-hidden border border-gray-100 bg-white active:scale-95 transition-all shadow-sm hover:shadow-md text-left">
                  {/* Thumbnail */}
                  <div className="w-full aspect-[4/3] flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: typeColor(doc.type) }}>
                    {isImage && dataUrl ? (
                      <img src={dataUrl} alt={doc.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl">{typeIcon(doc.type)}</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="px-3 py-2.5">
                    <p className="text-xs font-bold text-gray-900 truncate leading-tight">{doc.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{doc.size} · {doc.date}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav current="documents" onNavigate={onNavigate} />
    </div>
  );
}
