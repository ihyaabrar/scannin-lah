import { useState, useEffect, useCallback } from 'react';
import { Page, User } from './types';
import { useStore } from './useStore';
import { useAndroidBack } from './hooks/useAndroidBack';
import SplashScreen from './components/SplashScreen';
import LoginPage    from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage     from './pages/HomePage';
import DocumentsPage from './pages/DocumentsPage';
import ProfilePage  from './pages/ProfilePage';
import AskAIPage    from './pages/AskAIPage';
import ScanPage     from './pages/ScanPage';
import EditPage     from './pages/EditPage';
import ConvertPage  from './pages/ConvertPage';

const PROTECTED: Page[] = ['home','documents','profile','scan','edit','convert','askai'];

// Page back-navigation map
const BACK_MAP: Partial<Record<Page, Page>> = {
  documents: 'home',
  profile:   'home',
  askai:     'home',
  scan:      'home',
  edit:      'documents',
  convert:   'home',
  register:  'login',
};

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [page, setPage]   = useState<Page>('login');
  const [user, setUser]   = useState<User | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const { docs, addDoc, updateDoc, deleteDoc, getDataUrl } = useStore();

  const navigate = useCallback((next: Page) => {
    if (PROTECTED.includes(next) && !user) { setPage('login'); return; }
    setAnimKey(k => k + 1);
    setPage(next);
  }, [user]);

  const navigateEdit = (docId: string) => {
    setEditDocId(docId);
    navigate('edit');
  };

  // Android hardware back button
  const handleBack = useCallback(() => {
    const backPage = BACK_MAP[page];
    if (backPage) {
      navigate(backPage);
    } else if (page === 'home') {
      // Minimize app on home (Android behavior)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cap = (window as any).Capacitor;
      if (cap?.isNativePlatform()) {
        import('@capacitor/app').then(({ App }) => App.minimizeApp()).catch(() => {});
      }
    }
  }, [page, navigate]);

  useAndroidBack(page, handleBack);

  useEffect(() => {
    if (user && !PROTECTED.includes(page)) setPage('home');
  }, [user]); // eslint-disable-line

  const handleLogin = (u: User) => {
    setUser(u);
    setAnimKey(k => k + 1);
    setPage('home');
  };

  const handleLogout = () => {
    setUser(null);
    setAnimKey(k => k + 1);
    setPage('login');
  };

  const renderPage = () => {
    if (page === 'login')    return <LoginPage    onNavigate={navigate} onLogin={handleLogin} />;
    if (page === 'register') return <RegisterPage onNavigate={navigate} onLogin={handleLogin} />;
    if (!user) return <LoginPage onNavigate={navigate} onLogin={handleLogin} />;

    switch (page) {
      case 'home':
        return <HomePage user={user} docs={docs} onNavigate={navigate} getDataUrl={getDataUrl} />;
      case 'documents':
        return <DocumentsPage user={user} docs={docs} deleteDoc={deleteDoc} getDataUrl={getDataUrl} onNavigate={navigate} onEditDoc={navigateEdit} updateDoc={updateDoc} />;
      case 'profile':
        return <ProfilePage user={user} docs={docs} onNavigate={navigate} onLogout={handleLogout} />;
      case 'askai':
        return <AskAIPage user={user} docs={docs} onNavigate={navigate} />;
      case 'scan':
        return <ScanPage user={user} onNavigate={navigate} addDoc={addDoc} />;
      case 'edit':
        return <EditPage user={user} docs={docs} editDocId={editDocId} onNavigate={navigate} updateDoc={updateDoc} />;
      case 'convert':
        return <ConvertPage user={user} docs={docs} onNavigate={navigate} addDoc={addDoc} getDataUrl={getDataUrl} />;
      default:
        return <HomePage user={user} docs={docs} onNavigate={navigate} getDataUrl={getDataUrl} />;
    }
  };

  return (
    <>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}

      <div
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{ background: 'linear-gradient(135deg, #a8b4c8 0%, #b8c0cc 50%, #a0abb8 100%)' }}
      >
        {/* Background blobs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/6 w-80 h-80 rounded-full opacity-30 blur-3xl" style={{ backgroundColor: '#c8d0dc' }} />
          <div className="absolute bottom-1/4 right-1/6 w-72 h-72 rounded-full opacity-25 blur-3xl" style={{ backgroundColor: '#b4bcc8' }} />
          <div className="absolute top-3/4 left-1/2 w-60 h-60 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: '#c0c8d4' }} />
        </div>

        {/* Phone shell */}
        <div className="relative select-none" style={{ width: '390px' }}>
          {/* Side buttons – left */}
          <div className="absolute -left-2 top-28 w-1.5 h-7 bg-gradient-to-b from-gray-400 to-gray-500 rounded-l-sm shadow" />
          <div className="absolute -left-2 top-40 w-1.5 h-12 bg-gradient-to-b from-gray-400 to-gray-500 rounded-l-sm shadow" />
          <div className="absolute -left-2 top-56 w-1.5 h-12 bg-gradient-to-b from-gray-400 to-gray-500 rounded-l-sm shadow" />
          {/* Side button – right */}
          <div className="absolute -right-2 top-36 w-1.5 h-16 bg-gradient-to-b from-gray-400 to-gray-500 rounded-r-sm shadow" />

          {/* Phone frame */}
          <div className="phone-frame" style={{ height: '844px' }}>
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-50"
              style={{ width: '126px', height: '34px', background: '#111', borderRadius: '0 0 20px 20px' }}>
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-800" />
                <div className="w-8 h-1.5 rounded-full bg-gray-800" />
              </div>
            </div>

            {/* Screen */}
            <div className="absolute inset-0 overflow-hidden rounded-[48px] pt-[34px]">
              <div className="w-full h-full overflow-hidden" key={animKey}>
                {renderPage()}
              </div>
            </div>

            {/* Home indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-gray-400 rounded-full" />
          </div>
        </div>
      </div>
    </>
  );
}
