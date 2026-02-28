import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Ban, RotateCcw } from 'lucide-react';
import './owner.css';

const ROLE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'client', label: 'Clients' },
  { key: 'event_manager', label: 'Event Managers' },
  { key: 'owner', label: 'Owners' },
];

export default function UsersList() {
  const { profile: myProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [filter, setFilter] = useState('all');
  const [updating, setUpdating] = useState(null);

  const fetchUsers = useCallback(async () => {
    setFetchError('');
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setFetchError(error.message);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const changeRole = async (userId, newRole) => {
    setUpdating(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      alert(error.message);
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    }
    setUpdating(null);
  };

  const toggleBan = async (user) => {
    const newBanned = !user.banned;
    if (!window.confirm(`${newBanned ? 'Ban' : 'Unban'} ${user.full_name}?`)) return;

    setUpdating(user.id);
    const { error } = await supabase
      .from('profiles')
      .update({ banned: newBanned })
      .eq('id', user.id);

    if (error) {
      alert(error.message);
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, banned: newBanned } : u))
      );
    }
    setUpdating(null);
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const filtered = filter === 'all' ? users : users.filter((u) => u.role === filter);

  const counts = {
    all: users.length,
    client: users.filter((u) => u.role === 'client').length,
    event_manager: users.filter((u) => u.role === 'event_manager').length,
    owner: users.filter((u) => u.role === 'owner').length,
  };

  if (loading) {
    return <div className="ow-empty"><p>Loading...</p></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Users</h1>
        <p>Manage user roles and bans</p>
      </div>

      {fetchError && <div className="ow-error">Error: {fetchError}</div>}

      <div className="ow-filter-bar">
        {ROLE_FILTERS.map((f) => (
          <button
            key={f.key}
            className={`ow-filter-tab ${filter === f.key ? 'ow-filter-tab--active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="ow-filter-count">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="ow-empty"><p>No users found.</p></div>
      ) : (
        <div className="ow-users-list">
          <div className="ow-users-header">
            <span className="ow-uh-name">User</span>
            <span className="ow-uh-role">Role</span>
            <span className="ow-uh-date">Joined</span>
            <span className="ow-uh-actions">Actions</span>
          </div>

          {filtered.map((user) => {
            const isMe = user.id === myProfile?.id;
            const isUpdating = updating === user.id;

            return (
              <div className={`ow-user-row ${user.banned ? 'ow-user-row--banned' : ''}`} key={user.id}>
                <div className="ow-user-name-cell">
                  <div className="ow-user-avatar">
                    {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <span className="ow-user-name">
                      {user.full_name} {isMe && <span className="ow-you-badge">you</span>}
                    </span>
                    {user.banned && <span className="ow-banned-tag">Banned</span>}
                  </div>
                </div>

                <div className="ow-user-role-cell">
                  <select
                    className="ow-role-select"
                    value={user.role}
                    onChange={(e) => changeRole(user.id, e.target.value)}
                    disabled={isUpdating || isMe}
                  >
                    <option value="client">Client</option>
                    <option value="event_manager">Event Manager</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>

                <div className="ow-user-date-cell">
                  {formatDate(user.created_at)}
                </div>

                <div className="ow-user-actions-cell">
                  {!isMe && (
                    <button
                      className={`ow-ban-btn ${user.banned ? 'ow-ban-btn--unban' : ''}`}
                      onClick={() => toggleBan(user)}
                      disabled={isUpdating}
                      title={user.banned ? 'Unban user' : 'Ban user'}
                    >
                      {user.banned ? <RotateCcw size={14} /> : <Ban size={14} />}
                      {user.banned ? 'Unban' : 'Ban'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
