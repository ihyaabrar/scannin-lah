import { useState } from 'react';
import { Page, User } from '../types';
import { ArrowLeftIcon, EyeIcon, EyeOffIcon, CheckIcon } from '../components/Icons';
import StatusBar from '../components/StatusBar';

interface Props {
  onNavigate: (page: Page) => void;
  onLogin: (user: User) => void;
}

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function passwordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair', color: '#f59e0b' };
  if (score <= 3) return { score, label: 'Good', color: '#3b82f6' };
  return { score, label: 'Strong', color: '#22c55e' };
}

export default function RegisterPage({ onNavigate, onLogin }: Props) {
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed]           = useState(false);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  const pwdStr = passwordStrength(password);

  const handleRegister = () => {
    setError('');
    if (!name.trim()) { setError('Please enter your full name.'); return; }
    if (!isValidEmail(email)) { setError('Please enter a valid email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPwd) { setError('Passwords do not match.'); return; }
    if (!agreed) { setError('Please accept the Terms & Privacy Policy.'); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const n = name.trim().charAt(0).toUpperCase() + name.trim().slice(1);
      onLogin({ name: n, email });
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full bg-white page-enter overflow-y-auto">
      <StatusBar />

      <div className="absolute top-0 right-0 w-52 h-52 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #d1fae5 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />

      <div className="flex-1 flex flex-col px-7 pt-4 pb-6 relative">
        {/* Back */}
        <button
          onClick={() => onNavigate('login')}
          aria-label="Go back to login"
          className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center mb-5 active:scale-90 transition-all"
        >
          <ArrowLeftIcon size={18} />
        </button>

        <div className="mb-6">
          <h1 className="text-4xl font-black text-gray-900 leading-tight">Create<br/>account ✨</h1>
          <p className="text-gray-400 mt-2 text-sm font-medium">Bergabung dengan Scanin Lah dan mulai kelola dokumenmu</p>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="reg-name" className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Full Name</label>
            <input
              id="reg-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Peter Parker"
              autoComplete="name"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder-gray-300 focus:border-gray-900 focus:bg-white transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="reg-email" className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Email</label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder-gray-300 focus:border-gray-900 focus:bg-white transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="reg-password" className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Password</label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                autoComplete="new-password"
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder-gray-300 focus:border-gray-900 focus:bg-white transition-all pr-12"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'Hide' : 'Show'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {showPass ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                      style={{ backgroundColor: i <= pwdStr.score ? pwdStr.color : '#e5e7eb' }} />
                  ))}
                </div>
                <p className="text-xs font-semibold" style={{ color: pwdStr.color }}>{pwdStr.label}</p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="reg-confirm" className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Confirm Password</label>
            <div className="relative">
              <input
                id="reg-confirm"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
                className={`w-full bg-gray-50 border rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder-gray-300 focus:bg-white transition-all pr-12
                  ${confirmPwd && confirmPwd !== password ? 'border-red-300 focus:border-red-400' :
                    confirmPwd && confirmPwd === password ? 'border-green-300 focus:border-green-400' :
                    'border-gray-100 focus:border-gray-900'}`}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} aria-label={showConfirm ? 'Hide' : 'Show'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {showConfirm ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
              {confirmPwd && confirmPwd === password && (
                <div className="absolute right-10 top-1/2 -translate-y-1/2 text-green-500">
                  <CheckIcon size={16} />
                </div>
              )}
            </div>
          </div>

          {/* Terms */}
          <label className="flex items-start gap-3 cursor-pointer">
            <div
              onClick={() => setAgreed(!agreed)}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all
                ${agreed ? 'bg-gray-900 border-gray-900' : 'border-gray-200'}`}
            >
              {agreed && <CheckIcon size={12} className="text-white" />}
            </div>
            <span className="text-xs text-gray-400 leading-relaxed">
              I agree to the{' '}
              <span className="font-bold text-gray-900">Terms of Service</span>{' '}
              and{' '}
              <span className="font-bold text-gray-900">Privacy Policy</span>
            </span>
          </label>

          {error && (
            <div role="alert" className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-xs text-red-500 font-medium flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-gray-900 text-white rounded-2xl py-4 text-sm font-bold tracking-wide transition-all active:scale-95 disabled:opacity-60 shadow-lg shadow-gray-900/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating account…
              </span>
            ) : 'Create Account'}
          </button>
        </div>

        <div className="mt-5 text-center">
          <p className="text-sm text-gray-400">
            Already have an account?{' '}
            <button onClick={() => onNavigate('login')} className="font-bold text-gray-900 hover:underline">Sign In</button>
          </p>
        </div>
      </div>
    </div>
  );
}
