import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const SecurityNotice: React.FC = () => {
  return (
    <div className="security-notice">
      <ShieldCheck className="notice-icon" size={20} strokeWidth={2} />
      <div className="notice-text">
        <p>Access is restricted to authorized emergency response personnel.</p>
        <p>Activity may be monitored for security and operational purposes.</p>
      </div>
    </div>
  );
};
