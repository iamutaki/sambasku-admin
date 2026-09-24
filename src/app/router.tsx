import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { sessionStore } from '@/shared/auth/session';
import { tryRestoreSession } from '@/features/auth/application/try-restore-session';
import { BaseLayout } from '@/shared/layouts/base-layout';
import { ConsoleLayout } from '@/shared/layouts/console-layout';
import { LoginPage } from '@/features/auth/presentation/login-page';
import { DashboardPage } from '@/features/dashboard/presentation/dashboard-page';
import { WordsPage } from '@/features/words/presentation/words-page';
import { CreateWordPage } from '@/features/words/presentation/create-word-page';
import { EditWordPage } from '@/features/words/presentation/edit-word-page';
import { WordDetailPage } from '@/features/words/presentation/word-detail-page';
import { ContributionsPage } from '@/features/contributions/presentation/contributions-page';
import { ContributionDetailPage } from '@/features/contributions/presentation/contribution-detail-page';
import { CommentsPage } from '@/features/comments/presentation/comments-page';
import { CommentBlocklistPage } from '@/features/comment-blocklist/presentation/comment-blocklist-page';
import { SearchMissesPage } from '@/features/search-miss/presentation/search-misses-page';
import { VoteModerationPage } from '@/features/vote-moderation/presentation/vote-moderation-page';
import { WordSuggestionsPage } from '@/features/word-suggestions/presentation/word-suggestions-page';
import { WordSuggestionDetailPage } from '@/features/word-suggestions/presentation/word-suggestion-detail-page';
import { AuditLogsPage } from '@/features/audit/presentation/audit-logs-page';
import { BugReportsPage } from '@/features/bug-reports/presentation/bug-reports-page';
import { WordReportsPage } from '@/features/word-reports/presentation/word-reports-page';
import { WordReportDetailPage } from '@/features/word-reports/presentation/word-report-detail-page';
import { TranslationHelpsPage } from '@/features/translation-helps/presentation/translation-helps-page';
import { TranslationHelpDetailPage } from '@/features/translation-helps/presentation/translation-help-detail-page';
import { UsersPage } from '@/features/users/presentation/users-page';
import { VerifierApplicationsPage } from '@/features/verifier-applications/presentation/verifier-applications-page';
import { VerifierApplicationDetailPage } from '@/features/verifier-applications/presentation/verifier-application-detail-page';
import { NotificationCampaignsPage } from '@/features/notification-campaigns/presentation/notification-campaigns-page';
import { NotificationCampaignDetailPage } from '@/features/notification-campaigns/presentation/notification-campaign-detail-page';
import { NotificationTemplatesPage } from '@/features/notification-campaigns/presentation/notification-templates-page';
import { ProfilePage } from '@/features/profile/presentation/pages/profile-page';
import { NotFoundPage } from '@/shared/layouts/not-found-page';

/**
 * Route tree (didefinisikan manual, bukan file-based) - satu-satunya tempat
 * pemetaan path → halaman. Prinsip:
 *
 * - Root route: `beforeLoad` menjalankan session restore (hard reload) &
 *   seluruh navigasi lewat sini duluan.
 * - Dua layout (docs/admin/admin-base-stack.md Section 7):
 *   - `base-layout`   - publik / pra-auth (login). Guard: kalau sudah login,
 *     tidak boleh mampir ke sini (redirect /dashboard).
 *   - `console-layout` - area terproteksi. Guard: kalau belum login,
 *     dilempar ke /login.
 * - `/` (index) tidak menampilkan halaman apa pun - hanya redirect cerdas
 *   berdasarkan status sesi.
 */
const rootRoute = createRootRoute({
  beforeLoad: async () => {
    await tryRestoreSession();
  },
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: sessionStore.isAuthenticated() ? '/dashboard' : '/login' });
  },
});

// ---- Base layout (publik / pra-auth) ----
const baseLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'base-layout',
  component: BaseLayout,
});

const loginRoute = createRoute({
  getParentRoute: () => baseLayoutRoute,
  path: '/login',
  component: LoginPage,
  beforeLoad: () => {
    // Sesi sudah aktif (mis. user ketik /login manual) → arahkan ke konsol.
    if (sessionStore.isAuthenticated()) throw redirect({ to: '/dashboard' });
  },
});

// ---- Console layout (area terproteksi) ----
const consoleLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'console-layout',
  component: ConsoleLayout,
  beforeLoad: () => {
    if (!sessionStore.isAuthenticated()) throw redirect({ to: '/login' });
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/dashboard',
  component: DashboardPage,
});

const wordsRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/words',
  component: WordsPage,
});

const createWordRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/words/new',
  validateSearch: (search: Record<string, unknown>) => ({
    from_miss: typeof search.from_miss === 'string' ? search.from_miss : undefined,
    term: typeof search.term === 'string' ? search.term : undefined,
    direction:
      search.direction === 'lemma' || search.direction === 'translation'
        ? (search.direction as 'lemma' | 'translation')
        : undefined,
  }),
  component: CreateWordPage,
});

const editWordRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/words/$id/edit',
  component: EditWordPage,
});

const wordDetailRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/words/$id',
  component: WordDetailPage,
});

const contributionsRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/contributions',
  component: ContributionsPage,
});

const contributionDetailRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/contributions/$id',
  component: ContributionDetailPage,
});

const commentsRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/comments',
  component: CommentsPage,
});

const commentBlocklistRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/comment-blocklist',
  component: CommentBlocklistPage,
});

const searchMissesRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/search-misses',
  component: SearchMissesPage,
});

const voteModerationRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/vote-moderation',
  component: VoteModerationPage,
});

const wordSuggestionsRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/word-suggestions',
  component: WordSuggestionsPage,
});

const wordSuggestionDetailRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/word-suggestions/$id',
  component: WordSuggestionDetailPage,
});

const auditLogsRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/audit-logs',
  component: AuditLogsPage,
});

const bugReportsRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/bug-reports',
  component: BugReportsPage,
});

const translationHelpsRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/translation-helps',
  component: TranslationHelpsPage,
});

const translationHelpDetailRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/translation-helps/$id',
  component: TranslationHelpDetailPage,
});

const wordReportsRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/word-reports',
  component: WordReportsPage,
});

const wordReportDetailRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/word-reports/$id',
  component: WordReportDetailPage,
});

const usersRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/users',
  component: UsersPage,
});

const verifierApplicationsRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/verifier-applications',
  component: VerifierApplicationsPage,
});

const verifierApplicationDetailRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/verifier-applications/$id',
  component: VerifierApplicationDetailPage,
});

const notificationCampaignsRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/notification-campaigns',
  component: NotificationCampaignsPage,
});

const notificationCampaignDetailRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/notification-campaigns/$id',
  component: NotificationCampaignDetailPage,
});

const notificationTemplatesRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/notification-templates',
  component: NotificationTemplatesPage,
});

const profileRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/profile',
  component: ProfilePage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  baseLayoutRoute.addChildren([loginRoute]),
  consoleLayoutRoute.addChildren([
    dashboardRoute,
    wordsRoute,
    createWordRoute,
    wordDetailRoute,
    editWordRoute,
    contributionsRoute,
    contributionDetailRoute,
    translationHelpsRoute,
    translationHelpDetailRoute,
    commentsRoute,
    commentBlocklistRoute,
    searchMissesRoute,
    voteModerationRoute,
    wordSuggestionsRoute,
    wordSuggestionDetailRoute,
    wordReportsRoute,
    wordReportDetailRoute,
    auditLogsRoute,
    bugReportsRoute,
    usersRoute,
    verifierApplicationsRoute,
    verifierApplicationDetailRoute,
    notificationCampaignsRoute,
    notificationCampaignDetailRoute,
    notificationTemplatesRoute,
    profileRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}