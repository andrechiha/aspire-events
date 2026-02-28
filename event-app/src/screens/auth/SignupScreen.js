import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import './auth.css';

const ROLES = [
  { key: 'client', label: 'Client' },
  { key: 'event_manager', label: 'Event Manager' },
];

export default function SignupScreen() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [role, setRole] = useState('client');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !password || !confirmPw) {
      setError('Please fill in all fields');
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
    const { error: err } = await signUp({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      role,
    });
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={handleSignup}>
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Join the event community</p>

        {error && <div className="auth-error">{error}</div>}

        <label className="auth-label">Full Name</label>
        <input
          className="auth-input"
          type="text"
          placeholder="John Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

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
            placeholder="Min 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" className="auth-eye" onClick={() => setShowPw(!showPw)}>
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <label className="auth-label">Confirm Password</label>
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

        <label className="auth-label">I am a...</label>
        <div className="role-row">
          {ROLES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`role-chip ${role === r.key ? 'role-chip-active' : ''}`}
              onClick={() => setRole(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <button className="auth-button" type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Account'}
        </button>

        <p className="auth-link">
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </form>
    </div>
  );
}
