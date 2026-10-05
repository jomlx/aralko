import { useState, useEffect } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

type AuthView = 'login' | 'signup';

function friendlyError(msg: string): string {
  if (!msg) return 'Something went wrong. Please try again.';
  const m = msg.toLowerCase();
  
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials'))
    return 'Incorrect email or password.';
  if (m.includes('email not confirmed'))
    return 'Please check your email and confirm your account first.';
    
  // Handle email collision (either signing up via email when Google exists, or Google when email exists)
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('saving new user'))
    return "This email's already taken. Sign in instead, or try Google if you used that before.";
    
  if (m.includes('password') && m.includes('6'))
    return 'Password must be at least 6 characters.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Too many attempts. Please wait a moment and try again.';
  if (m.includes('network') || m.includes('fetch'))
    return 'Unable to connect. Please check your internet connection.';
    
  return 'Unable to sign in right now. Please try again.';
}

export function AuthPage() {
  const [view, setView] = useState<AuthView>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Catch OAuth errors returned in the URL hash from Supabase (e.g. email collision)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const errDesc = params.get('error_description');
      if (errDesc) {
        setError(friendlyError(errDesc.replace(/\+/g, ' ')));
        // Clean up the URL so it doesn't persist on reload
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  const switchView = (v: AuthView) => {
    setView(v);
    setError(null);
    setSuccessMsg(null);
    setName('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirm(false);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (view === 'signup' && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (view === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (view === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { full_name: name.trim() }
          }
        });
        if (err) throw err;
        
        // When email enumeration protection is ON, Supabase returns success but with empty identities if the email is taken.
        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error('User already registered');
        }

        setSuccessMsg('Account created! Check your email to confirm, then sign in.');
        switchView('login');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err: any) {
      setError(friendlyError(err.message || ''));
      setSuccessMsg(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (err) throw err;
    } catch (err: any) {
      setError(friendlyError(err.message || ''));
      setGoogleLoading(false);
    }
  };

  const isLogin = view === 'login';

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo + heading */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="h-16 w-16 flex shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-lg mb-4">
            <img src="/logo.png" alt="Aralko Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-primary">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-sm text-muted mt-1.5">
            {isLogin ? 'Please enter your details to sign in' : 'Start your study journey with Aralko'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-token bg-surface p-7 shadow-2xl shadow-black/40">

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
            
            {/* Username (signup only) */}
            {!isLogin && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-secondary">Username</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. study_buddy"
                  required
                  autoComplete="username"
                  className="w-full rounded-xl border border-token bg-app px-4 py-2.5 text-sm text-primary placeholder-slate-500 outline-none focus:border-accent/60 transition-colors"
                />
              </div>
            )}

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-secondary">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-token bg-app px-4 py-2.5 text-sm text-primary placeholder-slate-500 outline-none focus:border-accent/60 transition-colors"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-secondary">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className="w-full rounded-xl border border-token bg-app px-4 py-2.5 pr-10 text-sm text-primary placeholder-slate-500 outline-none focus:border-accent/60 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm Password (signup only) */}
            {!isLogin && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-secondary">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-token bg-app px-4 py-2.5 pr-10 text-sm text-primary placeholder-slate-500 outline-none focus:border-accent/60 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors"
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {/* Error / Success */}
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-400 leading-relaxed animate-in fade-in duration-200">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="rounded-xl bg-success-muted border border-success/20 px-4 py-3 text-xs text-success leading-relaxed animate-in fade-in duration-200">
                {successMsg}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full rounded-xl bg-accent hover:bg-accent/90 py-2.5 text-sm font-semibold text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading
                ? (isLogin ? 'Signing in...' : 'Creating account...')
                : (isLogin ? 'Sign in' : 'Create Account')}
            </button>
          </form>

          {/* OR divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 border-t border-token" />
            <span className="text-xs text-muted uppercase tracking-wider">or</span>
            <div className="flex-1 border-t border-token" />
          </div>

          {/* Full-width Google button */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            title="Continue with Google"
            className="w-full rounded-xl border border-token bg-app hover:bg-raised py-2.5 text-sm font-medium text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
          >
            {googleLoading ? (
              <Loader2 size={16} className="animate-spin text-secondary" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            )}
            Google
          </button>

          {/* Switch view */}
          <p className="text-center text-xs text-muted mt-5">
            {isLogin ? (
              <>Don't have an account?{' '}
                <button
                  onClick={() => switchView('signup')}
                  className="text-primary font-semibold hover:text-accent transition-colors"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button
                  onClick={() => switchView('login')}
                  className="text-primary font-semibold hover:text-accent transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
