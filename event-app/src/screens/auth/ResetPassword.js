import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import './auth.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    if (!password || !confirmPw) {
      setError('Please fill in both fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPw) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={handleReset}>
        <h1 className="auth-title">Reset Password</h1>
        <p className="auth-subtitle">Enter your new password below</p>

        {error && <div className="auth-error">{error}</div>}
        {done && <div className="auth-success">Password updated! Redirecting to login...</div>}

        {!done && (
          <>
            <label className="auth-label">New Password</label>
            <div className="auth-pw-wrap">
              <input
                className="auth-input auth-input--pw"
                type={showPw ? 'text' : 'password'}
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="auth-eye" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <label className="auth-label">Confirm New Password</label>
            <div className="auth-pw-wrap">
              <input
                className="auth-input auth-input--pw"
                type={showConfirmPw ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
              />
              <button type="button" className="auth-eye" onClick={() => setShowConfirmPw(!showConfirmPw)}>
                {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPw && password !== confirmPw && (
              <span className="auth-pw-mismatch">Passwords do not match</span>
            )}

            <button className="auth-button" type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
