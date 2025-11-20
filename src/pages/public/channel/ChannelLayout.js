// src/public/channel/ChannelLayout.jsx
import { Outlet, useParams, NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../../../api";

export default function ChannelLayout() {
  const { slug } = useParams();
  const [channel, setChannel] = useState(null);
  const [pages, setPages] = useState([]);

  useEffect(() => {
    (async () => {
      const [c, p] = await Promise.all([
        api.get(`/channels/${slug}`),
        api.get(`/channels/${slug}/pages`),
      ]);
      setChannel(c.data);
      setPages(p.data);
    })();
  }, [slug]);

  if (!channel) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div>
      <header className="channel-header">
        <div className="inner">
          <h1>{channel.title}</h1>
          <nav>
            {pages.map((p) => (
              <NavLink
                key={p.slug}
                to={p.slug === "home" ? `/@${slug}` : `/@${slug}/${p.slug}`}
              >
                {p.title}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="channel-main">
        <Outlet />
      </main>
    </div>
  );
}
