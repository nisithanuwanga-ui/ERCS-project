import React from 'react';
import { Activity } from 'lucide-react';

export const ERCSBrand: React.FC = () => {
  return (
    <div className="auth-brand">
      <div className="brand-icon-wrapper">
        <Activity size={28} strokeWidth={2.5} />
      </div>
      <div className="brand-text-container">
        <span className="brand-title">ERCS</span>
        <span className="brand-subtitle">Emergency Resource Coordination System</span>
      </div>
    </div>
  );
};
