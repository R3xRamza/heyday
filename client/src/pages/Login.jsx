import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import heydayLogo from '../assets/heyday-logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/tasks');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-off-white">
      <div className="md:w-[40%] bg-feather flex flex-col items-center justify-center p-12 min-h-[200px] md:min-h-screen">
        <img
          src={heydayLogo}
          alt="HEYDAY"
          className="w-full max-w-[280px] h-auto object-contain"
        />
        <p className="text-sky mt-6 text-center text-xl">Your real estate command center.</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white rounded-xl shadow-executive p-8">
          <h2 className="text-2xl font-bold text-feather mb-6">Welcome back</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-on-surface-variant mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-feather/20 focus:border-feather"
                placeholder="you@heyday.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-on-surface-variant mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 pr-11 rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-feather/20 focus:border-feather"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-feather"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm font-medium text-purple bg-purple/5 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-lemon text-feather font-bold rounded-lg hover:brightness-95 transition-all disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-on-surface-variant">
            <button type="button" className="hover:text-feather transition-colors">
              Forgot password?
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
