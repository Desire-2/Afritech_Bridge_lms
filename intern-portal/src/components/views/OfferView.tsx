/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { OfferData } from '../../types';
import { 
  FileCheck2, 
  Linkedin, 
  Twitter, 
  Facebook, 
  Share2, 
  Download, 
  ExternalLink,
  ShieldCheck, 
  Clock, 
  Loader2,
  AlertCircle
} from 'lucide-react';

export const OfferView: React.FC = () => {
  const [data, setData] = useState<OfferData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchOffer = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getOffer();
      if (response.success) {
        setData(response.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Admissions offer datasets are currently offline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffer();

    const handleSandboxChange = () => {
      fetchOffer();
    };
    window.addEventListener('sandbox_mode_changed', handleSandboxChange);
    return () => {
      window.removeEventListener('sandbox_mode_changed', handleSandboxChange);
    };
  }, []);

  const handleShareCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.verification_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSimpleDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 font-sans">
        <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
        <p className="text-xs text-slate-500 font-mono">Retrieving Admissions Offer metadata...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto space-y-4 mt-12 font-sans">
        <AlertCircle className="h-10 w-10 text-rose-455 mx-auto" />
        <div>
          <h3 className="text-md font-bold text-white">Offer Letter Database Alert</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {error || 'Admissions verification certificates could not be generated.'}
          </p>
        </div>
        <button
          onClick={fetchOffer}
          className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-705 hover:bg-slate-800 rounded-xl text-xs text-slate-350 font-semibold cursor-pointer"
        >
          Check admissions link
        </button>
      </div>
    );
  }

  // Social share generation
  const encodedShareText = encodeURIComponent(`Incredibly proud to share that I have been accepted as a Software Engineering Intern at AfriTech Bridge! 🚀 Looking forward to bridging the gap to remote global tech careers! #AfriTechBridge #SoftwareEngineering #Internship`);
  const encodedUrl = encodeURIComponent(data.verification_url);

  const shareLinks = {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedShareText}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodedShareText}%20${encodedUrl}`
  };

  return (
    <div className="space-y-8 font-sans animate-fadeIn" id="offer-view-card">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Admissions Offer & Verification</h1>
        <p className="text-xs text-slate-400 mt-1">
          Verify your eligibility status, share certified results, or download formal acceptance letters.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        
        {/* Certificate Card layout (3/5 width) */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-2xl shadow-slate-950">
          
          {/* Certificate watermarks */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rotate-45 pointer-events-none rounded-2xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/5 pointer-events-none rounded-full" />

          {/* Certificate header branding */}
          <div className="flex justify-between items-start border-b border-slate-804 pb-6 z-10 relative">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-orange-500 flex items-center justify-center font-bold text-white shadow-md text-sm">
                AT
              </div>
              <div>
                <span className="font-extrabold tracking-tight text-white text-md block">AfriTech Bridge</span>
                <span className="text-[9px] font-mono tracking-widest text-teal-400 uppercase">Admissions Board</span>
              </div>
            </div>

            {/* Authentic Green verification sticker */}
            <div className="flex items-center space-x-1.5 p-2 px-3 bg-emerald-950/70 border border-emerald-500/25 text-emerald-400 rounded-full text-[10px] uppercase font-bold font-mono">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Verified Certificate</span>
            </div>
          </div>

          {/* Core certificate details */}
          <div className="space-y-6 z-10 relative py-2">
            
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">Verification Identifier:</span>
              <span className="text-sm font-bold text-teal-300 font-mono tracking-tight block">
                {data.offer_number}
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-black text-white tracking-tight">Formal Internship Offer of Admission</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                This document verifies that the holding student has completed all necessary admissions screenings, technical interviews, and is formally accepted into the active specialization cohort.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850">
                <span className="text-[9px] text-slate-500 font-mono block uppercase">Status flag:</span>
                <span className="text-xs font-bold text-emerald-405 font-mono uppercase block mt-1">
                  {data.status} • Active
                </span>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850">
                <span className="text-[9px] text-slate-500 font-mono block uppercase">Dispatched Date:</span>
                <span className="text-xs font-bold text-slate-400 font-mono block mt-1">
                  {formatSimpleDate(data.sent_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Certificate footer note */}
          <div className="p-4 bg-slate-955 border border-slate-850 rounded-2xl flex items-start space-x-3 text-[11px] text-slate-400">
            <ShieldCheck className="h-5 w-5 text-teal-405 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              This certification contains cryptographic hashes synced to the AfriTech Bridge LMS registry. Modifying details invalidates authenticity signatures dynamically.
            </span>
          </div>
        </div>

        {/* Actions panel (2/5 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card: Share with the world */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white">Broadcast acceptance</h3>
              <p className="text-[11px] text-slate-405">
                Share your active verification URL directly on professional networks to stand out.
              </p>
            </div>

            {/* Social triggers */}
            <div className="grid grid-cols-2 gap-3">
              <a
                href={shareLinks.linkedin}
                target="_blank"
                referrerPolicy="no-referrer"
                className="flex items-center space-x-2.5 p-3 bg-[#0a66c2]/10 hover:bg-[#0a66c2]/20 border border-[#0a66c2]/20 rounded-xl text-xs font-bold text-sky-400 transition-all text-center justify-center cursor-pointer"
              >
                <Linkedin className="h-4 w-4 shrink-0" />
                <span>LinkedIn</span>
              </a>
              <a
                href={shareLinks.twitter}
                target="_blank"
                referrerPolicy="no-referrer"
                className="flex items-center space-x-2.5 p-3 bg-[#1d9bf0]/10 hover:bg-[#1d9bf0]/20 border border-[#1d9bf0]/20 rounded-xl text-xs font-bold text-sky-450 transition-all text-center justify-center cursor-pointer"
              >
                <Twitter className="h-4 w-4 shrink-0" />
                <span>Twitter</span>
              </a>
              <a
                href={shareLinks.facebook}
                target="_blank"
                referrerPolicy="no-referrer"
                className="flex items-center space-x-2.5 p-3 bg-[#1877f2]/10 hover:bg-[#1877f2]/20 border border-[#1877f2]/20 text-blue-400 rounded-xl text-xs font-bold transition-all text-center justify-center cursor-pointer"
              >
                <Facebook className="h-4 w-4 shrink-0" />
                <span>Facebook</span>
              </a>
              <a
                href={shareLinks.whatsapp}
                target="_blank"
                referrerPolicy="no-referrer"
                className="flex items-center space-x-2.5 p-3 bg-[#25d366]/10 hover:bg-[#25d366]/20 border border-[#25d366]/20 rounded-xl text-xs font-bold text-emerald-450 transition-all text-center justify-center cursor-pointer"
              >
                <Share2 className="h-4 w-4 shrink-0" />
                <span>WhatsApp</span>
              </a>
            </div>

            <div className="border-t border-slate-800 pt-1" />

            <div className="space-y-2">
              <label className="block text-[10px] text-slate-500 font-mono uppercase">Certified Verification Link:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={data.verification_url}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-450 outline-none"
                />
                
                <button
                  type="button"
                  onClick={handleShareCopy}
                  className="px-3.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-teal-400 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Action triggers: PDF downloads */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white">Admissions Dossier Downloads</h3>
              <p className="text-[11px] text-slate-405">
                Securely fetch offline copies of your certifications.
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <a
                href={data.download_url}
                download
                target="_blank"
                referrerPolicy="no-referrer"
                className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-805 hover:border-slate-700 p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="p-2 bg-slate-900 rounded-lg text-slate-400">
                    <FileCheck2 className="h-4 w-4" />
                  </div>
                  <div className="text-left font-sans">
                    <span className="block font-bold">Download Admissions PDF</span>
                    <span className="text-[10px] font-mono text-slate-500">Official Acceptance Letter</span>
                  </div>
                </div>

                <Download className="h-4.5 w-4.5 text-slate-500" />
              </a>

              <a
                href={data.verification_url}
                target="_blank"
                referrerPolicy="no-referrer"
                className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-805 hover:border-slate-700 p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="p-2 bg-slate-900 rounded-lg text-slate-400">
                    <ExternalLink className="h-4 w-4" />
                  </div>
                  <div className="text-left font-sans">
                    <span className="block font-bold">Open Verification Link</span>
                    <span className="text-[10px] font-mono text-slate-500">Public Admissions Board page</span>
                  </div>
                </div>

                <ExternalLink className="h-4.5 w-4.5 text-slate-400" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
