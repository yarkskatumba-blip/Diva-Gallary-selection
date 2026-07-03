import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Save, Camera, Check, Mail, ExternalLink } from 'lucide-react';

export const Settings: React.FC = () => {
  const { settings, updateSettings, updateSettingsInFirestore } = useStore();
  const [studioName, setStudioName] = useState(settings.studioName);
  const [slogan, setSlogan] = useState(settings.slogan);
  const [currency, setCurrency] = useState(settings.currency);
  const [defaultExtraPrice, setDefaultExtraPrice] = useState(settings.defaultExtraPrice);
  const [emailjsServiceId, setEmailjsServiceId] = useState(settings.emailjsServiceId || '');
  const [emailjsTemplateId, setEmailjsTemplateId] = useState(settings.emailjsTemplateId || '');
  const [emailjsPublicKey, setEmailjsPublicKey] = useState(settings.emailjsPublicKey || '');
  const [compressBeforeUpload, setCompressBeforeUpload] = useState(settings.compressBeforeUpload || false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSettings = {
      studioName,
      slogan,
      currency,
      defaultExtraPrice,
      emailjsServiceId,
      emailjsTemplateId,
      emailjsPublicKey,
      compressBeforeUpload
    };
    updateSettings(newSettings);
    await updateSettingsInFirestore(newSettings);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-slate-800 m-0 leading-none">
            Studio Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Manage branding text, currencies, and global photo package rates.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {success && (
            <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-xl border border-emerald-100 flex items-center gap-2">
              <Check className="w-5 h-5" />
              <span>Studio configuration saved successfully!</span>
            </div>
          )}

          {/* Branding Settings Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
              Studio Identity & Branding
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Studio Name
              </label>
              <input
                type="text"
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm placeholder-slate-400 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Slogan / Tagline
              </label>
              <input
                type="text"
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm placeholder-slate-400 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Pricing Config Section */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
              Global Overage Pricing Defaults
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Currency Symbol / ISO Code
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm focus:outline-none transition-colors"
                >
                  <option value="UGX">UGX (Ugandan Shilling)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="KES">KES (Kenyan Shilling)</option>
                  <option value="TZS">TZS (Tanzanian Shilling)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Default Price Per Extra Photo
                </label>
                <input
                  type="number"
                  min="0"
                  value={defaultExtraPrice}
                  onChange={(e) => setDefaultExtraPrice(parseInt(e.target.value) || 0)}
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm focus:outline-none transition-colors"
                />
              </div>
            </div>

          {/* EmailJS Notification Config */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Notifications
              </h3>
              <a
                href="https://www.emailjs.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-blue font-semibold flex items-center gap-1 hover:underline"
              >
                Setup EmailJS <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="bg-amber-50 border border-amber-100 text-amber-800 text-xs rounded-xl px-4 py-3 leading-relaxed">
              <strong>How to enable real emails to divashotsstudios@gmail.com:</strong><br />
              1. Sign up free at <a href="https://www.emailjs.com" target="_blank" rel="noopener noreferrer" className="underline">emailjs.com</a><br />
              2. Add a <strong>Gmail service</strong> connected to divashotsstudios@gmail.com<br />
              3. Create an <strong>email template</strong> with fields: <code>{'{{subject}}'}</code>, <code>{'{{message}}'}</code>, <code>{'{{to_email}}'}</code><br />
              4. Paste your <strong>Service ID, Template ID &amp; Public Key</strong> below and save.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Service ID</label>
                <input
                  type="text"
                  value={emailjsServiceId}
                  onChange={(e) => setEmailjsServiceId(e.target.value)}
                  placeholder="service_xxxxxxx"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm font-mono focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Template ID</label>
                <input
                  type="text"
                  value={emailjsTemplateId}
                  onChange={(e) => setEmailjsTemplateId(e.target.value)}
                  placeholder="template_xxxxxxx"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm font-mono focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Public Key</label>
                <input
                  type="text"
                  value={emailjsPublicKey}
                  onChange={(e) => setEmailjsPublicKey(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm font-mono focus:outline-none transition-colors"
                />
              </div>
            </div>
            {emailjsServiceId && emailjsTemplateId && emailjsPublicKey && (
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl">
                <Check className="w-4 h-4" />
                Email notifications configured — divashotsstudios@gmail.com will receive alerts.
              </div>
            )}
          </div>

          {/* Performance & Optimization Config */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
              Upload Optimization
            </h3>
            <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
              <input
                type="checkbox"
                id="compressBeforeUpload"
                checked={compressBeforeUpload}
                onChange={(e) => setCompressBeforeUpload(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-brand-blue border-slate-350 focus:ring-brand-blue"
              />
              <div className="text-xs">
                <label htmlFor="compressBeforeUpload" className="font-bold text-slate-700 block mb-0.5 cursor-pointer">
                  Compress images before uploading
                </label>
                <p className="text-slate-500 leading-relaxed font-medium">
                  When enabled, photos will be resized to a maximum of 1600px width/height and compressed to 80% quality in the browser before uploading. 
                  <strong> If disabled, original, unmodified full-resolution photos, videos, and documents will be uploaded preserving 100% original quality.</strong>
                </p>
              </div>
            </div>
          </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <button
              type="submit"
              className="bg-brand-blue hover:bg-brand-blue-dark text-white font-semibold py-3 px-5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-md shadow-brand-blue/10"
            >
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </button>
          </div>
        </form>
      </div>

      {/* Branding Info Box */}
      <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/10 rounded-full blur-2xl" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-brand-blue/10 p-3 rounded-2xl border border-brand-gold/30">
            <Camera className="w-6 h-6 text-brand-gold animate-pulse-gold" />
          </div>
          <div>
            <h4 className="font-display font-extrabold text-white uppercase tracking-wider text-xs">
              Diva Shots Brand Standards
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed">
              These settings control global metadata, login titles, and defaults across the client interfaces.<br />
              Primary Colors: Royal Blue (#2563EB), Gold (#F59E0B), White, Light Gray.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
