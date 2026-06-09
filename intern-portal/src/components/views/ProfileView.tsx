/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { api, extractApiError } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { InternProfile } from '../../types';
import { 
  User, 
  Mail, 
  Phone, 
  Globe, 
  Github, 
  Linkedin, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  Key,
  Database,
  Loader2,
  Lock
} from 'lucide-react';

interface ProfileViewProps {
  onNavigate: (path: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onNavigate }) => {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<InternProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editable Form Inputs State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const profileData = await api.getProfile();
      if (profileData && profileData.email) {
        const data = profileData;
        setProfile(data);
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setPhone(data.phone || '');
        setPortfolioUrl(data.portfolio_url || '');
        setGithubUrl(data.github_url || '');
        setLinkedinUrl(data.linkedin_url || '');
      }
    } catch (err: any) {
      const apiErr = extractApiError(err);
      setError(apiErr.message || 'Remote profile synchronizing failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdateProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: Partial<InternProfile> = {
      first_name: firstName,
      last_name: lastName,
      phone,
      portfolio_url: portfolioUrl,
      github_url: githubUrl,
      linkedin_url: linkedinUrl
    };

    try {
      const updated = await api.updateProfile(payload);
      setSuccess('Profile attributes updated successfully in active registries!');
      if (updated) setProfile(updated);
      refreshUser();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const apiErr = extractApiError(err);
      setError(apiErr.message || 'Failed saving profile updates. Please verify types.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 font-sans">
        <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
        <p className="text-xs text-slate-500 font-mono">Retrieving profile registers...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto space-y-4 mt-12 font-sans">
        <AlertCircle className="h-10 w-10 text-rose-455 mx-auto" />
        <div>
          <h3 className="text-md font-bold text-white">Profile Database Lock</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {error || 'Unable to load profile metadata records.'}
          </p>
        </div>
        <button
          onClick={fetchProfile}
          className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 rounded-xl text-xs text-slate-350 font-semibold cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans animate-fadeIn" id="profile-pane">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Profile & Workspace Settings</h1>
        <p className="text-xs text-slate-400 mt-1">
          Edit your contact details, map public version control URLs, or update security credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* EDIT FORM - LEFT SIDE (2/3 width) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-md">
          <form onSubmit={handleUpdateProfileSubmit} className="space-y-6">
            
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800/80 pb-2">Personal particulars</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first-name-input" className="block text-xs font-semibold text-slate-300 mb-1.5">First name</label>
                  <input
                    id="first-name-input"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 hover:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-650 outline-none transition-all font-sans"
                  />
                </div>
                <div>
                  <label htmlFor="last-name-input" className="block text-xs font-semibold text-slate-300 mb-1.5">Last name</label>
                  <input
                    id="last-name-input"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 hover:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-650 outline-none transition-all font-sans"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phone-input" className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
                  <input
                    id="phone-input"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+250 788 123 456"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-1">
              <h2 className="text-sm font-bold text-slate-205 border-b border-slate-800/80 pb-2">Professional Directories Links</h2>

              <div className="space-y-3.5">
                <div>
                  <label htmlFor="portfolio-input" className="block text-xs font-semibold text-slate-300 mb-1.5">Portfolio URL</label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
                    <input
                      id="portfolio-input"
                      type="url"
                      value={portfolioUrl}
                      onChange={(e) => setPortfolioUrl(e.target.value)}
                      placeholder="https://john.dev"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="github-input" className="block text-xs font-semibold text-slate-300 mb-1.5">GitHub Profile URL</label>
                  <div className="relative">
                    <Github className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
                    <input
                      id="github-input"
                      type="url"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/john"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="linkedin-input" className="block text-xs font-semibold text-slate-300 mb-1.5">LinkedIn Profile URL</label>
                  <div className="relative">
                    <Linkedin className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
                    <input
                      id="linkedin-input"
                      type="url"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/john"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-500/20 rounded-xl flex items-start space-x-2 text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/20 rounded-xl flex items-center space-x-2.5 text-emerald-300 text-xs animate-fadeIn">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-450 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-2.5 rounded-xl text-xs transition-with shadow-md hover:shadow-lg hover:shadow-teal-950 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              id="profile-save-btn"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving amendments...</span>
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" />
                  <span>Update Profile Attributes</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* REGISTRY METADATA & PASSWORD ACTIONS - RIGHT SIDE (1/3 width) */}
        <div className="space-y-6">
          
          {/* Readonly Core details */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-slate-804 pb-2">Academic registry records</h3>
            
            <div className="space-y-3 font-mono text-[11px] leading-relaxed">
              <div className="flex justify-between py-1.5 border-b border-slate-850/40">
                <span className="text-slate-550">FULL NAME:</span>
                <span className="text-slate-300 truncate max-w-[140px] text-right font-sans font-bold">{profile.full_name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-850/40">
                <span className="text-slate-550">EMAIL ID:</span>
                <span className="text-slate-300 truncate max-w-[140px] text-right font-bold">{profile.email}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-850/40">
                <span className="text-slate-550">USERNAME:</span>
                <span className="text-slate-300 truncate max-w-[140px] text-right">{profile.username}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-850/40">
                <span className="text-slate-550">REFERENCE CODE:</span>
                <span className="text-teal-400 font-bold">{profile.reference_code}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-850/40">
                <span className="text-slate-550">ASSIGNED ROLE:</span>
                <span className="text-orange-450 uppercase font-bold">INTERN</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-850/40 items-center">
                <span className="text-slate-550">ADMISSIONS STATUS:</span>
                <span className="px-1.5 py-0.5 bg-emerald-950/70 border border-emerald-500/20 text-emerald-400 text-[9px] rounded font-bold uppercase">ACCEPTED</span>
              </div>
            </div>
          </div>

          {/* Prompt Change password */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
            <div className="flex items-center space-x-3 text-orange-400 font-bold text-sm">
              <Key className="h-4.5 w-4.5 shrink-0" />
              <span>Security Configurations</span>
            </div>
            
            <p className="text-xs text-slate-405 leading-relaxed">
              Maintain active account passwords secure. On first registration you should change the default letters credential.
            </p>

            {profile.must_change_password ? (
              <div className="p-3 bg-rose-950/40 border border-rose-500/20 text-xs text-rose-300 rounded-xl flex items-start space-x-2">
                <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Security Warning:</strong> You are utilizing a default password dispatch. Update now!
                </span>
              </div>
            ) : (
              <div className="p-3 bg-slate-950 border border-slate-850 text-xs text-slate-500 rounded-xl flex items-center space-x-2">
                <Lock className="h-4 w-4 text-slate-550 shrink-0" />
                <span>Default credentials changed. Verified safe.</span>
              </div>
            )}

            <button
              onClick={() => onNavigate('/intern/change-password')}
              className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl py-2.5 text-xs font-semibold cursor-pointer text-center"
            >
              Update Security Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
