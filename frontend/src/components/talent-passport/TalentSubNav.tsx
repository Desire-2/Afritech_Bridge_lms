'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { TalentPassportTranslationKey } from '@/lib/i18n/talent-passport';
import { LanguageSwitcher } from './TalentPassportProvider';

const LINKS: Array<{ href: string; key: TalentPassportTranslationKey }> = [
  { href: '/student/talent-passport', key: 'navOverview' },
  { href: '/student/talent-passport/skills', key: 'navSkills' },
  { href: '/student/talent-passport/projects', key: 'navProjects' },
  { href: '/student/talent-passport/certificates', key: 'navCertificates' },
  { href: '/student/talent-passport/achievements', key: 'navAchievements' },
  { href: '/student/talent-passport/timeline', key: 'navTimeline' },
  { href: '/student/talent-passport/settings', key: 'navSettings' },
];

export function TalentSubNav({ t }: { t: (key: TalentPassportTranslationKey) => string }) {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex flex-col gap-3 border-b pb-3 lg:flex-row lg:items-center lg:justify-between">
      <nav className="-mb-3 flex flex-wrap gap-1" aria-label="Talent Passport sections">
        {LINKS.map((link) => {
          const active = link.href === '/student/talent-passport'
            ? pathname === link.href
            : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {t(link.key)}
            </Link>
          );
        })}
      </nav>
      <LanguageSwitcher />
    </div>
  );
}
