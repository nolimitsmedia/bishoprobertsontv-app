// Phase 4F — publish parity.
// Every block type the page editor can add must render on the public site.
// This test reads the editor's source for the block types it offers, renders a
// sample of each through the public renderer, and fails if one renders nothing.
// Run with: npm test -- BuilderPage.parity --watchAll=false

import fs from "fs";
import path from "path";
import React from "react";
import { render } from "@testing-library/react";
import { BuilderSections } from "./BuilderPage";

// React Router 7 cannot be resolved by Create React App's Jest 27, so the test
// uses a minimal stand-in: links render as plain <a> elements.
jest.mock(
  "react-router-dom",
  () => {
    const R = require("react");
    return {
      Link: ({ to, children, ...rest }) =>
        R.createElement("a", { href: String(to), ...rest }, children),
      useParams: () => ({}),
      useLocation: () => ({ pathname: "/", search: "", hash: "" }),
      useNavigate: () => () => {},
    };
  },
  { virtual: true },
);

// No network in this test (axios is also not loadable by Jest 27).
jest.mock("../../api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: {} })),
    defaults: { baseURL: "" },
  },
}));

const EDITOR = path.join(__dirname, "..", "admin", "AdminPageEditor.js");

// Rendered by the public Home page (Home.js), not by the builder renderer.
const HOME_ONLY = new Set([
  "home_hero",
  "home_join",
  "home_cta",
  "home_about",
  "featured_live",
  "latest_teaching",
]);

// A realistic sample for each public block type. A new block type in the
// editor needs a public renderer AND a sample here.
const SAMPLES = {
  richtext: { type: "richtext", html: "<p>Sample text block</p>" },
  button: { type: "button", text: "Sample button", href: "/about" },
  gallery: {
    type: "gallery",
    cols: 3,
    images: [
      {
        id: "i1",
        src: "https://cdn.example.com/a.jpg",
        alt: "Sample gallery image",
      },
    ],
  },
  grid: {
    type: "grid",
    cols: 3,
    items: [
      { id: "c1", title: "Sample card", text: "Card text", image_url: "" },
    ],
  },
  columns: {
    type: "columns",
    gap: 14,
    columns: [
      {
        id: "l",
        width_pct: 50,
        blocks: [{ id: "n1", type: "richtext", html: "<p>Left column</p>" }],
      },
      {
        id: "r",
        width_pct: 50,
        blocks: [{ id: "n2", type: "button", text: "Right button", href: "/" }],
      },
    ],
  },
  hero: { type: "hero", title: "Sample hero", sub: "Hero subtitle" },
  // Phase 5
  video: {
    type: "video",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "Sample video",
  },
  spacer: { type: "spacer", height: 40, divider: true },
  quote: {
    type: "quote",
    text: "Sample quote",
    name: "A. Member",
    role: "Member",
  },
  faq: {
    type: "faq",
    items: [{ id: "q1", q: "Sample question?", a: "Sample answer." }],
  },
  heading: { type: "heading", text: "Sample heading", level: "h2" },
  image: { type: "image", src: "https://cdn.example.com/a.jpg", alt: "Sample" },
  divider: { type: "divider", line: "solid", thickness: 2 },
  videos: { type: "videos", source: "latest", count: 3 },
  form: {
    type: "form",
    title: "Contact",
    fields: [{ id: "n", label: "Your name", type: "text", required: true }],
  },
  icon: { type: "icon", icon: "heart", label: "Love" },
  iconlist: {
    type: "iconlist",
    items: [{ id: "a", icon: "check", text: "Sample item" }],
  },
  slider: {
    type: "slider",
    images: [{ src: "https://cdn.example.com/a.jpg", alt: "A" }],
  },
  testimonials: {
    type: "testimonials",
    items: [{ id: "t", text: "Sample testimonial", name: "Ann" }],
  },
  countdown: {
    type: "countdown",
    mode: "date",
    target: "2099-01-01T10:00",
    title: "Sample countdown",
  },
  map: { type: "map", address: "Richmond, VA" },
  social: {
    type: "social",
    items: [{ id: "s", network: "facebook", url: "https://facebook.com/x" }],
  },
  embed: { type: "embed", code: "https://example.com/embed" },
};

function editorBlockTypes() {
  const src = fs.readFileSync(EDITOR, "utf8");
  const types = new Set();
  for (const m of src.matchAll(/addBlock\(\s*[a-zA-Z_.]+\s*,\s*"([a-z_]+)"/g))
    types.add(m[1]);
  for (const m of src.matchAll(/\{\s*type:\s*"([a-z_]+)",\s*label:/g))
    types.add(m[1]);
  return [...types];
}

function renderSection(block) {
  return render(
    <BuilderSections
      sections={[
        {
          id: "s1",
          title: "",
          layout: "card",
          blocks: [{ id: "b1", ...block }],
        },
      ]}
      pageSlug="parity-test"
    />,
  );
}

describe("publish parity: editor block types render on public pages", () => {
  const types = editorBlockTypes();

  test("the editor offers block types (source was read)", () => {
    expect(types).toEqual(
      expect.arrayContaining(["richtext", "grid", "columns"]),
    );
  });

  const publicTypes = types.filter((t) => !HOME_ONLY.has(t));

  test.each(publicTypes)(
    "%s has a sample and renders visible content",
    (type) => {
      const sample = SAMPLES[type];
      if (!sample) {
        throw new Error(
          `Block type "${type}" can be added in the editor but has no public sample. ` +
            "Add a public renderer in BuilderPage.js and a sample in this test.",
        );
      }
      const { container } = renderSection(sample);
      // Ignore <style> tags: their CSS text is not visible page content.
      container.querySelectorAll("style").forEach((el) => el.remove());
      const text = container.textContent.replace(/\s+/g, " ").trim();
      const hasImage = container.querySelector("img") !== null;
      // Media and layout blocks may have no text: an embed, video or spacer counts.
      const hasMedia =
        container.querySelector(
          "iframe, video, svg, .bx-spacer, .bx-divider2, .bx-vgrid",
        ) !== null;
      expect(text.length > 0 || hasImage || hasMedia).toBe(true);
    },
  );

  test("columns render their nested blocks", () => {
    const { container } = renderSection(SAMPLES.columns);
    expect(container.textContent).toContain("Left column");
    expect(container.textContent).toContain("Right button");
    expect(container.querySelectorAll(".builder-column")).toHaveLength(2);
  });

  test("grid renders one card per item with title and text", () => {
    const { container } = renderSection(SAMPLES.grid);
    expect(container.querySelectorAll(".builder-card")).toHaveLength(1);
    expect(container.textContent).toContain("Sample card");
  });

  test("video links become safe embeds; unknown links render nothing", () => {
    const yt = renderSection({
      type: "video",
      url: "https://youtu.be/dQw4w9WgXcQ",
    });
    expect(yt.container.querySelector("iframe").getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    const vimeo = renderSection({
      type: "video",
      url: "https://vimeo.com/123456789",
    });
    expect(vimeo.container.querySelector("iframe").getAttribute("src")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
    const bunny = renderSection({
      type: "video",
      url: "https://iframe.mediadelivery.net/play/12345/1b2c3d4e-5f60-7a8b-9c0d-112233445566",
    });
    expect(bunny.container.querySelector("iframe").getAttribute("src")).toBe(
      "https://iframe.mediadelivery.net/embed/12345/1b2c3d4e-5f60-7a8b-9c0d-112233445566",
    );
    const file = renderSection({
      type: "video",
      url: "https://cdn.example.com/clip.mp4",
    });
    expect(file.container.querySelector("video").getAttribute("src")).toBe(
      "https://cdn.example.com/clip.mp4",
    );
    for (const bad of [
      "javascript:alert(1)",
      "https://evil.example.com/embed/x",
      "https://www.youtube.com/watch?v=<script>",
      "http://cdn.example.com/clip.mp4",
      "data:text/html,<script>alert(1)</script>",
    ]) {
      const r = renderSection({ type: "video", url: bad });
      expect(r.container.querySelector("iframe, video")).toBeNull();
    }
  });

  test("FAQ renders an accessible accordion; quote and text stay plain text", () => {
    const { container } = renderSection({
      type: "faq",
      open_first: true,
      items: [
        { id: "a", q: "When is service?", a: "Sundays at 10." },
        { id: "b", q: "<img src=x onerror=alert(1)>", a: "x" },
        { id: "c", q: "", a: "skipped" },
      ],
    });
    const items = container.querySelectorAll("details.bx-faqItem");
    expect(items).toHaveLength(2);
    expect(items[0].open).toBe(true);
    expect(container.querySelector("img")).toBeNull();
    const q = renderSection({ type: "quote", text: "<b>bold</b>", name: "N" });
    expect(q.container.querySelector("b")).toBeNull();
    expect(q.container.textContent).toContain("<b>bold</b>");
  });

  test("heading uses a safe tag; image keeps its description", () => {
    const h = renderSection({
      type: "heading",
      text: "Hello",
      level: "<script>",
    });
    expect(h.container.querySelector("h2").textContent).toBe("Hello");
    const h1 = renderSection({ type: "heading", text: "Top", level: "h1" });
    expect(h1.container.querySelector("h1")).not.toBeNull();
    const img = renderSection({
      type: "image",
      src: "https://cdn.example.com/a.jpg",
      alt: "Choir",
    });
    expect(img.container.querySelector("img").getAttribute("alt")).toBe(
      "Choir",
    );
  });

  test("a block whose columns is a NUMBER (Cards) does not crash the page", () => {
    // About page crash: blocksDeviceCss treated grid.columns = 3 as a list.
    expect(() =>
      renderSection({
        type: "grid",
        columns: 3,
        items: [{ title: "One" }, { title: "Two" }],
        styles: { m_tablet: { margin_top: "8" } },
      }),
    ).not.toThrow();
  });

  test("Part C: embed uses only an https address; form shows its fields", () => {
    const bad = renderSection({
      type: "embed",
      code: '<script>alert(1)</script><iframe src="http://insecure.example"></iframe>',
    });
    expect(bad.container.querySelector("iframe")).toBeNull();
    const good = renderSection({
      type: "embed",
      code: '<iframe width="560" src="https://open.spotify.com/embed/x" onload="evil()"></iframe>',
    });
    const f = good.container.querySelector("iframe");
    expect(f.getAttribute("src")).toBe("https://open.spotify.com/embed/x");
    expect(f.getAttribute("onload")).toBeNull();
    expect(f.getAttribute("sandbox")).toContain("allow-scripts");
    const form = renderSection({
      type: "form",
      fields: [{ id: "e", label: "Email", type: "email", required: true }],
    });
    expect(
      form.container.querySelector('input[type="email"][required]'),
    ).not.toBeNull();
    expect(
      form.container
        .querySelector('input[name="website"]')
        .closest(".bx-formHp"),
    ).not.toBeNull();
  });

  test("empty border width does not draw a border on column boxes", () => {
    const { container } = renderSection({
      ...SAMPLES.columns,
      styles: { border_width: "", border_color: "", bg_color: "", radius: 14 },
    });
    const box = container.querySelector(".builder-columns");
    expect(box.style.borderStyle).toBe("");
  });
});
