import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import './client.css';

export default function CommunitiesList() {
  const navigate = useNavigate();

  return (
    <div className="bg-communities">
      <div className="bg-notif-top">
        <button className="bg-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Back
        </button>
      </div>
      <h2 className="bg-notif-title">Communities</h2>
      <div className="bg-notif-empty">
        <Users size={40} />
        <p>Communities coming soon</p>
      </div>
    </div>
  );
}
