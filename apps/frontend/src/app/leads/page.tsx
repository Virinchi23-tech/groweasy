'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LeadValidationSchema, ValidatedLead, CRM_STATUSES, DATA_SOURCES } from '@groweasy/shared';
import { apiFetch } from '../../utils/api';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  FunnelIcon,
  TrashIcon,
  PencilSquareIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

interface Lead {
  id: string;
  name: string;
  email: string;
  countryCode: string | null;
  mobileWithoutCountryCode: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  leadOwner: string | null;
  crmStatus: string;
  crmNote: string | null;
  dataSource: string | null;
  possessionTime: string | null;
  description: string | null;
  createdAt: string;
}

interface LeadsResponse {
  leads: Lead[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  // Modals state
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deleteConfirmLead, setDeleteConfirmLead] = useState<Lead | null>(null);

  // Fetch leads with React Query
  const { data, isLoading } = useQuery<LeadsResponse>({
    queryKey: ['leads', page, search, statusFilter, sourceFilter],
    queryFn: () =>
      apiFetch(
        `/leads?page=${page}&limit=10&search=${search}&crmStatus=${statusFilter}&dataSource=${sourceFilter}`
      ),
  });

  const leads = data?.leads || [];
  const pagination = data?.pagination || { total: 0, page: 1, limit: 10, pages: 1 };

  // React Hook Form for manual creation/edit
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ValidatedLead>({
    resolver: zodResolver(LeadValidationSchema),
    defaultValues: {
      crm_status: 'GOOD_LEAD_FOLLOW_UP',
      data_source: undefined,
    }
  });

  // Open Form Modal for Create
  const handleCreateOpen = () => {
    setEditingLead(null);
    reset({
      name: '',
      email: '',
      country_code: '91',
      mobile_without_country_code: '',
      company: '',
      city: '',
      state: '',
      country: '',
      lead_owner: 'System',
      crm_status: 'GOOD_LEAD_FOLLOW_UP',
      crm_note: '',
      data_source: undefined,
      possession_time: '',
      description: '',
    });
    setFormOpen(true);
  };

  // Open Form Modal for Edit
  const handleEditOpen = (lead: Lead) => {
    setEditingLead(lead);
    reset({
      name: lead.name,
      email: lead.email || '',
      country_code: lead.countryCode || '91',
      mobile_without_country_code: lead.mobileWithoutCountryCode || '',
      company: lead.company || '',
      city: lead.city || '',
      state: lead.state || '',
      country: lead.country || '',
      lead_owner: lead.leadOwner || 'System',
      crm_status: lead.crmStatus as any,
      crm_note: lead.crmNote || '',
      data_source: (lead.dataSource || undefined) as any,
      possession_time: lead.possessionTime || '',
      description: lead.description || '',
    });
    setFormOpen(true);
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newLead: ValidatedLead) =>
      apiFetch('/leads', {
        method: 'POST',
        body: JSON.stringify(newLead),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setFormOpen(false);
      reset();
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to create lead');
    }
  });

  const updateMutation = useMutation({
    mutationFn: (updatedLead: ValidatedLead) =>
      apiFetch(`/leads/${editingLead!.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedLead),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setFormOpen(false);
      setEditingLead(null);
      reset();
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to update lead');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (leadId: string) =>
      apiFetch(`/leads/${leadId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setDeleteConfirmLead(null);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete lead');
    }
  });

  const onSubmit = (formData: ValidatedLead) => {
    if (editingLead) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">CRM Leads</h1>
          <p className="text-slate-500 dark:text-slate-400">View, search, edit, and manage all CRM records</p>
        </div>
        <button
          onClick={handleCreateOpen}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 active:scale-98 transition-all self-start sm:self-auto"
        >
          <PlusIcon className="w-5 h-5" />
          Add Lead Manually
        </button>
      </div>

      {/* Filter panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row items-center gap-4 justify-between">
        <div className="relative w-full md:max-w-xs">
          <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search leads name, email, company..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-2xl w-full sm:w-auto">
            <FunnelIcon className="w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-sm focus:outline-none text-slate-700 dark:text-slate-200 font-medium cursor-pointer w-full"
            >
              <option value="">All CRM Statuses</option>
              {CRM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-2xl w-full sm:w-auto">
            <FunnelIcon className="w-4 h-4 text-slate-500" />
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-sm focus:outline-none text-slate-700 dark:text-slate-200 font-medium cursor-pointer w-full"
            >
              <option value="">All Sources</option>
              {DATA_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-50 dark:bg-slate-800 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
              <UserGroupIcon className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">No CRM leads found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Add a lead manually or run a CSV import</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Lead Name</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4">Company & Location</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Source</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-850">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors text-sm text-slate-700 dark:text-slate-350">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{lead.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">Owner: {lead.leadOwner || 'Unassigned'}</div>
                    </td>
                    <td className="px-6 py-4 space-y-0.5">
                      <div className="font-medium text-slate-800 dark:text-slate-300">{lead.email || 'No email'}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {lead.mobileWithoutCountryCode ? `+${lead.countryCode || '91'} ${lead.mobileWithoutCountryCode}` : 'No phone'}
                      </div>
                    </td>
                    <td className="px-6 py-4 space-y-0.5">
                      <div className="font-medium text-slate-800 dark:text-slate-350 truncate max-w-[160px]">{lead.company || 'Private'}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {lead.city && lead.country ? `${lead.city}, ${lead.country}` : lead.city || lead.country || '--'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        lead.crmStatus === 'SALE_DONE' ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400' :
                        lead.crmStatus === 'GOOD_LEAD_FOLLOW_UP' ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-400' :
                        lead.crmStatus === 'DID_NOT_CONNECT' ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400' :
                        'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-400'
                      }`}>
                        {lead.crmStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 capitalize">
                      {lead.dataSource ? lead.dataSource.replace(/_/g, ' ') : '--'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditOpen(lead)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-500 transition-colors"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmLead(lead)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-500 transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-450">
              Showing page {pagination.page} of {pagination.pages} ({pagination.total} leads)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-50 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 transition-colors"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(p + 1, pagination.pages))}
                disabled={page === pagination.pages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-50 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 transition-colors"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE & EDIT FORM DIALOG */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-scaleUp">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingLead ? 'Edit Lead Record' : 'Create New Lead'}
              </h3>
              <button
                onClick={() => setFormOpen(false)}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Lead Name *</label>
                  <input
                    type="text"
                    {...register('name')}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
                  />
                  {errors.name && <span className="text-xxs text-red-500">{errors.name.message}</span>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Email address</label>
                  <input
                    type="email"
                    {...register('email')}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
                  />
                  {errors.email && <span className="text-xxs text-red-500">{errors.email.message}</span>}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Code</label>
                    <input
                      type="text"
                      {...register('country_code')}
                      placeholder="91"
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Mobile Phone</label>
                    <input
                      type="text"
                      {...register('mobile_without_country_code')}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Company</label>
                  <input
                    type="text"
                    {...register('company')}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">City</label>
                  <input
                    type="text"
                    {...register('city')}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Country</label>
                  <input
                    type="text"
                    {...register('country')}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">CRM Status *</label>
                  <select
                    {...register('crm_status')}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white cursor-pointer"
                  >
                    {CRM_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Data Source</label>
                  <select
                    {...register('data_source')}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">None / Custom</option>
                    {DATA_SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Lead Owner</label>
                  <input
                    type="text"
                    {...register('lead_owner')}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Possession Time</label>
                  <input
                    type="text"
                    {...register('possession_time')}
                    placeholder="e.g. Immediate, 6 months"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Description / Notes</label>
                <textarea
                  {...register('description')}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 font-semibold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-98"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    editingLead ? 'Save Changes' : 'Create Lead'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteConfirmLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-8 border border-slate-200 dark:border-slate-800 shadow-2xl animate-scaleUp space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 text-red-655 flex items-center justify-center mx-auto">
                <TrashIcon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete CRM Lead</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Are you sure you want to delete lead <span className="font-semibold">{deleteConfirmLead.name}</span>? This action can be soft-recovered by admins.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setDeleteConfirmLead(null)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 font-semibold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-98"
                disabled={deleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmLead.id)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-2xl shadow-lg shadow-red-600/10 hover:shadow-red-600/20 active:scale-98 transition-all flex items-center justify-center gap-2"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Confirm Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
