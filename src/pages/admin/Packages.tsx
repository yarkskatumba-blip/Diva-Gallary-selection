import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import type { Package } from '../../types';
import { Plus, Edit, Trash2, Layers, X } from 'lucide-react';

export const Packages: React.FC = () => {
  const { packages, addPackage, updatePackage, deletePackage, settings } = useStore();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<Package | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [includedPhotos, setIncludedPhotos] = useState<number>(20);
  const [extraPhotoPrice, setExtraPhotoPrice] = useState<number>(10000);
  const [formError, setFormError] = useState('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency || 'UGX',
      minimumFractionDigits: 0
    }).format(val).replace('$', 'UGX ');
  };

  const openAddModal = () => {
    setEditingPkg(null);
    setName('');
    setIncludedPhotos(settings.defaultExtraPrice ? 20 : 20);
    setExtraPhotoPrice(settings.defaultExtraPrice || 10000);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (pkg: Package) => {
    setEditingPkg(pkg);
    setName(pkg.name);
    setIncludedPhotos(pkg.includedPhotos);
    setExtraPhotoPrice(pkg.extraPhotoPrice);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name || includedPhotos === undefined || extraPhotoPrice === undefined) {
      setFormError('All fields are required.');
      return;
    }

    if (includedPhotos < 0 || extraPhotoPrice < 0) {
      setFormError('Values cannot be negative.');
      return;
    }

    if (editingPkg) {
      // Edit
      updatePackage({
        id: editingPkg.id,
        name,
        includedPhotos,
        extraPhotoPrice
      });
    } else {
      // Add
      addPackage({
        id: `pkg-${Date.now()}`,
        name,
        includedPhotos,
        extraPhotoPrice
      });
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete package "${name}"? Existing galleries referencing this package will preserve their calculations, but you won't be able to select it for new galleries.`
      )
    ) {
      deletePackage(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-slate-800 m-0 leading-none">
            Packages & Pricing
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Define pricing models, included photo volumes, and penalty rates for selection overages.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-brand-blue hover:bg-brand-blue-dark text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 text-sm active:scale-[0.98] shadow-md shadow-brand-blue/10 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Package</span>
        </button>
      </div>

      {/* Grid of Packages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all duration-300 relative group overflow-hidden"
          >
            {/* Top gold bar decorative */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-brand-blue to-brand-gold opacity-80" />

            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-slate-50 rounded-2xl text-slate-700 border border-slate-100 group-hover:scale-105 transition-transform duration-300">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="flex gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditModal(pkg)}
                    className="p-1.5 text-slate-500 hover:text-brand-blue hover:bg-slate-50 rounded-lg transition-colors"
                    title="Edit package"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(pkg.id, pkg.name)}
                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete package"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-display font-bold text-lg text-slate-800 m-0 leading-tight">
                  {pkg.name}
                </h3>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mt-1">
                  ID: {pkg.id}
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Included Photos:</span>
                  <span className="font-extrabold text-slate-800">{pkg.includedPhotos} photos</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Extra Photo Rate:</span>
                  <span className="font-extrabold text-brand-gold">
                    {formatCurrency(pkg.extraPhotoPrice)} each
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {packages.length === 0 && (
          <div className="col-span-3 bg-slate-50 py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-400">
            No packages available. Create one to get started.
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-scale-up">
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
              <h3 className="font-display font-bold text-lg text-slate-800">
                {editingPkg ? 'Edit Pricing Package' : 'Create Pricing Package'}
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
                  Package Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Wedding Gold"
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Included Photos
                </label>
                <input
                  type="number"
                  min="0"
                  value={includedPhotos}
                  onChange={(e) => setIncludedPhotos(parseInt(e.target.value) || 0)}
                  placeholder="e.g. 20"
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Extra Photo Price (UGX)
                </label>
                <input
                  type="number"
                  min="0"
                  value={extraPhotoPrice}
                  onChange={(e) => setExtraPhotoPrice(parseInt(e.target.value) || 0)}
                  placeholder="e.g. 10000"
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
                  {editingPkg ? 'Save Changes' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
