import { useState, useEffect } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

type AuthView = 'login' | 'signup' | 'verify';

function friendlyError(msg: string): string {
  if (!msg) return 'Something went wrong. Please try again.';
  const m = msg.toLowerCase();
  
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials'))
    return 'Incorrect email or password.';
  if (m.includes('email not confirmed'))
    return 'Please check your email and confirm your account first.';
    
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('saving new user'))
    return "This email's already taken. Sign in instead.";
    
  if (m.includes('password') && m.includes('6'))
    return 'Password must be at least 6 characters.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('over the email send rate limit'))
    return 'Too many attempts. Please wait a moment and try again.';
  if (m.includes('network') || m.includes('fetch'))
    return 'Unable to connect. Please check your internet connection.';
  if (m.includes('token has expired') || m.includes('expired'))
    return 'The verification code has expired. Please request a new one.';
  if (m.includes('invalid token') || m.includes('invalid otp'))
    return 'Invalid verification code. Please check and try again.';
    
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
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const errDesc = params.get('error_description');
      if (errDesc) {
        setError(friendlyError(errDesc.replace(/\+/g, ' ')));
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    let timer: number;
    if (resendCooldown > 0) {
      timer = window.setInterval(() => {
        setResendCooldown(c => c - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const switchView = (v: AuthView) => {
    setView(v);
    setError(null);
    setSuccessMsg(null);
    setName('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirm(false);
    setOtp('');
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
        
        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error('User already registered');
        }

        setResendCooldown(60);
        setView('verify');
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

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otp.length < 6) {
      setError('Please enter the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.verifyOtp({ email, token: otp, type: 'signup' });
      if (err) throw err;
    } catch (err: any) {
      setError(friendlyError(err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setResending(true);
    try {
      const { error: err } = await supabase.auth.resend({ type: 'signup', email });
      if (err) throw err;
      setResendCooldown(60);
      setSuccessMsg('Code resent. Please check your email.');
    } catch (err: any) {
      setError(friendlyError(err.message || ''));
    } finally {
      setResending(false);
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
            {view === 'verify' ? 'Check your email' : isLogin ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-sm text-muted mt-1.5">
            {view === 'verify' ? `We sent a code to ${email}` : isLogin ? 'Please enter your details to sign in' : 'Start your study journey with Aralko'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-token bg-surface p-7 shadow-2xl shadow-black/40">

          {view === 'verify' ? (
            <form onSubmit={handleVerify} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-secondary text-center mb-2">Verification Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  className="w-full rounded-xl border border-token bg-app px-4 py-3 text-2xl text-primary placeholder-slate-500 outline-none focus:border-accent/60 transition-colors text-center tracking-[0.5em] font-mono"
                />
              </div>

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

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full rounded-xl bg-accent hover:bg-accent/90 py-2.5 text-sm font-semibold text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? 'Verifying...' : 'Verify'}
              </button>

              <div className="flex flex-col items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resending}
                  className="text-xs text-primary font-medium hover:text-accent transition-colors disabled:opacity-50"
                >
                  {resending ? 'Resending...' : resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
                <button
                  type="button"
                  onClick={() => switchView('signup')}
                  className="text-xs text-muted hover:text-primary transition-colors mt-2"
                >
                  Back to sign up
                </button>
              </div>
            </form>
          ) : (
            <>
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
                    <p className="text-[11px] text-muted mt-1.5 leading-snug">
                      By creating an account, you agree to the <button type="button" onClick={() => setShowPrivacy(true)} className="text-primary hover:underline font-medium">Data & Privacy notice</button>.
                    </p>
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
                  disabled={loading}
                  className="w-full rounded-xl bg-accent hover:bg-accent/90 py-2.5 text-sm font-semibold text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {loading
                    ? (isLogin ? 'Signing in...' : 'Creating account...')
                    : (isLogin ? 'Sign in' : 'Create Account')}
                </button>
              </form>

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
            </>
          )}
        </div>
      </div>

      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="max-w-md bg-surface border border-token">
          <DialogHeader>
            <DialogTitle className="text-primary">Data & Privacy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-secondary max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <h3 className="font-semibold text-primary mb-2">What we store</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Account information:</strong> Your email, display name, and profile picture.</li>
                <li><strong>Study progress:</strong> Pomodoro sessions, streaks, XP, level, flashcard progress, and quiz scores.</li>
                <li><strong>Study content:</strong> Your notes, reviewers, cheat sheets, flashcards, and test questions.</li>
                <li><strong>AI chat:</strong> Your conversations with the AI study assistant, saved so you can continue them later.</li>
                <li><strong>Spotify connection:</strong> Your Spotify access and refresh tokens, securely stored to keep you connected across devices.</li>
                <li><strong>Preferences:</strong> Your Pomodoro settings, AI preferences, and personal Gemini API key.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-primary mb-1">AI & Data Processing</h3>
              <p>
                When you use AI features (like generating flashcards or chatting with the study assistant), your relevant study notes or chat messages are sent to Google's Gemini API for processing. Your data is not used by Google to train their models.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
