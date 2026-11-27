// src/App.js
import React, { Suspense, lazy, useEffect } from "react";
import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import { AdminGate } from "./auth/adminAccess";
import api from "./api";
import BrandLoader from "./components/BrandLoader";
import { CLEAN_URLS, basePath } from "./lib/appUrl";
import { DialogHost } from "./components/ui/Dialogs";

const Layout = lazy(() => import("./layout/Layout"));
const PublicLayout = lazy(() => import("./layout/PublicLayout"));
const MemberLayout = lazy(() => import("./layout/MemberLayout"));
const ProtectedRoute = lazy(() => import("./auth/ProtectedRoute"));

const HomeRoute = lazy(() => import("./pages/public/HomeRoute"));
const AdminSiteSettings = lazy(() => import("./pages/admin/AdminSiteSettings"));
const AdminFormSubmissions = lazy(
  () => import("./pages/admin/AdminFormSubmissions"),
);
const CatalogModern = lazy(() => import("./pages/public/CatalogModern"));
const Catalog = lazy(() => import("./pages/public/Catalog"));
const Browse = lazy(() => import("./pages/public/Browse"));
const MyList = lazy(() => import("./pages/public/MyList"));
const Login = lazy(() => import("./pages/public/Login"));
const LiveWatch = lazy(() => import("./pages/public/LiveWatch"));
const Subscribe = lazy(() => import("./pages/public/Subscribe"));
const SubscribeThanks = lazy(() => import("./pages/public/SubscribeThanks"));
const About = lazy(() => import("./pages/public/About"));
const PastoralLeadership = lazy(
  () => import("./pages/public/PastoralLeadership"),
);
const PageView = lazy(() => import("./pages/site/PageView"));
const VideoView = lazy(() => import("./pages/site/VideoView"));
const Signup = lazy(() => import("./pages/public/Signup"));
const AllVideos = lazy(() => import("./pages/public/AllVideos"));
const TvActivate = lazy(() => import("./pages/tv/Activate"));
const FreeAccountForm = lazy(() => import("./pages/public/FreeAccountForm"));
const ForgotPassword = lazy(() => import("./pages/public/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/public/ResetPassword"));
const EmailPreferences = lazy(() => import("./pages/public/EmailPreferences"));
const ExclusiveContent = lazy(() => import("./pages/public/ExclusiveContent"));
const PlaylistView = lazy(() => import("./pages/public/PlaylistView"));
const LiveRoute = lazy(() => import("./pages/public/LiveRoute"));
const AdminLiveSettings = lazy(() => import("./pages/admin/AdminLiveSettings"));
const AdminPreviewClips = lazy(() => import("./pages/admin/AdminPreviewClips"));
const Partnership = lazy(() => import("./pages/public/Partnership"));
const Connection = lazy(() => import("./pages/public/Connection"));
const AdminCollectionPlaylists = lazy(
  () => import("./pages/public/AdminCollectionPlaylists"),
);
const BuilderPage = lazy(() => import("./pages/public/BuilderPage"));
const Community = lazy(() => import("./pages/public/Community"));
const CommunityNew = lazy(() => import("./pages/public/CommunityNew"));
const CommunityPost = lazy(() => import("./pages/public/CommunityPost"));
const AccountHome = lazy(() => import("./pages/account/AccountHome"));
const MobileTvApps = lazy(() => import("./pages/account/MobileTvApps"));
const UploadPage = lazy(() => import("./pages/studio/UploadPage"));
const LiveCreatePage = lazy(() => import("./pages/studio/LiveCreatePage"));
const LiveEventsPage = lazy(() => import("./pages/studio/LiveEventsPage"));
const LiveEventPage = lazy(() => import("./pages/studio/LiveEventPage"));
const MyPlaylists = lazy(() => import("./pages/account/MyPlaylists"));
const PlaylistEditor = lazy(() => import("./pages/account/PlaylistEditor"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const Videos = lazy(() => import("./pages/content/Videos"));
const CategoriesPage = lazy(() => import("./pages/content/Categories"));
const CollectionsPage = lazy(() => import("./pages/content/Collections"));
const VideoDetails = lazy(() => import("./pages/content/VideoDetails"));
const LiveStreaming = lazy(() => import("./pages/admin/LiveStreaming"));
const CollectionDetails = lazy(
  () => import("./pages/content/CollectionDetails"),
);
const Calendar = lazy(() => import("./pages/admin/Calendar"));
const Resources = lazy(() => import("./pages/admin/Resources"));
const Organize = lazy(() => import("./pages/admin/Organize"));
const Integrations = lazy(() => import("./pages/admin/Integrations"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminWasabiImport = lazy(() => import("./pages/admin/AdminWasabiImport"));
const CloudStoragePage = lazy(() => import("./pages/admin/CloudStoragePage"));
const SeriesListPage = lazy(() =>
  import("./pages/public/SeriesPages").then((m) => ({ default: m.SeriesList })),
);
const SeriesDetailPage = lazy(() =>
  import("./pages/public/SeriesPages").then((m) => ({ default: m.SeriesPage })),
);
const ContactPage = lazy(() => import("./pages/public/ContactPage"));
const LegalPage = lazy(() => import("./pages/public/LegalPage"));

// New pages and messages open at the top (the browser kept the old scroll
// position). Back/forward (POP) is left to the browser.
function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  useEffect(() => {
    if (navType === "POP") return;
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname, navType]);
  return null;
}
const AdminEmailIntegration = lazy(
  () => import("./pages/admin/AdminEmailIntegration"),
);
const AdminEmailCenter = lazy(() => import("./pages/admin/AdminEmailCenter"));
const AdminEmailAutomations = lazy(
  () => import("./pages/admin/AdminEmailAutomations"),
);
const AdminPagesList = lazy(() => import("./pages/admin/AdminPagesList"));
const AdminNavigation = lazy(() => import("./pages/admin/AdminNavigation"));
const AdminPageEditor = lazy(() => import("./pages/admin/AdminPageEditor"));
const AdminSiteDesign = lazy(() => import("./pages/admin/AdminSiteDesign"));
const AdminMedia = lazy(() => import("./pages/admin/AdminMedia"));
const AdminTeam = lazy(() => import("./pages/admin/AdminTeam"));
const VisualCanvas = lazy(() => import("./pages/admin/VisualCanvas"));

function RouteFallback() {
  // Visible branded loader (the old dark "Loading…" text was invisible on black).
  return <BrandLoader minHeight="55vh" />;
}

// ✅ CMS route wrapper: provides per-slug legacy fallbacks (so /p/about can show About.js until you add builder sections)
function CmsPageWrapper() {
  const { slug } = useParams();
  const s = String(slug || "").toLowerCase();
  const fallbackMap = {
    about: <About />,
    partnership: <Partnership />,
    "pastoral-leadership": <PastoralLeadership />,
  };
  const fallback = fallbackMap[s] || null;
  return <BuilderPage slug={s} fallback={fallback} />;
}

// Release 1.3 (white-label): "#" addresses by default; clean addresses when
// REACT_APP_ROUTER=browser (the hosting must send every path to index.html).
function SiteRouter({ children }) {
  return CLEAN_URLS ? (
    <BrowserRouter basename={basePath() || undefined}>{children}</BrowserRouter>
  ) : (
    <HashRouter>{children}</HashRouter>
  );
}

export default function App() {
  useEffect(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
  }, []);

  return (
    <SiteRouter>
      <ScrollToTop />
      <DialogHost />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Full-screen visual editor (outside the admin layout, like Elementor) */}
          <Route
            path="/admin/pages/:id/visual"
            element={
              <ProtectedRoute>
                <AdminGate area="website">
                  <AdminPageEditor visualOnly />
                </AdminGate>
              </ProtectedRoute>
            }
          />
          {/* ---------- ADMIN ---------- */}
          <Route
            path="/admin"
            element={
              // Phase 8-1: administrators and team members (Website / Content Manager)
              <ProtectedRoute>
                <AdminGate>
                  <Layout />
                </AdminGate>
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />

            {/* Content */}
            <Route path="content/videos" element={<Videos />} />
            <Route path="content/videos/:id" element={<VideoDetails />} />
            <Route path="content/live" element={<LiveStreaming />} />
            <Route path="content/categories" element={<CategoriesPage />} />
            <Route path="content/collections" element={<CollectionsPage />} />
            <Route
              path="content/collections/new"
              element={<CollectionDetails />}
            />
            <Route
              path="content/collections/:id"
              element={<CollectionDetails />}
            />
            <Route path="content/calendar" element={<Calendar />} />
            <Route path="content/resources" element={<Resources />} />
            <Route path="content/organize" element={<Organize />} />
            <Route path="content/integrations" element={<Integrations />} />
            <Route path="content/analytics" element={<Analytics />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route
              path="/admin/content/wasabi-import"
              element={<AdminWasabiImport />}
            />
            {/* Cloud Storage replaces the old Wasabi importer (old address redirects) */}
            <Route
              path="/admin/content/cloud-storage"
              element={<CloudStoragePage />}
            />
            <Route
              path="/admin/content/wasabi-importer"
              element={<Navigate to="/admin/content/cloud-storage" replace />}
            />
            <Route
              path="/admin/content/email-integration"
              element={<AdminEmailIntegration />}
            />
            <Route
              path="/admin/content/email-center"
              element={<AdminEmailCenter />}
            />
            <Route
              path="/admin/content/email-automations"
              element={<AdminEmailAutomations />}
            />

            <Route path="/admin/pages" element={<AdminPagesList />} />
            <Route path="/admin/navigation" element={<AdminNavigation />} />
            <Route path="/admin/site-design" element={<AdminSiteDesign />} />
            <Route path="/admin/media" element={<AdminMedia />} />
            <Route path="/admin/team" element={<AdminTeam />} />
            <Route
              path="/admin/site-settings"
              element={<AdminSiteSettings />}
            />
            <Route path="/admin/forms" element={<AdminFormSubmissions />} />
            <Route
              path="/admin/integrations/live"
              element={<AdminLiveSettings />}
            />
            <Route
              path="/admin/preview-clips"
              element={<AdminPreviewClips />}
            />
            <Route path="/admin/pages/:id" element={<AdminPageEditor />} />

            {/* Pages */}
            {/* <Route path="pages" element={<PagesAdmin />} /> */}
            {/* ✅ Builder route used by PagesAdmin: /admin/pages/:id/builder */}
            {/* <Route path="pages/:id/builder" element={<PageBuilder />} /> */}
            {/* ✅ Back-compat if you already linked /edit somewhere */}
            {/* <Route path="pages/:id/edit" element={<PageBuilder />} /> */}

            {/* Subscriptions */}
            {/* <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="subscriptions/new" element={<SubscriptionPlanNew />} />
          <Route
            path="subscriptions/plan/:id"
            element={<SubscriptionPlanEdit />}
          /> */}

            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>

          {/* ---------- PUBLIC ---------- */}
          <Route element={<PublicLayout />}>
            {/* Phase 4E: draft preview for admins, inside the public layout */}
            <Route
              path="/admin/pages/:id/preview"
              element={
                <ProtectedRoute>
                  <AdminGate area="website">
                    <BuilderPage adminPreview />
                  </AdminGate>
                </ProtectedRoute>
              }
            />
            {/* Visual editor canvas (inside the page editor's iframe) */}
            <Route
              path="/admin/pages/:id/canvas"
              element={
                <ProtectedRoute>
                  <AdminGate area="website">
                    <VisualCanvas />
                  </AdminGate>
                </ProtectedRoute>
              }
            />
            <Route path="/p/:slug" element={<CmsPageWrapper />} />
            <Route index element={<HomeRoute />} />

            {/* Catalog / content */}
            {/* The client's choice: Watch (/catalog) shows the full Catalog */}
            <Route path="/catalog" element={<CatalogModern />} />
            <Route path="/catalog/all" element={<Catalog />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/my-list" element={<MyList />} />
            <Route path="/exclusive-content" element={<ExclusiveContent />} />
            <Route
              path="/admin-collections/:id"
              element={<AdminCollectionPlaylists />}
            />
            <Route path="/playlist/:id" element={<PlaylistView />} />
            <Route path="/playlists/:id" element={<PlaylistView />} />
            <Route path="/videos" element={<AllVideos />} />
            <Route path="/p/videos" element={<AllVideos />} />

            {/* Watch */}
            <Route path="/watch/:id" element={<VideoView />} />
            <Route path="/watch/live/:id" element={<LiveWatch />} />
            <Route path="/live-streaming" element={<LiveRoute />} />

            {/* Bio */}
            {/* ✅ About is CMS-driven (fallback to legacy About.js) */}
            <Route
              path="/about"
              element={<BuilderPage slug="about" fallback={<About />} />}
            />
            {/* ✅ Pastoral Leadership can be CMS-driven (fallback to legacy) */}
            <Route
              path="/pastoral-leadership"
              element={
                <BuilderPage
                  slug="pastoral-leadership"
                  fallback={<PastoralLeadership />}
                />
              }
            />

            {/* Marketing pages */}
            {/* No Limits Media's platform pricing moved to tv.nolimitsmedia.com;
                viewers upgrading go to this ministry's own plans. */}
            <Route
              path="/pricing"
              element={<Navigate to="/subscribe" replace />}
            />
            {/* ✅ Partnership can be CMS-driven (fallback to legacy) */}
            <Route
              path="/partnership"
              element={
                <BuilderPage slug="partnership" fallback={<Partnership />} />
              }
            />
            <Route path="/connection" element={<Connection />} />

            {/* Auth */}
            <Route path="/subscribe" element={<Subscribe />} />
            <Route path="/subscribe/thanks" element={<SubscribeThanks />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/free-account" element={<FreeAccountForm />} />
            <Route path="/forgot" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/reset" element={<ResetPassword />} />
            <Route path="/email-preferences" element={<EmailPreferences />} />

            {/* Community (fixed order) */}
            <Route path="/community/new" element={<CommunityNew />} />
            <Route path="/community/post/:id" element={<CommunityPost />} />
            <Route path="/community/:id" element={<CommunityPost />} />
            <Route path="/community" element={<Community />} />

            {/* Contact, Terms and Privacy (before the CMS /:slug route) */}
            {/* Series / program pages */}
            <Route path="/series" element={<SeriesListPage />} />
            <Route path="/series/:slug" element={<SeriesDetailPage />} />

            {/* editable in Admin › Pages; the built-in page shows if not published */}
            <Route
              path="/contact"
              element={
                <BuilderPage slug="contact" fallback={<ContactPage />} />
              }
            />
            <Route
              path="/terms"
              element={
                <BuilderPage
                  slug="terms"
                  fallback={<LegalPage kind="terms" />}
                />
              }
            />
            <Route
              path="/privacy"
              element={
                <BuilderPage
                  slug="privacy"
                  fallback={<LegalPage kind="privacy" />}
                />
              }
            />

            {/* TV Activate */}
            <Route path="/activate" element={<TvActivate />} />
            <Route path="/tv/activate" element={<TvActivate />} />

            {/* ✅ Dynamic pages from builder */}
            {/* ✅ Dynamic pages from builder (legacy renderer) */}
            <Route path="/page/:slug" element={<PageView />} />

            {/* ✅ Optional: allow clean URL pages like /about (must be LAST before wildcard) */}
            {/* ✅ Clean CMS pages like /about-bishop (CMS first, fallback map inside CmsPageWrapper) */}
            <Route path="/:slug" element={<CmsPageWrapper />} />

            {/* MUST be last */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>

          {/* ---------- MEMBER ACCOUNT AREA ---------- */}
          <Route
            element={
              <ProtectedRoute>
                <MemberLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/account" element={<AccountHome />} />
            <Route path="/account/playlists" element={<MyPlaylists />} />
            <Route
              path="/account/playlists/:idOrSlug/edit"
              element={<PlaylistEditor />}
            />
            <Route path="/account/apps" element={<MobileTvApps />} />
          </Route>

          {/* ---------- STUDIO / CONTENT MANAGEMENT ---------- */}
          <Route
            element={
              <ProtectedRoute roles={["admin"]}>
                <MemberLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/studio/upload" element={<UploadPage />} />
            <Route path="/studio/videos" element={<Videos />} />
            <Route path="/studio/videos/:id" element={<VideoDetails />} />
            <Route path="/studio/live" element={<LiveEventsPage />} />
            <Route path="/studio/live/new" element={<LiveCreatePage />} />
            <Route path="/studio/live/:id" element={<LiveEventPage />} />
          </Route>
        </Routes>
      </Suspense>
    </SiteRouter>
  );
}
