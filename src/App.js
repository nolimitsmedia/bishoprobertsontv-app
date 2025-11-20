// src/App.js
import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import api from "./api";

import Layout from "./layout/Layout";
import PublicLayout from "./layout/PublicLayout";
import MemberLayout from "./layout/MemberLayout";
import ProtectedRoute from "./auth/ProtectedRoute";

// Admin Pages manager (channel-agnostic) + visual builder
import PagesAdmin from "./pages/admin/PagesAdmin";
import PageBuilder from "./pages/studio/PageBuilder"; // visual builder by page ID

// PUBLIC PAGES
import Home from "./pages/public/Home";
import Login from "./pages/public/Login";
import LiveWatch from "./pages/public/LiveWatch";
import Subscribe from "./pages/public/Subscribe";
import SubscribeThanks from "./pages/public/SubscribeThanks";
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

// Community
import Community from "./pages/public/Community";
import CommunityNew from "./pages/public/CommunityNew";
import CommunityPost from "./pages/public/CommunityPost"; // <-- NEW detail page

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

function SimplePage({ title }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p>Coming soon…</p>
    </div>
  );
}

export default function App() {
  // Prime axios with token if present
  useEffect(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* ---------- ADMIN (protected + role: admin) ---------- */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard title="Dashboard" />} />

          {/* Content */}
          <Route path="content/videos" element={<Videos />} />
          <Route path="content/videos/:id" element={<VideoDetails />} />
          <Route
            path="content/live"
            element={<LiveStreaming title="Live Streaming" />}
          />
          <Route
            path="content/collections"
            element={<CollectionsPage title="Collections" />}
          />
          <Route
            path="content/collections/new"
            element={<CollectionDetails />}
          />
          <Route
            path="content/collections/:id"
            element={<CollectionDetails />}
          />
          <Route
            path="content/categories"
            element={<CategoriesPage title="Categories" />}
          />

          {/* Pages (channel removed; generic site pages) */}
          <Route path="pages" element={<PagesAdmin />} />
          <Route path="pages/:id/edit" element={<PageBuilder />} />

          <Route
            path="content/calendar"
            element={<SimplePage title="Calendar" />}
          />
          <Route
            path="content/resources"
            element={<SimplePage title="Resources" />}
          />
          <Route
            path="content/organize"
            element={<SimplePage title="Organize" />}
          />

          <Route path="people" element={<SimplePage title="People" />} />
          <Route path="community" element={<SimplePage title="Community" />} />

          {/* Subscriptions */}
          <Route
            path="subscriptions"
            element={<Subscriptions title="Subscriptions" />}
          />
          <Route path="subscriptions/new" element={<SubscriptionPlanNew />} />
          <Route
            path="subscriptions/plan/:id"
            element={<SubscriptionPlanEdit />}
          />

          <Route path="bundles" element={<SimplePage title="Bundles" />} />
          <Route path="sales" element={<SimplePage title="Sales" />} />
          <Route path="marketing" element={<SimplePage title="Marketing" />} />
          <Route path="analytics" element={<SimplePage title="Analytics" />} />
          <Route
            path="apps"
            element={<SimplePage title="Mobile & TV Apps" />}
          />
          <Route path="settings" element={<SimplePage title="Settings" />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        {/* ---------- PUBLIC (shell) ---------- */}
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          {/* Public playlist detail (id or slug). Keep both spellings. */}
          <Route path="/playlist/:id" element={<PlaylistView />} />
          <Route path="/playlists/:id" element={<PlaylistView />} />
          <Route path="/videos" element={<AllVideos />} />
          <Route path="/p/videos" element={<AllVideos />} />
          <Route path="/pricing" element={<Pricing />} />
          {/* Site page by slug */}
          <Route path="/p/:slug" element={<PageView />} />
          <Route path="/watch/:id" element={<VideoView />} />
          <Route path="/watch/live/:id" element={<LiveWatch />} />
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/subscribe/thanks" element={<SubscribeThanks />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/free-account" element={<FreeAccountForm />} />
          <Route path="/forgot" element={<ForgotPassword />} />

          {/* ✅ Community */}
          <Route path="/community" element={<Community />} />
          {/* Post detail (primary + legacy alias) */}
          <Route path="/community/:id" element={<CommunityPost />} />
          <Route path="/community/post/:id" element={<CommunityPost />} />
          {/* Compose (component handles admin-only UI) */}
          <Route path="/community/new" element={<CommunityNew />} />

          {/* TV activation mock (public) */}
          <Route path="/activate" element={<TvActivate />} />
          <Route path="/tv/activate" element={<TvActivate />} />

          {/* Public fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>

        {/* ---------- MEMBER AREA (protected) ---------- */}
        <Route
          element={
            <ProtectedRoute>
              <MemberLayout />
            </ProtectedRoute>
          }
        >
          {/* Account */}
          <Route path="/account" element={<AccountHome />} />

          {/* Playlists */}
          <Route path="/account/playlists" element={<MyPlaylists />} />
          <Route
            path="/account/playlists/:idOrSlug/edit"
            element={<PlaylistEditor />}
          />

          {/* Apps */}
          <Route path="/account/apps" element={<MobileTvApps />} />

          {/* Studio (uploads/live) – pages are admin-only now */}
          <Route path="/studio/upload" element={<UploadPage />} />
          <Route path="/studio/videos" element={<Videos />} />
          <Route path="/studio/videos/:id" element={<VideoDetails />} />
          <Route path="/studio/live" element={<LiveEventsPage />} />
          <Route path="/studio/live/new" element={<LiveCreatePage />} />
          <Route path="/studio/live/:id" element={<LiveEventPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
