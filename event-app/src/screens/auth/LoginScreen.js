import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { Eye, EyeOff } from 'lucide-react';
import './auth.css';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    const { error: err } = await signIn({ email: email.trim(), password });
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      navigate('/');
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email above first, then click Forgot Password');
      return;
    }
    setResetLoading(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setResetSent(true);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={handleLogin}>
        <div className="auth-logo">🎫</div>
        <h1 className="auth-title">Aspire Events</h1>
        <p className="auth-subtitle">Sign in to your account</p>

        {error && <div className="auth-error">{error}</div>}
        {resetSent && <div className="auth-success">Password reset email sent! Check your inbox.</div>}

        <label className="auth-label">Email</label>
        <input
          className="auth-input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="auth-label">Password</label>
        <div className="auth-pw-wrap">
          <input
            className="auth-input auth-input--pw"
            type={showPw ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" className="auth-eye" onClick={() => setShowPw(!showPw)}>
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button
          type="button"
          className="auth-forgot"
          onClick={handleForgotPassword}
          disabled={resetLoading}
        >
          {resetLoading ? 'Sending...' : 'Forgot Password?'}
        </button>

        <button className="auth-button" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p className="auth-link">
          Don't have an account? <Link to="/signup">Sign Up</Link>
        </p>
      </form>
    </div>
  );
}
