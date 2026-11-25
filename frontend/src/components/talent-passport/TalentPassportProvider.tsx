'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

import {
  normalizeTalentPassportLanguage,
  useTalentPassportI18n,
  type TalentPassportLanguage,
} from '@/lib/i18n/talent-passport';

type I18nValue = ReturnType<typeof useTalentPassportI18n>;

interface PassportContextValue extends I18nValue {
  setLanguage: (language: TalentPassportLanguage) => void;
}

const PassportContext = createContext<PassportContextValue | null>(null);

export function TalentPassportProvider({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage?: string;
}) {
  const [language, setLanguageState] = useState<TalentPassportLanguage>(() =>
    normalizeTalentPassportLanguage(initialLanguage),
  );

  useEffect(() => {
    if (initialLanguage || typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('language');
      if (stored) setLanguageState(normalizeTalentPassportLanguage(stored));
    } catch {
      // Storage can be unavailable in private browsing; keep English.
    }
  }, [initialLanguage]);

  const setLanguage = (next: TalentPassportLanguage) => {
    setLanguageState(next);
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem('language', next);
    } catch {
      // Non-fatal: the selection still applies for this session.
    }
  };

  const i18n = useTalentPassportI18n(language);
  return (
    <PassportContext.Provider value={{ ...i18n, language, setLanguage }}>
      {children}
    </PassportContext.Provider>
  );
}

export function usePassportI18n(): PassportContextValue {
  const value = useContext(PassportContext);
  // Called unconditionally so hook order stays stable when no provider exists.
  const fallback = useTalentPassportI18n();
  if (value) return value;
  return { ...fallback, setLanguage: () => undefined };
}

const LANGUAGES: TalentPassportLanguage[] = ['en', 'fr', 'rw'];

export function LanguageSwitcher() {
  const { language, setLanguage } = usePassportI18n();
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Language">
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          aria-pressed={language === code}
          className={`min-h-9 rounded-md px-2 text-xs font-medium transition-colors ${
            language === code
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
