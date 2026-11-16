import React from 'react';
import { useApi } from '../hooks/useApi';
import { ERCSBrand } from '../components/auth/ERCSBrand';
import { EmergencyNetwork } from '../components/auth/EmergencyNetwork';
import { StatusIndicator } from '../components/auth/StatusIndicator';
import { LoginForm } from '../components/auth/LoginForm';
import { SecurityNotice } from '../components/auth/SecurityNotice';
import '../styles/auth.css';

export const LoginPage: React.FC = () => {
  const health = useApi<{success: boolean}>("/health");
  return (
    <div className="auth-container">
      {/* Abstract Animated Background */}
      <div className="background-glow" aria-hidden="true"></div>

      {/* Left Section - Visual & Branding */}
      <section className="auth-visual">
        <EmergencyNetwork />
        
        <ERCSBrand />
        
        <div className="auth-hero">
          <h1 className="hero-title">
            Coordinate faster.<br />
            Respond smarter.
          </h1>
          <p className="hero-subtitle">
            Secure access to real-time incident coordination, resource allocation and emergency response operations.
          </p>
        </div>

        <StatusIndicator />
      </section>

      {/* Right Section - Authentication */}
      <section className="auth-form-container">
        <div className="system-status">
          <div className="status-dot" style={{background: health.data?.success ? "#10b981" : "#f59e0b"}}></div>
          {health.loading ? "CHECKING SERVER" : health.data?.success ? "API ONLINE" : "SERVER UNAVAILABLE"}
        </div>

        <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 2 }}>
          <LoginForm />
          <SecurityNotice />
        </div>

        <footer className="auth-footer">
          <div>© 2026 ERCS · Emergency Resource Coordination System</div>
          <div className="footer-links">
            <a href="/privacy">Privacy</a>
            <a href="/security">Security</a>
            <a href="/support">Support</a>
          </div>
        </footer>
      </section>
    </div>
  );
};
