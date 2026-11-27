// src/pages/public/HomeRoute.js
//
// The site's home ("/"): the page chosen in Site settings > Homepage, or the
// built-in Home page when none is chosen (like WordPress "A static page").
// Faster loading: uses the options saved in the browser right away; on a first
// visit it waits at most 1.5 s for the server (branded loader), then shows the
// built-in Home.

import React, { Suspense, lazy, useEffect, useState } from "react";
import { useSiteOptions } from "../../lib/siteOptions";
import BrandLoader from "../../components/BrandLoader";

const Home = lazy(() => import("./Home"));
const BuilderPage = lazy(() => import("./BuilderPage"));

export default function HomeRoute() {
  const options = useSiteOptions();
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (options) return undefined;
    const t = setTimeout(() => setGaveUp(true), 1500);
    return () => clearTimeout(t);
  }, [options]);
  if (!options && !gaveUp) return <BrandLoader />;
  const slug = String(options?.home_page_slug || "").trim();
  return (
    <Suspense fallback={<BrandLoader />}>
      {slug && slug !== "home" ? (
        <BuilderPage slug={slug} fallback={<Home />} />
      ) : (
        <Home />
      )}
    </Suspense>
  );
}
