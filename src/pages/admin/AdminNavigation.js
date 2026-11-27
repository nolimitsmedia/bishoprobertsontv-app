import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import {
  DEFAULT_HEADER_ITEMS,
  loadDefaultHeaderItems,
} from "../../config/headerNavigation";
import "./AdminPages.css";

const clone = (value) => JSON.parse(JSON.stringify(value));
const makeId = () =>
  `nav-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const normalizeItems = (value) =>
  Array.isArray(value) ? clone(value) : clone(DEFAULT_HEADER_ITEMS);
const isPublishedPage = (page) =>
  page.status === "published" ||
  page.is_published === true ||
  Boolean(page.published_at);
const pageUrl = (page) => `/p/${page.slug}`;
const parentOf = (item) => item.parentId || null;

function MenuItem({
  item,
  expanded,
  setExpanded,
  items,
  pages,
  updateItem,
  changeParent,
  removeItem,
  moveItem,
  canMove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) {
  const isOpen = expanded === item.id;
  const parents = items.filter(
    (candidate) => candidate.id !== item.id && !candidate.parentId,
  );

  return (
    <div
      className={`ap-wpMenuItem ${item.parentId ? "is-child" : ""} ${
        isOpen ? "is-open" : ""
      } ${item.visible === false ? "is-hidden" : ""}`}
    >
      <div
        className="ap-wpMenuItemHead"
        draggable
        onDragStart={(event) => onDragStart(event, item.id)}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDrop={(event) => onDrop(event, item.id)}
      >
        <span className="ap-wpGrip" title="Drag to reorder">
          ⠿
        </span>
        <button
          type="button"
          className="ap-wpItemName"
          aria-expanded={isOpen}
          onClick={() => setExpanded(isOpen ? null : item.id)}
        >
          <strong>{item.label || "Untitled link"}</strong>
          <small>
            {item.parentId ? "Submenu item" : "Menu item"}
            {item.visible === false ? " · Hidden" : ""}
          </small>
        </button>
        <div className="ap-wpItemActions">
          <button
            type="button"
            title="Move up"
            aria-label={`Move ${item.label} up`}
            disabled={!canMove(item, -1)}
            onClick={() => moveItem(item.id, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            title="Move down"
            aria-label={`Move ${item.label} down`}
            disabled={!canMove(item, 1)}
            onClick={() => moveItem(item.id, 1)}
          >
            ↓
          </button>
          <button
            type="button"
            title="Edit item"
            aria-label={`Edit ${item.label}`}
            aria-expanded={isOpen}
            onClick={() => setExpanded(isOpen ? null : item.id)}
          >
            {isOpen ? "⌃" : "⌄"}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="ap-wpItemDetails">
          <div className="ap-wpFieldGrid">
            <label>
              Navigation label
              <input
                className="ap-input"
                value={item.label || ""}
                onChange={(event) =>
                  updateItem(item.id, { label: event.target.value })
                }
              />
            </label>
            <label>
              Destination URL
              <input
                className="ap-input"
                value={item.href || ""}
                onChange={(event) =>
                  updateItem(item.id, { href: event.target.value })
                }
              />
            </label>
          </div>
          <div className="ap-wpFieldGrid">
            <label>
              Link to published page
              <select
                className="ap-input"
                value=""
                onChange={(event) => {
                  if (event.target.value) {
                    updateItem(item.id, { href: event.target.value });
                  }
                }}
              >
                <option value="">Choose a page (optional)</option>
                {pages
                  .filter(isPublishedPage)
                  .filter((page) => page.slug)
                  .map((page) => (
                    <option key={page.id} value={pageUrl(page)}>
                      {page.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Parent dropdown
              <select
                className="ap-input"
                value={item.parentId || ""}
                onChange={(event) => changeParent(item.id, event.target.value)}
              >
                <option value="">Top-level item</option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    Under {parent.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="ap-wpItemFooter">
            <label className="ap-wpVisibility">
              <input
                type="checkbox"
                checked={item.visible !== false}
                onChange={(event) =>
                  updateItem(item.id, { visible: event.target.checked })
                }
              />
              Visible in menu
            </label>
            <button
              type="button"
              className="ap-wpRemove"
              onClick={() => removeItem(item.id)}
            >
              Remove item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminNavigation() {
  const [items, setItems] = useState([]);
  const [savedDraft, setSavedDraft] = useState([]);
  const [published, setPublished] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [pageSelections, setPageSelections] = useState([]);
  const [pageSearch, setPageSearch] = useState("");
  const [sourceTab, setSourceTab] = useState("pages");
  const [customLabel, setCustomLabel] = useState("");
  const [customHref, setCustomHref] = useState("");
  const [dragId, setDragId] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get("/navigation/admin/header"),
      api.get("/admin/pages"),
      loadDefaultHeaderItems(), // this site's own default menu
    ])
      .then(([navigationResponse, pagesResponse]) => {
        if (!active) return;
        const navigation = navigationResponse.data || {};
        const draft = normalizeItems(navigation.draft ?? navigation.published);
        setItems(draft);
        setSavedDraft(clone(draft));
        setPublished(
          Array.isArray(navigation.published)
            ? clone(navigation.published)
            : null,
        );
        const payload = pagesResponse.data || {};
        setPages(Array.isArray(payload.pages) ? payload.pages : []);
      })
      .catch((error) => {
        if (active) {
          setNotice(
            error?.response?.data?.error ||
              "Unable to load navigation. Check the API and migration.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const dirty = JSON.stringify(items) !== JSON.stringify(savedDraft);
  const unpublished =
    JSON.stringify(items) !== JSON.stringify(published ?? DEFAULT_HEADER_ITEMS);

  const arranged = useMemo(() => {
    const topLevel = items.filter(
      (item) => !item.parentId || !items.some((p) => p.id === item.parentId),
    );
    return topLevel.flatMap((parent) => [
      parent,
      ...items.filter((child) => child.parentId === parent.id),
    ]);
  }, [items]);

  const availablePages = pages
    .filter((page) => isPublishedPage(page) && page.slug && page.title)
    .filter((page) =>
      `${page.title} ${page.slug}`
        .toLowerCase()
        .includes(pageSearch.toLowerCase()),
    );

  const updateItem = (id, patch) => {
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const addEntries = (entries) => {
    if (!entries.length) return;
    const created = entries.map(({ label, href }) => ({
      id: makeId(),
      label,
      href,
      parentId: null,
      visible: true,
    }));
    setItems((previous) => [...previous, ...created]);
    setExpanded(created[created.length - 1].id);
    setNotice(
      `${created.length} menu item${created.length === 1 ? "" : "s"} added. Save your draft when ready.`,
    );
  };

  const addPages = () => {
    const chosen = pages.filter((page) =>
      pageSelections.includes(String(page.id)),
    );
    addEntries(
      chosen.map((page) => ({ label: page.title, href: pageUrl(page) })),
    );
    setPageSelections([]);
  };

  const addCustom = () => {
    if (!customLabel.trim() || !customHref.trim()) {
      setNotice("Enter both a link label and destination URL.");
      return;
    }
    const href = customHref.trim();
    if (!/^(\/|https?:\/\/|mailto:|tel:)/i.test(href)) {
      setNotice("Use an app path beginning with / or a valid https:// URL.");
      return;
    }
    addEntries([{ label: customLabel.trim(), href }]);
    setCustomLabel("");
    setCustomHref("");
  };

  const removeItem = (id) => {
    setItems((previous) =>
      previous
        .filter((item) => item.id !== id)
        .map((item) =>
          item.parentId === id ? { ...item, parentId: null } : item,
        ),
    );
    if (expanded === id) setExpanded(null);
  };

  const changeParent = (id, parentId) => {
    setItems((previous) =>
      previous.map((item) => {
        if (item.id === id) return { ...item, parentId: parentId || null };
        if (item.parentId === id) return { ...item, parentId: null };
        return item;
      }),
    );
  };

  const reorderSiblings = (previous, draggedId, targetId) => {
    const dragged = previous.find((item) => item.id === draggedId);
    const target = previous.find((item) => item.id === targetId);
    if (!dragged || !target || parentOf(dragged) !== parentOf(target)) {
      return previous;
    }
    const siblings = previous.filter(
      (item) => parentOf(item) === parentOf(dragged),
    );
    const from = siblings.findIndex((item) => item.id === draggedId);
    const to = siblings.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0 || from === to) return previous;
    const [entry] = siblings.splice(from, 1);
    siblings.splice(to, 0, entry);
    let index = 0;
    return previous.map((item) =>
      parentOf(item) === parentOf(dragged) ? siblings[index++] : item,
    );
  };

  const moveItem = (id, direction) => {
    setItems((previous) => {
      const current = previous.find((item) => item.id === id);
      if (!current) return previous;
      const siblings = previous.filter(
        (item) => parentOf(item) === parentOf(current),
      );
      const index = siblings.findIndex((item) => item.id === id);
      const neighbor = siblings[index + direction];
      return neighbor ? reorderSiblings(previous, id, neighbor.id) : previous;
    });
  };

  const canMove = (item, direction) => {
    const siblings = items.filter(
      (candidate) => parentOf(candidate) === parentOf(item),
    );
    const index = siblings.findIndex((candidate) => candidate.id === item.id);
    return index + direction >= 0 && index + direction < siblings.length;
  };

  const save = async (publish) => {
    setSaving(true);
    setNotice("");
    try {
      await api.put("/navigation/admin/header", { items });
      setSavedDraft(clone(items));
      if (publish) {
        const response = await api.post("/navigation/admin/header/publish");
        setPublished(normalizeItems(response.data?.items ?? items));
        setNotice(
          "Navigation published. Refresh the public website to see it.",
        );
      } else {
        setNotice("Draft saved. The live website menu is unchanged.");
      }
    } catch (error) {
      setNotice(error?.response?.data?.error || "Unable to save navigation.");
    } finally {
      setSaving(false);
    }
  };

  const onDragStart = (event, id) => {
    setDragId(id);
    event.dataTransfer.effectAllowed = "move";
  };
  const onDragEnd = () => setDragId(null);
  const onDragOver = (event) => {
    if (dragId) event.preventDefault();
  };
  const onDrop = (event, targetId) => {
    event.preventDefault();
    if (dragId && dragId !== targetId) {
      setItems((previous) => reorderSiblings(previous, dragId, targetId));
    }
    setDragId(null);
  };

  return (
    <div className="ap-root ap-navPage ap-wpNav">
      <header className="ap-wpHeader">
        <div>
          <div className="ap-navEyebrow">WEBSITE MANAGEMENT</div>
          <h1>Website Navigation</h1>
          <p>
            Add pages, organize dropdowns, and publish the menu used on your
            website.
          </p>
        </div>
        <div className="ap-wpActions">
          <span
            className={`ap-navState ${dirty || unpublished ? "changed" : ""}`}
          >
            {dirty
              ? "Unsaved changes"
              : unpublished
                ? "Draft not published"
                : "Draft matches live"}
          </span>
          <button
            type="button"
            className="ap-btn"
            disabled={loading || saving || !dirty}
            onClick={() => save(false)}
          >
            Save Draft
          </button>
          <button
            type="button"
            className="ap-btn ap-btnPrimary"
            disabled={loading || saving}
            onClick={() => save(true)}
          >
            {saving ? "Saving…" : "Publish Navigation"}
          </button>
        </div>
      </header>

      {notice && (
        <div className="ap-navNotice" role="status">
          {notice}
        </div>
      )}
      {loading ? (
        <div className="ap-card ap-loading">Loading navigation…</div>
      ) : (
        <>
          <div className="ap-wpMenuBar">
            <div>
              <strong>Main Header Menu</strong>
              <span>Displayed in the desktop header and mobile navigation</span>
            </div>
            <span className="ap-navCount">{items.length} items</span>
          </div>
          <div className="ap-wpWorkspace">
            <aside className="ap-wpAddPanel ap-card">
              <h2>Add menu items</h2>
              <div
                className="ap-wpSourceTabs"
                role="tablist"
                aria-label="Link source"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={sourceTab === "pages"}
                  className={sourceTab === "pages" ? "active" : ""}
                  onClick={() => setSourceTab("pages")}
                >
                  Pages
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={sourceTab === "custom"}
                  className={sourceTab === "custom" ? "active" : ""}
                  onClick={() => setSourceTab("custom")}
                >
                  Custom links
                </button>
              </div>
              {sourceTab === "pages" ? (
                <div className="ap-wpSourceBody" role="tabpanel">
                  <label className="ap-wpFieldLabel" htmlFor="nav-page-search">
                    Find a published page
                  </label>
                  <input
                    id="nav-page-search"
                    className="ap-input"
                    placeholder="Search pages…"
                    value={pageSearch}
                    onChange={(event) => setPageSearch(event.target.value)}
                  />
                  <div className="ap-wpPageChoices">
                    {availablePages.length ? (
                      availablePages.map((page) => (
                        <label key={page.id} className="ap-wpPageChoice">
                          <input
                            type="checkbox"
                            checked={pageSelections.includes(String(page.id))}
                            onChange={(event) =>
                              setPageSelections((previous) =>
                                event.target.checked
                                  ? [...previous, String(page.id)]
                                  : previous.filter(
                                      (id) => id !== String(page.id),
                                    ),
                              )
                            }
                          />
                          <span>
                            <strong>{page.title}</strong>
                            <small>{pageUrl(page)}</small>
                          </span>
                        </label>
                      ))
                    ) : (
                      <p className="ap-wpHelp">
                        No published CMS pages match this search. You can add a
                        custom link instead.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="ap-btn ap-btnPrimary ap-wpAddButton"
                    disabled={!pageSelections.length}
                    onClick={addPages}
                  >
                    + Add selected to menu
                  </button>
                </div>
              ) : (
                <div className="ap-wpSourceBody" role="tabpanel">
                  <label className="ap-wpFieldLabel" htmlFor="nav-custom-label">
                    Link text
                  </label>
                  <input
                    id="nav-custom-label"
                    className="ap-input"
                    placeholder="e.g. Resources"
                    value={customLabel}
                    onChange={(event) => setCustomLabel(event.target.value)}
                  />
                  <label className="ap-wpFieldLabel" htmlFor="nav-custom-url">
                    URL
                  </label>
                  <input
                    id="nav-custom-url"
                    className="ap-input"
                    placeholder="/resources or https://…"
                    value={customHref}
                    onChange={(event) => setCustomHref(event.target.value)}
                  />
                  <p className="ap-wpHelp">
                    Use / for your homepage, /p/page-slug for CMS pages, or a
                    complete external URL.
                  </p>
                  <button
                    type="button"
                    className="ap-btn ap-btnPrimary ap-wpAddButton"
                    onClick={addCustom}
                  >
                    + Add to menu
                  </button>
                </div>
              )}
            </aside>

            <section
              className="ap-card ap-wpStructure"
              aria-label="Menu structure"
            >
              <div className="ap-wpStructureHead">
                <div>
                  <h2>Menu structure</h2>
                  <p>
                    Open an item to edit its label, link, visibility, or
                    dropdown placement.
                  </p>
                </div>
                <span className="ap-navCount">{items.length} items</span>
              </div>
              <div className="ap-wpList">
                {arranged.map((item) => (
                  <MenuItem
                    key={item.id}
                    item={item}
                    expanded={expanded}
                    setExpanded={setExpanded}
                    items={items}
                    pages={pages}
                    updateItem={updateItem}
                    changeParent={changeParent}
                    removeItem={removeItem}
                    moveItem={moveItem}
                    canMove={canMove}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                  />
                ))}
                {!items.length && (
                  <div className="ap-navEmpty">
                    Your menu is empty. Select pages or add a custom link from
                    the panel on the left.
                  </div>
                )}
              </div>
              <div className="ap-wpMenuSettings">
                <h3>Menu settings</h3>
                <p>
                  Dropdown items appear indented below their parent. Move items
                  with the arrows or drag them within the same level.
                </p>
                <label>
                  <input type="checkbox" checked readOnly />
                  Main header and mobile navigation{" "}
                  <small>(current published menu location)</small>
                </label>
              </div>
              <footer className="ap-wpBottomActions">
                <span>
                  {dirty
                    ? "You have unsaved edits."
                    : unpublished
                      ? "Draft changes are not yet live."
                      : "All changes are published."}
                </span>
                <button
                  type="button"
                  className="ap-btn"
                  disabled={saving || !dirty}
                  onClick={() => save(false)}
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  className="ap-btn ap-btnPrimary"
                  disabled={saving}
                  onClick={() => save(true)}
                >
                  Publish Navigation
                </button>
              </footer>
            </section>
          </div>
          <p className="ap-navFooter">
            {published === null
              ? "The original website menu is active as fallback."
              : `${published.length} published navigation items.`}{" "}
            Account, Admin, and notification controls are managed separately.
          </p>
        </>
      )}
    </div>
  );
}
