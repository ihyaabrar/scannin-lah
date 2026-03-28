import { useState } from 'react';
import { Page, User, DocFile } from '../types';
import StatusBar from '../components/StatusBar';
import BottomNav from '../components/BottomNav';
import Toast from '../components/Toast';
import { ArrowLeftIcon, ConvertIcon, CheckIcon, FileIcon, ImageIcon } from '../components/Icons';

interface Props {
  user: User;
  docs: DocFile[];
  onNavigate: (page: Page) => void;
  addDoc: (doc: DocFile, dataUrl?: string) => void;
  getDataUrl: (id: string) => string | undefined;
}

type Format = 'PDF' | 'DOCX' | 'TXT' | 'JPG' | 'PNG';
type ConvertState = 'idle' | 'converting' | 'done';

const formats: { id: Format; color: string; desc: string; mime: string }[] = [
  { id: 'PDF',  color: '#e8d5f5', desc: 'Dokumen Portabel', mime: 'application/pdf' },
  { id: 'DOCX', color: '#d4e9f7', desc: 'Dokumen Word',     mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { id: 'TXT',  color: '#e0e7ff', desc: 'Teks Biasa',        mime: 'text/plain' },
  { id: 'JPG',  color: '#fdf0c4', desc: 'Gambar JPEG',        mime: 'image/jpeg' },
  { id: 'PNG',  color: '#ffe4e6', desc: 'Gambar PNG',         mime: 'image/png' },
];

// Convert dataURL string to Blob
function dataURLtoBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Build a minimal valid DOCX ZIP blob without external dependencies
function buildDocxBlob(contentTypesXml: string, relsXml: string, docXml: string): Blob {
  // Encode string to Uint8Array
  const enc = (s: string) => new TextEncoder().encode(s);

  // Minimal ZIP builder (store method, no compression)
  const files: { name: string; data: Uint8Array }[] = [
    { name: '[Content_Types].xml', data: enc(contentTypesXml) },
    { name: '_rels/.rels',         data: enc(relsXml) },
    { name: 'word/document.xml',   data: enc(docXml) },
  ];

  const localHeaders: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  const u32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
  const u16 = (n: number) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; };

  for (const file of files) {
    const nameBytes = enc(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    // Local file header
    const lh = concat([
      new Uint8Array([0x50,0x4B,0x03,0x04]), // signature
      u16(20), u16(0), u16(0),               // version, flags, compression (store)
      u16(0), u16(0),                        // mod time, mod date
      u32(crc), u32(size), u32(size),        // crc, compressed, uncompressed
      u16(nameBytes.length), u16(0),         // filename len, extra len
      nameBytes, file.data,
    ]);

    // Central directory entry
    const cd = concat([
      new Uint8Array([0x50,0x4B,0x01,0x02]), // signature
      u16(20), u16(20), u16(0), u16(0),      // version made, needed, flags, compression
      u16(0), u16(0),                        // mod time, mod date
      u32(crc), u32(size), u32(size),        // crc, compressed, uncompressed
      u16(nameBytes.length), u16(0), u16(0), // filename, extra, comment len
      u16(0), u16(0), u32(0),               // disk start, int attr, ext attr
      u32(offset),                           // local header offset
      nameBytes,
    ]);

    localHeaders.push(lh);
    centralDir.push(cd);
    offset += lh.length;
  }

  const cdOffset = offset;
  const cdSize = centralDir.reduce((s, b) => s + b.length, 0);
  const eocd = concat([
    new Uint8Array([0x50,0x4B,0x05,0x06]),   // end of central dir signature
    u16(0), u16(0),                          // disk number, disk with cd
    u16(files.length), u16(files.length),    // entries on disk, total entries
    u32(cdSize), u32(cdOffset),              // cd size, cd offset
    u16(0),                                  // comment length
  ]);

  // Cast to ArrayBuffer to satisfy strict TS Blob types
  const parts: BlobPart[] = [...localHeaders, ...centralDir, eocd].map(u => u.buffer as ArrayBuffer);
  return new Blob(parts, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const a of arrays) { out.set(a, pos); pos += a.length; }
  return out;
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  const table = crc32Table();
  for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

let _crcTable: Uint32Array | null = null;
function crc32Table(): Uint32Array {
  if (_crcTable) return _crcTable;
  _crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    _crcTable[i] = c;
  }
  return _crcTable;
}

function typeColor(type: string) {
  const map: Record<string, string> = {
    pdf: '#e8d5f5', doc: '#d4e9f7', xls: '#d4f0e0',
    jpg: '#fdf0c4', png: '#ffe4e6', txt: '#e0e7ff',
  };
  return map[type] ?? '#f3f4f6';
}

export default function ConvertPage({ docs, onNavigate, addDoc, getDataUrl }: Props) {
  const [sourceDoc, setSourceDoc]   = useState<DocFile | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [targetFmt, setTargetFmt]   = useState<Format | null>(null);
  const [state, setState]           = useState<ConvertState>('idle');
  const [progress, setProgress]     = useState(0);
  const [toast, setToast]           = useState<string | null>(null);
  const [outputDataUrl, setOutputDataUrl] = useState<string | null>(null);

  const handleConvert = () => {
    if (!targetFmt || !sourceDoc) return;
    setState('converting');
    setProgress(0);

    // Animate progress bar independently, then run conversion once at end
    let p = 0;
    const interval = setInterval(() => {
      p = Math.min(p + Math.random() * 18, 95); // stop at 95, finish after convert
      setProgress(p);
      if (p >= 95) {
        clearInterval(interval);
        // Run conversion exactly once
        doConvert().then(() => setProgress(100));
      }
    }, 150);
  };

  const doConvert = async () => {
    if (!sourceDoc || !targetFmt) return;

    const fmt = formats.find(f => f.id === targetFmt)!;
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const outName = sourceDoc.name.replace(/\.[^.]+$/, '') + '.' + targetFmt.toLowerCase();

    let blob: Blob | null = null;
    let dataUrlForStore: string | undefined;

    if (targetFmt === 'TXT') {
      const textContent = sourceDoc.content
        ? sourceDoc.content
        : `Dikonversi dari: ${sourceDoc.name}\nTanggal: ${dateStr}\n\n[Tidak ada konten teks. Gunakan OCR di halaman Edit terlebih dahulu.]`;
      blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });

    } else if (targetFmt === 'JPG' || targetFmt === 'PNG') {
      const srcDataUrl = getDataUrl(sourceDoc.id);
      if (srcDataUrl) {
        // Wait for image to load before reading dimensions
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || 800;
            canvas.height = img.naturalHeight || 600;
            canvas.getContext('2d')!.drawImage(img, 0, 0);
            const mime = targetFmt === 'PNG' ? 'image/png' : 'image/jpeg';
            dataUrlForStore = canvas.toDataURL(mime, 0.92);
            resolve();
          };
          img.onerror = () => { dataUrlForStore = srcDataUrl; resolve(); };
          img.src = srcDataUrl;
        });
      } else {
        // Render text content as image
        const canvas = document.createElement('canvas');
        canvas.width = 794; canvas.height = 1123; // A4 at 96dpi
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(sourceDoc.name, 48, 60);
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px sans-serif';
        ctx.fillText(`Dikonversi: ${dateStr}`, 48, 88);
        // Draw text content line by line
        if (sourceDoc.content) {
          ctx.fillStyle = '#374151';
          ctx.font = '15px sans-serif';
          const lines = sourceDoc.content.split('\n');
          let y = 130;
          for (const line of lines) {
            if (y > 1080) break;
            ctx.fillText(line.slice(0, 90), 48, y);
            y += 22;
          }
        }
        const mime = targetFmt === 'PNG' ? 'image/png' : 'image/jpeg';
        dataUrlForStore = canvas.toDataURL(mime, 0.92);
      }

    } else if (targetFmt === 'PDF') {
      // Generate real PDF using jsPDF
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jspdf = (window as any).jspdf;
      if (jspdf) {
        const { jsPDF } = jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfW = pdf.internal.pageSize.getWidth();
        const srcDataUrl = getDataUrl(sourceDoc.id);

        if (srcDataUrl) {
          // Wait for image to load before reading dimensions
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              const pdfH = pdf.internal.pageSize.getHeight();
              const ratio = img.naturalWidth / img.naturalHeight;
              let rW = pdfW - 20, rH = rW / ratio;
              if (rH > pdfH - 20) { rH = pdfH - 20; rW = rH * ratio; }
              pdf.addImage(srcDataUrl, 'JPEG', (pdfW - rW) / 2, 10, rW, rH);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = srcDataUrl;
          });
        } else {
          // Text source → write text into PDF
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(16);
          pdf.text(sourceDoc.name, 14, 20);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(100);
          pdf.text(`Dikonversi: ${dateStr}`, 14, 28);
          pdf.setTextColor(40);
          pdf.setFontSize(11);
          const content = sourceDoc.content || '[Tidak ada konten teks]';
          const lines = pdf.splitTextToSize(content, pdfW - 28) as string[];
          pdf.text(lines, 14, 40);
        }
        const pdfDataUrl = pdf.output('datauristring');
        blob = dataURLtoBlob(pdfDataUrl);
      } else {
        // jsPDF not loaded — fallback plain text blob
        const content = sourceDoc.content || `Dokumen: ${sourceDoc.name}\nDikonversi: ${dateStr}`;
        blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      }

    } else if (targetFmt === 'DOCX') {
      // Generate minimal valid DOCX (Office Open XML) without external lib
      const content = sourceDoc.content || `Dokumen: ${sourceDoc.name}\nDikonversi: ${dateStr}`;
      const escaped = content
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const paragraphs = escaped.split('\n').map(line =>
        `<w:p><w:r><w:t xml:space="preserve">${line}</w:t></w:r></w:p>`
      ).join('');

      const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${sourceDoc.name}</w:t></w:r></w:p>
    ${paragraphs}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
  </w:body>
</w:document>`;

      const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

      const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

      // Build a minimal ZIP (DOCX is a ZIP) using raw bytes
      blob = buildDocxBlob(contentTypesXml, relsXml, docXml);
    }

    // Save converted doc to store
    const sizeBytes = blob ? blob.size : (dataUrlForStore ? Math.round(dataUrlForStore.length * 0.75) : 1024);
    const sizeKB = Math.round(sizeBytes / 1024);
    const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.max(1, sizeKB)} KB`;

    const newDoc: DocFile = {
      id: `doc_${Date.now()}`,
      name: outName,
      type: targetFmt.toLowerCase() as DocFile['type'],
      size: sizeStr,
      date: dateStr,
      color: fmt.color,
      content: sourceDoc.content,
      mimeType: fmt.mime,
    };

    addDoc(newDoc, dataUrlForStore);

    // Store blob as object URL for download
    if (blob) {
      const url = URL.createObjectURL(blob);
      setOutputDataUrl(url);
    } else if (dataUrlForStore) {
      setOutputDataUrl(dataUrlForStore);
    }

    setState('done');
  };

  const handleDownload = () => {
    if (!outputDataUrl || !targetFmt || !sourceDoc) return;

    const outName = sourceDoc.name.replace(/\.[^.]+$/, '') + '.' + targetFmt.toLowerCase();
    const a = document.createElement('a');
    a.href = outputDataUrl;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setToast(`✅ ${outName} berhasil diunduh!`);
  };

  const handleReset = () => {
    setState('idle');
    setTargetFmt(null);
    setProgress(0);
    setSourceDoc(null);
    setOutputDataUrl(null);
  };

  return (
    <div className="flex flex-col h-full bg-white page-enter relative">
      <StatusBar />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* File picker modal */}
      {showPicker && (
        <div className="absolute inset-0 z-50 bg-black/50 flex flex-col justify-end animate-fade">
          <div className="bg-white rounded-t-3xl p-5 max-h-[70%] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="font-black text-gray-900">Pilih Dokumen</p>
              <button onClick={() => setShowPicker(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            {docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <FileIcon size={40} className="text-gray-200" />
                <p className="text-sm text-gray-400 text-center">Belum ada dokumen.<br/>Pindai dokumen terlebih dahulu.</p>
                <button
                  onClick={() => { setShowPicker(false); onNavigate('scan'); }}
                  className="px-5 py-2.5 bg-gray-900 text-white rounded-2xl text-sm font-bold active:scale-95 transition-all"
                >
                  Pindai Dokumen
                </button>
              </div>
            ) : (
              <div className="overflow-y-auto space-y-2">
                {docs.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => { setSourceDoc(doc); setShowPicker(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 active:bg-gray-100 transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                      style={{ backgroundColor: typeColor(doc.type) }}>
                      {['jpg','png'].includes(doc.type) && getDataUrl(doc.id) ? (
                        <img src={getDataUrl(doc.id)} alt="" className="w-full h-full object-cover rounded-xl" />
                      ) : ['jpg','png'].includes(doc.type) ? (
                        <ImageIcon size={18} className="text-gray-600" />
                      ) : (
                        <FileIcon size={18} className="text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{doc.name}</p>
                      <p className="text-xs text-gray-400">{doc.size} · {doc.date}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg uppercase"
                      style={{ backgroundColor: typeColor(doc.type), color: '#4b5563' }}>
                      {doc.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50">
        <button
          onClick={() => onNavigate('home')}
          aria-label="Go back"
          className="w-9 h-9 rounded-2xl bg-gray-100 flex items-center justify-center active:scale-90 transition-all"
        >
          <ArrowLeftIcon size={18} />
        </button>
        <p className="text-sm font-bold text-gray-900">Konversi Dokumen</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Source file */}
        <div className="bg-gray-50 rounded-3xl p-4 mb-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">File Sumber</p>
          {sourceDoc ? (
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: typeColor(sourceDoc.type) }}>
                {['jpg','png'].includes(sourceDoc.type) && getDataUrl(sourceDoc.id) ? (
                  <img src={getDataUrl(sourceDoc.id)} alt="" className="w-full h-full object-cover rounded-2xl" />
                ) : ['jpg','png'].includes(sourceDoc.type) ? (
                  <ImageIcon size={20} className="text-gray-600" />
                ) : (
                  <FileIcon size={20} className="text-gray-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{sourceDoc.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sourceDoc.size} · {sourceDoc.date}</p>
              </div>
              {state === 'idle' && (
                <button
                  onClick={() => setShowPicker(true)}
                  className="text-xs text-gray-400 hover:text-gray-700 font-semibold active:scale-95 transition-all"
                >
                  Change
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowPicker(true)}
              className="w-full flex items-center gap-3 active:scale-95 transition-all"
            >
              <div className="w-11 h-11 rounded-2xl bg-gray-200 border-2 border-dashed border-gray-300 flex items-center justify-center">
                <FileIcon size={20} className="text-gray-400" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-bold text-gray-400 italic">Tap to select file</p>
                <p className="text-xs text-gray-300 mt-0.5">{docs.length} document{docs.length !== 1 ? 's' : ''} available</p>
              </div>
              <span className="text-xs text-gray-400">→</span>
            </button>
          )}
        </div>

        {/* Target format */}
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Convert To</p>
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {formats.map(({ id, color, desc }) => (
            <button
              key={id}
              onClick={() => { if (state === 'idle') { setTargetFmt(id); setProgress(0); } }}
              disabled={state !== 'idle'}
              aria-label={`Convert to ${id}`}
              className={`relative p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all active:scale-95
                ${targetFmt === id ? 'ring-2 ring-gray-900' : ''}
                ${state !== 'idle' && targetFmt !== id ? 'opacity-40' : ''}`}
              style={{ backgroundColor: color }}
            >
              {targetFmt === id && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center">
                  <CheckIcon size={10} className="text-white" />
                </div>
              )}
              <span className="text-sm font-black text-gray-800">{id}</span>
              <span className="text-[9px] font-medium text-gray-500 text-center">{desc}</span>
            </button>
          ))}
        </div>

        {/* Arrow indicator */}
        {sourceDoc && targetFmt && state === 'idle' && (
          <div className="flex items-center justify-center gap-4 mb-5 animate-fade">
            <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-xl">
              <FileIcon size={14} className="text-gray-500" />
              <span className="text-xs font-bold text-gray-500">{sourceDoc.type.toUpperCase()}</span>
            </div>
            <ConvertIcon size={20} className="text-gray-400" />
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ backgroundColor: formats.find(f => f.id === targetFmt)?.color }}>
              <FileIcon size={14} className="text-gray-600" />
              <span className="text-xs font-bold text-gray-700">{targetFmt}</span>
            </div>
          </div>
        )}

        {/* Progress */}
        {state === 'converting' && (
          <div className="mb-5 animate-fade">
            <div className="flex justify-between mb-2">
              <span className="text-xs font-semibold text-gray-600">Converting to {targetFmt}…</span>
              <span className="text-xs font-bold text-gray-900">{Math.min(Math.round(progress), 100)}%</span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-900 rounded-full transition-all duration-200"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Done state */}
        {state === 'done' && (
          <div className="mb-5 animate-fade">
            <div className="bg-green-50 border border-green-100 rounded-3xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-green-500 flex items-center justify-center flex-shrink-0">
                <CheckIcon size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-green-700">Conversion complete!</p>
                <p className="text-xs text-green-600 mt-0.5 truncate">
                  {sourceDoc?.name.replace(/\.[^.]+$/, '')}.{targetFmt?.toLowerCase()} · saved to Documents
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {state === 'idle' && (
          <button
            onClick={handleConvert}
            disabled={!targetFmt || !sourceDoc}
            className="w-full bg-gray-900 text-white rounded-2xl py-4 text-sm font-bold active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-gray-900/20"
          >
            {!sourceDoc ? 'Select a file first' : !targetFmt ? 'Select a format' : `Convert to ${targetFmt}`}
          </button>
        )}

        {state === 'converting' && (
          <button disabled className="w-full bg-gray-900/50 text-white rounded-2xl py-4 text-sm font-bold flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Converting…
          </button>
        )}

        {state === 'done' && (
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 py-3.5 rounded-2xl border-2 border-gray-100 text-gray-700 text-sm font-bold active:scale-95 transition-all"
            >
              Convert More
            </button>
            <button
              onClick={handleDownload}
              disabled={!outputDataUrl}
              className="flex-1 py-3.5 rounded-2xl bg-gray-900 text-white text-sm font-bold active:scale-95 transition-all shadow-lg shadow-gray-900/20 disabled:opacity-40"
            >
              ⬇ Download
            </button>
          </div>
        )}
      </div>

      <BottomNav current="convert" onNavigate={onNavigate} />
    </div>
  );
}
