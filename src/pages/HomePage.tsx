import { useState } from 'react';
import { Page, User, DocFile } from '../types';
import StatusBar from '../components/StatusBar';
import BottomNav from '../components/BottomNav';
import {
  ScanIcon, EditIcon, ConvertIcon, AIIcon,
  BellIcon, SearchIcon, PlusIcon, FileIcon, MicIcon, ImageIcon
} from '../components/Icons';

interface Props {
  user: User;
  docs: DocFile[];
  onNavigate: (page: Page) => void;
  getDataUrl: (id: string) => string | undefined;
}

const quickActions = [
  { id: 'scan'    as Page, label: 'Pindai',     icon: ScanIcon,    bg: '#d4e9f7' },
  { id: 'edit'    as Page, label: 'Edit',       icon: EditIcon,    bg: '#ffffff' },
  { id: 'convert' as Page, label: 'Konversi',   icon: ConvertIcon, bg: '#d4f0e0' },
  { id: 'askai'   as Page, label: 'Tanya AI',   icon: AIIcon,      bg: '#fdf0c4' },
];

function typeColor(type: string) {
  const map: Record<string, string> = {
    pdf: '#e8d5f5', doc: '#d4e9f7', xls: '#d4f0e0',
    jpg: '#fdf0c4', png: '#ffe4e6', txt: '#e0e7ff',
  };
  return map[type] ?? '#f3f4f6';
}

export default function HomePage({ user, docs, onNavigate, getDataUrl }: Props) {
  const [search, setSearch] = useState('');
  const firstName = user.name.split(' ')[0];
  const recent = docs.slice(0, 4);

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.trim()) {
      onNavigate('askai');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white page-enter relative">
      <StatusBar />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-2">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className="relative">
            <button aria-label="Notifications" className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <BellIcon size={18} className="text-gray-600" />
            </button>
            {docs.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                {Math.min(docs.length, 9)}
              </span>
            )}
          </div>
        </div>

        {/* Greeting */}
        <div className="px-5 mb-5">
          <h1 className="text-4xl font-black text-gray-900 leading-tight">
            Hai {firstName},<br/>
            <span className="text-gray-400 font-black">Ada yang bisa dibantu</span><br/>
            hari ini?
          </h1>
        </div>

        {/* Quick Actions Grid */}
        <div className="px-5 mb-5">
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map(({ id, label, icon: Icon, bg }) => (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                aria-label={`Go to ${label}`}
                className="rounded-3xl p-4 flex flex-col items-start gap-3 transition-all active:scale-95 active:brightness-95"
                style={{
                  backgroundColor: bg,
                  border: bg === '#ffffff' ? '1.5px solid #e5e7eb' : 'none',
                  minHeight: '100px'
                }}
              >
                <div className="w-9 h-9 rounded-2xl bg-white/60 flex items-center justify-center">
                  <Icon size={18} className="text-gray-700" />
                </div>
                <span className="font-bold text-gray-800 text-sm">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Documents */}
        <div className="px-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Dokumen Terakhir</h2>
            <button
              onClick={() => onNavigate('documents')}
              className="text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors"
            >
              Lihat Semua →
            </button>
          </div>

          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-16 h-16 rounded-3xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center">
                <FileIcon size={28} className="text-gray-200" />
              </div>
              <p className="text-xs text-gray-400 font-medium text-center">
                Belum ada dokumen.<br/>Pindai atau unggah untuk memulai.
              </p>
              <button
                onClick={() => onNavigate('scan')}
                className="px-5 py-2 rounded-2xl bg-gray-900 text-white text-xs font-bold active:scale-95 transition-all"
              >
                Pindai Dokumen
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => onNavigate('documents')}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 active:bg-gray-100 transition-all text-left"
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: typeColor(doc.type) }}
                  >
                    {['jpg','png'].includes(doc.type) && getDataUrl(doc.id)
                      ? <img src={getDataUrl(doc.id)} alt="" className="w-full h-full object-cover" />
                      : ['jpg','png'].includes(doc.type)
                      ? <ImageIcon size={20} className="text-gray-600" />
                      : <FileIcon size={20} className="text-gray-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{doc.size} · {doc.date}</p>
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

      {/* Search bar + FAB */}
      <div className="px-5 py-3 bg-white border-t border-gray-50">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
            <SearchIcon size={16} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Tanya atau cari apa saja"
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-300 min-w-0 focus:outline-none"
            />
            <button
              aria-label="Voice search"
              onClick={() => onNavigate('askai')}
              className="text-gray-400 active:text-gray-700 transition-colors"
            >
              <MicIcon size={16} />
            </button>
          </div>
          <button
            onClick={() => onNavigate('askai')}
            aria-label="Ask AI"
            className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center flex-shrink-0 active:scale-90 transition-all shadow-lg shadow-gray-900/20"
          >
            <PlusIcon size={20} className="text-white" />
          </button>
        </div>
      </div>

      <BottomNav current="home" onNavigate={onNavigate} />
    </div>
  );
}
