// src/components/BlocksEditor/views/Live.tsx
import React, { useMemo } from "react";
import type { FC } from "react";
import renderHtml from "../../core/html"; // <-- uses your updated renderHtml

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type AnyNode = {
  type?: string;
  provider?: "youtube" | "vimeo" | "iframe";
  src?: string;
  style?: any;
};

type Block = {
  id?: string | number;
  type: string;
  props?: Record<string, any>;
  children?: Block[] | Block[][];
};

type PageLike = {
  content_draft?: Block[] | { blocks?: Block[] };
  draft_json?: Block[] | { blocks?: Block[] };
  json?: Block[] | { blocks?: Block[] };
  builder_json?: Block[] | { blocks?: Block[] };
  meta?: { builder_html?: string } | null;
};

/* ------------------------------------------------------------------ */
/* Helpers for page mode                                              */
/* ------------------------------------------------------------------ */
function extractBlocks(page?: PageLike): Block[] {
  if (!page) return [];
  const candidate =
    (page.content_draft as any) ??
    (page.draft_json as any) ??
    (page.json as any) ??
    (page.builder_json as any) ??
    [];
  if (Array.isArray(candidate)) return candidate;
  if (candidate && Array.isArray(candidate.blocks)) return candidate.blocks;
  return [];
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */
type Props =
  | { page: PageLike; className?: string; node?: never } // page renderer mode
  | { node: AnyNode; className?: string; page?: never }; // legacy video block mode

const Live: FC<Props> = (props) => {
  // ----------------------- PAGE RENDERER MODE -----------------------
  if ("page" in props && props.page) {
    const { page, className } = props;

    const html = useMemo(() => {
      // Prefer prebuilt HTML from publish step
      const prebuilt = page?.meta && (page.meta as any).builder_html;
      if (typeof prebuilt === "string" && prebuilt.trim().length) {
        return prebuilt; // do NOT strip styles
      }
      // Fallback: build from blocks with updated renderer
      const blocks = extractBlocks(page);
      return renderHtml(blocks);
    }, [page]);

    return (
      <div
        className={className}
        // IMPORTANT: do not sanitize styles here or the backgroundImage will be removed
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // --------------------- LEGACY VIDEO BLOCK MODE --------------------
  const node = (props as { node: AnyNode }).node || {};
  const p = node.provider || "iframe";
  const src = node.src || "";
  const aspect = node.style?.aspect ?? 9 / 16; // height/width
  const radius = node.style?.radius ? Number(node.style.radius) : 10;

  const box: React.CSSProperties = {
    position: "relative",
    width: "100%",
    paddingTop: `${aspect * 100}%`,
    overflow: "hidden",
    borderRadius: radius,
    background: "#000",
  };
  const frame: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    border: 0,
  };

  // Allow direct iframe src (HLS player, etc.)
  if (p === "iframe") {
    return (
      <div style={box}>
        <iframe
          src={src}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          style={frame}
          title="Live"
        />
      </div>
    );
  }

  // YouTube/Vimeo URL → embed src
  const yt = /youtu\.?be/.test(src);
  const vm = /vimeo\.com/.test(src);
  let embed = src;

  if (p === "youtube" || yt) {
    const id =
      src
        .split(/v=|be\//)
        .pop()
        ?.split(/[?&]/)[0] ?? "";
    embed = `https://www.youtube.com/embed/${id}`;
  } else if (p === "vimeo" || vm) {
    const id = src.split("/").pop() ?? "";
    embed = `https://player.vimeo.com/video/${id}`;
  }

  return (
    <div style={box}>
      <iframe
        src={embed}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        style={frame}
        title="Live"
      />
    </div>
  );
};

export default Live;
