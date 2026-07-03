import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import type { Client } from '../../types';
import { Plus, Edit, Trash2, Search, X, User } from 'lucide-react';

export const Clients: React.FC = () => {
  const { clients, addClient, updateClient, deleteClient } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState('');

  const openAddModal = () => {
    setEditingClient(null);
    setName('');
    setEmail('');
    setPhone('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setEmail(client.email);
    setPhone(client.phone);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name || !email || !phone) {
      setFormError('All fields are required.');
      return;
    }

    if (editingClient) {
      // Edit
      updateClient({
        id: editingClient.id,
        name,
        email,
        phone
      });
    } else {
      // Add
      addClient({
        id: `cli-${Date.now()}`,
        name,
        email,
        phone
      });
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete client "${name}"? This will also delete all associated galleries.`)) {
      deleteClient(id);
    }
  };

  // Search filter
  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-slate-800 m-0 leading-none">
            Clients Management
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Register and manage customer profiles for studio selection galleries.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-brand-blue hover:bg-brand-blue-dark text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 text-sm active:scale-[0.98] shadow-md shadow-brand-blue/10 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Client</span>
        </button>
      </div>

      {/* Control Actions (Search) */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by client name, email, or phone..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-brand-blue focus:bg-white rounded-xl text-sm placeholder-slate-400 focus:outline-none transition-colors"
          />
        </div>
        <div className="text-xs font-semibold text-slate-400">
          Showing {filteredClients.length} of {clients.length} clients
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                <th className="py-4 px-6">Client Info</th>
                <th className="py-4 px-6">Email Address</th>
                <th className="py-4 px-6">Phone Number</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50/20 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200/50">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{client.name}</div>
                        <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">{client.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-600 font-medium">{client.email}</td>
                  <td className="py-4 px-6 text-slate-600 font-medium">{client.phone}</td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEditModal(client)}
                        className="p-2 text-slate-500 hover:bg-slate-50 hover:text-brand-blue rounded-lg border border-transparent hover:border-slate-100 transition-all duration-200"
                        title="Edit profile"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(client.id, client.name)}
                        className="p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-lg border border-transparent hover:border-red-100 transition-all duration-200"
                        title="Delete profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                    No clients found matching the search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-scale-up">
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
              <h3 className="font-display font-bold text-lg text-slate-800">
                {editingClient ? 'Edit Client Profile' : 'Register New Client'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-xl border border-red-100">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Client Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sarah Nabirye"
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. sarah@example.com"
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +256 772 987654"
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-brand-blue hover:bg-brand-blue-dark text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors shadow-md shadow-brand-blue/10"
                >
                  {editingClient ? 'Save Changes' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
