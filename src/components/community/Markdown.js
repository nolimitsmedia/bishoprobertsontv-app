import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeExternalLinks from "rehype-external-links";

/**
 * Drop-in Markdown renderer:
 * - GFM (tables, strikethrough, task lists)
 * - External links open in a new tab safely
 * - Images are responsive & lazy
 */
export default function Markdown({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        [
          rehypeExternalLinks,
          { target: "_blank", rel: ["noopener", "noreferrer"] },
        ],
      ]}
      components={{
        img: (props) => (
          <img
            {...props}
            loading="lazy"
            style={{ maxWidth: "100%", height: "auto", display: "block" }}
          />
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
