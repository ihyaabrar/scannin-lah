import { useState, useEffect } from 'react';

export default function StatusBar({ dark = false }: { dark?: boolean }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      setTime(`${h}:${m}`);
    };
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);

  const textColor = dark ? 'text-white' : 'text-gray-900';

  return (
    <div className={`flex items-center justify-between px-6 pt-3 pb-1 ${textColor}`} style={{ height: '44px' }}>
      <span className="text-sm font-semibold tabular-nums">{time || '09:41'}</span>
      <div className="flex items-center gap-1.5">
        {/* Signal */}
        <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
          <rect x="0" y="6" width="3" height="6" rx="0.5" opacity="0.4"/>
          <rect x="4.5" y="4" width="3" height="8" rx="0.5" opacity="0.6"/>
          <rect x="9" y="2" width="3" height="10" rx="0.5" opacity="0.8"/>
          <rect x="13.5" y="0" width="3" height="12" rx="0.5"/>
        </svg>
        {/* Wifi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
          <path d="M8 9.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
          <path d="M4.9 7.2a4.4 4.4 0 0 1 6.2 0" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
          <path d="M2.1 4.5A8 8 0 0 1 13.9 4.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
          <path d="M0 1.8A11.5 11.5 0 0 1 16 1.8" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
        </svg>
        {/* Battery */}
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" strokeOpacity="0.4"/>
          <rect x="1.5" y="1.5" width="17" height="9" rx="2" fill="currentColor"/>
          <path d="M22.5 4v4a2 2 0 0 0 0-4z" fill="currentColor" fillOpacity="0.4"/>
        </svg>
      </div>
    </div>
  );
}
