import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [isLoginView, setIsLoginView] = useState(true);
  
  // Auth form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Dashboard state
  const [links, setLinks] = useState([]);
  const [originalUrl, setOriginalUrl] = useState('');
  const [expiryHours, setExpiryHours] = useState('6');
  
  // Feedback messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Expiry Edit Modal state
  const [editingLink, setEditingLink] = useState(null);
  const [editExpiryHours, setEditExpiryHours] = useState('6');

  // Load user links if authenticated
  useEffect(() => {
    if (token) {
      fetchLinks();
    }
  }, [token]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const fetchLinks = async () => {
    try {
      const res = await fetch('/api/urls', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setLinks(data.links || []);
      } else {
        setError(data.error || 'Failed to fetch links');
        if (res.status === 401) {
          handleLogout();
        }
      }
    } catch (err) {
      console.error('Fetch links error:', err);
      setError('Network error: Failed to connect to server');
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('All fields are required');
      return;
    }

    if (!isLoginView && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const endpoint = isLoginView ? '/api/auth/login' : '/api/auth/signup';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Reset auth fields
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setSuccess(isLoginView ? 'Welcome back!' : 'Account created successfully!');
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('Network error: Could not complete authentication');
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setLinks([]);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const handleShortenSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!originalUrl) {
      setError('Please provide a URL to shorten');
      return;
    }

    try {
      const res = await fetch('/api/urls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          original_url: originalUrl,
          expiry_hours: parseInt(expiryHours, 10)
        })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess('Short URL created successfully!');
        setOriginalUrl('');
        setExpiryHours('6');
        fetchLinks();
      } else {
        setError(data.error || 'Failed to shorten URL');
      }
    } catch (err) {
      console.error('Shorten error:', err);
      setError('Network error: Failed to create short URL');
    }
  };

  const handleDeleteLink = async (id) => {
    if (!window.confirm('Are you sure you want to delete this short URL?')) {
      return;
    }

    try {
      const res = await fetch(`/api/urls/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess('Short URL deleted successfully');
        fetchLinks();
      } else {
        setError(data.error || 'Failed to delete URL');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError('Network error: Failed to delete short URL');
    }
  };

  const handleUpdateExpiry = async (e) => {
    e.preventDefault();
    if (!editingLink) return;

    try {
      const res = await fetch(`/api/urls/${editingLink.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          expiry_hours: parseInt(editExpiryHours, 10)
        })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess('Expiration time updated successfully!');
        setEditingLink(null);
        setEditExpiryHours('6');
        fetchLinks();
      } else {
        setError(data.error || 'Failed to update expiration');
      }
    } catch (err) {
      console.error('Update expiry error:', err);
      setError('Network error: Failed to update expiration');
    }
  };

  const getShortUrl = (code) => {
    // In dev mode (Vite), absolute redirects point to the backend port (5000)
    const base = import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin;
    return `${base}/${code}`;
  };

  const copyToClipboard = (code) => {
    const fullUrl = getShortUrl(code);
    navigator.clipboard.writeText(fullUrl)
      .then(() => setSuccess('Copied to clipboard!'))
      .catch(() => setError('Failed to copy to clipboard'));
  };

  const formatDateTime = (dateStr) => {
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateStr).toLocaleDateString(undefined, options);
  };

  // Check if a link is active based on expires_at
  const isLinkActive = (expiresAt) => {
    return new Date(expiresAt) > new Date();
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h2>{isLoginView ? 'Welcome Back' : 'Get Started'}</h2>
            <p>{isLoginView ? 'Log in to manage your short URLs' : 'Create an account to shorten and track links'}</p>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleAuthSubmit}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {!isLoginView && (
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={!isLoginView}
                />
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.75rem' }}>
              {isLoginView ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="auth-switch">
            {isLoginView ? (
              <>
                Don't have an account? <span onClick={() => { setIsLoginView(false); setError(''); }}>Register here</span>
              </>
            ) : (
              <>
                Already have an account? <span onClick={() => { setIsLoginView(true); setError(''); }}>Log in here</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="nav-brand">⚡ ShrinkURL</div>
        <div className="nav-user">
          <span className="user-email">{user?.email}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Log Out</button>
        </div>
      </nav>

      <main className="dashboard">
        {error && <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>{success}</div>}

        {/* Create Form Section */}
        <section className="create-section">
          <form onSubmit={handleShortenSubmit} className="create-form">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Paste a long URL</label>
              <input
                type="url"
                className="form-control"
                placeholder="https://example.com/very/long/path/to/resource?id=123"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Expires In</label>
              <select 
                className="form-control" 
                value={expiryHours}
                onChange={(e) => setExpiryHours(e.target.value)}
                style={{ minWidth: '130px' }}
              >
                {Array.from({ length: 24 }, (_, i) => i + 1).map(h => (
                  <option key={h} value={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', height: '42px' }}>
              Shorten Link
            </button>
          </form>
        </section>

        {/* Links Table Section */}
        <section className="links-section">
          <div className="section-header">
            <h3>My Shortened Links</h3>
            <button className="btn btn-secondary btn-sm" onClick={fetchLinks}>🔄 Refresh</button>
          </div>

          <div className="links-table-container">
            {links.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🔗</div>
                <p>No links shortened yet. Paste a link above to get started!</p>
              </div>
            ) : (
              <table className="links-table">
                <thead>
                  <tr>
                    <th>Short Link</th>
                    <th>Original Destination</th>
                    <th>Status</th>
                    <th>Expires At</th>
                    <th style={{ textAlign: 'center' }}>Clicks</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => {
                    const active = isLinkActive(link.expires_at);
                    return (
                      <tr key={link.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <a 
                              href={getShortUrl(link.short_code)} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="link-short"
                            >
                              /{link.short_code}
                            </a>
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                              onClick={() => copyToClipboard(link.short_code)}
                              title="Copy to clipboard"
                            >
                              📋
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="link-original" title={link.original_url}>
                            {link.original_url}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${active ? 'badge-active' : 'badge-expired'}`}>
                            {active ? 'Active' : 'Expired'}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {formatDateTime(link.expires_at)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1rem' }}>
                          {link.clicks}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setEditingLink(link);
                                setEditExpiryHours('6');
                              }}
                            >
                              🕒 Expiry
                            </button>
                            <button 
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteLink(link.id)}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {/* Edit Expiry Modal */}
      {editingLink && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h4>Extend Link Expiration</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                For URL code: <span className="font-mono" style={{ color: '#818cf8', fontWeight: 600 }}>/{editingLink.short_code}</span>
              </p>
            </div>
            
            <form onSubmit={handleUpdateExpiry}>
              <div className="form-group">
                <label>Set new lifespan (from now)</label>
                <select 
                  className="form-control" 
                  value={editExpiryHours}
                  onChange={(e) => setEditExpiryHours(e.target.value)}
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map(h => (
                    <option key={h} value={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>
                  ))}
                </select>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setEditingLink(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
