// Home.canvas.test.js
//
// Guards the Home page's built-in parts, normally and inside the visual editor
// canvas: the page renders without errors (in development mode, where React
// Router validates every link) and every button keeps its real address.
// Run: npm test -- Home.canvas --watchAll=false

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";

// React Router 7's package entry is not resolvable by CRA's Jest 27; load the
// real (CommonJS) build directly so links are validated exactly as in the app.
// jsdom has no TextEncoder/TextDecoder; React Router 7 needs them.
jest.mock(
  "react-router/dom",
  () => {
    const util = require("util");
    if (!global.TextEncoder) global.TextEncoder = util.TextEncoder;
    if (!global.TextDecoder) global.TextDecoder = util.TextDecoder;
    return jest.requireActual("react-router/dist/development/dom-export.js");
  },
  { virtual: true },
);
jest.mock(
  "react-router-dom",
  () => {
    const util = require("util");
    if (!global.TextEncoder) global.TextEncoder = util.TextEncoder;
    if (!global.TextDecoder) global.TextDecoder = util.TextDecoder;
    return jest.requireActual("react-router-dom/dist/index.js");
  },
  { virtual: true },
);
import { CanvasContext } from "../../components/builder/canvasContext";

jest.mock("../../api", () => {
  const ok = (data) => Promise.resolve({ data });
  const api = {
    get: jest.fn((url) => {
      if (String(url).includes("/pages/home"))
        return ok({ ok: true, page: global.__HOME_PAGE__ });
      return ok({ ok: true, items: [], videos: [], events: [], data: [] });
    }),
    post: jest.fn(() => ok({ ok: true })),
    defaults: { baseURL: "http://localhost:5000/api" },
    interceptors: { request: { use: () => {} }, response: { use: () => {} } },
  };
  return { __esModule: true, default: api, ...api };
});

const PAGE = {
  id: 1,
  slug: "home",
  status: "published",
  content_json: {
    extra_sections: [
      {
        id: "core-hero",
        blocks: [
          {
            id: "hh",
            type: "home_hero",
            title: "Hello Without Limits",
            cta_text: "Start Watching",
            cta_href: "/catalog",
          },
        ],
      },
      {
        id: "core-join",
        blocks: [
          {
            id: "hj",
            type: "home_join",
            title: "DRM",
            cta_text: "Join Now",
            cta_href: "/signup",
          },
        ],
      },
      {
        id: "core-cta",
        blocks: [
          {
            id: "hc",
            type: "home_cta",
            title: "Go Deeper",
            cta_text: "Browse Catalog",
            cta_href: "/catalog?from=home",
          },
        ],
      },
      {
        id: "core-about",
        blocks: [
          { id: "ha", type: "home_about", name: "Bishop", text: "About text" },
        ],
      },
    ],
  },
};

function renderHome(canvas) {
  global.__HOME_PAGE__ = PAGE;
  const errors = [];
  const spy = jest
    .spyOn(console, "error")
    .mockImplementation((...a) => errors.push(a.join(" ")));
  const ui = (
    <MemoryRouter>
      <CanvasContext.Provider value={canvas}>
        <Home previewPage={PAGE} />
      </CanvasContext.Provider>
    </MemoryRouter>
  );
  const result = render(ui);
  return { ...result, errors, restore: () => spy.mockRestore() };
}

const hrefOf = (text) =>
  screen.getByText(text).closest("a")?.getAttribute("href");

describe.each([
  ["public site", false],
  ["visual editor canvas", true],
])("Home page (%s)", (_label, canvas) => {
  test("renders and every button keeps its address", async () => {
    const { errors, restore } = renderHome(canvas);
    await waitFor(() =>
      expect(screen.getByText("Start Watching")).toBeTruthy(),
    );
    expect(hrefOf("Start Watching")).toBe("/catalog");
    expect(hrefOf("Join Now")).toBe("/signup");
    expect(hrefOf("Browse Catalog")).toBe("/catalog?from=home");
    restore();
    // No React or router errors (e.g. an element passed as a link address).
    // App log lines like "[LatestTeaching] …" come from the mocked data and are ignored.
    expect(errors.filter((e) => !/^\[[A-Za-z]+\]/.test(e))).toEqual([]);
  });
});

test("editor markers only appear in the canvas", async () => {
  const pub = renderHome(false);
  await waitFor(() => expect(screen.getByText("Start Watching")).toBeTruthy());
  expect(
    pub.container.querySelectorAll(
      "[data-bx-field],[data-bx-block],[data-bx-section]",
    ).length,
  ).toBe(0);
  pub.restore();
  pub.unmount();
  const cv = renderHome(true);
  await waitFor(() => expect(screen.getByText("Start Watching")).toBeTruthy());
  expect(
    cv.container.querySelector('[data-bx-field="cta_text"]'),
  ).not.toBeNull();
  expect(cv.container.querySelector('[data-bx-field="cta_href"]')).toBeNull(); // addresses are not editable text
  cv.restore();
});
