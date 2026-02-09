// src/App.js
import React, { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import api from "./api";

import Layout from "./layout/Layout";
import PublicLayout from "./layout/PublicLayout";
import MemberLayout from "./layout/MemberLayout";
import ProtectedRoute from "./auth/ProtectedRoute";

// Admin Pages manager + visual builder
import PagesAdmin from "./pages/admin/PagesAdmin";
import PageBuilder from "./pages/studio/PageBuilder";

// PUBLIC PAGES
import Home from "./pages/public/Home";
import Login from "./pages/public/Login";
import LiveWatch from "./pages/public/LiveWatch";
import Subscribe from "./pages/public/Subscribe";
import SubscribeThanks from "./pages/public/SubscribeThanks";
import About from "./pages/public/About";
import PastoralLeadership from "./pages/public/PastoralLeadership";

// ✅ Public site page renderer (supports /p/:slug and /:slug)
import PageView from "./pages/site/PageView";

import VideoView from "./pages/site/VideoView";
import Pricing from "./pages/public/Pricing";
import Signup from "./pages/public/Signup";
import AllVideos from "./pages/public/AllVideos";
import TvActivate from "./pages/tv/Activate";
import FreeAccountForm from "./pages/public/FreeAccountForm";
import ForgotPassword from "./pages/public/ForgotPassword";
import Catalog from "./pages/public/Catalog";
import PlaylistView from "./pages/public/PlaylistView";
import LivePage from "./pages/public/LivePage";
import Partnership from "./pages/public/Partnership";
import Connection from "./pages/public/Connection";
import AdminCollectionPlaylists from "./pages/public/AdminCollectionPlaylists";

// Community
import Community from "./pages/public/Community";
import CommunityNew from "./pages/public/CommunityNew";
import CommunityPost from "./pages/public/CommunityPost";

// MEMBER (Studio/Account)
import AccountHome from "./pages/account/AccountHome";
import MobileTvApps from "./pages/account/MobileTvApps";
import UploadPage from "./pages/studio/UploadPage";
import LiveCreatePage from "./pages/studio/LiveCreatePage";
import LiveEventsPage from "./pages/studio/LiveEventsPage";
import LiveEventPage from "./pages/studio/LiveEventPage";
import MyPlaylists from "./pages/account/MyPlaylists";
import PlaylistEditor from "./pages/account/PlaylistEditor";

// ADMIN PAGES
import AdminDashboard from "./pages/admin/AdminDashboard";
import Videos from "./pages/content/Videos";
import CategoriesPage from "./pages/content/Categories";
import CollectionsPage from "./pages/content/Collections";
import VideoDetails from "./pages/content/VideoDetails";
import LiveStreaming from "./pages/admin/LiveStreaming";
import CollectionDetails from "./pages/content/CollectionDetails";
import Subscriptions from "./pages/admin/Subscriptions";
import SubscriptionPlanNew from "./pages/admin/SubscriptionPlanNew";
import SubscriptionPlanEdit from "./pages/admin/SubscriptionPlanEdit";
import Calendar from "./pages/admin/Calendar";
import Resources from "./pages/admin/Resources";
import Organize from "./pages/admin/Organize";
import Integrations from "./pages/admin/Integrations";
import Analytics from "./pages/admin/Analytics";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminWasabiImport from "./pages/admin/AdminWasabiImport";
import WasabiImporterPage from "./pages/admin/WasabiImporterPage";

export default function App() {
  useEffect(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
  }, []);

  return (
    <HashRouter>
      <Routes>
        {/* ---------- ADMIN ---------- */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout />
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
          <Route
            path="/admin/content/wasabi-importer"
            element={<WasabiImporterPage />}
          />

          {/* Pages */}
          <Route path="pages" element={<PagesAdmin />} />
          {/* ✅ Builder route used by PagesAdmin: /admin/pages/:id/builder */}
          <Route path="pages/:id/builder" element={<PageBuilder />} />
          {/* ✅ Back-compat if you already linked /edit somewhere */}
          <Route path="pages/:id/edit" element={<PageBuilder />} />

          {/* Subscriptions */}
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="subscriptions/new" element={<SubscriptionPlanNew />} />
          <Route
            path="subscriptions/plan/:id"
            element={<SubscriptionPlanEdit />}
          />

          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        {/* ---------- PUBLIC ---------- */}
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />

          {/* Catalog / content */}
          <Route path="/catalog" element={<Catalog />} />
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
          <Route path="/live-streaming" element={<LivePage />} />

          {/* Bio */}
          <Route path="/about" element={<About />} />
          <Route path="/pastoral-leadership" element={<PastoralLeadership />} />

          {/* Marketing pages */}
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/partnership" element={<Partnership />} />
          <Route path="/connection" element={<Connection />} />

          {/* Auth */}
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/subscribe/thanks" element={<SubscribeThanks />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/free-account" element={<FreeAccountForm />} />
          <Route path="/forgot" element={<ForgotPassword />} />

          {/* Community (fixed order) */}
          <Route path="/community/new" element={<CommunityNew />} />
          <Route path="/community/post/:id" element={<CommunityPost />} />
          <Route path="/community/:id" element={<CommunityPost />} />
          <Route path="/community" element={<Community />} />

          {/* TV Activate */}
          <Route path="/activate" element={<TvActivate />} />
          <Route path="/tv/activate" element={<TvActivate />} />

          {/* ✅ Dynamic pages from builder */}
          <Route path="/p/:slug" element={<PageView />} />

          {/* ✅ Optional: allow clean URL pages like /about (must be LAST before wildcard) */}
          <Route path="/:slug" element={<PageView />} />

          {/* MUST be last */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>

        {/* ---------- MEMBER AREA ---------- */}
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

          <Route path="/studio/upload" element={<UploadPage />} />
          <Route path="/studio/videos" element={<Videos />} />
          <Route path="/studio/videos/:id" element={<VideoDetails />} />
          <Route path="/studio/live" element={<LiveEventsPage />} />
          <Route path="/studio/live/new" element={<LiveCreatePage />} />
          <Route path="/studio/live/:id" element={<LiveEventPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
