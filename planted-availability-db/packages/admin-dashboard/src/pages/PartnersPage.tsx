import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  partnersApi,
  batchesApi,
  type Partner,
  type IngestionBatch,
  type CreatePartnerInput,
  type CreatePartnerResponse,
} from '../lib/api';

type TabType = 'partners' | 'batches';
type PartnerType = Partner['type'];
type PartnerStatus = Partner['status'];

interface PartnerFormData {
  name: string;
  type: PartnerType;
  primary_name: string;
  primary_email: string;
  technical_email: string;
  phone: string;
  data_format: 'planted_standard' | 'custom';
  auto_approve_threshold: number;
  requires_manual_review: boolean;
  allowed_entity_types: string[];
  markets: string;
  requests_per_hour: number;
  requests_per_day: number;
}

const emptyForm: PartnerFormData = {
  name: '',
  type: 'independent',
  primary_name: '',
  primary_email: '',
  technical_email: '',
  phone: '',
  data_format: 'planted_standard',
  auto_approve_threshold: 85,
  requires_manual_review: false,
  allowed_entity_types: ['venue', 'dish', 'promotion'],
  markets: '',
  requests_per_hour: 1000,
  requests_per_day: 10000,
};

function PartnersPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('partners');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState<PartnerFormData>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<CreatePartnerResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Fetch partners
  const { data: partnersData, isLoading: partnersLoading } = useQuery({
    queryKey: ['partners', statusFilter],
    queryFn: () => partnersApi.getAll({ status: statusFilter || undefined, limit: 100 }),
    enabled: activeTab === 'partners',
  });

  // Fetch batches
  const { data: batchesData, isLoading: batchesLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchesApi.getAll({ limit: 100 }),
    enabled: activeTab === 'batches',
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreatePartnerInput) => partnersApi.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      setCreatedCredentials(response);
    },
    onError: (err: Error) => setError(err.message),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Partner> }) =>
      partnersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      closeModal();
    },
    onError: (err: Error) => setError(err.message),
  });

  // Activate mutation
  const activateMutation = useMutation({
    mutationFn: (id: string) => partnersApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  // Suspend mutation
  const suspendMutation = useMutation({
    mutationFn: (id: string) => partnersApi.suspend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const openCreateModal = () => {
    setEditingPartner(null);
    setFormData(emptyForm);
    setError(null);
    setCreatedCredentials(null);
    setIsModalOpen(true);
  };

  const openEditModal = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      type: partner.type,
      primary_name: partner.contact.primary_name,
      primary_email: partner.contact.primary_email,
      technical_email: partner.contact.technical_email || '',
      phone: partner.contact.phone || '',
      data_format: partner.config.data_format,
      auto_approve_threshold: partner.config.auto_approve_threshold,
      requires_manual_review: partner.config.requires_manual_review,
      allowed_entity_types: partner.config.allowed_entity_types,
      markets: partner.config.markets.join(', '),
      requests_per_hour: partner.rate_limits.requests_per_hour,
      requests_per_day: partner.rate_limits.requests_per_day,
    });
    setError(null);
    setCreatedCredentials(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPartner(null);
    setFormData(emptyForm);
    setError(null);
    setCreatedCredentials(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!formData.name || !formData.primary_name || !formData.primary_email) {
      setError('Name, primary contact name, and email are required');
      return;
    }

    const input: CreatePartnerInput = {
      name: formData.name,
      type: formData.type,
      contact: {
        primary_name: formData.primary_name,
        primary_email: formData.primary_email,
        technical_email: formData.technical_email || undefined,
        phone: formData.phone || undefined,
      },
      config: {
        data_format: formData.data_format,
        auto_approve_threshold: formData.auto_approve_threshold,
        requires_manual_review: formData.requires_manual_review,
        allowed_entity_types: formData.allowed_entity_types as Partner['config']['allowed_entity_types'],
        markets: formData.markets
          .split(',')
          .map((m) => m.trim().toUpperCase())
          .filter(Boolean),
      },
      rate_limits: {
        requests_per_hour: formData.requests_per_hour,
        requests_per_day: formData.requests_per_day,
      },
    };

    if (editingPartner) {
      updateMutation.mutate({ id: editingPartner.id, data: input as unknown as Partial<Partner> });
    } else {
      createMutation.mutate(input);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : type === 'number'
            ? parseInt(value, 10)
            : value,
    }));
  };

  const handleEntityTypeChange = (entityType: string) => {
    setFormData((prev) => {
      const types = prev.allowed_entity_types.includes(entityType)
        ? prev.allowed_entity_types.filter((t) => t !== entityType)
        : [...prev.allowed_entity_types, entityType];
      return { ...prev, allowed_entity_types: types };
    });
  };

  const getStatusBadgeClass = (status: PartnerStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'onboarding':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getBatchStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending_review':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Partner Management</h1>
        <button
          onClick={openCreateModal}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          + Add Partner
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('partners')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'partners'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Partners
          </button>
          <button
            onClick={() => setActiveTab('batches')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'batches'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Ingestion Batches
          </button>
        </nav>
      </div>

      {/* Partners Tab */}
      {activeTab === 'partners' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="onboarding">Onboarding</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Partners Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            {partnersLoading ? (
              <div className="p-8 text-center text-gray-500">Loading partners...</div>
            ) : !partnersData?.partners?.length ? (
              <div className="p-8 text-center text-gray-500">No partners found</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Partner
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Quality Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Submissions
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {partnersData.partners.map((partner: Partner) => (
                    <tr key={partner.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{partner.name}</div>
                        <div className="text-sm text-gray-500">{partner.contact.primary_email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize">{partner.type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(partner.status)}`}
                        >
                          {partner.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div
                            className={`w-12 h-2 rounded-full mr-2 ${
                              partner.quality_metrics.data_quality_score >= 70
                                ? 'bg-green-400'
                                : partner.quality_metrics.data_quality_score >= 40
                                  ? 'bg-yellow-400'
                                  : 'bg-red-400'
                            }`}
                            style={{
                              width: `${partner.quality_metrics.data_quality_score}%`,
                              maxWidth: '48px',
                            }}
                          />
                          <span className="text-sm">{partner.quality_metrics.data_quality_score}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {partner.quality_metrics.total_submissions} total
                        <br />
                        <span className="text-green-600">
                          {partner.quality_metrics.accepted_submissions} accepted
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(partner)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        {partner.status === 'onboarding' && (
                          <button
                            onClick={() => activateMutation.mutate(partner.id)}
                            className="text-green-600 hover:text-green-800"
                          >
                            Activate
                          </button>
                        )}
                        {partner.status === 'active' && (
                          <button
                            onClick={() => suspendMutation.mutate(partner.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Suspend
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Batches Tab */}
      {activeTab === 'batches' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {batchesLoading ? (
            <div className="p-8 text-center text-gray-500">Loading batches...</div>
          ) : !batchesData?.batches?.length ? (
            <div className="p-8 text-center text-gray-500">No ingestion batches found</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Batch ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Channel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Records
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Received
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {batchesData.batches.map((batch: IngestionBatch) => (
                  <tr key={batch.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm">{batch.id.slice(0, 12)}...</div>
                      <div className="text-xs text-gray-500">{batch.partner_id.slice(0, 12)}...</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize">{batch.source.channel.replace('_', ' ')}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getBatchStatusBadgeClass(batch.status)}`}
                      >
                        {batch.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div>{batch.stats.records_received} received</div>
                      <div className="text-green-600">{batch.stats.records_approved} approved</div>
                      {batch.stats.records_rejected > 0 && (
                        <div className="text-red-600">{batch.stats.records_rejected} rejected</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(batch.received_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {createdCredentials
                    ? 'Partner Created Successfully'
                    : editingPartner
                      ? 'Edit Partner'
                      : 'Create Partner'}
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  &times;
                </button>
              </div>

              {createdCredentials ? (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded">
                    <strong>Important:</strong> Save these credentials now. They will only be shown once!
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">API Key</label>
                      <code className="block bg-gray-100 p-2 rounded text-sm break-all">
                        {createdCredentials.credentials.api_key}
                      </code>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Webhook Secret</label>
                      <code className="block bg-gray-100 p-2 rounded text-sm break-all">
                        {createdCredentials.credentials.webhook_secret}
                      </code>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Webhook URL</label>
                      <code className="block bg-gray-100 p-2 rounded text-sm break-all">
                        {createdCredentials.integration_docs.webhook_url}
                      </code>
                    </div>
                  </div>

                  <button
                    onClick={closeModal}
                    className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
                  >
                    I&apos;ve Saved the Credentials
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Partner Name</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Type</label>
                      <select
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="chain">Chain</option>
                        <option value="independent">Independent</option>
                        <option value="distributor">Distributor</option>
                        <option value="aggregator">Aggregator</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Data Format</label>
                      <select
                        name="data_format"
                        value={formData.data_format}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="planted_standard">Planted Standard</option>
                        <option value="custom">Custom (Requires Transformer)</option>
                      </select>
                    </div>
                  </div>

                  <hr />
                  <h3 className="font-medium">Contact Information</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Primary Contact Name
                      </label>
                      <input
                        type="text"
                        name="primary_name"
                        value={formData.primary_name}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Primary Email</label>
                      <input
                        type="email"
                        name="primary_email"
                        value={formData.primary_email}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Technical Email (optional)
                      </label>
                      <input
                        type="email"
                        name="technical_email"
                        value={formData.technical_email}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone (optional)</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>

                  <hr />
                  <h3 className="font-medium">Configuration</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Auto-Approve Threshold (%)
                      </label>
                      <input
                        type="number"
                        name="auto_approve_threshold"
                        value={formData.auto_approve_threshold}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Markets (comma-separated country codes)
                      </label>
                      <input
                        type="text"
                        name="markets"
                        value={formData.markets}
                        onChange={handleInputChange}
                        placeholder="CH, DE, AT"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Allowed Entity Types
                      </label>
                      <div className="flex gap-4">
                        {['venue', 'dish', 'promotion', 'availability'].map((type) => (
                          <label key={type} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.allowed_entity_types.includes(type)}
                              onChange={() => handleEntityTypeChange(type)}
                              className="mr-2"
                            />
                            <span className="capitalize">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="requires_manual_review"
                          checked={formData.requires_manual_review}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        <span>Require Manual Review for All Submissions</span>
                      </label>
                    </div>
                  </div>

                  <hr />
                  <h3 className="font-medium">Rate Limits</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Requests per Hour
                      </label>
                      <input
                        type="number"
                        name="requests_per_hour"
                        value={formData.requests_per_hour}
                        onChange={handleInputChange}
                        min="1"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Requests per Day
                      </label>
                      <input
                        type="number"
                        name="requests_per_day"
                        value={formData.requests_per_day}
                        onChange={handleInputChange}
                        min="1"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {createMutation.isPending || updateMutation.isPending
                        ? 'Saving...'
                        : editingPartner
                          ? 'Update Partner'
                          : 'Create Partner'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PartnersPage;
