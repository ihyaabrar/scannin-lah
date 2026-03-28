import { useEffect } from 'react';
import { CheckIcon, CloseIcon } from './Icons';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  const bg = type === 'success' ? 'bg-gray-900' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';

  return (
    <div className={`absolute top-16 left-4 right-4 z-50 ${bg} text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg toast-enter`}>
      {type === 'success' && (
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <CheckIcon size={14} className="text-white" />
        </div>
      )}
      <span className="text-sm font-medium flex-1">{message}</span>
      <button onClick={onClose} className="text-white/60 hover:text-white" aria-label="Close notification">
        <CloseIcon size={16} />
      </button>
    </div>
  );
}
