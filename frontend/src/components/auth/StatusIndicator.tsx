import React from 'react';
import { ShieldCheck, Activity, Users } from 'lucide-react';

export const StatusIndicator: React.FC = () => {
  return (
    <div className="status-indicators">
      <div className="status-card">
        <Activity className="status-icon" size={24} strokeWidth={2} />
        <div className="status-details">
          <span className="status-title">24/7</span>
          <span className="status-desc">Operational Access</span>
        </div>
      </div>
      <div className="status-card">
        <ShieldCheck className="status-icon" size={24} strokeWidth={2} />
        <div className="status-details">
          <span className="status-title">Secure</span>
          <span className="status-desc">Authorized Personnel</span>
        </div>
      </div>
      <div className="status-card">
        <Users className="status-icon" size={24} strokeWidth={2} />
        <div className="status-details">
          <span className="status-title">Live</span>
          <span className="status-desc">Resource Coordination</span>
        </div>
      </div>
    </div>
  );
};
