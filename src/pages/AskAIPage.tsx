import { useState, useRef, useEffect } from 'react';
import { Page, User, DocFile } from '../types';
import StatusBar from '../components/StatusBar';
import BottomNav from '../components/BottomNav';
import { ArrowLeftIcon, SendIcon, MicIcon, AIIcon } from '../components/Icons';

interface Props {
  user: User;
  docs: DocFile[];
  onNavigate: (page: Page) => void;
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  time: string;
}

const SUGGESTIONS = [
  'Dokumen apa saja yang saya punya?',
  'Ringkaskan dokumen saya',
  'Cara scan dokumen?',
  'Cara konversi ke PDF?',
];

function getTime() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
}

// ── AI Engine — bahasa Indonesia, context-aware, analisa konten ──────────────
function buildReply(input: string, docs: DocFile[], userName: string): string {
  const q = input.toLowerCase().trim();
  const nama = userName.split(' ')[0];

  // ── Salam ──
  if (/^(halo|hai|hi|hello|hey|selamat|pagi|siang|sore|malam)/.test(q)) {
    const jam = new Date().getHours();
    const waktu = jam < 11 ? 'pagi' : jam < 15 ? 'siang' : jam < 18 ? 'sore' : 'malam';
    return `Halo ${nama}! Selamat ${waktu} 👋\n\nSaya asisten AI Scanin Lah. Kamu punya ${docs.length} dokumen tersimpan.\n\nSaya bisa membantu:\n• Menganalisa & meringkas isi dokumen\n• Menjawab pertanyaan tentang konten dokumen\n• Mencari informasi di dokumenmu\n• Panduan penggunaan fitur\n\nTanyakan apa saja!`;
  }

  // ── Terima kasih ──
  if (/terima kasih|makasih|thanks|thank you/.test(q)) {
    return `Sama-sama, ${nama}! 😊 Senang bisa membantu. Ada lagi yang perlu dianalisa?`;
  }

  // ── Analisa / baca isi dokumen ──
  if (/analisa|analisis|baca|isi|konten|apa yang ada|tentang apa|membahas|berisi/.test(q)) {
    const textDocs = docs.filter(d => d.content && d.content.trim().length > 20);
    if (textDocs.length === 0) {
      return `Belum ada dokumen dengan konten teks untuk dianalisa, ${nama}.\n\nCoba:\n1. Pindai dokumen terlebih dahulu\n2. Buka halaman Edit\n3. Gunakan "Kenali Teks" (OCR) untuk mengekstrak teks\n4. Kembali ke sini dan tanya lagi!`;
    }
    // Cari dokumen yang disebutkan dalam query
    const target = textDocs.find(d =>
      q.includes(d.name.toLowerCase().replace(/\.[^.]+$/, ''))
    ) ?? textDocs[0];

    const words = target.content!.trim().split(/\s+/);
    const sentences = target.content!.split(/[.!?]+/).filter(s => s.trim().length > 15);
    const topicWords = words
      .filter(w => w.length > 4)
      .reduce((acc: Record<string, number>, w) => {
        const key = w.toLowerCase().replace(/[^a-z]/g, '');
        if (key) acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    const topTopics = Object.entries(topicWords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w]) => w);

    return `📄 Analisa "${target.name}":\n\n📊 Statistik:\n• ${words.length} kata\n• ${sentences.length} kalimat\n• ${target.content!.split('\n').filter(l => l.trim()).length} baris\n\n🔑 Kata kunci utama:\n${topTopics.map(t => `• ${t}`).join('\n')}\n\n📝 Cuplikan awal:\n"${sentences.slice(0, 2).join('. ').slice(0, 200)}…"`;
  }

  // ── Ringkasan ──
  if (/ringkas|rangkum|summary|summarize|singkat/.test(q)) {
    const textDocs = docs.filter(d => d.content && d.content.trim().length > 20);
    if (textDocs.length === 0) {
      return `Belum ada dokumen dengan konten teks.\n\nGunakan fitur "Kenali Teks" di halaman Edit untuk mengekstrak teks dari dokumen gambarmu terlebih dahulu.`;
    }
    const target = textDocs.find(d =>
      q.includes(d.name.toLowerCase().replace(/\.[^.]+$/, ''))
    ) ?? textDocs[0];

    const sentences = target.content!
      .split(/[.!?\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20)
      .slice(0, 4);

    return `📋 Ringkasan "${target.name}":\n\n${sentences.map((s, i) => `${i + 1}. ${s}.`).join('\n')}\n\n(${target.content!.split(/\s+/).length} kata total)`;
  }

  // ── Cari kata/frasa dalam dokumen ──
  if (/cari|temukan|ada kata|ada tulisan|mencari|apakah ada/.test(q)) {
    // Ekstrak kata yang dicari (setelah kata "cari", "temukan", dll)
    const searchMatch = q.match(/(?:cari|temukan|ada kata|ada tulisan|mencari|apakah ada)\s+["']?([^"'?]+)["']?/);
    const keyword = searchMatch?.[1]?.trim();
    if (keyword && keyword.length > 1) {
      const results = docs.filter(d =>
        d.content?.toLowerCase().includes(keyword.toLowerCase()) ||
        d.name.toLowerCase().includes(keyword.toLowerCase())
      );
      if (results.length === 0) {
        return `Tidak ditemukan kata "${keyword}" di dokumen manapun.`;
      }
      return `🔍 Ditemukan "${keyword}" di ${results.length} dokumen:\n\n${results.map(d => {
        const idx = d.content?.toLowerCase().indexOf(keyword.toLowerCase()) ?? -1;
        const snippet = idx >= 0 ? '…' + d.content!.slice(Math.max(0, idx - 30), idx + 60) + '…' : '';
        return `📄 ${d.name}${snippet ? `\n   "${snippet}"` : ''}`;
      }).join('\n\n')}`;
    }
    return `Kata apa yang ingin kamu cari? Contoh: "cari kata kontrak" atau "temukan tanggal"`;
  }

  // ── Bandingkan dokumen ──
  if (/banding|compare|bedanya|perbedaan|sama|mirip/.test(q)) {
    const textDocs = docs.filter(d => d.content && d.content.trim().length > 20);
    if (textDocs.length < 2) {
      return `Perlu minimal 2 dokumen dengan konten teks untuk dibandingkan.\n\nSaat ini ada ${textDocs.length} dokumen berteks.`;
    }
    const [d1, d2] = textDocs.slice(0, 2);
    const w1 = new Set(d1.content!.toLowerCase().split(/\s+/));
    const w2 = new Set(d2.content!.toLowerCase().split(/\s+/));
    const common = [...w1].filter(w => w2.has(w) && w.length > 4).length;
    const similarity = Math.round((common / Math.max(w1.size, w2.size)) * 100);
    return `📊 Perbandingan dokumen:\n\n📄 "${d1.name}" vs "${d2.name}"\n\n• Kesamaan kata: ~${similarity}%\n• Kata unik di dok.1: ${w1.size - common}\n• Kata unik di dok.2: ${w2.size - common}\n• Kata yang sama: ${common}\n\n${similarity > 60 ? '⚠️ Dokumen ini cukup mirip.' : similarity > 30 ? '📝 Ada beberapa kesamaan.' : '✅ Dokumen ini berbeda secara signifikan.'}`;
  }

  // ── Daftar dokumen ──
  if (/dokumen|file|berkas|list|daftar|punya|ada apa|apa saja/.test(q)) {
    if (docs.length === 0) {
      return `Kamu belum punya dokumen tersimpan, ${nama}.\n\nCoba pindai dokumen pertamamu dengan menekan tombol 📷 Pindai di halaman utama!`;
    }
    const list = docs.slice(0, 8).map((d, i) =>
      `${i + 1}. ${d.name} (${d.type.toUpperCase()}) — ${d.size} · ${d.date}`
    ).join('\n');
    const sisa = docs.length > 8 ? `\n...dan ${docs.length - 8} dokumen lainnya.` : '';
    return `Kamu punya ${docs.length} dokumen:\n\n${list}${sisa}\n\nKetuk nama dokumen untuk melihat detailnya, atau minta saya untuk menganalisa isinya!`;
  }

  // ── Cari dokumen spesifik ──
  const matchDoc = docs.find(d => {
    const baseName = d.name.toLowerCase().replace(/\.[^.]+$/, '');
    return q.includes(baseName) || baseName.split(/[\s_-]/).some(part => part.length > 3 && q.includes(part));
  });
  if (matchDoc) {
    const hasContent = matchDoc.content && matchDoc.content.trim().length > 0;
    const words = hasContent ? matchDoc.content!.split(/\s+/).length : 0;
    return `Ditemukan: "${matchDoc.name}"\n\n📋 Tipe: ${matchDoc.type.toUpperCase()}\n📦 Ukuran: ${matchDoc.size}\n📅 Tanggal: ${matchDoc.date}${hasContent ? `\n📝 Konten: ${words} kata\n\n💡 Minta saya untuk "analisa ${matchDoc.name.replace(/\.[^.]+$/, '')}" atau "ringkas ${matchDoc.name.replace(/\.[^.]+$/, '')}"` : '\n\n💡 Gunakan OCR di halaman Edit untuk mengekstrak teks dari dokumen ini.'}`;
  }

  // ── Cara scan ──
  if (/scan|pindai|foto|kamera|ambil gambar/.test(q)) {
    return `Cara memindai dokumen:\n\n1️⃣ Tekan "Pindai" di halaman utama\n2️⃣ Izinkan akses kamera\n3️⃣ Arahkan ke dokumen — AI otomatis deteksi tepi\n4️⃣ Tekan tombol rana ⚪ untuk foto\n5️⃣ Sesuaikan sudut jika perlu → Crop ✓\n6️⃣ Pilih format (PDF/JPG/PNG)\n7️⃣ Tekan "💾 Simpan"\n\n💡 Tekan "➕ Scan Lagi" untuk scan banyak halaman sekaligus!`;
  }

  // ── Cara konversi ──
  if (/konversi|convert|ubah format|ganti format/.test(q)) {
    return `Cara mengonversi dokumen:\n\n1️⃣ Buka halaman "Konversi"\n2️⃣ Pilih dokumen sumber\n3️⃣ Pilih format tujuan (PDF/DOCX/TXT/JPG/PNG)\n4️⃣ Tekan "Konversi"\n5️⃣ Setelah selesai → "⬇ Unduh"\n\nHasil konversi otomatis tersimpan di Dokumen!`;
  }

  // ── Cara edit / OCR ──
  if (/edit|ubah|sunting|ocr|kenali teks|ekstrak teks/.test(q)) {
    return `Cara mengedit & OCR dokumen:\n\n1️⃣ Buka "Dokumen" → ketuk file\n2️⃣ Tekan "Edit"\n3️⃣ Pilih alat:\n   • ✏️ Tambah Teks — ketik langsung\n   • 🖊️ Markup — sorot teks\n   • 🔍 Kenali Teks — OCR otomatis (Tesseract.js)\n   • 🙈 Sembunyikan — redaksi konten\n4️⃣ Tekan "Save"\n\nSetelah OCR, kamu bisa minta saya untuk menganalisa isinya!`;
  }

  // ── Statistik ──
  if (/statistik|stats|berapa|jumlah|total/.test(q)) {
    const byType: Record<string, number> = {};
    docs.forEach(d => { byType[d.type] = (byType[d.type] ?? 0) + 1; });
    const typeList = Object.entries(byType).map(([t, n]) => `• ${t.toUpperCase()}: ${n} file`).join('\n');
    const withText = docs.filter(d => d.content && d.content.trim().length > 0).length;
    return `📊 Statistik dokumenmu:\n\nTotal: ${docs.length} dokumen\nBerteks (bisa dianalisa): ${withText}\n\n${typeList || '(belum ada dokumen)'}`;
  }

  // ── Bantuan umum ──
  if (/bantuan|help|bisa apa|fitur|apa yang|kemampuan/.test(q)) {
    return `Saya bisa membantu kamu dengan:\n\n🔍 Analisa isi dokumen\n📋 Meringkas konten\n🔎 Mencari kata/frasa di dokumen\n📊 Membandingkan 2 dokumen\n📄 Melihat daftar & detail dokumen\n📷 Panduan scan & multi-scan\n🔄 Panduan konversi format\n✏️ Panduan edit & OCR\n📊 Statistik dokumenmu\n\nKamu punya ${docs.length} dokumen. Tanyakan apa saja! 😊`;
  }

  // ── Default ──
  const responses = [
    `Hmm, bisa diperjelas pertanyaanmu, ${nama}?\n\nContoh yang bisa saya bantu:\n• "Analisa dokumen saya"\n• "Ringkaskan [nama file]"\n• "Cari kata kontrak di dokumen saya"\n• "Bandingkan dua dokumen saya"`,
    `Saya spesialis analisa dokumen! Coba tanya:\n• "Apa isi dokumen saya?"\n• "Ringkaskan dokumen pertama"\n• "Cari kata penting"\n\nKamu punya ${docs.length} dokumen yang bisa dianalisa.`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// ── Web Speech API ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

function useSpeechRecognition(onResult: (text: string) => void) {
  const recogRef = useRef<AnyRecognition | null>(null);
  const [listening, setListening] = useState(false);
  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = () => {
    if (!supported) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const API = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recog = new API();
    recog.lang = 'id-ID'; // Bahasa Indonesia
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.onstart  = () => setListening(true);
    recog.onend    = () => setListening(false);
    recog.onerror  = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onresult = (e: any) => onResult(e.results[0][0].transcript);
    recog.start();
    recogRef.current = recog;
  };

  const stopListening = () => { recogRef.current?.stop(); setListening(false); };
  return { listening, startListening, stopListening, supported };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AskAIPage({ user, docs, onNavigate }: Props) {
  const [messages, setMessages] = useState<Message[]>([{
    id: '0',
    role: 'ai',
    text: `Halo ${user.name.split(' ')[0]}! 👋 Saya DocAI, asisten dokumen pintarmu.\n\nKamu punya ${docs.length > 0 ? `${docs.length} dokumen tersimpan` : 'belum ada dokumen'}. Tanyakan apa saja tentang dokumenmu!`,
    time: getTime(),
  }]);
  const [input, setInput]   = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef           = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLInputElement>(null);

  const { listening, startListening, stopListening, supported: micSupported } =
    useSpeechRecognition((text) => {
      setInput(text);
      setTimeout(() => sendMessage(text), 300);
    });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: trimmed, time: getTime() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    // Simulate realistic typing delay (400–900ms)
    const delay = 400 + Math.random() * 500;
    setTimeout(() => {
      const reply = buildReply(trimmed, docs, user.name);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: reply, time: getTime() }]);
      setTyping(false);
    }, delay);
  };

  return (
    <div className="flex flex-col h-full bg-white page-enter">
      <StatusBar />

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50">
        <button
          onClick={() => onNavigate('home')}
          aria-label="Kembali"
          className="w-9 h-9 rounded-2xl bg-gray-100 flex items-center justify-center active:scale-90 transition-all"
        >
          <ArrowLeftIcon size={18} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-9 h-9 rounded-2xl bg-gray-900 flex items-center justify-center">
            <AIIcon size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">DocAI Asisten</p>
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${listening ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              <span className="text-xs text-gray-400">{listening ? 'Mendengarkan…' : 'Online'}</span>
            </div>
          </div>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-xl font-semibold">
          {docs.length} dok
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Suggestions — only on first load */}
        {messages.length <= 1 && (
          <div className="animate-fade">
            <p className="text-xs text-gray-400 font-medium text-center mb-3">Pertanyaan yang sering ditanyakan</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-semibold text-gray-600 active:scale-95 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade`}>
            {msg.role === 'ai' && (
              <div className="w-7 h-7 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                <AIIcon size={14} className="text-white" />
              </div>
            )}
            <div className="max-w-[78%]">
              <div className={`px-4 py-3 rounded-3xl text-sm leading-relaxed whitespace-pre-line
                ${msg.role === 'user'
                  ? 'bg-gray-900 text-white rounded-br-sm'
                  : 'bg-gray-50 text-gray-800 rounded-bl-sm'}`}>
                {msg.text}
              </div>
              <p className={`text-[10px] text-gray-400 mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                {msg.time}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {typing && (
          <div className="flex items-center gap-2 animate-fade">
            <div className="w-7 h-7 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
              <AIIcon size={14} className="text-white" />
            </div>
            <div className="bg-gray-50 px-4 py-3 rounded-3xl rounded-bl-sm flex items-center gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full dot-1" />
              <div className="w-2 h-2 bg-gray-400 rounded-full dot-2" />
              <div className="w-2 h-2 bg-gray-400 rounded-full dot-3" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-50 bg-white">
        <div className="flex items-center gap-2">
          {micSupported && (
            <button
              aria-label={listening ? 'Hentikan suara' : 'Mulai suara'}
              onClick={listening ? stopListening : startListening}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center active:scale-90 transition-all
                ${listening ? 'bg-red-500' : 'bg-gray-100'}`}
            >
              <MicIcon size={18} className={listening ? 'text-white' : 'text-gray-500'} />
            </button>
          )}
          <div className="flex-1 flex items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2.5 gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              placeholder="Tanya apa saja tentang dokumenmu…"
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-300 focus:outline-none"
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || typing}
            aria-label="Kirim pesan"
            className="w-10 h-10 bg-gray-900 rounded-2xl flex items-center justify-center active:scale-90 transition-all disabled:opacity-40"
          >
            <SendIcon size={16} className="text-white" />
          </button>
        </div>
        {listening && (
          <p className="text-xs text-center text-red-500 mt-2 animate-pulse font-medium">
            🎤 Mendengarkan… ketuk mikrofon untuk berhenti
          </p>
        )}
      </div>

      <BottomNav current="askai" onNavigate={onNavigate} />
    </div>
  );
}
