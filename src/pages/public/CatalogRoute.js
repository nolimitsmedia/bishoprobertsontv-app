// src/pages/public/CatalogRoute.js
//
// Release 2.0: /catalog shows Browse (rows). Addresses with search or filter
// parameters (e.g. /catalog?collection=5) show the full catalog, so existing
// links and filters work as before. /catalog/all is always the full catalog.

import React, { Suspense, lazy, useRef } from "react";
import {
  useLocation,
  useNavigationType,
  useSearchParams,
} from "react-router-dom";

const Browse = lazy(() => import("./Browse"));
const Catalog = lazy(() => import("./Catalog"));

export default function CatalogRoute({ full = false }) {
  const [sp] = useSearchParams();
  const loc = useLocation();
  const navType = useNavigationType();
  const hasParams = [...sp.keys()].length > 0;
  // The catalog updates its own filters by REPLACING the address; clearing them
  // must not switch to Browse. A normal visit (link, menu, back) decides afresh.
  const showFull = useRef(full || hasParams);
  const lastKey = useRef(loc.key);
  if (loc.key !== lastKey.current) {
    lastKey.current = loc.key;
    if (navType !== "REPLACE" || hasParams)
      showFull.current = full || hasParams;
  }
  return (
    <Suspense fallback={null}>
      {showFull.current ? <Catalog /> : <Browse />}
    </Suspense>
  );
}
