import React from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../app/useAuth';
import { ShieldCheck, Activity, Users } from 'lucide-react';

export const StatusIndicator: React.FC = () => {
  const health = useApi<{success: boolean}>("/db-health");
  const {user, serviceError} = useAuth();
  return (
    <div className="status-indicators">
      <div className="status-card">
        <Activity className="status-icon" size={24} strokeWidth={2} />
        <div className="status-details">
          <span className="status-title">{health.loading ? "Checking" : health.data?.success ? "Connected" : "Unavailable"}</span>
          <span className="status-desc">Incident database</span>
        </div>
      </div>
      <div className="status-card">
        <ShieldCheck className="status-icon" size={24} strokeWidth={2} />
        <div className="status-details">
          <span className="status-title">{user ? "Signed in" : serviceError ? "Pending" : "Required"}</span>
          <span className="status-desc">Authorized Personnel</span>
        </div>
      </div>
      <div className="status-card">
        <Users className="status-icon" size={24} strokeWidth={2} />
        <div className="status-details">
          <span className="status-title">API</span>
          <span className="status-desc">Resource Coordination</span>
        </div>
      </div>
    </div>
  );
};
