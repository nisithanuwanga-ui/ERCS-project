import React, { useState } from 'react';
import { Mail, LockKeyhole, Eye, EyeOff, ArrowRight, Loader2, Check } from 'lucide-react';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) {
      newErrors.email = 'Email address is required.';
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setLoading(true);
      
      // Simulate API call
      setTimeout(() => {
        setLoading(false);
        setSuccess(true);
        
        // Reset success state after a while for demo purposes
        setTimeout(() => setSuccess(false), 3000);
      }, 1000);
    }
  };

  return (
    <div className="login-card">
      <div className="login-header">
        <span className="login-label">Secure Access</span>
        <h2 className="login-title">Welcome back</h2>
        <p className="login-subtitle">Sign in to access the Emergency Resource Coordination System.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="email" className="input-label">Email address</label>
          <div className="input-wrapper">
            <Mail className="input-icon" size={20} strokeWidth={2} />
            <input
              id="email"
              type="email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="name@organization.gov"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || success}
            />
          </div>
          {errors.email && (
            <div className="error-message">
              <span>{errors.email}</span>
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="password" className="input-label">Password</label>
          <div className="input-wrapper">
            <LockKeyhole className="input-icon" size={20} strokeWidth={2} />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className={`form-input ${errors.password ? 'error' : ''}`}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || success}
            />
            <button
              type="button"
              className="input-action"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              disabled={loading || success}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <div className="error-message">
              <span>{errors.password}</span>
            </div>
          )}
        </div>

        <div className="form-options">
          <label className="checkbox-label">
            <input type="checkbox" disabled={loading || success} />
            <div className="custom-checkbox">
              <Check className="checkbox-icon" strokeWidth={3} />
            </div>
            Remember me
          </label>
          <a href="#" className="forgot-link">Forgot password?</a>
        </div>

        <button 
          type="submit" 
          className={`btn-submit ${success ? 'success' : ''}`}
          disabled={loading || success}
        >
          {loading ? (
            <>
              <Loader2 className="spinner" size={20} />
              Authenticating...
            </>
          ) : success ? (
            <>
              <Check size={20} strokeWidth={2.5} />
              Authentication successful
            </>
          ) : (
            <>
              Sign in securely
              <ArrowRight size={18} strokeWidth={2.5} />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
