// src/config/menu.js
import {
  Gauge,
  Folder,
  Video,
  Radio,
  Calendar,
  BookText,
  PanelsTopLeft,
  // Users,
  // MessageSquare,
  // CreditCard,
  // Package,
  // BarChart2,
  // Megaphone,
  // Globe,
  // PieChart,
  // MonitorSmartphone,
  // Settings,
} from "lucide-react";

/**
 * Uscreen-like menu with icons. Child items under "Content" are always visible.
 * Each "icon" is a component, rendered by Layout's <RenderIcon /> helper.
 */
export const MENU = [
  {
    label: "ADMIN",
    items: [
      { title: "Dashboard", to: "/admin", icon: Gauge },

      {
        title: "Content",
        icon: Folder,
        children: [
          // New Pages item
          { title: "Pages", to: "/admin/pages", icon: BookText },

          { title: "Videos", to: "/admin/content/videos", icon: Video },
          { title: "Live Streaming", to: "/studio/live", icon: Radio },
          {
            title: "Collections",
            to: "/admin/content/collections",
            icon: Folder,
          },
          { title: "Calendar", to: "/admin/content/calendar", icon: Calendar },
          {
            title: "Resources",
            to: "/admin/content/resources",
            icon: BookText,
          },
          {
            title: "Organize",
            to: "/admin/content/organize",
            icon: PanelsTopLeft,
          },
          {
            title: "Community",
            to: "/community/new",
            icon: PanelsTopLeft,
          },
        ],
      },

      // { title: "People", to: "/admin/people", icon: Users },
      // { title: "Community", to: "/admin/community", icon: MessageSquare },
      // { title: "Subscriptions", to: "/admin/subscriptions", icon: CreditCard },
      // { title: "Bundles", to: "/admin/bundles", icon: Package },
      // { title: "Sales", to: "/admin/sales", icon: BarChart2 },
      // { title: "Marketing", to: "/admin/marketing", icon: Megaphone },
      // { title: "Website", to: "/admin/website", icon: Globe },
      // { title: "Analytics", to: "/admin/analytics", icon: PieChart },
      // { title: "Mobile & TV Apps", to: "/admin/apps", icon: MonitorSmartphone },
      // { title: "Settings", to: "/admin/settings", icon: Settings },
    ],
  },
];
