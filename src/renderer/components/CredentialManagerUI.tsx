import React, { useState, useEffect, useCallback } from 'react';
import { Key, Plus, Trash2, Lock, Check, AlertCircle, Copy, Eye, EyeOff } from 'lucide-react';
import type { Credential, CredentialType } from '../../services/credentialManager';

export const CredentialManagerUI: React.FC = () => {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCredential, setNewCredential] = useState<{
    type: CredentialType;
    service: string;
    username?: string;
    password?: string;
    apiKey?: string;
    token?: string;
  }>({
    type: 'generic',
    service: '',
  });
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const loadCredentials = useCallback(async () => {
    try {
      const { CredentialManager } = await import('../../services/credentialManager');
      const manager = new CredentialManager();
      const creds = await manager.listCredentials();
      setCredentials(creds);
    } catch (error) {
      console.error('Failed to load credentials:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  const handleAddCredential = async () => {
    if (!newCredential.service) return;

    try {
      const { CredentialManager } = await import('../../services/credentialManager');
      const manager = new CredentialManager();

      if (newCredential.type === 'api_key') {
        await manager.setCredential(newCredential.service, 'api_key', newCredential.apiKey || '');
      } else if (newCredential.type === 'oauth') {
        await manager.setCredential(newCredential.service, 'oauth', newCredential.token || '');
      } else {
        await manager.setCredential(
          newCredential.service,
          newCredential.type,
          newCredential.password || ''
        );
      }

      setNewCredential({ type: 'generic', service: '' });
      setShowAddForm(false);
      loadCredentials();
    } catch (error) {
      console.error('Failed to add credential:', error);
    }
  };

  const handleDeleteCredential = async (service: string, type: CredentialType) => {
    if (!confirm(`Delete credential for ${service}?`)) return;

    try {
      const { CredentialManager } = await import('../../services/credentialManager');
      const manager = new CredentialManager();
      await manager.deleteCredential(service, type);
      loadCredentials();
    } catch (error) {
      console.error('Failed to delete credential:', error);
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getTypeIcon = (type: CredentialType) => {
    switch (type) {
      case 'api_key': return '🔑';
      case 'oauth': return '🔐';
      case 'zap': return '🛡️';
      case 'defectdojo': return '📋';
      case 'proxy': return '🌐';
      default: return '🔓';
    }
  };

  const groupedCredentials = credentials.reduce((acc, cred) => {
    if (!acc[cred.type]) {
      acc[cred.type] = [];
    }
    acc[cred.type].push(cred);
    return acc;
  }, {} as Record<CredentialType, Credential[]>);

  return (
    <div className="credential-manager">
      <div className="section-header">
        <div className="header-left">
          <Key className="w-6 h-6" />
          <h2>Credential Manager</h2>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Credential
        </button>
      </div>

      {/* Add Credential Form */}
      {showAddForm && (
        <div className="add-form">
          <h3>Add New Credential</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select
                value={newCredential.type}
                onChange={e => setNewCredential({ ...newCredential, type: e.target.value as CredentialType })}
              >
                <option value="generic">Generic Password</option>
                <option value="api_key">API Key</option>
                <option value="oauth">OAuth Token</option>
                <option value="zap">ZAP API Key</option>
                <option value="defectdojo">DefectDojo</option>
                <option value="proxy">Proxy Auth</option>
              </select>
            </div>
            <div className="form-group">
              <label>Service Name</label>
              <input
                type="text"
                value={newCredential.service}
                onChange={e => setNewCredential({ ...newCredential, service: e.target.value })}
                placeholder="e.g., github, jira"
              />
            </div>
          </div>

          {newCredential.type === 'generic' && (
            <div className="form-row">
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={newCredential.username || ''}
                  onChange={e => setNewCredential({ ...newCredential, username: e.target.value })}
                  placeholder="username"
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={newCredential.password || ''}
                  onChange={e => setNewCredential({ ...newCredential, password: e.target.value })}
                  placeholder="password"
                />
              </div>
            </div>
          )}

          {newCredential.type === 'api_key' && (
            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                value={newCredential.apiKey || ''}
                onChange={e => setNewCredential({ ...newCredential, apiKey: e.target.value })}
                placeholder="your-api-key"
              />
            </div>
          )}

          {newCredential.type === 'oauth' && (
            <div className="form-group">
              <label>OAuth Token</label>
              <input
                type="password"
                value={newCredential.token || ''}
                onChange={e => setNewCredential({ ...newCredential, token: e.target.value })}
                placeholder="oauth-token"
              />
            </div>
          )}

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAddCredential}>
              <Lock className="w-4 h-4 mr-2" />
              Save Credential
            </button>
          </div>
        </div>
      )}

      {/* Credentials List */}
      {isLoading ? (
        <div className="loading">Loading credentials...</div>
      ) : credentials.length === 0 ? (
        <div className="empty-state">
          <Lock className="w-12 h-12" />
          <p>No credentials stored</p>
          <p className="help-text">Credentials are stored securely in your system keychain</p>
        </div>
      ) : (
        <div className="credentials-grid">
          {Object.entries(groupedCredentials).map(([type, creds]) => (
            <div key={type} className="credential-group">
              <h3 className="group-title">
                {getTypeIcon(type as CredentialType)} {type.toUpperCase()}
              </h3>
              {creds.map(cred => (
                <div key={`${cred.service}-${cred.type}`} className="credential-card">
                  <div className="credential-info">
                    <span className="service-name">{cred.service}</span>
                    <span className="created-date">
                      Created: {new Date(cred.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="credential-actions">
                    <button
                      className="icon-btn"
                      onClick={() => togglePasswordVisibility(`${cred.service}-${cred.type}`)}
                      title="Toggle visibility"
                    >
                      {showPasswords[`${cred.service}-${cred.type}`] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      className="icon-btn danger"
                      onClick={() => handleDeleteCredential(cred.service, cred.type)}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .credential-manager {
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

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
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

        .form-group input,
        .form-group select {
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

        .loading {
          text-align: center;
          padding: 2rem;
          color: #94a3b8;
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

        .credentials-grid {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .credential-group {
          background: #0f0f23;
          border-radius: 8px;
          padding: 1rem;
        }

        .group-title {
          margin: 0 0 1rem 0;
          font-size: 0.875rem;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .credential-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: #1a1a2e;
          border-radius: 6px;
          margin-bottom: 0.5rem;
        }

        .credential-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .service-name {
          font-weight: 500;
        }

        .created-date {
          font-size: 0.75rem;
          color: #64748b;
        }

        .credential-actions {
          display: flex;
          gap: 0.5rem;
        }

        .icon-btn {
          padding: 0.375rem;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .icon-btn:hover {
          background: #2d2d44;
          color: #fff;
        }

        .icon-btn.danger:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }
      `}</style>
    </div>
  );
};

export default CredentialManagerUI;
