// src/public/channel/ChannelRoutes.jsx
import { Routes, Route } from "react-router-dom";
import ChannelLayout from "./ChannelLayout";
import ChannelPage from "./ChannelPage"; // generic renderer
import ChannelVideos from "./ChannelVideos";
import ChannelLive from "./ChannelLive";

export default function ChannelRoutes() {
  return (
    <Routes>
      <Route path="/@:slug" element={<ChannelLayout />}>
        <Route index element={<ChannelPage pageSlug="home" />} />
        <Route path="about" element={<ChannelPage pageSlug="about" />} />
        <Route path="videos" element={<ChannelVideos />} />
        <Route path="live" element={<ChannelLive />} />
        <Route path="contact" element={<ChannelPage pageSlug="contact" />} />
        {/* dynamic custom pages */}
        <Route path=":pageSlug" element={<ChannelPage />} />
      </Route>
    </Routes>
  );
}
