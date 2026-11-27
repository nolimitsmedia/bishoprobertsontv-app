// src/config/menu.js
import {
  Gauge,
  Folder,
  Video,
  Radio,
  Calendar,
  BookText,
  PanelsTopLeft,
  Images,
  Settings2,
  Inbox,
  ShieldCheck,
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
import {
  LayoutDashboard,
  FolderKanban,
  Video as VideoIcon,
  Radio as RadioIcon,
  Library,
  Scissors,
  CalendarDays,
  FolderOpen,
  ListOrdered,
  MessagesSquare,
  Navigation,
  FileText,
  Images as ImagesIcon,
  Settings2 as SettingsIcon,
  Inbox as InboxIcon,
  ChartColumn,
  Users as UsersIcon,
  ShieldCheck as ShieldIcon,
  Plug,
  CloudDownload,
  ArrowRightLeft,
  Mail,
  Send,
  MailCheck,
} from "lucide-react";

/**
 * Uscreen-like menu with icons. Child items under "Content" are always visible.
 * Each "icon" is a component, rendered by Layout's <RenderIcon /> helper.
 */
export const MENU = [
  {
    // label: "ADMIN",
    items: [
      { title: "Dashboard", to: "/admin", icon: Gauge },

      {
        title: "Content",
        icon: Folder,
        children: [
          // ✅ Pages manager (Admin)

          { title: "Videos", to: "/admin/content/videos", icon: Video },
          { title: "Live Streaming", to: "/admin/content/live", icon: Radio },
          // { title: "Live Stream", to: "/studio/live", icon: Radio },
          {
            title: "Collections",
            to: "/admin/content/collections",
            icon: Folder,
          },
          {
            title: "Preview Clips",
            to: "/admin/preview-clips",
            icon: BookText,
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
          {
            title: "Website Navigation",
            to: "/admin/navigation",
            icon: PanelsTopLeft,
          },
          {
            title: "Pages",
            to: "/admin/pages",
            icon: PanelsTopLeft,
          },
          {
            title: "Media Library",
            to: "/admin/media",
            icon: Images,
          },
          {
            title: "Site Settings",
            to: "/admin/site-settings",
            icon: Settings2,
          },
          {
            title: "Form Submissions",
            to: "/admin/forms",
            icon: Inbox,
          },
        ],
      },
      // {
      //   title: "Pages",
      //   to: "/admin/pages",
      //   icon: BookText,
      // },
      {
        title: "Analytics",
        to: "/admin/content/analytics",
        icon: BookText,
      },
      {
        title: "Users",
        to: "/admin/users",
        icon: BookText,
      },
      {
        title: "Team",
        to: "/admin/team",
        icon: ShieldCheck,
      },
      // {
      //   title: "Wasabi Import",
      //   to: "/admin/content/wasabi-import",
      //   icon: BookText,
      // },
      // {
      //   title: "Wasabi to Bunny Import",
      //   to: "/admin/content/wasabi-importer",
      //   icon: BookText,
      // },

      {
        title: "Integration",
        icon: Folder,
        children: [
          // ✅ Pages manager (Admin)

          {
            title: "Wasabi Import",
            to: "/admin/content/wasabi-import",
            icon: BookText,
          },
          {
            // any cloud storage (alphabetical list) + the customer's own Bunny
            // Stream library; replaces the old job-based Wasabi importer
            title: "Cloud Storage",
            to: "/admin/content/cloud-storage",
            icon: BookText,
          },
          {
            title: "Email",
            to: "/admin/content/email-integration",
            icon: BookText,
          },
          {
            title: "Live Platform",
            to: "/admin/integrations/live",
            icon: BookText,
          },
        ],
      },
      {
        title: "Email Center",
        to: "/admin/content/email-center",
        icon: BookText,
      },
      {
        title: "Email Automations",
        to: "/admin/content/email-automations",
        icon: BookText,
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

// One meaningful icon per item (the admin theme shows them in the sidebar).
const ICON_BY_TITLE = {
  Dashboard: LayoutDashboard,
  Content: FolderKanban,
  Videos: VideoIcon,
  "Live Streaming": RadioIcon,
  Collections: Library,
  "Preview Clips": Scissors,
  Calendar: CalendarDays,
  Resources: FolderOpen,
  Organize: ListOrdered,
  Community: MessagesSquare,
  "Website Navigation": Navigation,
  Pages: FileText,
  "Media Library": ImagesIcon,
  "Site Settings": SettingsIcon,
  "Form Submissions": InboxIcon,
  Analytics: ChartColumn,
  Users: UsersIcon,
  Team: ShieldIcon,
  Integration: Plug,
  "Wasabi Import": CloudDownload,
  "Wasabi to Bunny Import": ArrowRightLeft,
  "Old Wasabi importer": ArrowRightLeft,
  "Cloud Storage": ArrowRightLeft,
  Email: Mail,
  "Live Platform": RadioIcon,
  "Email Center": Send,
  "Email Automations": MailCheck,
};
(function applyIcons(list) {
  (Array.isArray(list) ? list : []).forEach((it) => {
    if (it && ICON_BY_TITLE[it.title]) it.icon = ICON_BY_TITLE[it.title];
    if (it && Array.isArray(it.items)) applyIcons(it.items);
    if (it && Array.isArray(it.children)) applyIcons(it.children);
  });
})(MENU);
