import React, { useState, useEffect, useCallback } from 'react';
import { Database, Plus, Trash2, Download, Upload, RefreshCw, Check, X, Clock } from 'lucide-react';
import { useSessionStore } from '../../stores';
import type { SessionData } from '../../services/sessionManager';

export const SessionManagerUI: React.FC = () => {
  const { sessions, saveSession, deleteSession, getSession } = useSessionStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSession, setNewSession] = useState({
    name: '',
    file: File | null,
  });
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);

  const loadSessions = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 500);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleExportSession = (session: SessionData) => {
    const dataStr = JSON.stringify(session, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSession = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const sessionData = JSON.parse(e.target?.result as string) as SessionData;
        sessionData.id = `session-${Date.now()}`;
        sessionData.createdAt = new Date();
        saveSession(sessionData);
        loadSessions();
      } catch (error) {
        console.error('Failed to import session:', error);
        alert('Invalid session file format');
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteSession = (id: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    deleteSession(id);
    loadSessions();
  };

  const handleCreateSession = async () => {
    if (!newSession.name) return;

    const session: SessionData = {
      id: `session-${Date.now()}`,
      name: newSession.name,
      createdAt: new Date(),
      cookies: [],
      localStorage: {},
      sessionStorage: {},
    };

    saveSession(session);
    setNewSession({ name: '', file: null });
    setShowAddForm(false);
    loadSessions();
  };

  const getCookieCount = (session: SessionData) => {
    return session.cookies?.length || 0;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="session-manager">
      <div className="section-header">
        <div className="header-left">
          <Database className="w-6 h-6" />
          <h2>Session Manager</h2>
        </div>
        <div className="header-actions">
          <label className="btn btn-secondary">
            <Upload className="w-4 h-4 mr-2" />
            Import Session
            <input
              type="file"
              accept=".json"
              onChange={handleImportSession}
              style={{ display: 'none' }}
            />
          </label>
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Session
          </button>
        </div>
      </div>

      {/* Add Session Form */}
      {showAddForm && (
        <div className="add-form">
          <h3>Create New Session</h3>
          <div className="form-group">
            <label>Session Name</label>
            <input
              type="text"
              value={newSession.name}
              onChange={e => setNewSession({ ...newSession, name: e.target.value })}
              placeholder="e.g., Production Auth Session"
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreateSession}>
              <Check className="w-4 h-4 mr-2" />
              Create Session
            </button>
          </div>
        </div>
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="modal-overlay" onClick={() => setSelectedSession(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedSession.name}</h2>
              <button className="icon-btn" onClick={() => setSelectedSession(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h3>Session Information</h3>
                <dl className="detail-grid">
                  <dt>ID</dt>
                  <dd>{selectedSession.id}</dd>
                  <dt>Created</dt>
                  <dd>{formatDate(selectedSession.createdAt)}</dd>
                  <dt>Cookies</dt>
                  <dd>{getCookieCount(selectedSession)}</dd>
                </dl>
              </div>

              {selectedSession.cookies && selectedSession.cookies.length > 0 && (
                <div className="detail-section">
                  <h3>Cookies ({selectedSession.cookies.length})</h3>
                  <div className="cookies-list">
                    {selectedSession.cookies.map((cookie, index) => (
                      <div key={index} className="cookie-item">
                        <div className="cookie-name">{cookie.name}</div>
                        <div className="cookie-value">{cookie.value}</div>
                        <div className="cookie-domain">{cookie.domain}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedSession(null)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  handleExportSession(selectedSession);
                  setSelectedSession(null);
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {isLoading ? (
        <div className="loading">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p>Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <Database className="w-12 h-12" />
          <p>No sessions saved</p>
          <p className="help-text">Create or import sessions to capture browser authentication state</p>
        </div>
      ) : (
        <div className="sessions-grid">
          {sessions.map(session => (
            <div key={session.id} className="session-card">
              <div className="session-header">
                <div className="session-info">
                  <h3>{session.name}</h3>
                  <span className="session-date">
                    <Clock className="w-3 h-3" />
                    {formatDate(session.createdAt)}
                  </span>
                </div>
                <div className="session-stats">
                  <span className="stat-badge">
                    <Database className="w-3 h-3" />
                    {getCookieCount(session)} cookies
                  </span>
                </div>
              </div>

              <div className="session-actions">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setSelectedSession(session)}
                >
                  View Details
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleExportSession(session)}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Export
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteSession(session.id)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .session-manager {
          padding: 0;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .header-left h2 {
          margin: 0;
          font-size: 1.25rem;
        }

        .header-actions {
          display: flex;
          gap: 0.75rem;
        }

        .add-form {
          background: #0f0f23;
          border: 1px solid #2d2d44;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .add-form h3 {
          margin: 0 0 1rem 0;
          font-size: 1rem;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          color: #94a3b8;
        }

        .form-group input {
          width: 100%;
          padding: 0.75rem;
          background: #1a1a2e;
          border: 1px solid #2d2d44;
          border-radius: 8px;
          color: #fff;
          font-size: 0.875rem;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .btn {
          display: flex;
          align-items: center;
          padding: 0.625rem 1rem;
          border: none;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
        }

        .btn-secondary {
          background: #2d2d44;
          color: #fff;
        }

        .btn-sm {
          padding: 0.375rem 0.75rem;
          font-size: 0.75rem;
        }

        .btn-danger {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .loading {
          text-align: center;
          padding: 3rem;
          color: #94a3b8;
        }

        .loading svg {
          margin-bottom: 1rem;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #64748b;
        }

        .empty-state svg {
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .empty-state .help-text {
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }

        .sessions-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .session-card {
          background: #0f0f23;
          border: 1px solid #2d2d44;
          border-radius: 8px;
          padding: 1rem;
        }

        .session-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .session-info h3 {
          margin: 0 0 0.25rem 0;
          font-size: 1rem;
        }

        .session-date {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          color: #64748b;
        }

        .stat-badge {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.25rem 0.5rem;
          background: #2d2d44;
          border-radius: 4px;
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .session-actions {
          display: flex;
          gap: 0.5rem;
        }

        /* Modal styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: #1a1a2e;
          border-radius: 12px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #2d2d44;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.125rem;
        }

        .icon-btn {
          padding: 0.375rem;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          border-radius: 4px;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .detail-section {
          margin-bottom: 1.5rem;
        }

        .detail-section h3 {
          margin: 0 0 1rem 0;
          font-size: 0.875rem;
          color: #94a3b8;
          text-transform: uppercase;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 0.5rem 1rem;
        }

        .detail-grid dt {
          color: #64748b;
          font-size: 0.875rem;
        }

        .detail-grid dd {
          margin: 0;
          font-size: 0.875rem;
        }

        .cookies-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 200px;
          overflow-y: auto;
        }

        .cookie-item {
          padding: 0.5rem;
          background: #0f0f23;
          border-radius: 4px;
          font-size: 0.75rem;
        }

        .cookie-name {
          font-weight: 500;
          color: #fff;
        }

        .cookie-value {
          color: #94a3b8;
          word-break: break-all;
        }

        .cookie-domain {
          color: #64748b;
          font-size: 0.625rem;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 1.25rem 1.5rem;
          border-top: 1px solid #2d2d44;
        }
      `}</style>
    </div>
  );
};

export default SessionManagerUI;
