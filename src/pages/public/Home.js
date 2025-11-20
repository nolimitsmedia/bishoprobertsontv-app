// src/pages/Home.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <main style={{ background: "#0A0D12" }}>
      <Hero />
      <JoinStrip />
      <FeaturedPromo />
      <RevivalBanner />
      <WordForYear />
      <LatestVideos />
      <MoneyComethFeature />
      <DownloadApp /> {/* 8th section */}
      <WatchMoreCTA /> {/* 9th section */}
      <AboutBio /> {/* 10th section */}
    </main>
  );
}

/* ------------------------- 1) HERO (video background) ------------------------ */
function Hero() {
  const VIDEO_SRC = "https://www.youtube.com/watch?v=2jb-q-klLrw";
  const POSTER_SRC = "/media/dummy-hero-poster.jpg";

  const videoRef = useRef(null);
  const [useVideo, setUseVideo] = useState(true);
  const [isYouTube, setIsYouTube] = useState(false);
  const [ytId, setYtId] = useState(null);

  useEffect(() => {
    const id = extractYouTubeId(VIDEO_SRC);
    setIsYouTube(!!id);
    setYtId(id);
  }, [VIDEO_SRC]);

  useEffect(() => {
    if (isYouTube) return;
    const reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setUseVideo(false);
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    (async () => {
      try {
        await v.play();
        setUseVideo(true);
      } catch {
        setUseVideo(false);
      }
    })();
  }, [isYouTube]);

  const s = {
    root: {
      position: "relative",
      minHeight: "78vh",
      display: "grid",
      alignItems: "center",
      justifyItems: "start",
      overflow: "hidden",
      color: "#fff",
      background: "#0B0F17",
    },
    mediaWrap: { position: "absolute", inset: 0, zIndex: 0, lineHeight: 0 },
    media: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: "center",
      filter: "brightness(0.9)",
      display: "block",
    },
    ytFrame: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      border: 0,
      pointerEvents: "none",
    },
    overlay: {
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(90% 70% at 0% 50%, rgba(0,0,0,0.75), rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.2) 100%)",
      zIndex: 1,
    },
    wrap: {
      position: "relative",
      zIndex: 2,
      width: "min(1100px, 92vw)",
      marginInline: "auto",
      padding: "clamp(24px,4vw,48px)",
      display: "grid",
      gridTemplateColumns: "minmax(0, 720px)",
      justifyItems: "start",
      textAlign: "left",
      textShadow: "0 1px 2px rgba(0,0,0,.4)",
    },
    kicker: {
      fontSize: "clamp(12px, 1.5vw, 14px)",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      fontWeight: 700,
      color: "#e5e7eb",
      opacity: 0.9,
      marginBottom: 10,
    },
    heading: {
      margin: 0,
      fontSize: "clamp(28px, 5vw, 44px)",
      lineHeight: 1.1,
      fontWeight: 800,
      letterSpacing: "-0.01em",
    },
    sub: {
      margin: "12px 0 24px",
      fontSize: "clamp(14px, 2.2vw, 18px)",
      color: "#d6d8de",
      maxWidth: 720,
    },
    cta: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "14px 22px",
      borderRadius: 8,
      background: "#c1121f",
      color: "#fff",
      textDecoration: "none",
      fontWeight: 800,
      boxShadow: "0 6px 20px rgba(193,18,31,0.35)",
    },
  };

  return (
    <section aria-label="Hero" style={s.root}>
      <div style={s.mediaWrap} aria-hidden>
        {isYouTube ? (
          <iframe
            title="Hero Background"
            style={s.ytFrame}
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&controls=0&rel=0&loop=1&playlist=${ytId}&playsinline=1&modestbranding=1`}
            allow="autoplay; fullscreen; picture-in-picture"
          />
        ) : useVideo ? (
          <video
            ref={videoRef}
            src={VIDEO_SRC}
            poster={POSTER_SRC || undefined}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            style={s.media}
          />
        ) : (
          POSTER_SRC && <img src={POSTER_SRC} alt="" style={s.media} />
        )}
        <div style={s.overlay} />
      </div>

      <div style={s.wrap}>
        <div style={s.kicker}>Where You Get The Cutting Edge</div>
        <h1 style={s.heading}>
          The official streaming platform of Bishop Robertson.
        </h1>
        <p style={s.sub}>
          Apostolic-level teaching to equip you for everyday breakthroughs.
        </p>
        <Link to="/catalog" style={s.cta}>
          Start Watching Now
        </Link>
      </div>
    </section>
  );
}

function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {}
  return null;
}

/* --------------------------- 2) JOIN STRIP (Connect) -------------------------- */
function JoinStrip() {
  const s = {
    outer: { padding: "clamp(16px, 2vw, 24px)", background: "#0A0D12" },
    box: {
      width: "min(1200px, 94vw)",
      margin: "0 auto",
      background: "#E9ECEF",
      borderRadius: 4,
      padding: "clamp(18px, 3vw, 28px)",
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 16,
    },
    boxWide: { gridTemplateColumns: "1.4fr 0.6fr", alignItems: "center" },
    h: {
      margin: 0,
      fontSize: "clamp(26px, 4.2vw, 44px)",
      lineHeight: 1.05,
      fontWeight: 900,
      letterSpacing: "-0.01em",
      color: "#0B0F17",
    },
    sub: {
      marginTop: 10,
      color: "#1f2937",
      fontSize: "clamp(13px, 1.8vw, 15px)",
      maxWidth: 720,
    },
    strong: { fontWeight: 800 },
    btnWrap: { display: "grid", justifyContent: "end", alignItems: "center" },
    btn: {
      display: "inline-flex",
      justifyContent: "center",
      width: "min(320px, 100%)",
      padding: "14px 18px",
      background: "#0874C7",
      color: "#0B0F17",
      fontWeight: 800,
      borderRadius: 2,
      textDecoration: "none",
      border: "1px solid rgba(0,0,0,.08)",
    },
  };

  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 880px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return (
    <section aria-label="Join" style={s.outer}>
      <div style={{ ...s.box, ...(wide ? s.boxWide : null) }}>
        <div>
          <h2 style={s.h}>JOIN OVER 18,000+ PEOPLE</h2>
          <p style={s.sub}>
            who experience <span style={s.strong}>BISHOPTV</span> and sign up
            today. Get access to a more personal and customized experience.
          </p>
        </div>
        <div style={s.btnWrap}>
          <Link to="/signup" style={s.btn}>
            CONNECT
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------- 3) FEATURED PROMO (CAMP MEETING 2025 — fixed BG) -------------- */
function FeaturedPromo() {
  const BG_URL =
    "https://bethelatx.com/wp-content/uploads/2024/10/Webpage-Header-1024x576.png";
  const POSTER_URL = "/media/camp-2025.jpg";
  const CTA_HREF = "/catalog";

  const [bgLoaded, setBgLoaded] = useState(false);
  useEffect(() => {
    if (!BG_URL) return;
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.onerror = () => setBgLoaded(false);
    img.src = BG_URL;
  }, [BG_URL]);

  const s = {
    section: {
      position: "relative",
      minHeight: "64vh",
      display: "grid",
      placeItems: "center",
      padding: "clamp(40px, 6vw, 80px) 0",
      overflow: "hidden",
      backgroundColor: "#0D1219",
    },
    bg: {
      position: "absolute",
      inset: 0,
      zIndex: 0,
      backgroundImage: bgLoaded ? `url('${BG_URL}')` : "none",
      backgroundSize: "cover",
      backgroundPosition: "center",
      filter: "brightness(0.6)",
      transition: "opacity .3s ease",
      opacity: bgLoaded ? 1 : 0,
    },
    overlay: {
      position: "absolute",
      inset: 0,
      zIndex: 1,
      background:
        "linear-gradient(to bottom, rgba(0,0,0,.45), rgba(0,0,0,.45))",
      pointerEvents: "none",
    },
    wrap: {
      position: "relative",
      zIndex: 2,
      width: "min(1100px, 92vw)",
      marginInline: "auto",
      display: "grid",
      justifyItems: "center",
      textAlign: "center",
      gap: 18,
      color: "#fff",
    },
    poster: {
      width: "min(420px, 70vw)",
      maxHeight: "70vh",
      objectFit: "cover",
      borderRadius: 12,
      boxShadow: "0 16px 50px rgba(0,0,0,.45)",
      marginBottom: "clamp(12px, 2.2vw, 20px)",
    },
    title: {
      margin: 0,
      fontSize: "clamp(18px, 2.6vw, 28px)",
      fontWeight: 800,
      letterSpacing: "0.01em",
      textShadow: "0 1px 2px rgba(0,0,0,.5)",
    },
    cta: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "12px 18px",
      borderRadius: 6,
      background: "#1473ff",
      color: "#fff",
      textDecoration: "none",
      fontWeight: 800,
      boxShadow: "0 10px 25px rgba(20,115,255,.35)",
      minWidth: 180,
    },
  };

  return (
    <section aria-label="Featured Promo" style={s.section}>
      <div aria-hidden style={s.bg} />
      <div aria-hidden style={s.overlay} />
      <div style={s.wrap}>
        <img src={POSTER_URL} alt="" style={s.poster} />
        <h3 style={s.title}>CAMP MEETING 2025 – The Glory Is Rising</h3>
        <Link to={CTA_HREF} style={s.cta}>
          WATCH NOW
        </Link>
      </div>
    </section>
  );
}

/* --------------------------- 4) REVIVAL BANNER ------------------------------- */
function RevivalBanner() {
  const BG =
    "https://alpha.uscreencdn.com/1920xnull/assets%2Fpage-builder%2F21.1732547489.jpg";
  const TITLE =
    "PROSPERITY REVIVAL 2024 : Developing Money Cometh Demonstrators";
  const CTA_HREF = "/catalog";

  const s = {
    section: {
      position: "relative",
      minHeight: "44vh",
      display: "grid",
      placeItems: "center",
      padding: "clamp(36px, 6vw, 72px) 0",
      overflow: "hidden",
      backgroundColor: "#0D1219",
    },
    bg: {
      position: "absolute",
      inset: 0,
      backgroundImage: `url('${BG}')`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      filter: "brightness(0.55)",
      zIndex: 0,
    },
    overlayTop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      background: "#2a2a2a",
      zIndex: 1,
    },
    wrap: {
      position: "relative",
      zIndex: 2,
      width: "min(1100px, 92vw)",
      marginInline: "auto",
      textAlign: "center",
      color: "#fff",
      display: "grid",
      gap: 16,
      justifyItems: "center",
    },
    title: {
      margin: 0,
      fontSize: "clamp(20px, 3vw, 32px)",
      fontWeight: 900,
      letterSpacing: "0.01em",
      textShadow: "0 1px 2px rgba(0,0,0,.6)",
      maxWidth: 980,
    },
    btn: {
      display: "inline-flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "12px 22px",
      borderRadius: 4,
      background: "#1A73E8",
      color: "#fff",
      fontWeight: 800,
      textDecoration: "none",
      minWidth: 160,
      boxShadow: "0 10px 24px rgba(26,115,232,.35)",
    },
  };

  return (
    <section aria-label="Prosperity Revival 2024" style={s.section}>
      <div aria-hidden style={s.bg} />
      <div aria-hidden style={s.overlayTop} />
      <div style={s.wrap}>
        <h3 style={s.title}>{TITLE}</h3>
        <Link to={CTA_HREF} style={s.btn}>
          PLAY
        </Link>
      </div>
    </section>
  );
}

/* --------------------------- 5) WORD FOR THE YEAR ---------------------------- */
function WordForYear() {
  const TITLE = "WORD FOR THE YEAR OF 2025";
  const SUBTITLE = `"Holy Spirit Have Your Way!" John 6:63`;

  const VIDEO_URL = "/media/word-for-year.mp4";

  const ytId = extractYouTubeId(VIDEO_URL);
  const vmId = extractVimeoId(VIDEO_URL);

  const s = {
    section: {
      background: "#14181f",
      color: "#fff",
      padding: "clamp(40px, 6vw, 80px) 0",
      display: "grid",
      gap: 18,
    },
    wrap: {
      width: "min(1100px, 92vw)",
      margin: "0 auto",
      textAlign: "center",
    },
    title: {
      margin: 0,
      fontWeight: 900,
      letterSpacing: "0.01em",
      fontSize: "clamp(26px, 4.6vw, 48px)",
    },
    sub: {
      marginTop: 8,
      marginBottom: 22,
      opacity: 0.9,
      fontSize: "clamp(14px, 2.2vw, 18px)",
    },
    playerShell: {
      position: "relative",
      width: "min(960px, 100%)",
      margin: "0 auto",
      background: "#000",
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: "0 12px 40px rgba(0,0,0,.45)",
    },
    spacer: { paddingTop: "56.25%" },
    player: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      border: 0,
      display: "block",
    },
    video: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
    },
  };

  return (
    <section aria-label="Word for the Year" style={s.section}>
      <div style={s.wrap}>
        <h2 style={s.title}>{TITLE}</h2>
        <div style={s.sub}>{SUBTITLE}</div>

        <div style={s.playerShell}>
          <div style={s.spacer} />
          {ytId ? (
            <iframe
              title="Word for the Year (YouTube)"
              style={s.player}
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=0&mute=0&controls=1&rel=0&playsinline=1&modestbranding=1`}
              allow="autoplay; fullscreen; picture-in-picture"
            />
          ) : vmId ? (
            <iframe
              title="Word for the Year (Vimeo)"
              style={s.player}
              src={`https://player.vimeo.com/video/${vmId}?title=0&byline=0&portrait=0`}
              allow="autoplay; fullscreen; picture-in-picture"
            />
          ) : (
            <video
              style={{ ...s.player, ...s.video }}
              src={VIDEO_URL}
              controls
              playsInline
              preload="metadata"
              poster="/media/word-for-year-poster.jpg"
            />
          )}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- 6) LATEST VIDEOS ----------------------------- */
function LatestVideos() {
  const TITLE = "LATEST VIDEOS";
  const SUBTITLE =
    "You’re being anointed with promotion by God’s permission, and no one can stop it.";

  const VIDEO_URL = "/media/latest-video.mp4";

  const ytId = extractYouTubeId(VIDEO_URL);
  const vmId = extractVimeoId(VIDEO_URL);

  const s = {
    section: {
      background: "#161a21",
      color: "#fff",
      padding: "clamp(48px, 6vw, 84px) 0",
    },
    wrap: {
      width: "min(1100px, 92vw)",
      margin: "0 auto",
      textAlign: "center",
    },
    title: {
      margin: 0,
      fontWeight: 900,
      letterSpacing: "0.02em",
      fontSize: "clamp(22px, 4.2vw, 40px)",
    },
    sub: {
      marginTop: 10,
      marginBottom: 22,
      opacity: 0.9,
      fontSize: "clamp(14px, 2.2vw, 18px)",
    },
    shell: {
      position: "relative",
      width: "min(960px, 100%)",
      margin: "0 auto",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 18px 50px rgba(0,0,0,.45)",
      border: "1px solid rgba(255,255,255,.08)",
      background: "#000",
    },
    spacer: { paddingTop: "56.25%" },
    frame: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      border: 0,
      display: "block",
    },
    video: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
    },
  };

  return (
    <section aria-label="Latest Videos" style={s.section}>
      <div style={s.wrap}>
        <h2 style={s.title}>{TITLE}</h2>
        <div style={s.sub}>{SUBTITLE}</div>

        <div style={s.shell}>
          <div style={s.spacer} />
          {ytId ? (
            <iframe
              title="Latest Video (YouTube)"
              style={s.frame}
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=0&mute=0&controls=1&rel=0&playsinline=1&modestbranding=1`}
              allow="autoplay; fullscreen; picture-in-picture"
            />
          ) : vmId ? (
            <iframe
              title="Latest Video (Vimeo)"
              style={s.frame}
              src={`https://player.vimeo.com/video/${vmId}?title=0&byline=0&portrait=0`}
              allow="autoplay; fullscreen; picture-in-picture"
            />
          ) : (
            <video
              src={VIDEO_URL}
              controls
              playsInline
              preload="metadata"
              poster="/media/latest-video-poster.jpg"
              style={{ ...s.frame, ...s.video }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/* ----------------------- 7) MONEY COMETH (split feature) --------------------- */
function MoneyComethFeature() {
  const TITLE = "Money Cometh to the Body of Christ";
  const BLURB =
    "Watch this classic that kicked off the continuously fresh revelation and end time message of Money Cometh®.";

  const VIDEO_URL = "/media/money-cometh-classic.mp4";

  const ytId = extractYouTubeId(VIDEO_URL);
  const vmId = extractVimeoId(VIDEO_URL);

  const s = {
    section: {
      background: "#121518",
      color: "#fff",
      padding: "clamp(44px, 6vw, 84px) 0",
      borderTop: "1px solid rgba(255,255,255,.06)",
    },
    wrap: {
      width: "min(1100px, 92vw)",
      margin: "0 auto",
      display: "grid",
      gridTemplateColumns: "1fr 1.2fr",
      gap: "clamp(18px, 3vw, 28px)",
      alignItems: "center",
    },
    left: {
      display: "grid",
      gap: 12,
    },
    h: {
      margin: 0,
      fontWeight: 900,
      fontSize: "clamp(20px, 3vw, 30px)",
      lineHeight: 1.15,
    },
    p: {
      margin: 0,
      color: "#d8dbe5",
      fontSize: "clamp(14px, 2vw, 16px)",
      maxWidth: 560,
    },
    shell: {
      position: "relative",
      width: "100%",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 18px 50px rgba(0,0,0,.45)",
      border: "1px solid rgba(255,255,255,.08)",
      background: "#000",
    },
    spacer: { paddingTop: "56.25%" },
    frame: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      border: 0,
      display: "block",
    },
    video: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
    },
  };

  const [singleColumn, setSingleColumn] = useState(
    typeof window !== "undefined" && window.innerWidth <= 960
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 960px)");
    const update = () => setSingleColumn(mq.matches);
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return (
    <section aria-label="Money Cometh Feature" style={s.section}>
      <div
        style={{
          ...s.wrap,
          ...(singleColumn ? { gridTemplateColumns: "1fr", gap: 18 } : null),
        }}
      >
        <div style={s.left}>
          <h3 style={s.h}>{TITLE}</h3>
          <p style={s.p}>{BLURB}</p>
        </div>

        <div style={s.shell}>
          <div style={s.spacer} />
          {ytId ? (
            <iframe
              title="Money Cometh (YouTube)"
              style={s.frame}
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=0&mute=0&controls=1&rel=0&playsinline=1&modestbranding=1`}
              allow="autoplay; fullscreen; picture-in-picture"
            />
          ) : vmId ? (
            <iframe
              title="Money Cometh (Vimeo)"
              style={s.frame}
              src={`https://player.vimeo.com/video/${vmId}?title=0&byline=0&portrait=0`}
              allow="autoplay; fullscreen; picture-in-picture"
            />
          ) : (
            <video
              src={VIDEO_URL}
              controls
              playsInline
              preload="metadata"
              poster="/media/money-cometh-classic-poster.jpg"
              style={{ ...s.frame, ...s.video }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------- 8) DOWNLOAD APP (two-up) -------------------------- */
function DownloadApp() {
  const DEVICE_IMG =
    "https://leroythompson.tv/page_builder_blocks/platforms_devices/02_tablet_phone.png";
  const APPLE_BADGE =
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRiL5sY58_6DBRntFztvzMgxbbT-G-rWDsksA&s";
  const GOOGLE_BADGE =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Google_Play_Store_badge_EN.svg/1200px-Google_Play_Store_badge_EN.svg.png";
  const APPLE_LINK = "#";
  const GOOGLE_LINK = "#";

  const s = {
    section: {
      background: "#ffffff",
      color: "#000",
      padding: "clamp(48px, 6vw, 90px) 0",
    },
    wrap: {
      width: "min(1100px, 92vw)",
      margin: "0 auto",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "clamp(20px, 3vw, 36px)",
      alignItems: "center",
    },
    art: {
      width: "100%",
      height: "auto",
      objectFit: "contain",
      display: "block",
    },
    right: {
      display: "grid",
      gap: 12,
    },
    title: {
      margin: 0,
      fontWeight: 900,
      fontSize: "clamp(20px, 3.2vw, 32px)",
      lineHeight: 1.15,
      color: "#000",
    },
    p: {
      margin: 0,
      color: "#111",
      fontSize: "clamp(14px, 2vw, 16px)",
    },
    strong: { fontWeight: 900 },
    storeRow: {
      display: "flex",
      gap: 12,
      marginTop: 8,
      flexWrap: "wrap",
    },
    badge: {
      height: 44,
      width: "auto",
      display: "block",
      filter: "drop-shadow(0 6px 20px rgba(0,0,0,.35))",
    },
  };

  const [singleColumn, setSingleColumn] = useState(
    typeof window !== "undefined" && window.innerWidth <= 980
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 980px)");
    const update = () => setSingleColumn(mq.matches);
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return (
    <section aria-label="Download the App" style={s.section}>
      <div
        style={{
          ...s.wrap,
          ...(singleColumn ? { gridTemplateColumns: "1fr" } : null),
        }}
      >
        <div>
          <img src={DEVICE_IMG} alt="" style={s.art} />
        </div>

        <div style={s.right}>
          <h3 style={s.title}>
            DOWNLOAD Bisho Robertson.TV
            <br />
            IN THE APP STORE
          </h3>
          <p style={s.p}>
            Stream <span style={s.strong}>BishopRobertson.TV</span> on any of
            your devices wherever you are. Apple iOS mobile &amp; TV, Android
            mobile &amp; TV, Amazon Fire TV, &amp; all ROKU products.
          </p>

          <div style={s.storeRow}>
            <a href={APPLE_LINK} aria-label="Download on the App Store">
              <img src={APPLE_BADGE} alt="" style={s.badge} />
            </a>
            <a href={GOOGLE_LINK} aria-label="Get it on Google Play">
              <img src={GOOGLE_BADGE} alt="" style={s.badge} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- 9) WATCH MORE (CTA) ----------------------------- */
function WatchMoreCTA() {
  // Big background image w/ gradient, centered CTA
  const BG =
    "https://images.unsplash.com/photo-1557825835-70d97c4aa495?q=80&w=2400&auto=format&fit=crop"; // placeholder phone/background

  const s = {
    section: {
      position: "relative",
      minHeight: "46vh",
      display: "grid",
      placeItems: "center",
      padding: "clamp(36px, 6vw, 72px) 0",
      overflow: "hidden",
      background: "#0F1318",
    },
    bg: {
      position: "absolute",
      inset: 0,
      backgroundImage: `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.55)), url('${BG}')`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      filter: "saturate(0.9)",
      zIndex: 0,
    },
    wrap: {
      position: "relative",
      zIndex: 1,
      width: "min(1100px, 92vw)",
      marginInline: "auto",
      textAlign: "center",
      color: "#fff",
      display: "grid",
      gap: 14,
      justifyItems: "center",
    },
    title: {
      margin: 0,
      fontWeight: 900,
      letterSpacing: "0.02em",
      fontSize: "clamp(22px, 4vw, 36px)",
    },
    sub: {
      maxWidth: 820,
      opacity: 0.95,
      fontSize: "clamp(14px, 2.2vw, 18px)",
    },
    btn: {
      marginTop: 4,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "14px 26px",
      borderRadius: 6,
      background: "#ffffff",
      color: "#111827",
      fontWeight: 900,
      textDecoration: "none",
      minWidth: 180,
      boxShadow: "0 14px 32px rgba(0,0,0,.35)",
    },
  };

  return (
    <section aria-label="Watch More CTA" style={s.section}>
      <div aria-hidden style={s.bg} />
      <div style={s.wrap}>
        <h3 style={s.title}>WATCH MORE</h3>
        <div style={s.sub}>
          Stream the most relevant messages and videos now!
        </div>
        <Link to="/catalog" style={s.btn}>
          STREAM
        </Link>
      </div>
    </section>
  );
}

/* --------------------------- 10) ABOUT / BIO BLOCK --------------------------- */
function AboutBio() {
  const AVATAR =
    "https://alpha.uscreencdn.com/fit-in/120x120/assets%2Fpage-builder%2FApostle-Headshot.jpg"; // replace with your headshot

  const s = {
    section: {
      background: "#ffffff",
      color: "#111827",
      padding: "clamp(36px, 5vw, 64px) 0",
    },
    wrap: {
      width: "min(1100px, 92vw)",
      margin: "0 auto",
      display: "grid",
      gridTemplateColumns: "auto 1fr",
      gap: 18,
      alignItems: "start",
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: "50%",
      objectFit: "cover",
      border: "2px solid rgba(0,0,0,.06)",
      background: "#eee",
    },
    name: {
      margin: 0,
      fontWeight: 900,
      fontSize: "clamp(18px, 2.4vw, 22px)",
    },
    text: {
      marginTop: 6,
      lineHeight: 1.6,
      color: "#374151",
      fontSize: "clamp(14px, 2vw, 16px)",
    },
    strong: { fontWeight: 900, color: "#111827" },
    small: { opacity: 0.9 },
    stack: { display: "grid", gap: 6 },
    wrapMobile: { gridTemplateColumns: "1fr", gap: 12 },
  };

  const [mobile, setMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 640
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setMobile(mq.matches);
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return (
    <section aria-label="About Apostle" style={s.section}>
      <div
        style={{
          ...s.wrap,
          ...(mobile ? s.wrapMobile : null),
        }}
      >
        <img src={AVATAR} alt="" style={s.avatar} />
        <div style={s.stack}>
          <h4 style={s.name}>Bishop Robertson</h4>
          <p style={s.text}>
            Author of the world renowned prophetic word{" "}
            <span style={s.strong}>Money Cometh</span> <sup>®</sup>. With over{" "}
            <span style={s.strong}>five decades of successful ministry</span>,
            Apostle Thompson continues to be{" "}
            <span style={s.strong}>a pioneer and a trailblazer</span> in various
            subject matters established by his Lord and Savior Jesus Christ.
          </p>
          <p style={s.text}>
            This platform was created with you in mind. So that you can{" "}
            <span style={s.strong}>receive from and connect with</span> Apostle
            Thompson—with no limits!
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ helpers ------------------------------------- */
function extractVimeoId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.includes("vimeo.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const id = parts[parts.length - 1];
    return /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
