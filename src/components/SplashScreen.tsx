import { useEffect, useState } from 'react';

interface Props {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<'show' | 'fade'>('show');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('fade'), 1900);
    const t2 = setTimeout(() => onDone(), 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(160deg, #f8fafc 0%, #e2e8f0 60%, #f1f5f9 100%)',
        opacity: phase === 'fade' ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }}
    >
      {/* Decorative blobs — match app background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/6 w-64 h-64 rounded-full opacity-40 blur-3xl" style={{ backgroundColor: '#bfdbfe' }} />
        <div className="absolute bottom-1/4 right-1/6 w-56 h-56 rounded-full opacity-30 blur-3xl" style={{ backgroundColor: '#c7d2fe' }} />
      </div>

      <div className="relative flex flex-col items-center gap-6 splash-enter">
        {/* Logo card — white, matches phone UI */}
        <div
          className="w-28 h-28 rounded-[32px] flex items-center justify-center"
          style={{
            background: 'white',
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
          }}
        >
          <img src="/logo.svg" alt="Scanin Lah" className="w-24 h-24" />
        </div>

        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight" style={{ color: '#1e293b' }}>
            Scanin{' '}
            <span style={{
              background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Lah
            </span>
          </h1>
          <p className="text-sm font-medium mt-1.5" style={{ color: '#94a3b8' }}>
            Asisten Dokumen Pintar
          </p>
        </div>

        {/* Loading dots */}
        <div className="flex items-center gap-2 mt-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: i === 1 ? '#6366f1' : '#3b82f6',
                opacity: i === 0 ? 0.9 : i === 1 ? 0.6 : 0.3,
                animation: `bounce-dot 1.2s infinite ${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes splashEnter {
          from { opacity: 0; transform: scale(0.88) translateY(24px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .splash-enter { animation: splashEnter 0.55s cubic-bezier(.22,1,.36,1) forwards; }
      `}</style>
    </div>
  );
}
