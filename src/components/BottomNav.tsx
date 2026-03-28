import { Page } from '../types';
import { HomeIcon, DocsIcon, UserIcon } from './Icons';

interface Props {
  current: Page;
  onNavigate: (page: Page) => void;
}

const tabs = [
  { id: 'home' as Page,      icon: HomeIcon, label: 'Home' },
  { id: 'documents' as Page, icon: DocsIcon, label: 'Docs' },
  { id: 'profile' as Page,   icon: UserIcon, label: 'Profile' },
];

const activePages: Partial<Record<Page, Page>> = {
  home:      'home',
  scan:      'home',
  askai:     'home',
  documents: 'documents',
  profile:   'profile',
  // edit, convert, login, register → no active tab
};

export default function BottomNav({ current, onNavigate }: Props) {
  const activePage = activePages[current] ?? null;

  return (
    <div className="flex items-center justify-around px-6 py-3 bg-white border-t border-gray-100">
      {tabs.map(({ id, icon: Icon, label }) => {
        const isActive = activePage === id;
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            aria-label={`Navigate to ${label}`}
            className="flex flex-col items-center gap-1 transition-all active:scale-90"
          >
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all
              ${isActive ? 'bg-gray-900 text-white' : 'text-gray-400'}`}>
              <Icon size={20} />
            </div>
            <span className={`text-xs font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
