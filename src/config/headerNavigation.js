// src/config/headerNavigation.js
// The header menu used until a menu is published in Admin › Website Navigation.
// Phase 2C: the code holds a neutral menu; each site's own default menu is in
// public/content/defaults.json ("header_items") and replaces it once loaded.
import { loadSiteDefaults } from "../lib/siteContent";

const GENERIC_HEADER_ITEMS = [
  { id: "home", label: "Home", href: "/", parentId: null, visible: true },
  {
    id: "about",
    label: "About",
    href: "/about",
    parentId: null,
    visible: true,
  },
  {
    id: "pastoral",
    label: "Leadership",
    href: "/pastoral-leadership",
    parentId: "about",
    visible: true,
  },
  {
    id: "watch",
    label: "Watch",
    href: "/catalog",
    parentId: null,
    visible: true,
  },
  {
    id: "live",
    label: "Live",
    href: "/live-streaming",
    parentId: null,
    visible: true,
  },
  {
    id: "community",
    label: "Community",
    href: "/community",
    parentId: null,
    visible: false,
  },
  {
    id: "partner",
    label: "Partner with us",
    href: "/partnership",
    parentId: null,
    visible: true,
  },
  {
    id: "contact",
    label: "Contact",
    href: "/contact",
    parentId: null,
    visible: true,
  },
];

// Live binding: becomes the site's own default menu once defaults.json loads.
// eslint-disable-next-line import/no-mutable-exports
export let DEFAULT_HEADER_ITEMS = GENERIC_HEADER_ITEMS;

export function loadDefaultHeaderItems() {
  return loadSiteDefaults().then((d) => {
    if (Array.isArray(d.header_items) && d.header_items.length)
      DEFAULT_HEADER_ITEMS = d.header_items;
    return DEFAULT_HEADER_ITEMS;
  });
}
loadDefaultHeaderItems();
