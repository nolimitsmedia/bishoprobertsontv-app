// src/components/builder/collectionEditors.js
//
// Visual editor (pre-launch review): edit Cards and Gallery images right in the
// settings panel, without switching to List view. Same data as List view:
//   grid    { cols, items: [{ id, title, text, image_url, alt }] }
//   gallery { images: [{ id, src, alt }] }   (columns and gap stay in the panel)

import React, { useContext } from "react";
import { MediaPickerContext } from "../media/MediaPicker";
import { mediaSrc } from "../../lib/mediaApi";

const newId = (p) =>
  `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function move(list, from, to) {
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

function ItemActions({ index, count, label, onMove, onRemove }) {
  return (
    <span className="bx-faqEditActions">
      <button
        type="button"
        className="ap-btn"
        disabled={index === 0}
        aria-label={`Move ${label} up`}
        onClick={() => onMove(index, index - 1)}
      >
        ↑
      </button>
      <button
        type="button"
        className="ap-btn"
        disabled={index === count - 1}
        aria-label={`Move ${label} down`}
        onClick={() => onMove(index, index + 1)}
      >
        ↓
      </button>
      <button
        type="button"
        className="ap-btn ap-btnDanger"
        aria-label={`Remove ${label}`}
        onClick={() => onRemove(index)}
      >
        Remove
      </button>
    </span>
  );
}

export function CardsEditor({ block, onPatch }) {
  const pickFromLibrary = useContext(MediaPickerContext);
  const items = Array.isArray(block?.items) ? block.items : [];
  const setItems = (next) => onPatch({ items: next });
  const edit = (i, patch) =>
    setItems(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  return (
    <div className="bx-editor">
      <div className="bx-field">
        <label htmlFor="cx-cols">Cards per row</label>
        <select
          id="cx-cols"
          className="ap-input"
          value={String(block?.cols || 3)}
          onChange={(e) => onPatch({ cols: Number(e.target.value) })}
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <div className="bx-hint">Phones always show one card per row.</div>
      </div>
      {items.map((it, i) => {
        const label = `card ${i + 1}`;
        const img = String(it?.image_url || it?.src || "");
        return (
          <div className="bx-faqEdit" key={it?.id || i}>
            <div className="bx-faqEditHead">
              <strong>Card {i + 1}</strong>
              <ItemActions
                index={i}
                count={items.length}
                label={label}
                onMove={(a, b) => setItems(move(items, a, b))}
                onRemove={(k) => setItems(items.filter((_, x) => x !== k))}
              />
            </div>
            <input
              className="ap-input"
              aria-label={`Card ${i + 1} title`}
              placeholder="Title"
              value={it?.title || ""}
              onChange={(e) => edit(i, { title: e.target.value })}
            />
            <textarea
              className="ap-textarea"
              rows={3}
              aria-label={`Card ${i + 1} text`}
              placeholder="Text"
              value={it?.text || ""}
              onChange={(e) => edit(i, { text: e.target.value })}
            />
            <div className="bx-photoRow">
              {img ? (
                <img
                  src={mediaSrc(img)}
                  alt=""
                  className="bx-quotePhoto"
                  style={{ borderRadius: 8 }}
                />
              ) : null}
              {pickFromLibrary ? (
                <button
                  type="button"
                  className="ap-btn"
                  onClick={async () => {
                    const pick = await pickFromLibrary({
                      title: `Image for card ${i + 1}`,
                    });
                    if (pick?.url)
                      edit(i, {
                        image_url: pick.url,
                        alt: it?.alt || pick.alt || "",
                      });
                  }}
                >
                  {img ? "Change image" : "Add image"}
                </button>
              ) : null}
              {img ? (
                <button
                  type="button"
                  className="ap-btn"
                  onClick={() => edit(i, { image_url: "", src: "" })}
                >
                  Remove image
                </button>
              ) : null}
            </div>
            {img ? (
              <input
                className="ap-input"
                aria-label={`Card ${i + 1} image description`}
                placeholder="Image description (for screen readers)"
                value={it?.alt || ""}
                onChange={(e) => edit(i, { alt: e.target.value })}
              />
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        className="ap-btn ap-btnPrimary"
        onClick={() =>
          setItems([
            ...items,
            { id: newId("card"), title: "", text: "", image_url: "" },
          ])
        }
      >
        + Add card
      </button>
    </div>
  );
}

export function GalleryImagesEditor({ block, onPatch }) {
  const pickFromLibrary = useContext(MediaPickerContext);
  const field = Array.isArray(block?.images)
    ? "images"
    : Array.isArray(block?.items) && block.items.length
      ? "items"
      : "images";
  const images = (Array.isArray(block?.[field]) ? block[field] : []).map(
    (im) => (typeof im === "string" ? { src: im, alt: "" } : im || {}),
  );
  const setImages = (next) => onPatch({ [field]: next });
  return (
    <div className="bx-editor">
      {images.length ? (
        <ul className="cx-gallery" aria-label="Gallery images">
          {images.map((im, i) => {
            const src = String(im.src || im.url || im.image_url || "");
            return (
              <li key={im.id || `${src}-${i}`} className="cx-galleryItem">
                <img src={mediaSrc(src)} alt="" />
                <div className="cx-galleryBody">
                  <input
                    className="ap-input"
                    aria-label={`Image ${i + 1} description`}
                    placeholder="Description (for screen readers)"
                    value={im.alt || ""}
                    onChange={(e) =>
                      setImages(
                        images.map((x, k) =>
                          k === i ? { ...x, alt: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <ItemActions
                    index={i}
                    count={images.length}
                    label={`image ${i + 1}`}
                    onMove={(a, b) => setImages(move(images, a, b))}
                    onRemove={(k) =>
                      setImages(images.filter((_, x) => x !== k))
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="bx-hint" style={{ margin: 0 }}>
          No images yet.
        </p>
      )}
      {pickFromLibrary ? (
        <button
          type="button"
          className="ap-btn ap-btnPrimary"
          onClick={async () => {
            const picks = await pickFromLibrary({
              title: "Add images to the gallery",
              multiple: true,
            });
            if (Array.isArray(picks) && picks.length) {
              setImages([
                ...images,
                ...picks
                  .filter((p) => p?.url)
                  .map((p) => ({
                    id: newId("img"),
                    src: p.url,
                    alt: p.alt || "",
                  })),
              ]);
            }
          }}
        >
          + Add images
        </button>
      ) : null}
    </div>
  );
}
