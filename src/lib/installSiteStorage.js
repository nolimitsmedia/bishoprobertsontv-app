// Imported FIRST in src/index.js: imports run in order, so this runs before any
// other part of the app touches browser storage.
import { installSiteStorage } from "./siteStorage";

installSiteStorage();
