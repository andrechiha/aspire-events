import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, User, Mail, Lock, LogOut, Save, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import './client.css';

export default function AccountSettings() {
  const { profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const wantsPasswordChange = oldPassword || newPassword || confirmPassword;

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);

    try {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', profile.id);
      if (profileErr) throw profileErr;

      if (wantsPasswordChange) {
        if (!oldPassword) throw new Error('Please enter your current password.');
        if (!newPassword) throw new Error('Please enter a new password.');
        if (newPassword.length < 6) throw new Error('New password must be at least 6 characters.');
        if (newPassword !== confirmPassword) throw new Error('New passwords do not match.');

        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: profile.email,
          password: oldPassword,
        });
        if (signInErr) throw new Error('Current password is incorrect.');

        const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword });
        if (pwErr) throw pwErr;
      }

      await refreshProfile();
      setMsg({ type: 'ok', text: 'Settings saved successfully.' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMsg({ type: 'err', text: err.message || 'Failed to save.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="bg-settings">
      <button className="bg-back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} /> Back
      </button>

      <h2 className="bg-settings-heading">My Account</h2>

      <div className="bg-settings-avatar-section">
        <div className="bg-settings-avatar">{initials}</div>
        <div className="bg-settings-user-info">
          <span className="bg-settings-name">{profile?.full_name || 'User'}</span>
          <span className="bg-settings-role">{profile?.role?.replace('_', ' ') || 'client'}</span>
        </div>
      </div>

      <div className="bg-settings-form">
        <label className="bg-settings-label">
          <User size={16} /> Full Name
        </label>
        <input
          className="bg-settings-input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name"
        />

        <label className="bg-settings-label">
          <Mail size={16} /> Email
        </label>
        <input
          className="bg-settings-input"
          value={profile?.email || ''}
          disabled
          style={{ opacity: 0.5 }}
        />

        <div className="bg-settings-divider" />

        <label className="bg-settings-label">
          <Lock size={16} /> Current Password
        </label>
        <div className="bg-settings-pw-wrap">
          <input
            className="bg-settings-input bg-settings-input--pw"
            type={showOld ? 'text' : 'password'}
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="Enter current password"
          />
          <button type="button" className="bg-settings-eye" onClick={() => setShowOld(!showOld)}>
            {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <label className="bg-settings-label">
          <Lock size={16} /> New Password
        </label>
        <div className="bg-settings-pw-wrap">
          <input
            className="bg-settings-input bg-settings-input--pw"
            type={showNew ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
          <button type="button" className="bg-settings-eye" onClick={() => setShowNew(!showNew)}>
            {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <label className="bg-settings-label">
          <Lock size={16} /> Confirm New Password
        </label>
        <div className="bg-settings-pw-wrap">
          <input
            className="bg-settings-input bg-settings-input--pw"
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
          />
          <button type="button" className="bg-settings-eye" onClick={() => setShowConfirm(!showConfirm)}>
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {newPassword && confirmPassword && newPassword !== confirmPassword && (
          <div className="bg-msg bg-msg--err">Passwords do not match</div>
        )}

        {msg && (
          <div className={`bg-msg bg-msg--${msg.type}`}>{msg.text}</div>
        )}

        <button className="bg-settings-save" onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <button className="bg-settings-signout" onClick={handleSignOut}>
        <LogOut size={18} /> Sign Out
      </button>
    </div>
  );
}
