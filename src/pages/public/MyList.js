// src/pages/public/MyList.js
//
// Release 2.0: My List — videos the viewer saved with "+ My List".

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import { VideoCard } from "../../components/viewer/ViewerParts";
import {
  isSignedIn,
  myListLoaded,
  useMyList,
} from "../../components/viewer/viewerStore";
import "../../components/viewer/Viewer.css";

export default function MyList() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const ids = useMyList(); // removing from the list hides the card right away
  const signedIn = isSignedIn();
  useEffect(() => {
    if (!signedIn) return;
    api
      .get("/viewer/list")
      .then(({ data }) =>
        setItems(Array.isArray(data?.items) ? data.items : []),
      )
      .catch(() => setError("My List could not be loaded. Please try again."));
  }, [signedIn]);
  const shown = (items || []).filter(
    (v) => !myListLoaded() || ids.has(Number(v.id)),
  );
  return (
    <main className="vw-page">
      <div className="vw-pageHead">
        <h1>My List</h1>
        <Link to="/catalog" className="vw-linkBtn">
          Browse videos ›
        </Link>
      </div>
      <div className="vw-pageBody">
        {!signedIn ? (
          <p className="vw-empty">
            <Link to="/login" className="vw-linkBtn">
              Sign in
            </Link>{" "}
            to save videos to My List.
          </p>
        ) : error ? (
          <p className="vw-empty" role="alert">
            {error}
          </p>
        ) : items === null ? (
          <p className="vw-empty" role="status">
            Loading…
          </p>
        ) : !shown.length ? (
          <p className="vw-empty">
            Nothing here yet. Use “+ My List” on any video to save it for later.
          </p>
        ) : (
          <div className="vw-grid">
            {shown.map((v) => (
              <VideoCard key={v.id} v={v} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
