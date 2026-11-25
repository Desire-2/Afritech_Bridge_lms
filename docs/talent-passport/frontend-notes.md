# Talent Passport frontend notes

## Scope

All frontend work lives under `frontend/`. No backend files were changed. The shell/navigation integrations are limited to:

- `frontend/src/components/student/StudentSidebar.tsx` — one **Talent Passport** item in the shared `ACHIEVEMENTS` section, so it appears in both mobile and desktop navigation.
- `frontend/src/app/student/dashboard/profile/page.tsx` — a prominent link card in the Overview tab, before the existing profile grids. The page was not restructured.

An earlier untracked scaffold existed but targeted a different API contract (`per_page`, `display_title`, `learning`, etc.). It was replaced with contract-aligned files. Six unused, incompatible scaffold components were removed: `AchievementsPanel.tsx`, `CareerInterestsPanel.tsx`, `CertificatesPanel.tsx`, `ShareAndExport.tsx`, `TimelinePanel.tsx`, and `VisibilitySettings.tsx`.

## Routes

Private routes (inside the existing student layout/guard):

- `/student/talent-passport` — overview, stats, completeness, recent activity, sync, share link.
- `/student/talent-passport/skills` — skill cards with canonical state badges.
- `/student/talent-passport/skills/[skillId]/evidence` — evidence detail for one skill.
- `/student/talent-passport/projects` — paginated list plus inline create/edit/delete.
- `/student/talent-passport/certificates`
- `/student/talent-passport/achievements`
- `/student/talent-passport/timeline`
- `/student/talent-passport/settings` — professional profile/career interests, visibility, publish/unpublish, sync, share link/copy, QR text fallback, PDF export.

Public route:

- `/talent/[publicSlug]` — renders only sections returned and enabled by the backend.

## API layer

`frontend/src/services/talent-passport.service.ts` exports `TalentPassportApi` and a singleton `talentPassportService`.

- Private/admin calls reuse the existing `axiosInstance` from `frontend/src/services/api/base.service.ts`. It reads `localStorage.token` and adds `Authorization: Bearer <token>`; no duplicate auth was added.
- Public calls use a separate bare axios instance with the same `/api/v1` base URL, so no JWT is attached.
- All URLs are relative to the configured base URL (`NEXT_PUBLIC_API_URL` or `http://localhost:5001/api/v1`).
- Pagination uses `page` and `page_size`, defaulting to `page=1&page_size=20`.
- `unwrapEnvelope` handles the optional `{ success: true, data }` envelope.
- `parseTalentApiError` reads `{ error: { code, message, details } }`, with status/network fallbacks and a typed `TalentApiError`.
- PDF endpoints request `responseType: 'blob'` and download through a temporary object URL.

Admin service methods are present for the contract endpoints (skills, mappings, evidence verify/reject, audit), but no admin UI was requested or added.

## Public rendering safety

`serializePublicPassport` in `frontend/src/types/talent-passport.ts` builds a whitelist-only view:

- Profile fields, section flags, and list item fields are picked from known backend keys.
- Unknown fields are dropped.
- Disabled sections produce empty arrays and are not rendered.
- 404 renders the not-found state; 410 renders the retired-link state; 401/403 also degrade to a public unavailable state.
- No values are invented or defaulted beyond UI labels/empty-state copy.

## State semantics

Skill states are displayed only from backend values using the exact names `LEARNING`, `EVIDENCE_SUBMITTED`, `DEMONSTRATED`, and `VERIFIED`, with local human labels. Evidence review states are also display-only. No frontend logic promotes a provisional/AI result to `VERIFIED`.

Loading, empty, error/retry, and unauthorized states are provided by `PassportStates.tsx` and `usePassportResource.ts`.

## Localization and QR fallback

There is no app-wide i18n framework. `src/lib/i18n/talent-passport.ts` contains a small `en`/`fr`/`rw` dictionary and a hook. `TalentPassportProvider` stores the selection in `localStorage.language` and exposes `LanguageSwitcher` on private and public surfaces.

No QR library is installed in `frontend/node_modules`, so `SharePanel` shows the generated public URL as the share code with an explanatory note. It does not fabricate a QR image.

## Verification

Node 20 was used explicitly (default `node` is v12):

- `/root/.nvm/versions/node/v20.19.6/bin/node`
- npm: `/root/.nvm/versions/node/v20.19.6/bin/node /root/.nvm/versions/node/v20.19.6/lib/node_modules/npm/bin/npm-cli.js` (v10.8.2)
- `tsx` is not installed in `frontend/node_modules`, so the test was compiled to CommonJS with the local `tsc` and run with `node --test`. The generated `.talent-test-build` directory was removed afterward.

Commands run and outcomes:

1. Targeted typecheck

   ```bash
   cd /root/My_project/Afritech_Bridge_lms/frontend
   /root/.nvm/versions/node/v20.19.6/bin/node node_modules/typescript/bin/tsc -p tsconfig.talent-passport.json
   ```

   Result: exit 0, no output.

2. Test compile and run

   ```bash
   cd /root/My_project/Afritech_Bridge_lms/frontend
   /root/.nvm/versions/node/v20.19.6/bin/node node_modules/typescript/bin/tsc -p tsconfig.talent-test.json
   /root/.nvm/versions/node/v20.19.6/bin/node --test .talent-test-build/tests/talent-passport.test.js
   ```

   Result: `tests 8`, `pass 8`, `fail 0`, exit 0.

3. Full project typecheck (informational only)

   ```bash
   cd /root/My_project/Afritech_Bridge_lms/frontend
   /root/.nvm/versions/node/v20.19.6/bin/node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
   ```

   Result: exit 1 with pre-existing parse errors only in `src/components/instructor/EnhancedModificationDashboard.tsx` and `src/components/instructor/ai-agent/index-new.ts`. These were not changed.

4. Production build

   The installed `lucide-react@0.364.0` does not export `IdCard`. The import and
   usages in `StudentSidebar.tsx` and `dashboard/profile/page.tsx` were changed
   to `Contact`, which is exported by that version. The build also requires
   Node 20 on `PATH` because Turbopack spawns a child `node` process for PostCSS.

   ```bash
   cd /root/My_project/Afritech_Bridge_lms/frontend
   export PATH=/root/.nvm/versions/node/v20.19.6/bin:$PATH
   node node_modules/next/dist/bin/next build
   ```

   Result: exit 0, `✓ Compiled successfully in 82s`, static generation `92/92`
   in `14.9s`; the route table includes the Talent Passport routes.

Not verified: no live backend was running and no browser/visual check was performed.

## File inventory

Created or rewritten under `frontend/`:

- `src/types/talent-passport.ts`
- `src/services/talent-passport.service.ts`
- `src/lib/i18n/talent-passport.ts`
- `src/components/talent-passport/TalentPassportProvider.tsx`
- `src/components/talent-passport/usePassportResource.ts`
- `src/components/talent-passport/PassportStates.tsx`
- `src/components/talent-passport/PassportPageHeader.tsx`
- `src/components/talent-passport/Pagination.tsx`
- `src/components/talent-passport/CompletenessCard.tsx`
- `src/components/talent-passport/LearningSummary.tsx`
- `src/components/talent-passport/SkillStatusBadge.tsx`
- `src/components/talent-passport/SkillsPanel.tsx`
- `src/components/talent-passport/EvidenceList.tsx`
- `src/components/talent-passport/ProjectForm.tsx`
- `src/components/talent-passport/PortfolioPanel.tsx`
- `src/components/talent-passport/RecordLists.tsx`
- `src/components/talent-passport/ProfessionalProfilePanel.tsx`
- `src/components/talent-passport/VisibilityPanel.tsx`
- `src/components/talent-passport/SharePanel.tsx`
- `src/components/talent-passport/PublicPassportView.tsx`
- `src/components/talent-passport/TalentSubNav.tsx`
- `src/app/student/talent-passport/layout.tsx`
- `src/app/student/talent-passport/page.tsx`
- `src/app/student/talent-passport/skills/page.tsx`
- `src/app/student/talent-passport/skills/[skillId]/evidence/page.tsx`
- `src/app/student/talent-passport/projects/page.tsx`
- `src/app/student/talent-passport/certificates/page.tsx`
- `src/app/student/talent-passport/achievements/page.tsx`
- `src/app/student/talent-passport/timeline/page.tsx`
- `src/app/student/talent-passport/settings/page.tsx`
- `src/app/talent/[publicSlug]/page.tsx`
- `tests/talent-passport.test.ts`
- `tsconfig.talent-passport.json`
- `tsconfig.talent-test.json`

Modified:

- `src/components/student/StudentSidebar.tsx`
- `src/app/student/dashboard/profile/page.tsx`

Created documentation:

- `docs/talent-passport/frontend-notes.md`

Pre-existing unrelated mode-only changes in `frontend/deploy-to-vercel.sh`, `frontend/deploy.sh`, and `frontend/fix-chunk-error.sh` were left untouched.
