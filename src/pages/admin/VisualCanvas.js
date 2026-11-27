// src/pages/admin/VisualCanvas.js
//
// Visual editor: the real public page, rendered from the editor's unsaved
// draft inside an iframe in the page editor.
//  Stage 1: hover outline, click to select (opens the inspector), no navigation.
//  Stage 2: double-click text to type on the page; a toolbar on the selected
//           section/block (drag, up, down, duplicate, delete); "+ Add block"
//           and "+ Add section"; drag and drop to reorder.
// Nothing is saved here. Every change is sent to the editor window, which owns
// the draft (so undo, unsaved-changes and Save Draft keep working).

import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import BuilderPage from "../public/BuilderPage";
import { CanvasContext } from "../../components/builder/canvasContext";
import { STORY_PANEL } from "../../components/builder/storyBlocks";

const HomePage = lazy(() => import("../public/Home"));

const MARK = "[data-bx-block],[data-bx-section]";
const ADDABLE = [
  ["richtext", "Text", "¶"],
  ["button", "Button", "▣"],
  ["video", "Video", "▶"],
  ["quote", "Quote", "❝"],
  ["faq", "FAQ", "?"],
  ["gallery", "Gallery", "▦"],
  ["grid", "Cards", "▤"],
  ["spacer", "Spacer", "↕"],
  ["heading", "Heading", "H"],
  ["image", "Image", "🖼"],
  ["divider", "Divider", "—"],
  ["videos", "Video gallery", "▶▶"],
  ["container", "Container", "▢"],
  ["columns", "Columns", "▥"],
  ["form", "Form", "✉"],
  ["icon", "Icon", "★"],
  ["iconlist", "Icon list", "☰"],
  ["slider", "Image slider", "⇆"],
  ["testimonials", "Testimonials", "❞"],
  ["countdown", "Countdown", "⏱"],
  ["map", "Google Map", "⌖"],
  ["social", "Social icons", "＠"],
  ["embed", "Embed", "</>"],
  ...STORY_PANEL,
];

function boxOf(el) {
  if (!el) return null;
  const rects = (
    getComputedStyle(el).display === "contents"
      ? [...el.children].map((c) => c.getBoundingClientRect())
      : [el.getBoundingClientRect()]
  ).filter((r) => r.width || r.height);
  if (!rects.length) return null;
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return {
    left: left + window.scrollX,
    top: top + window.scrollY,
    width: right - left,
    height: bottom - top,
  };
}

function place(node, b) {
  if (!node) return;
  if (!b) {
    node.style.display = "none";
    return;
  }
  Object.assign(node.style, {
    display: "block",
    left: `${b.left - 2}px`,
    top: `${b.top - 2}px`,
    width: `${b.width + 4}px`,
    height: `${b.height + 4}px`,
  });
}

function postToEditor(message) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, window.location.origin);
  }
}

// Ids of the columns/blocks between the top-level block and el (excluding the
// top block itself): [colId, blockId, colId, ...].
function pathBetween(el, topEl) {
  const ids = [];
  for (let n = el; n && n !== topEl; n = n.parentElement) {
    if (n.hasAttribute?.("data-bx-column"))
      ids.unshift(n.getAttribute("data-bx-column"));
    else if (n.hasAttribute?.("data-bx-block"))
      ids.unshift(n.getAttribute("data-bx-block"));
  }
  return ids;
}
const sel = (attr, id) =>
  id ? document.querySelector(`[${attr}="${CSS.escape(String(id))}"]`) : null;
const isCoreSection = (sec) =>
  String(sec?.id || "").startsWith("core-") ||
  (Array.isArray(sec?.blocks) &&
    sec.blocks.some((b) =>
      /^home_|^featured_live$|^latest_teaching$/.test(String(b?.type || "")),
    ));
const isTwoCol = (sec) =>
  /twocol|2col/.test(
    String(sec?.layout || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ""),
  );

export default function VisualCanvas() {
  const [page, setPage] = useState(null);
  // path: from the top-level block down: [colId, blockId, colId, ...]
  const [selected, setSelected] = useState({
    sectionId: "",
    blockId: "",
    label: "",
    path: [],
  });
  const selPathKey = (selected.path || []).join("/");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(""); // block id being typed in
  const hoverRef = useRef(null);
  const selectRef = useRef(null);
  const toolsRef = useRef(null);
  const addRef = useRef(null);
  const dropRef = useRef(null);
  const pendingPage = useRef(null);
  const pendingSelect = useRef(null);
  const editingRef = useRef("");
  const pageRef = useRef(null);
  pageRef.current = page;
  const selectedRef = useRef({ sectionId: "", blockId: "" });

  // Type of a top-level block (from the page data; refs keep it current inside
  // event handlers registered once).
  function topBlockType(blockId) {
    const secs = pageRef.current?.content_json?.extra_sections || [];
    const walk = (list) => {
      for (const blk of list || []) {
        if (String(blk?.id) === String(blockId))
          return String(blk.type || "richtext");
        // only Columns / Container blocks hold a LIST of columns; Cards use
        // "columns" as a number (that crashed the editor on pages like About)
        for (const c of Array.isArray(blk?.columns) ? blk.columns : []) {
          const t = walk(c?.blocks);
          if (t) return t;
        }
      }
      return "";
    };
    for (const sec of secs) {
      const t = walk(sec?.blocks);
      if (t) return t;
    }
    return "";
  }

  selectedRef.current = selected;
  const sections = Array.isArray(page?.content_json?.extra_sections)
    ? page.content_json.extra_sections
    : [];
  const secById = (id) => sections.find((s) => String(s?.id) === String(id));
  const selSection = secById(selected.sectionId);
  const selIsCore = isCoreSection(selSection);

  // ---- messages from the editor (same site only) ----
  useEffect(() => {
    function onMessage(e) {
      if (e.origin !== window.location.origin || e.source !== window.parent)
        return;
      const d = e.data || {};
      if (d.type === "brtv:draft" && d.page && typeof d.page === "object") {
        // While typing on the page, hold updates so the cursor isn't reset.
        if (editingRef.current) pendingPage.current = d.page;
        else setPage(d.page);
      }
      if (d.type === "brtv:select") {
        const next = {
          sectionId: String(d.sectionId || ""),
          blockId: String(d.blockId || ""),
          label: String(d.label || ""),
          path: Array.isArray(d.path) ? d.path.map(String) : [],
        };
        // No re-render while typing on the page (it would reset the text).
        if (editingRef.current) pendingSelect.current = next;
        else {
          setSelected(next);
          setMenuOpen(false);
        }
      }
    }
    window.addEventListener("message", onMessage);
    postToEditor({ type: "brtv:canvas-ready" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // ---- typing on the page ----
  // fieldEl: a Home built-in text (plain text); otherwise a Text block (HTML).
  // innerEl/path: a Text element inside (nested) columns of the top block blockEl.
  function startEditing(blockEl, fieldEl = null, innerEl = null, path = []) {
    if (fieldEl) return startFieldEditing(blockEl, fieldEl);
    const textEl = innerEl || blockEl;
    if (topBlockType(textEl?.getAttribute?.("data-bx-block")) !== "richtext")
      return false;
    const target = textEl?.querySelector?.(".builder-richtext");
    if (!target) return false;
    const editPath = innerEl ? path : [];
    const blockId = blockEl.getAttribute("data-bx-block");
    const sectionId =
      blockEl.closest("[data-bx-section]")?.getAttribute("data-bx-section") ||
      "";
    editingRef.current = blockId;
    setEditing(blockId);
    // Text blocks render their HTML with dangerouslySetInnerHTML, so React does
    // not manage the children and they can be edited in place.
    target.setAttribute("contenteditable", "true");
    target.classList.add("vc-editing");
    window.focus(); // make sure keystrokes come to this page, not the editor
    target.focus();
    let timer = 0;
    const send = () =>
      postToEditor({
        type: "brtv:edit-html",
        sectionId,
        blockId,
        path: editPath,
        html: target.innerHTML,
      });
    const onInput = () => {
      clearTimeout(timer);
      timer = setTimeout(send, 250);
    };
    const onPaste = (e) => {
      e.preventDefault(); // keep pasted text clean
      const text = e.clipboardData?.getData("text/plain") || "";
      document.execCommand("insertText", false, text);
    };
    const finish = () => {
      clearTimeout(timer);
      send();
      target.removeAttribute("contenteditable");
      target.classList.remove("vc-editing");
      target.removeEventListener("input", onInput);
      target.removeEventListener("blur", finish);
      target.removeEventListener("keydown", onKey);
      target.removeEventListener("paste", onPaste);
      endEditing();
    };
    const onKey = (e) => {
      if (e.key === "Escape") target.blur();
    };
    target.addEventListener("input", onInput);
    target.addEventListener("blur", finish);
    target.addEventListener("keydown", onKey);
    target.addEventListener("paste", onPaste);
    return true;
  }

  // Home built-in texts are rendered by React components, so their elements
  // must not be edited in place (React would lose track of them). Instead an
  // editable copy is laid exactly over the text, outside React, and removed
  // when typing ends; the editor then re-renders the page with the new text.
  function startFieldEditing(blockEl, fieldEl) {
    const field = fieldEl.getAttribute("data-bx-field");
    const blockId = blockEl.getAttribute("data-bx-block");
    const sectionId =
      blockEl.closest("[data-bx-section]")?.getAttribute("data-bx-section") ||
      "";
    const multiline = ["sub", "text", "title"].includes(field);
    // Measure the visible text (the field element may be display:inline).
    const host =
      getComputedStyle(fieldEl).display === "inline" && fieldEl.parentElement
        ? fieldEl.parentElement
        : fieldEl;
    const b = boxOf(fieldEl) || boxOf(host);
    if (!b) return false;
    const cs = getComputedStyle(fieldEl);
    const overlay = document.createElement("div");
    overlay.className = "vc-fieldEditor";
    overlay.setAttribute("contenteditable", "plaintext-only");
    if (overlay.contentEditable !== "plaintext-only")
      overlay.setAttribute("contenteditable", "true");
    overlay.setAttribute("role", "textbox");
    overlay.setAttribute("aria-label", `Edit ${field}`);
    // Start from the stored text, not the displayed text: CSS may show it in
    // capitals, and that styling must not be saved into the text itself.
    const stored = (() => {
      const secs = pageRef.current?.content_json?.extra_sections || [];
      for (const sec of secs) {
        const blk = (sec?.blocks || []).find(
          (x) => String(x?.id) === String(blockId),
        );
        if (blk) return blk[field];
      }
      return undefined;
    })();
    overlay.textContent =
      typeof stored === "string"
        ? stored
        : field === "title"
          ? String(fieldEl.innerText || "").replace(/\s*\n\s*/g, " ")
          : String(fieldEl.textContent || "");
    const props = [
      "fontFamily",
      "fontSize",
      "fontWeight",
      "fontStyle",
      "lineHeight",
      "letterSpacing",
      "textAlign",
      "color",
      "wordSpacing",
    ];
    for (const k of props) overlay.style[k] = cs[k];
    overlay.style.textTransform = "none"; // show exactly what will be saved
    if (cs.color === "rgba(0, 0, 0, 0)" || !cs.color)
      overlay.style.color = "#fff";
    Object.assign(overlay.style, {
      position: "absolute",
      left: `${b.left}px`,
      top: `${b.top}px`,
      minWidth: `${Math.max(40, b.width)}px`,
      minHeight: `${b.height}px`,
      maxWidth: `${Math.max(b.width, Math.min(window.innerWidth - b.left - 8, b.width + 300))}px`,
      whiteSpace: multiline ? "pre-wrap" : "nowrap",
    });
    fieldEl.style.visibility = "hidden";
    document.body.appendChild(overlay);
    editingRef.current = blockId;
    setEditing(blockId);
    window.focus();
    overlay.focus();
    const range = document.createRange();
    range.selectNodeContents(overlay);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const value = () => {
      const t = String(overlay.innerText || "").replace(/\u00a0/g, " ");
      if (field === "title") return t.replace(/\s*\n\s*/g, " ").trim();
      return multiline
        ? t.replace(/\n{3,}/g, "\n\n").trim()
        : t.replace(/\s+/g, " ").trim();
    };
    let timer = 0;
    const send = () =>
      postToEditor({
        type: "brtv:edit-field",
        sectionId,
        blockId,
        field,
        value: value(),
      });
    const onInput = () => {
      clearTimeout(timer);
      timer = setTimeout(send, 250);
    };
    const onPaste = (e) => {
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") || "";
      document.execCommand("insertText", false, text);
    };
    const onKey = (e) => {
      if (e.key === "Escape") overlay.blur();
      // Single-line texts and the headline: Enter finishes.
      if (e.key === "Enter" && (!multiline || field === "title")) {
        e.preventDefault();
        overlay.blur();
      }
    };
    const finish = () => {
      clearTimeout(timer);
      send();
      overlay.removeEventListener("input", onInput);
      overlay.removeEventListener("blur", finish);
      overlay.removeEventListener("keydown", onKey);
      overlay.removeEventListener("paste", onPaste);
      overlay.remove();
      fieldEl.style.visibility = "";
      endEditing();
    };
    overlay.addEventListener("input", onInput);
    overlay.addEventListener("blur", finish);
    overlay.addEventListener("keydown", onKey);
    overlay.addEventListener("paste", onPaste);
    return true;
  }

  function endEditing() {
    editingRef.current = "";
    setEditing("");
    if (pendingPage.current) {
      setPage(pendingPage.current);
      pendingPage.current = null;
    }
    if (pendingSelect.current) {
      setSelected(pendingSelect.current);
      pendingSelect.current = null;
    }
  }

  // ---- hover, click, double-click ----
  useEffect(() => {
    function find(t) {
      // A click on a heading or paragraph that holds exactly one editable text
      // counts as that text (like clicking the text itself).
      let fieldEl = t?.closest?.("[data-bx-field]") || null;
      if (!fieldEl && t?.querySelectorAll) {
        const inner = t.querySelectorAll("[data-bx-field]");
        if (inner.length === 1) fieldEl = inner[0];
      }
      const el = t?.closest?.(MARK);
      if (!el) return {};
      // Nearest marked element under the pointer: a column or an element (at any
      // depth inside containers). blockEl = the top-level block of the section.
      const near = t.closest("[data-bx-block],[data-bx-column]");
      let blockEl = near
        ? near.matches("[data-bx-block]")
          ? near
          : near.closest("[data-bx-block]")
        : null;
      for (
        let up = blockEl?.parentElement?.closest("[data-bx-block]");
        up;
        up = up.parentElement?.closest("[data-bx-block]")
      ) {
        blockEl = up;
      }
      const path =
        near && blockEl && near !== blockEl ? pathBetween(near, blockEl) : [];
      const isCol = path.length % 2 === 1;
      const colEl = isCol ? near : null;
      const innerEl = path.length && !isCol ? near : null;
      const sectionEl = (blockEl || el).closest("[data-bx-section]");
      return {
        el: fieldEl || near || sectionEl,
        blockEl,
        sectionEl,
        fieldEl,
        innerEl,
        colEl,
        path,
      };
    }
    const inUi = (t) => !!t?.closest?.(".vc-ui");
    const inEditing = (t) => !!t?.closest?.(".vc-editing, .vc-fieldEditor");
    function onMove(e) {
      if (inUi(e.target) || editingRef.current) return;
      const { el, blockEl, fieldEl } = find(e.target);
      const node = hoverRef.current;
      if (!el) return place(node, null);
      const selNow = selectedRef.current;
      const hoverId =
        el.getAttribute("data-bx-block") ||
        el.getAttribute("data-bx-column") ||
        "";
      const selP = Array.isArray(selNow.path) ? selNow.path : [];
      const selId = selP.length ? selP[selP.length - 1] : selNow.blockId;
      const isSelected =
        !fieldEl &&
        ((hoverId && hoverId === selId) ||
          (!blockEl &&
            el.getAttribute("data-bx-section") === selNow.sectionId &&
            !selNow.blockId));
      if (isSelected) return place(node, null); // already outlined
      place(node, boxOf(el));
      const tag = node?.firstChild;
      if (tag) {
        const { innerEl: hovInner, colEl: hovCol } = find(e.target);
        const rich =
          topBlockType(
            (hovInner || blockEl)?.getAttribute?.("data-bx-block"),
          ) === "richtext";
        if (hovCol && !hovInner && !fieldEl) {
          tag.textContent = "Click to select this column";
          return;
        }
        tag.textContent = fieldEl
          ? "Click to edit · double-click to type"
          : blockEl
            ? rich
              ? "Click to edit · double-click to type"
              : "Click to edit"
            : "Click to edit this section";
      }
    }
    function onClick(e) {
      if (inUi(e.target) || inEditing(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const { blockEl, sectionEl, fieldEl } = find(e.target);
      if (!sectionEl && !blockEl) return;
      postToEditor({
        type: "brtv:selected",
        sectionId: sectionEl?.getAttribute("data-bx-section") || "",
        blockId: blockEl?.getAttribute("data-bx-block") || "",
        field: fieldEl?.getAttribute("data-bx-field") || "",
        path: find(e.target).path || [],
      });
    }
    function onDbl(e) {
      if (inUi(e.target) || inEditing(e.target)) return;
      const { blockEl, fieldEl, innerEl, path } = find(e.target);
      if (blockEl && startEditing(blockEl, fieldEl, innerEl, path || [])) {
        e.preventDefault();
        place(hoverRef.current, null);
      }
    }
    const stop = (e) => e.preventDefault();
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("dblclick", onDbl, true);
    document.addEventListener("submit", stop, true);
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("dblclick", onDbl, true);
      document.removeEventListener("submit", stop, true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- uses refs and stable setters only

  // ---- keep selection outline, toolbar and add buttons in place ----
  useEffect(() => {
    let frame = 0;
    function draw() {
      const sp = Array.isArray(selected.path) ? selected.path : [];
      const last = sp[sp.length - 1];
      const el = sp.length
        ? sp.length % 2 === 1
          ? sel("data-bx-column", last)
          : sel("data-bx-block", last)
        : selected.blockId
          ? sel("data-bx-block", selected.blockId)
          : sel("data-bx-section", selected.sectionId);
      const b = boxOf(el);
      place(selectRef.current, b);
      const lab = selectRef.current?.firstChild;
      if (lab)
        lab.textContent =
          sp.length % 2 === 1
            ? "Selected column"
            : selected.label ||
              (selected.blockId ? "Selected block" : "Selected section");
      const tools = toolsRef.current;
      if (tools) {
        // A column on its own has no toolbar (its settings are on the left).
        if (b && !selIsCore && sp.length % 2 === 0) {
          tools.style.display = "flex";
          tools.style.left = `${Math.max(4, b.left + b.width - tools.offsetWidth)}px`;
          tools.style.top = `${Math.max(4, b.top - 40)}px`;
        } else tools.style.display = "none";
      }
      const secEl = sel("data-bx-section", selected.sectionId);
      const sb = boxOf(secEl);
      const add = addRef.current;
      if (add) {
        if (sb && !editing) {
          add.style.display = "flex";
          add.style.left = `${sb.left + sb.width / 2 - add.offsetWidth / 2}px`;
          add.style.top = `${sb.top + sb.height - 18}px`;
        } else add.style.display = "none";
      }
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    }
    schedule();
    const t = setInterval(draw, 500);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(t);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [selected, page, editing, menuOpen, selIsCore]);

  // A new selection replaces the hover outline (the mouse is usually still on it).
  useEffect(() => {
    place(hoverRef.current, null);
  }, [selected.blockId, selected.sectionId, selPathKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bring a newly selected item into view.
  useEffect(() => {
    const sp = Array.isArray(selected.path) ? selected.path : [];
    const el = sp.length
      ? sp.length % 2 === 1
        ? sel("data-bx-column", sp[sp.length - 1])
        : sel("data-bx-block", sp[sp.length - 1])
      : selected.blockId
        ? sel("data-bx-block", selected.blockId)
        : sel("data-bx-section", selected.sectionId);
    const b = boxOf(el);
    if (!b) return;
    if (
      b.top < window.scrollY + 40 ||
      b.top > window.scrollY + window.innerHeight - 40
    ) {
      window.scrollTo({ top: Math.max(0, b.top - 90), behavior: "smooth" });
    }
  }, [selected.blockId, selected.sectionId, selPathKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- drop elements dragged from the editor's Elements panel ----
  const dropZoneRef = useRef(null);
  useEffect(() => {
    const TYPE = "application/x-brtv-element";
    const isElementDrag = (e) =>
      Array.from(e.dataTransfer?.types || []).includes(TYPE);
    const outerBlocks = (secEl) =>
      [...secEl.querySelectorAll("[data-bx-block]")].filter(
        (el) =>
          el.closest("[data-bx-section]") === secEl &&
          !el.parentElement.closest("[data-bx-block]"),
      );
    let target = null;
    function locate(e) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return null;
      if (dropZoneRef.current && dropZoneRef.current.contains(el))
        return { kind: "end" };
      const colEl = el.closest("[data-bx-column]");
      const secEl = el.closest("[data-bx-section]");
      if (!secEl) return null;
      const sectionId = secEl.getAttribute("data-bx-section");
      const secData = (
        pageRef.current?.content_json?.extra_sections || []
      ).find((x) => String(x?.id) === sectionId);
      if (isCoreSection(secData))
        return { kind: "after", sectionId, box: boxOf(secEl), y: "bottom" };
      if (colEl) {
        let top = colEl.closest("[data-bx-block]");
        for (
          let up = top?.parentElement?.closest("[data-bx-block]");
          up;
          up = up.parentElement?.closest("[data-bx-block]")
        )
          top = up;
        const colPath = pathBetween(colEl, top);
        const kids = [...colEl.querySelectorAll("[data-bx-block]")].filter(
          (k) => k.parentElement.closest("[data-bx-column]") === colEl,
        );
        const y = e.clientY + window.scrollY;
        let index = kids.length;
        for (let i = 0; i < kids.length; i++) {
          const kb = boxOf(kids[i]);
          if (kb && y < kb.top + kb.height / 2) {
            index = i;
            break;
          }
        }
        return {
          kind: "column",
          sectionId,
          blockId: top?.getAttribute("data-bx-block") || "",
          path: colPath,
          index,
          box: boxOf(colEl),
        };
      }
      const y = e.clientY + window.scrollY;
      const blocks = outerBlocks(secEl);
      let index = blocks.length;
      let lineY = null;
      let ref = boxOf(secEl);
      for (let i = 0; i < blocks.length; i++) {
        const b = boxOf(blocks[i]);
        if (!b) continue;
        if (y < b.top + b.height / 2) {
          index = i;
          lineY = b.top - 4;
          ref = b;
          break;
        }
        lineY = b.top + b.height + 4;
        ref = b;
      }
      if (lineY == null && ref) lineY = ref.top + ref.height / 2;
      return {
        kind: "section",
        sectionId,
        index,
        line: { left: ref?.left || 0, width: ref?.width || 0, top: lineY },
      };
    }
    function show(t) {
      const drop = dropRef.current;
      const zone = dropZoneRef.current;
      if (zone) zone.classList.toggle("is-over", t?.kind === "end");
      if (!drop) return;
      if (t?.kind === "section" || t?.kind === "after") {
        const line =
          t.kind === "after"
            ? {
                left: t.box.left,
                width: t.box.width,
                top: t.box.top + t.box.height + 4,
              }
            : t.line;
        Object.assign(drop.style, {
          display: "block",
          left: `${line.left}px`,
          width: `${line.width}px`,
          top: `${line.top - 2}px`,
          height: "4px",
        });
        drop.classList.remove("is-box");
      } else if (t?.kind === "column" && t.box) {
        Object.assign(drop.style, {
          display: "block",
          left: `${t.box.left}px`,
          width: `${t.box.width}px`,
          top: `${t.box.top}px`,
          height: `${t.box.height}px`,
        });
        drop.classList.add("is-box");
      } else {
        drop.style.display = "none";
      }
    }
    function onOver(e) {
      if (!isElementDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      target = locate(e);
      show(target);
    }
    function onLeave(e) {
      if (e.relatedTarget) return;
      target = null;
      show(null);
    }
    function onDrop(e) {
      if (!isElementDrag(e)) return;
      e.preventDefault();
      const type = e.dataTransfer.getData(TYPE);
      const t = target || locate(e);
      show(null);
      target = null;
      if (!type || !t) return;
      if (t.kind === "column")
        postToEditor({
          type: "brtv:insert-block",
          blockType: type,
          sectionId: t.sectionId,
          blockId: t.blockId,
          path: t.path,
          index: t.index,
        });
      else if (t.kind === "section")
        postToEditor({
          type: "brtv:insert-block",
          blockType: type,
          sectionId: t.sectionId,
          index: t.index,
        });
      else if (t.kind === "after")
        postToEditor({
          type: "brtv:insert-block",
          blockType: type,
          sectionId: t.sectionId,
        });
      else
        postToEditor({
          type: "brtv:insert-block",
          blockType: type,
          sectionId: "",
        });
    }
    document.addEventListener("dragover", onOver);
    document.addEventListener("dragleave", onLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onOver);
      document.removeEventListener("dragleave", onLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, []);

  // ---- keyboard: Delete, Ctrl/Cmd+D, Esc (not while typing) ----
  useEffect(() => {
    function onKey(e) {
      if (editingRef.current) return;
      const t = e.target;
      if (
        t &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      )
        return;
      const sel = selectedRef.current;
      if (!sel.sectionId) return;
      const core = isCoreSection(
        (pageRef.current?.content_json?.extra_sections || []).find(
          (x) => String(x?.id) === sel.sectionId,
        ),
      );
      if (e.key === "Escape") {
        postToEditor({ type: "brtv:deselect" });
        return;
      }
      const kp = Array.isArray(sel.path) ? sel.path : [];
      const payload = {
        sectionId: sel.sectionId,
        blockId: sel.blockId,
        path: kp,
      };
      // Copy / paste work on elements and into columns (not on Home's built-in parts).
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "c" || e.key === "C") &&
        !core &&
        sel.blockId
      ) {
        if (String(window.getSelection?.() || "")) return; // copying selected text
        e.preventDefault();
        postToEditor({ type: "brtv:copy", ...payload });
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "v" || e.key === "V") &&
        !core
      ) {
        e.preventDefault();
        postToEditor({ type: "brtv:paste", ...payload });
        return;
      }
      if (core || kp.length % 2 === 1) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        postToEditor({ type: "brtv:delete", ...payload });
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        postToEditor({ type: "brtv:duplicate", ...payload });
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ---- toolbar actions ----
  function act(kind, extra = {}) {
    postToEditor({
      type: `brtv:${kind}`,
      sectionId: selected.sectionId,
      blockId: selected.blockId,
      path: Array.isArray(selected.path) ? selected.path : [],
      ...extra,
    });
  }
  function moveBy(dir) {
    if ((selected.path || []).length) {
      act("move-block", { dir });
      return;
    }
    const sec = secById(selected.sectionId);
    if (selected.blockId) {
      const blocks = Array.isArray(sec?.blocks) ? sec.blocks : [];
      const i = blocks.findIndex((b) => String(b?.id) === selected.blockId);
      const to = i + dir;
      if (i >= 0 && to >= 0 && to < blocks.length)
        act("move-block", { toIndex: to });
    } else {
      const i = sections.findIndex((s) => String(s?.id) === selected.sectionId);
      const to = i + dir;
      if (i >= 0 && to >= 0 && to < sections.length)
        act("move-section", { toIndex: to });
    }
  }

  // ---- drag and drop (handle on the toolbar) ----
  function startDrag(e) {
    e.preventDefault();
    const isBlock = !!selected.blockId;
    const secEl = sel("data-bx-section", selected.sectionId);
    let items; // [{id, el}] in page order
    if (isBlock) {
      const sec = secById(selected.sectionId);
      if (isTwoCol(sec)) return; // columns: use the arrows
      items = [...(secEl?.querySelectorAll("[data-bx-block]") || [])]
        .filter((el) => el.closest("[data-bx-section]") === secEl)
        .map((el) => ({ id: el.getAttribute("data-bx-block"), el }));
    } else {
      items = [...document.querySelectorAll("[data-bx-section]")].map((el) => ({
        id: el.getAttribute("data-bx-section"),
        el,
      }));
    }
    const dragId = isBlock ? selected.blockId : selected.sectionId;
    const drop = dropRef.current;
    let target = null; // { afterId | beforeId }
    function onMove(ev) {
      const y = ev.clientY + window.scrollY;
      let best = null;
      for (const it of items) {
        const b = boxOf(it.el);
        if (!b) continue;
        const mid = b.top + b.height / 2;
        if (y < mid) {
          best = { beforeId: it.id, y: b.top - 4, b };
          break;
        }
        best = { afterId: it.id, y: b.top + b.height + 4, b };
      }
      if (!best || !drop) return;
      target = best;
      Object.assign(drop.style, {
        display: "block",
        left: `${best.b.left}px`,
        width: `${best.b.width}px`,
        top: `${best.y - 2}px`,
      });
      if (ev.clientY < 60) window.scrollBy(0, -12);
      if (ev.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      if (drop) drop.style.display = "none";
      if (!target) return;
      // Translate "before/after this item" into a data index.
      const list = isBlock
        ? (secById(selected.sectionId)?.blocks || []).map((b) => String(b?.id))
        : sections.map((s) => String(s?.id));
      const from = list.indexOf(String(dragId));
      const anchor = list.indexOf(String(target.beforeId || target.afterId));
      if (from < 0 || anchor < 0) return;
      let to = target.beforeId ? anchor : anchor + 1;
      if (from < to) to -= 1;
      if (to === from) return;
      act(isBlock ? "move-block" : "move-section", { toIndex: to });
    }
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
  }

  const isHome = String(page?.slug || "").toLowerCase() === "home";
  const selPath = Array.isArray(selected.path) ? selected.path : [];
  const selIsColumn = selPath.length % 2 === 1;
  const canAddBlock = selSection && !selIsCore;

  return (
    <CanvasContext.Provider value={true}>
      <style>{`
        [data-bx-block] iframe, [data-bx-block] video { pointer-events: none; }
        [data-bx-block], [data-bx-section] { cursor: pointer; }
        .vc-editing { outline: 2px solid #22c55e; outline-offset: 4px; cursor: text; border-radius: 4px; }
        .vc-fieldEditor { z-index: 2147483400; outline: 2px solid #22c55e; outline-offset: 4px; border-radius: 4px;
                          background: rgba(0, 0, 0, 0.35); cursor: text; box-sizing: border-box; margin: 0; padding: 0; }
        .vc-box { position: absolute; display: none; pointer-events: none; z-index: 2147483000;
                  border-radius: 6px; box-sizing: border-box; }
        .vc-box > span { position: absolute; top: -26px; left: -2px; padding: 3px 10px; border-radius: 6px 6px 6px 0;
                  font: 600 13px/18px system-ui, sans-serif; white-space: nowrap; color: #fff; }
        .vc-hover { border: 2px dashed rgba(167, 139, 250, 0.9); }
        .vc-hover > span { background: rgba(124, 58, 237, 0.85); }
        .vc-selected { border: 2px solid #f59e0b; box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.18); }
        .vc-selected > span { background: #d97706; }
        .vc-ui { position: absolute; z-index: 2147483600; font: 600 14px/1 system-ui, sans-serif; }
        .vc-tools { display: none; gap: 2px; padding: 3px; border-radius: 8px; background: #1f1d2b;
                    box-shadow: 0 6px 20px rgba(0,0,0,.45); }
        .vc-tools button, .vc-add button, .vc-menu button {
          appearance: none; border: 0; border-radius: 6px; background: transparent; color: #fff;
          padding: 8px 11px; cursor: pointer; font: inherit; min-width: 34px; }
        .vc-tools button:hover, .vc-menu button:hover { background: #3b3550; }
        .vc-tools button:focus-visible, .vc-add button:focus-visible, .vc-menu button:focus-visible { outline: 2px solid #a78bfa; }
        .vc-tools .vc-danger:hover { background: #7f1d1d; }
        .vc-tools .vc-drag { cursor: grab; touch-action: none; }
        .vc-add { display: none; gap: 6px; z-index: 2147483646 !important; }
        .vc-add button { background: #7c3aed; box-shadow: 0 4px 14px rgba(124,58,237,.45); }
        .vc-add button.vc-secondary { background: #2b2838; }
        .vc-menu { position: absolute; top: 44px; left: 50%; transform: translateX(-50%); display: grid;
                   grid-template-columns: repeat(4, 86px); gap: 6px; padding: 10px; border-radius: 12px;
                   background: #1f1d2b; box-shadow: 0 14px 40px rgba(0,0,0,.6); border: 1px solid #3b3550; }
        .vc-add .vc-menu button { display: grid; justify-items: center; align-content: center; gap: 6px;
                   width: 86px; height: 72px; padding: 6px; border-radius: 10px; background: #2b2838;
                   box-shadow: none; font: 600 13px/1.1 system-ui, sans-serif; white-space: nowrap; }
        .vc-add .vc-menu button:hover { background: #4c1d95; }
        .vc-menu .vc-ic { font-size: 22px; line-height: 1; color: #c4b5fd; }
        /* empty Text element: visible and clickable in the editor */
        [data-bx-block] .builder-richtext:empty { min-height: 44px; border: 2px dashed rgba(167,139,250,.55);
                   border-radius: 8px; }
        [data-bx-block] .builder-richtext:empty:not(.vc-editing)::before { content: "Empty text — double-click to type";
                   display: block; padding: 10px; color: rgba(255,255,255,.6); font: 600 14px system-ui, sans-serif; }
        /* hidden on this device: still shown in the editor, faded (like Elementor) */
        @media (min-width: 1025px) { .bx-hide-d { display: block !important; opacity: .35;
                   outline: 2px dashed rgba(255,255,255,.35); outline-offset: 2px; } }
        @media (min-width: 768px) and (max-width: 1024px) { .bx-hide-t { display: block !important; opacity: .35;
                   outline: 2px dashed rgba(255,255,255,.35); outline-offset: 2px; } }
        @media (max-width: 767px) { .bx-hide-m { display: block !important; opacity: .35;
                   outline: 2px dashed rgba(255,255,255,.35); outline-offset: 2px; } }
        .vc-drop { position: absolute; display: none; height: 4px; border-radius: 2px; background: #22c55e;
                   z-index: 2147483500; pointer-events: none; box-shadow: 0 0 0 3px rgba(34,197,94,.25); }
        /* embedded pages (maps, embeds, videos) don't take clicks in the editor */
        [data-bx-block] iframe { pointer-events: none; }
        .vc-menu { grid-template-columns: repeat(5, 86px) !important; max-height: 70vh; overflow: auto; }
        .vc-drop.is-box { background: rgba(34,197,94,.12); border: 2px solid #22c55e; border-radius: 8px; box-shadow: none; }
        .vc-dropZone { position: relative !important; z-index: 0 !important; display: grid; justify-items: center; gap: 8px; max-width: 1100px;
                   margin: 24px auto 40px; padding: 26px 16px; border: 2px dashed rgba(167,139,250,.5); border-radius: 14px;
                   color: rgba(255,255,255,.7); font: 600 14px/1.4 system-ui, sans-serif; text-align: center; }
        .vc-dropZone p { margin: 0; }
        .vc-dropZone.is-over { border-color: #22c55e; background: rgba(34,197,94,.08); color: #fff; }
        .vc-dropAdd { width: 44px; height: 44px; border-radius: 50%; border: 0; background: #7c3aed; color: #fff;
                   font-size: 22px; cursor: pointer; box-shadow: 0 4px 14px rgba(124,58,237,.45); }
        .vc-dropAdd:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
      `}</style>
      <div ref={hoverRef} className="vc-box vc-hover" aria-hidden="true">
        <span />
      </div>
      <div ref={selectRef} className="vc-box vc-selected" aria-hidden="true">
        <span />
      </div>
      <div ref={dropRef} className="vc-drop" aria-hidden="true" />

      <div
        ref={toolsRef}
        className="vc-ui vc-tools"
        role="toolbar"
        aria-label="Selected item"
      >
        {!(selected.blockId && isTwoCol(selSection)) && !selPath.length ? (
          <button
            type="button"
            className="vc-drag"
            title="Drag to move"
            aria-label="Drag to move"
            onPointerDown={startDrag}
          >
            ⠿
          </button>
        ) : null}
        <button
          type="button"
          title="Move up"
          aria-label="Move up"
          onClick={() => moveBy(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          title="Move down"
          aria-label="Move down"
          onClick={() => moveBy(1)}
        >
          ↓
        </button>
        <button
          type="button"
          title="Duplicate"
          aria-label="Duplicate"
          onClick={() => act("duplicate")}
        >
          ⧉
        </button>
        <button
          type="button"
          className="vc-danger"
          title="Delete"
          aria-label="Delete"
          onClick={() => act("delete")}
        >
          🗑
        </button>
      </div>

      <div ref={addRef} className="vc-ui vc-add">
        {canAddBlock ? (
          <span style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
            >
              {selIsColumn
                ? "+ Add to column"
                : selPath.length
                  ? "+ Add here"
                  : "+ Add block"}
            </button>
            {menuOpen ? (
              <div className="vc-menu" role="menu">
                {ADDABLE.map(([type, label, icon]) => (
                  <button
                    key={type}
                    type="button"
                    role="menuitem"
                    aria-label={label}
                    onClick={() => {
                      setMenuOpen(false);
                      act("add-block", { blockType: type });
                    }}
                  >
                    <span className="vc-ic" aria-hidden="true">
                      {icon}
                    </span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </span>
        ) : null}
        <button
          type="button"
          className="vc-secondary"
          onClick={() => act("add-section")}
        >
          + Add section below
        </button>
      </div>

      {!page ? (
        <div
          style={{ padding: 40, textAlign: "center", opacity: 0.7 }}
          role="status"
        >
          Loading the page…
        </div>
      ) : isHome ? (
        <Suspense fallback={null}>
          <HomePage previewPage={page} />
        </Suspense>
      ) : (
        <BuilderPage canvasPage={page} />
      )}
      {page ? (
        <div
          ref={dropZoneRef}
          className="vc-ui vc-dropZone"
          style={{ position: "relative" }}
        >
          <button
            type="button"
            className="vc-dropAdd"
            aria-label="Add a section"
            onClick={() =>
              postToEditor({ type: "brtv:add-section", sectionId: "" })
            }
          >
            ＋
          </button>
          <p>
            {sections.length
              ? "Drag an element here to add a new section"
              : "This page is empty. Drag an element here, or click ＋ to add a section"}
          </p>
        </div>
      ) : null}
    </CanvasContext.Provider>
  );
}
