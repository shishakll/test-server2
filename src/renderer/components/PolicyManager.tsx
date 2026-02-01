import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle,
  FileText,
  Settings,
  Copy,
  ExternalLink,
} from 'lucide-react';
import type { SecurityPolicy, PolicyRule } from '../../types';

interface PolicyManagerProps {
  onSelectPolicy?: (policyId: string) => void;
  selectedPolicyId?: string;
}

export const PolicyManager: React.FC<PolicyManagerProps> = ({
  onSelectPolicy,
  selectedPolicyId,
}) => {
  const [policies, setPolicies] = useState<SecurityPolicy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<SecurityPolicy | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Partial<SecurityPolicy> | null>(null);
  const [showCompliance, setShowCompliance] = useState(false);
  const [complianceResults, setComplianceResults] = useState<any>(null);

  // Load policies on mount
  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = useCallback(async () => {
    try {
      const { PolicyEngine } = await import('../../services/policyEngine');
      const engine = new PolicyEngine();
      const allPolicies = engine.getPolicies();
      setPolicies(allPolicies);

      if (selectedPolicyId) {
        const policy = engine.getPolicy(selectedPolicyId);
        if (policy) {
          setSelectedPolicy(policy);
        }
      }
    } catch (error) {
      console.error('Failed to load policies:', error);
    }
  }, [selectedPolicyId]);

  const handleSelectPolicy = (policy: SecurityPolicy) => {
    setSelectedPolicy(policy);
    onSelectPolicy?.(policy.id);
  };

  const handleCreatePolicy = () => {
    setEditingPolicy({
      name: 'New Custom Policy',
      description: 'Custom security policy',
      version: '1.0.0',
      framework: 'Custom',
      rules: [],
      compliance: {
        owasp: false,
        pciDss: false,
        hipaa: false,
        soc2: false,
      },
    });
    setIsCreating(true);
  };

  const handleEditPolicy = (policy: SecurityPolicy) => {
    setEditingPolicy({ ...policy });
    setIsCreating(true);
  };

  const handleSavePolicy = async () => {
    if (!editingPolicy) return;

    try {
      const { PolicyEngine } = await import('../../services/policyEngine');
      const engine = new PolicyEngine();

      if (isCreating && !editingPolicy.id) {
        const newPolicy = engine.createPolicy(editingPolicy as Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt'>);
        setPolicies([...policies, newPolicy]);
      } else if (editingPolicy.id) {
        const updatedPolicy = engine.updatePolicy(editingPolicy.id, editingPolicy);
        if (updatedPolicy) {
          setPolicies(policies.map(p => p.id === updatedPolicy.id ? updatedPolicy : p));
        }
      }

      setIsCreating(false);
      setEditingPolicy(null);
      loadPolicies();
    } catch (error) {
      console.error('Failed to save policy:', error);
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;

    try {
      const { PolicyEngine } = await import('../../services/policyEngine');
      const engine = new PolicyEngine();
      engine.deletePolicy(policyId);
      setPolicies(policies.filter(p => p.id !== policyId));

      if (selectedPolicy?.id === policyId) {
        setSelectedPolicy(null);
      }
    } catch (error) {
      console.error('Failed to delete policy:', error);
    }
  };

  const handleClonePolicy = async (policy: SecurityPolicy) => {
    try {
      const { PolicyEngine } = await import('../../services/policyEngine');
      const engine = new PolicyEngine();

      const clonedPolicy = engine.clonePolicy(policy.id, `${policy.name} (Copy)`);
      if (clonedPolicy) {
        setPolicies([...policies, clonedPolicy]);
      }
    } catch (error) {
      console.error('Failed to clone policy:', error);
    }
  };

  const handleAddRule = () => {
    if (!editingPolicy) return;

    const newRule: PolicyRule = {
      id: `RULE-${Date.now()}`,
      name: 'New Rule',
      severity: 'medium',
      categories: ['security'],
      enabled: true,
    };

    setEditingPolicy({
      ...editingPolicy,
      rules: [...(editingPolicy.rules || []), newRule],
    });
  };

  const handleUpdateRule = (ruleId: string, updates: Partial<PolicyRule>) => {
    if (!editingPolicy) return;

    setEditingPolicy({
      ...editingPolicy,
      rules: editingPolicy.rules?.map(r =>
        r.id === ruleId ? { ...r, ...updates } : r
      ),
    });
  };

  const handleRemoveRule = (ruleId: string) => {
    if (!editingPolicy) return;

    setEditingPolicy({
      ...editingPolicy,
      rules: editingPolicy.rules?.filter(r => r.id !== ruleId),
    });
  };

  const getComplianceBadge = (policy: SecurityPolicy) => {
    const frameworks: string[] = [];
    if (policy.compliance?.owasp) frameworks.push('OWASP');
    if (policy.compliance?.pciDss) frameworks.push('PCI-DSS');
    if (policy.compliance?.hipaa) frameworks.push('HIPAA');
    if (policy.compliance?.soc2) frameworks.push('SOC 2');

    if (frameworks.length === 0) return null;

    return (
      <div className="compliance-badges">
        {frameworks.map(f => (
          <span key={f} className="compliance-badge">{f}</span>
        ))}
      </div>
    );
  };

  return (
    <div className="policy-manager">
      {/* Header */}
      <div className="policy-header">
        <div className="header-left">
          <Shield className="w-6 h-6" />
          <h2>Security Policies</h2>
        </div>
        <button className="btn btn-primary" onClick={handleCreatePolicy}>
          <Plus className="w-4 h-4 mr-2" />
          Create Policy
        </button>
      </div>

      {/* Policy List */}
      <div className="policy-list">
        {policies.map(policy => (
          <div
            key={policy.id}
            className={`policy-card ${selectedPolicy?.id === policy.id ? 'selected' : ''}`}
            onClick={() => handleSelectPolicy(policy)}
          >
            <div className="policy-card-header">
              <div className="policy-info">
                <h3>{policy.name}</h3>
                <p>{policy.description}</p>
              </div>
              <div className="policy-actions">
                <button
                  className="icon-btn"
                  onClick={(e) => { e.stopPropagation(); handleClonePolicy(policy); }}
                  title="Clone"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  className="icon-btn"
                  onClick={(e) => { e.stopPropagation(); handleEditPolicy(policy); }}
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  className="icon-btn danger"
                  onClick={(e) => { e.stopPropagation(); handleDeletePolicy(policy.id); }}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="policy-meta">
              <span className="version">v{policy.version}</span>
              <span className="rule-count">{policy.rules?.length || 0} rules</span>
              {getComplianceBadge(policy)}
            </div>

            {selectedPolicy?.id === policy.id && selectedPolicy && (
              <div className="policy-details">
                <h4>Policy Rules</h4>
                <div className="rules-list">
                  {selectedPolicy.rules?.map(rule => (
                    <div key={rule.id} className="rule-item">
                      <div className="rule-header">
                        <span className="rule-name">{rule.name}</span>
                        <span className={`severity-badge ${rule.severity}`}>{rule.severity}</span>
                      </div>
                      <div className="rule-categories">
                        {rule.categories.map(cat => (
                          <span key={cat} className="category-tag">{cat}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create/Edit Policy Modal */}
      {isCreating && editingPolicy && (
        <div className="modal-overlay" onClick={() => { setIsCreating(false); setEditingPolicy(null); }}>
          <div className="modal-content policy-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isCreating ? 'Create New Policy' : 'Edit Policy'}</h2>
              <button className="icon-btn" onClick={() => { setIsCreating(false); setEditingPolicy(null); }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              {/* Basic Info */}
              <div className="form-section">
                <h3>Basic Information</h3>
                <div className="form-group">
                  <label>Policy Name</label>
                  <input
                    type="text"
                    value={editingPolicy.name || ''}
                    onChange={e => setEditingPolicy({ ...editingPolicy, name: e.target.value })}
                    placeholder="Enter policy name"
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={editingPolicy.description || ''}
                    onChange={e => setEditingPolicy({ ...editingPolicy, description: e.target.value })}
                    placeholder="Describe this policy"
                    rows={3}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Version</label>
                    <input
                      type="text"
                      value={editingPolicy.version || ''}
                      onChange={e => setEditingPolicy({ ...editingPolicy, version: e.target.value })}
                      placeholder="1.0.0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Framework</label>
                    <select
                      value={editingPolicy.framework || ''}
                      onChange={e => setEditingPolicy({ ...editingPolicy, framework: e.target.value })}
                    >
                      <option value="Custom">Custom</option>
                      <option value="OWASP">OWASP</option>
                      <option value="PCI-DSS">PCI-DSS</option>
                      <option value="HIPAA">HIPAA</option>
                      <option value="SOC 2">SOC 2</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Compliance */}
              <div className="form-section">
                <h3>Compliance Standards</h3>
                <div className="checkbox-group">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={editingPolicy.compliance?.owasp || false}
                      onChange={e => setEditingPolicy({
                        ...editingPolicy,
                        compliance: { ...editingPolicy.compliance!, owasp: e.target.checked }
                      })}
                    />
                    OWASP Top 10
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={editingPolicy.compliance?.pciDss || false}
                      onChange={e => setEditingPolicy({
                        ...editingPolicy,
                        compliance: { ...editingPolicy.compliance!, pciDss: e.target.checked }
                      })}
                    />
                    PCI-DSS 4.0
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={editingPolicy.compliance?.hipaa || false}
                      onChange={e => setEditingPolicy({
                        ...editingPolicy,
                        compliance: { ...editingPolicy.compliance!, hipaa: e.target.checked }
                      })}
                    />
                    HIPAA
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={editingPolicy.compliance?.soc2 || false}
                      onChange={e => setEditingPolicy({
                        ...editingPolicy,
                        compliance: { ...editingPolicy.compliance!, soc2: e.target.checked }
                      })}
                    />
                    SOC 2
                  </label>
                </div>
              </div>

              {/* Rules */}
              <div className="form-section">
                <div className="section-header">
                  <h3>Rules ({editingPolicy.rules?.length || 0})</h3>
                  <button className="btn btn-sm btn-secondary" onClick={handleAddRule}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add Rule
                  </button>
                </div>

                <div className="rules-editor">
                  {editingPolicy.rules?.map((rule, index) => (
                    <div key={rule.id} className="rule-editor-item">
                      <div className="rule-number">{index + 1}</div>
                      <div className="rule-fields">
                        <input
                          type="text"
                          value={rule.name}
                          onChange={e => handleUpdateRule(rule.id, { name: e.target.value })}
                          placeholder="Rule name"
                          className="rule-name-input"
                        />
                        <select
                          value={rule.severity}
                          onChange={e => handleUpdateRule(rule.id, { severity: e.target.value as any })}
                          className="severity-select"
                        >
                          <option value="critical">Critical</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                          <option value="informational">Info</option>
                        </select>
                        <button
                          className="icon-btn danger"
                          onClick={() => handleRemoveRule(rule.id)}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setIsCreating(false); setEditingPolicy(null); }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSavePolicy}>
                <Check className="w-4 h-4 mr-2" />
                Save Policy
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .policy-manager {
          padding: 1.5rem;
          background: #1a1a2e;
          border-radius: 12px;
          color: #fff;
        }

        .policy-header {
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

        .policy-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .policy-card {
          background: #0f0f23;
          border: 1px solid #2d2d44;
          border-radius: 8px;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .policy-card:hover {
          border-color: #6366f1;
        }

        .policy-card.selected {
          border-color: #6366f1;
          background: rgba(99, 102, 241, 0.1);
        }

        .policy-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .policy-info h3 {
          margin: 0 0 0.25rem 0;
          font-size: 1rem;
        }

        .policy-info p {
          margin: 0;
          font-size: 0.875rem;
          color: #94a3b8;
        }

        .policy-actions {
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

        .policy-meta {
          display: flex;
          gap: 1rem;
          margin-top: 0.75rem;
          font-size: 0.75rem;
          color: #64748b;
        }

        .version {
          padding: 0.125rem 0.5rem;
          background: #2d2d44;
          border-radius: 4px;
        }

        .compliance-badges {
          display: flex;
          gap: 0.25rem;
        }

        .compliance-badge {
          padding: 0.125rem 0.5rem;
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
          border-radius: 4px;
        }

        .policy-details {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #2d2d44;
        }

        .policy-details h4 {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
          color: #94a3b8;
        }

        .rules-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .rule-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: #1a1a2e;
          border-radius: 4px;
        }

        .rule-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .rule-name {
          font-size: 0.875rem;
        }

        .severity-badge {
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          font-size: 0.625rem;
          text-transform: uppercase;
        }

        .severity-badge.critical { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .severity-badge.high { background: rgba(249, 115, 22, 0.2); color: #f97316; }
        .severity-badge.medium { background: rgba(234, 179, 8, 0.2); color: #eab308; }
        .severity-badge.low { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }

        .category-tag {
          padding: 0.125rem 0.375rem;
          background: #2d2d44;
          border-radius: 4px;
          font-size: 0.625rem;
          color: #94a3b8;
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
          max-width: 600px;
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

        .modal-body {
          padding: 1.5rem;
        }

        .form-section {
          margin-bottom: 1.5rem;
        }

        .form-section h3 {
          margin: 0 0 1rem 0;
          font-size: 0.875rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .section-header h3 {
          margin: 0;
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
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 0.75rem;
          background: #0f0f23;
          border: 1px solid #2d2d44;
          border-radius: 8px;
          color: #fff;
          font-size: 0.875rem;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
          outline: none;
          border-color: #6366f1;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .checkbox-group .checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .checkbox-group input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .rules-editor {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .rule-editor-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: #0f0f23;
          border-radius: 8px;
        }

        .rule-number {
          width: 24px;
          height: 24px;
          background: #2d2d44;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .rule-fields {
          flex: 1;
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .rule-name-input {
          flex: 1;
        }

        .severity-select {
          width: 120px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 1.25rem 1.5rem;
          border-top: 1px solid #2d2d44;
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
      `}</style>
    </div>
  );
};

export default PolicyManager;
