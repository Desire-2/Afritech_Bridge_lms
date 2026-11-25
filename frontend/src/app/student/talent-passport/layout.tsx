'use client';

import {
  TalentPassportProvider,
  usePassportI18n,
} from '@/components/talent-passport/TalentPassportProvider';
import { TalentSubNav } from '@/components/talent-passport/TalentSubNav';

function PassportShell({ children }: { children: React.ReactNode }) {
  const { t } = usePassportI18n();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <TalentSubNav t={t} />
      {children}
    </div>
  );
}

export default function TalentPassportLayout({ children }: { children: React.ReactNode }) {
  return (
    <TalentPassportProvider>
      <PassportShell>{children}</PassportShell>
    </TalentPassportProvider>
  );
}
