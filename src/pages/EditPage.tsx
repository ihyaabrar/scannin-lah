import { useState, useEffect, useRef } from 'react';
import { Page, User, DocFile } from '../types';
import { store } from '../store';
import StatusBar from '../components/StatusBar';
import BottomNav from '../components/BottomNav';
import Toast from '../components/Toast';
import { recognizeText } from '../services/ocr';
import {
  ArrowLeftIcon, CloseIcon, FileIcon,
  AddTextIcon, MarkupIcon, RecognizeIcon, HideIcon, SplitIcon, MergeIcon
} from '../components/Icons';

interface Props {
  user: User;
  docs: DocFile[];
  editDocId: string | null;
  onNavigate: (page: Page) => void;
  updateDoc: (id: string, updates: Partial<DocFile>) => void;
}

const tools = [
  { id: 'addtext',   label: 'Tambah Teks', Icon: AddTextIcon,   color: '#d4e9f7', desc: 'Ketik & edit teks' },
  { id: 'markup',    label: 'Markup',       Icon: MarkupIcon,    color: '#e8d5f5', desc: 'Sorot teks penting' },
  { id: 'recognize', label: 'Kenali Teks',  Icon: RecognizeIcon, color: '#d4f0e0', desc: 'OCR dari gambar' },
  { id: 'hide',      label: 'Sembunyikan',  Icon: HideIcon,      color: '#fdf0c4', desc: 'Sensor/redaksi' },
  { id: 'split',     label: 'Pisah',        Icon: SplitIcon,     color: '#ffe4e6', desc: 'Pisah jadi 2 dok' },
  { id: 'merge',     label: 'Gabung',       Icon: MergeIcon,     color: '#e0e7ff', desc: 'Gabung dokumen' },
];

export default function EditPage({ docs, editDocId, onNavigate, updateDoc }: Props) {
  const doc = docs.find(d => d.id === editDocId) ?? null;

  const [activeTool, setActiveTool]     = useState<string | null>(null);
  const [toast, setToast]               = useState<{ msg: string; type?: 'success'|'error'|'info' } | null>(null);
  const [docText, setDocText]           = useState(doc?.content ?? '');
  const [docName, setDocName]           = useState(doc?.name ?? '');
  const [saved, setSaved]               = useState(false);
  const [editingName, setEditingName]   = useState(false);
  const [ocrProgress, setOcrProgress]   = useState(0);
  const [ocrRunning, setOcrRunning]     = useState(false);
  // Markup: highlighted ranges stored as {start,end} pairs applied as spans
  const [markupRanges, setMarkupRanges] = useState<{start:number;end:number}[]>([]);
  // Hide: redacted ranges
  const [, setHiddenRanges] = useState<{start:number;end:number}[]>([]);
  // Split: split position (char index)
  const [splitPos, setSplitPos]         = useState<number | null>(null);
  // Merge: show doc picker
  const [showMergePicker, setShowMergePicker] = useState(false);
  // Find & replace
  const [findText, setFindText]         = useState('');
  const [replaceText, setReplaceText]   = useState('');
  const [showFindReplace, setShowFindReplace] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (doc) { setDocText(doc.content ?? ''); setDocName(doc.name); }
    setActiveTool(null);
    setMarkupRanges([]);
    setHiddenRanges([]);
    setSplitPos(null);
    setShowMergePicker(false);
    setShowFindReplace(false);
  }, [editDocId]); // eslint-disable-line

  // ── Tool handler ────────────────────────────────────────────────────────────
  const handleTool = async (id: string) => {
    if (activeTool === id) { setActiveTool(null); return; }
    setActiveTool(id);

    if (id === 'recognize') {
      const dataUrl = (window as any).__docaiDataUrls?.[doc?.id ?? ''];
      if (!dataUrl && !doc?.content) {
        setToast({ msg: 'Tidak ada data gambar. Pindai dokumen terlebih dahulu.', type: 'error' });
        setActiveTool(null); return;
      }
      if (!dataUrl) {
        setToast({ msg: 'Dokumen sudah memiliki konten teks.', type: 'info' });
        setActiveTool(null); return;
      }
      setOcrRunning(true); setOcrProgress(0);
      try {
        const text = await recognizeText(dataUrl, p => setOcrProgress(p));
        setDocText(text || '[Tidak ada teks terdeteksi]');
        setToast({ msg: '✅ Teks berhasil dikenali!', type: 'success' });
      } catch {
        setToast({ msg: 'OCR gagal. Coba lagi.', type: 'error' });
      } finally { setOcrRunning(false); setActiveTool(null); }
      return;
    }

    if (id === 'split') {
      const pos = textareaRef.current?.selectionStart ?? Math.floor(docText.length / 2);
      setSplitPos(pos);
      setToast({ msg: `Dokumen akan dipecah di posisi karakter ${pos}. Tekan "Pisah Sekarang".`, type: 'info' });
      return;
    }

    if (id === 'merge') { setShowMergePicker(true); setActiveTool(null); return; }
    if (id === 'markup') setToast({ msg: 'Pilih teks di editor lalu tekan "Sorot Pilihan".', type: 'info' });
    if (id === 'hide')   setToast({ msg: 'Pilih teks di editor lalu tekan "Sensor Pilihan".', type: 'info' });
    if (id === 'addtext') textareaRef.current?.focus();
  };

  // ── Markup: sorot teks yang dipilih ─────────────────────────────────────────
  const applyMarkup = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    if (s === e) { setToast({ msg: 'Pilih teks terlebih dahulu.', type: 'info' }); return; }
    setMarkupRanges(prev => [...prev, { start: s, end: e }]);
    setToast({ msg: '✅ Teks disorot!', type: 'success' });
  };

  const clearMarkup = () => { setMarkupRanges([]); setToast({ msg: 'Semua sorotan dihapus.', type: 'info' }); };

  // ── Hide: sensor teks yang dipilih ──────────────────────────────────────────
  const applyHide = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    if (s === e) { setToast({ msg: 'Pilih teks yang ingin disensor.', type: 'info' }); return; }
    // Replace selected text with ████ blocks
    const redacted = '█'.repeat(e - s);
    const newText = docText.slice(0, s) + redacted + docText.slice(e);
    setDocText(newText);
    setHiddenRanges(prev => [...prev, { start: s, end: s + redacted.length }]);
    setToast({ msg: '✅ Teks disensor!', type: 'success' });
  };

  // ── Split: pecah dokumen jadi 2 ─────────────────────────────────────────────
  const applySplit = () => {
    if (!doc || splitPos === null) return;
    const part1 = docText.slice(0, splitPos).trim();
    const part2 = docText.slice(splitPos).trim();
    if (!part2) { setToast({ msg: 'Tidak ada konten setelah posisi pemisah.', type: 'error' }); return; }

    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const baseName = docName.replace(/\.[^.]+$/, '');
    const ext = docName.includes('.') ? docName.split('.').pop()! : 'txt';

    // Update current doc with part1
    updateDoc(doc.id, { content: part1, name: `${baseName}_bagian1.${ext}` });
    setDocText(part1);
    setDocName(`${baseName}_bagian1.${ext}`);

    // Create new doc with part2
    const newDoc: DocFile = {
      id: `doc_${Date.now()}`,
      name: `${baseName}_bagian2.${ext}`,
      type: doc.type,
      size: `${new Blob([part2]).size} B`,
      date: dateStr,
      color: doc.color,
      content: part2,
      mimeType: doc.mimeType,
    };
    store.addDoc(newDoc);
    setSplitPos(null);
    setActiveTool(null);
    setToast({ msg: `✅ Dokumen dipecah menjadi 2! "${newDoc.name}" tersimpan di Dokumen.`, type: 'success' });
  };

  // ── Merge: gabung dengan dokumen lain ───────────────────────────────────────
  const applyMerge = (targetDoc: DocFile) => {
    if (!doc) return;
    setShowMergePicker(false);
    const separator = `\n\n${'─'.repeat(40)}\n[Digabung dari: ${targetDoc.name}]\n${'─'.repeat(40)}\n\n`;
    const merged = docText + separator + (targetDoc.content ?? `[${targetDoc.name} — tidak ada konten teks]`);
    setDocText(merged);
    setToast({ msg: `✅ "${targetDoc.name}" berhasil digabungkan!`, type: 'success' });
  };

  // ── Find & Replace ───────────────────────────────────────────────────────────

  // ── Find & Replace ───────────────────────────────────────────────────────────
  const applyFindReplace = () => {
    if (!findText) return;
    try {
      const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      const count = (docText.match(regex) || []).length;
      if (count === 0) { setToast({ msg: `"${findText}" tidak ditemukan.`, type: 'info' }); return; }
      setDocText(docText.replace(regex, replaceText));
      setToast({ msg: `✅ ${count} kata diganti.`, type: 'success' });
    } catch {
      setToast({ msg: 'Pola pencarian tidak valid.', type: 'error' });
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!doc) { setToast({ msg: 'Tidak ada dokumen dipilih.', type: 'error' }); return; }
    updateDoc(doc.id, { content: docText, name: docName });
    setSaved(true);
    setToast({ msg: '✅ Dokumen disimpan!', type: 'success' });
    setTimeout(() => setSaved(false), 2000);
  };

  // ── Download as TXT ──────────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!docText) { setToast({ msg: 'Tidak ada konten untuk diunduh.', type: 'error' }); return; }
    const blob = new Blob([docText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = docName.replace(/\.[^.]+$/, '') + '.txt';
    a.click(); URL.revokeObjectURL(url);
    setToast({ msg: '⬇ File diunduh!', type: 'success' });
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white page-enter relative">
      <StatusBar />
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Merge picker modal */}
      {showMergePicker && (
        <div className="absolute inset-0 z-50 bg-black/50 flex flex-col justify-end animate-fade" onClick={() => setShowMergePicker(false)}>
          <div className="bg-white rounded-t-3xl p-5 max-h-[65%] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-black text-gray-900">Pilih Dokumen untuk Digabung</p>
              <button onClick={() => setShowMergePicker(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="overflow-y-auto space-y-2">
              {docs.filter(d => d.id !== doc?.id).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Tidak ada dokumen lain.</p>
              ) : (
                docs.filter(d => d.id !== doc?.id).map(d => (
                  <button key={d.id} onClick={() => applyMerge(d)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 active:bg-gray-100 transition-all text-left">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <FileIcon size={18} className="text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
                      <p className="text-xs text-gray-400">{d.size} · {d.date}</p>
                    </div>
                    <span className="text-xs font-bold text-indigo-500">Gabung →</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50">
        <button onClick={() => onNavigate(doc ? 'documents' : 'home')} aria-label="Kembali"
          className="w-9 h-9 rounded-2xl bg-gray-100 flex items-center justify-center active:scale-90 transition-all">
          <ArrowLeftIcon size={18} />
        </button>
        <p className="text-sm font-bold text-gray-900 flex-1 truncate">Edit Dokumen</p>
        <button onClick={handleDownload} disabled={!doc || !docText}
          className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 active:scale-95 transition-all disabled:opacity-40 mr-1">
          ⬇
        </button>
        <button onClick={handleSave} disabled={!doc}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40
            ${saved ? 'bg-green-100 text-green-600' : 'bg-gray-900 text-white'}`}>
          {saved ? '✓ Tersimpan' : 'Simpan'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!doc ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
            <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center">
              <FileIcon size={36} className="text-gray-300" />
            </div>
            <div className="text-center">
              <p className="font-black text-gray-800 text-base">Belum Ada Dokumen</p>
              <p className="text-xs text-gray-400 mt-1">Buka dokumen dari halaman Dokumen, lalu ketuk Edit.</p>
            </div>
            <button onClick={() => onNavigate('documents')}
              className="px-6 py-3 bg-gray-900 text-white rounded-2xl text-sm font-bold active:scale-95 transition-all">
              Buka Dokumen
            </button>
          </div>
        ) : (
          <>
            {/* Tools grid */}
            <div className="px-5 pt-4 pb-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Alat Edit</p>
              <div className="grid grid-cols-3 gap-2.5">
                {tools.map(({ id, label, Icon, color, desc }) => (
                  <button key={id} onClick={() => handleTool(id)} disabled={ocrRunning} aria-label={label}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all active:scale-95 disabled:opacity-50
                      ${activeTool === id ? 'ring-2 ring-gray-900 shadow-md' : ''}`}
                    style={{ backgroundColor: color }}>
                    <Icon size={20} className="text-gray-700" />
                    <span className="text-[10px] font-bold text-gray-700 text-center leading-tight">{label}</span>
                    <span className="text-[8px] text-gray-500 text-center leading-tight">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Context toolbar — shown based on active tool */}
            {activeTool === 'markup' && (
              <div className="mx-5 mb-2 p-3 bg-purple-50 rounded-2xl flex items-center gap-2 animate-fade">
                <span className="text-xs text-purple-700 flex-1">Pilih teks di editor lalu sorot</span>
                <button onClick={applyMarkup} className="px-3 py-1.5 bg-purple-500 text-white text-xs font-bold rounded-xl active:scale-95">Sorot Pilihan</button>
                <button onClick={clearMarkup} className="px-3 py-1.5 bg-purple-100 text-purple-600 text-xs font-bold rounded-xl active:scale-95">Hapus Semua</button>
              </div>
            )}

            {activeTool === 'hide' && (
              <div className="mx-5 mb-2 p-3 bg-yellow-50 rounded-2xl flex items-center gap-2 animate-fade">
                <span className="text-xs text-yellow-700 flex-1">Pilih teks yang ingin disensor</span>
                <button onClick={applyHide} className="px-3 py-1.5 bg-yellow-500 text-white text-xs font-bold rounded-xl active:scale-95">Sensor Pilihan</button>
              </div>
            )}

            {activeTool === 'split' && splitPos !== null && (
              <div className="mx-5 mb-2 p-3 bg-red-50 rounded-2xl animate-fade">
                <p className="text-xs text-red-700 mb-2">Posisi pemisah: karakter ke-{splitPos} dari {docText.length}</p>
                <p className="text-[10px] text-red-500 mb-2 font-mono bg-red-100 rounded-lg p-2 truncate">
                  …{docText.slice(Math.max(0, splitPos - 20), splitPos)}
                  <span className="bg-red-400 text-white px-0.5">|</span>
                  {docText.slice(splitPos, splitPos + 20)}…
                </p>
                <div className="flex gap-2">
                  <button onClick={() => { const pos = textareaRef.current?.selectionStart ?? splitPos; setSplitPos(pos); }}
                    className="flex-1 py-2 bg-red-100 text-red-600 text-xs font-bold rounded-xl active:scale-95">
                    Perbarui Posisi
                  </button>
                  <button onClick={applySplit}
                    className="flex-1 py-2 bg-red-500 text-white text-xs font-bold rounded-xl active:scale-95">
                    Pisah Sekarang ✂️
                  </button>
                </div>
              </div>
            )}

            {/* Find & Replace toggle */}
            <div className="mx-5 mb-2">
              <button onClick={() => setShowFindReplace(v => !v)}
                className="text-xs text-gray-400 font-semibold flex items-center gap-1 hover:text-gray-700 transition-colors">
                {showFindReplace ? '▲' : '▼'} Cari & Ganti
              </button>
              {showFindReplace && (
                <div className="mt-2 p-3 bg-gray-50 rounded-2xl space-y-2 animate-fade">
                  <input value={findText} onChange={e => setFindText(e.target.value)}
                    placeholder="Cari teks…"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-gray-400" />
                  <input value={replaceText} onChange={e => setReplaceText(e.target.value)}
                    placeholder="Ganti dengan…"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-gray-400" />
                  <button onClick={applyFindReplace} disabled={!findText}
                    className="w-full py-2 bg-gray-900 text-white text-xs font-bold rounded-xl active:scale-95 disabled:opacity-40">
                    Ganti Semua
                  </button>
                </div>
              )}
            </div>

            {/* Editor */}
            <div className="px-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Konten Dokumen</p>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  Mengedit
                </div>
              </div>
              <div className="relative rounded-3xl border-2 border-gray-100 overflow-hidden"
                style={{ background: activeTool === 'markup' ? '#fefce8' : 'white' }}>
                {/* Title bar */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-50 bg-gray-50/50">
                  <div className="w-2 h-2 rounded-full bg-red-300" />
                  <div className="w-2 h-2 rounded-full bg-yellow-300" />
                  <div className="w-2 h-2 rounded-full bg-green-300" />
                  {editingName ? (
                    <input autoFocus value={docName} onChange={e => setDocName(e.target.value)}
                      onBlur={() => setEditingName(false)}
                      onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
                      className="text-[10px] text-gray-600 ml-1 font-medium bg-transparent border-b border-gray-300 focus:outline-none w-40" />
                  ) : (
                    <button onClick={() => setEditingName(true)}
                      className="text-[10px] text-gray-400 ml-1 font-medium hover:text-gray-700 transition-colors truncate max-w-[180px]">
                      {docName} ✎
                    </button>
                  )}
                </div>

                {/* Markup highlight preview above textarea */}
                {markupRanges.length > 0 && (
                  <div className="px-4 pt-2 pb-1">
                    <p className="text-[9px] text-purple-500 font-semibold uppercase tracking-wider mb-1">
                      {markupRanges.length} sorotan aktif
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {markupRanges.map((r, i) => (
                        <span key={i} className="bg-yellow-200 text-yellow-800 text-[9px] px-1.5 py-0.5 rounded font-medium">
                          "{docText.slice(r.start, r.end).slice(0, 20)}{docText.slice(r.start, r.end).length > 20 ? '…' : ''}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  value={docText}
                  onChange={e => setDocText(e.target.value)}
                  className="w-full px-4 py-3 text-xs text-gray-700 leading-relaxed bg-transparent resize-none focus:outline-none"
                  rows={14}
                  placeholder="Belum ada konten. Gunakan 'Kenali Teks' untuk OCR, atau ketik di sini."
                  style={{ fontFamily: activeTool === 'addtext' ? 'monospace' : 'Inter, sans-serif' }}
                />

                {/* OCR overlay */}
                {ocrRunning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 rounded-3xl animate-fade gap-3">
                    <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-gray-600 font-medium">Mengenali teks… {ocrProgress}%</p>
                    <div className="w-40 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-900 rounded-full transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mt-2 px-1">
                <span className="text-[10px] text-gray-400">{docText.length} karakter · {docText.split(/\s+/).filter(Boolean).length} kata</span>
                {activeTool && activeTool !== 'recognize' && !ocrRunning && (
                  <button onClick={() => setActiveTool(null)}
                    className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-700 transition-colors">
                    <CloseIcon size={10} /> Nonaktifkan alat
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <BottomNav current="edit" onNavigate={onNavigate} />
    </div>
  );
}
