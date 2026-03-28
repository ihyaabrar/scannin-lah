import { useState } from 'react';
import { Page, User } from '../types';
import { EyeIcon, EyeOffIcon } from '../components/Icons';
import StatusBar from '../components/StatusBar';

interface Props {
  onNavigate: (page: Page) => void;
  onLogin: (user: User) => void;
}

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function LoginPage({ onNavigate, onLogin }: Props) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = () => {
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    if (!isValidEmail(email)) { setError('Please enter a valid email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const raw = email.split('@')[0].replace(/[^a-zA-Z]/g, ' ').trim();
      const name = raw.charAt(0).toUpperCase() + raw.slice(1);
      onLogin({ name, email });
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="flex flex-col h-full bg-white page-enter overflow-y-auto">
      <StatusBar />

      {/* Decorations */}
      <div className="absolute top-0 right-0 w-52 h-52 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #ddd6fe 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
      <div className="absolute top-32 left-0 w-36 h-36 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #bfdbfe 0%, transparent 70%)', transform: 'translate(-40%,0)' }} />

      <div className="flex-1 flex flex-col px-7 pt-6 pb-6 relative">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-gray-900 leading-tight">Welcome<br/>back 👋</h1>
          <p className="text-gray-400 mt-2 text-sm font-medium">Masuk ke akun Scanin Lah kamu</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label htmlFor="login-email" className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder-gray-300 focus:border-gray-900 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Password</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder-gray-300 focus:border-gray-900 focus:bg-white transition-all pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPass ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </div>
          </div>

          <div className="text-right">
            <button className="text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors">
              Forgot password?
            </button>
          </div>

          {error && (
            <div role="alert" className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-xs text-red-500 font-medium flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-gray-900 text-white rounded-2xl py-4 text-sm font-bold tracking-wide transition-all active:scale-95 disabled:opacity-60 shadow-lg shadow-gray-900/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in…
              </span>
            ) : 'Sign In'}
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-300 font-medium">OR</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <button
            onClick={() => onLogin({ name: 'Peter', email: 'peter@google.com' })}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 text-sm font-semibold text-gray-700 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-6 text-center">
          <p className="text-sm text-gray-400">
            Don't have an account?{' '}
            <button
              onClick={() => onNavigate('register')}
              className="font-bold text-gray-900 hover:underline"
            >
              Sign Up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
