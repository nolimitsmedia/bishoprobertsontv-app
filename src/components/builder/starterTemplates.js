// src/components/builder/starterTemplates.js
//
// Release 1.2 Part B: ready-made starter pages for the visual editor. Each is a
// list of sections built from the normal elements; inserting one copies it
// with fresh IDs, so pages never share content with the template.

// This site's own pictures (public/content/, set per ministry at build time).
import { contentUrl } from "../../lib/siteContent";

const LeaderPhoto = contentUrl("leader.png");
const MinistryPhoto = contentUrl("about-2.jpg");
const FamilyPhoto = contentUrl("about-3.jpg");

const s = (id, title, blocks, styles = {}) => ({
  id,
  title,
  layout: "plain",
  theme: "default",
  styles: { show_title: false, ...styles },
  blocks,
});
const heading = (id, text, level = "h2", styles) => ({
  id,
  type: "heading",
  text,
  level,
  link: "",
  ...(styles ? { styles } : {}),
});
const text = (id, html, styles) => ({
  id,
  type: "richtext",
  html,
  ...(styles ? { styles } : {}),
});
const button = (id, label, href) => ({
  id,
  type: "button",
  text: label,
  href,
  align: "center",
});
const spacer = (id, height = 24) => ({
  id,
  type: "spacer",
  height,
  divider: false,
});
const container = (id, blocks, extra = {}) => ({
  id,
  type: "columns",
  variant: "container",
  gap: 14,
  stack_on_mobile: true,
  columns: [{ id: `${id}-c`, width_pct: 100, styles: {}, blocks }],
  ...extra,
});
const columns2 = (id, left, right) => ({
  id,
  type: "columns",
  gap: 24,
  stack_on_mobile: true,
  align_items: "center",
  columns: [
    { id: `${id}-a`, width_pct: 50, styles: {}, blocks: left },
    { id: `${id}-b`, width_pct: 50, styles: {}, blocks: right },
  ],
});
const cards = (id, items, cols = 3) => ({
  id,
  type: "grid",
  cols,
  items: items.map(([title, body], i) => ({
    id: `${id}-${i}`,
    title,
    text: body,
    image_url: "",
  })),
});
const faq = (id, items) => ({
  id,
  type: "faq",
  items: items.map(([q, a], i) => ({ id: `${id}-${i}`, q, a })),
});
const center = { align: "center" };

/* ---- About our pastor and Pastoral Leadership (approved designs, Nov 2026; generic wording Phase 2C-2) ---- */
// Built from the story blocks (storyBlocks.js) and the normal blocks, so every
// word, number, photo and link stays editable in the visual editor. The photos
// are the site's own files; replace any from the Media Library.
const img = (id, src, alt) => ({
  id,
  type: "image",
  src,
  alt,
  link: "",
  width: 100,
  align: "center",
});
const cols = (id, leftPct, left, right, align = "center") => ({
  id,
  type: "columns",
  gap: 48,
  stack_on_mobile: true,
  align_items: align,
  columns: [
    { id: `${id}-a`, width_pct: leftPct, styles: {}, blocks: left },
    { id: `${id}-b`, width_pct: 100 - leftPct, styles: {}, blocks: right },
  ],
});
const eyebrow = (id, t, align = "left") => ({
  id,
  type: "eyebrow",
  text: t,
  align,
});
const btns = (id, list, align = "left") => ({
  id,
  type: "buttons",
  align,
  buttons: list.map(([label, href, style], i) => ({
    id: `${id}-${i}`,
    label,
    href,
    style: style || "primary",
  })),
});
const items = (id, rows, keys) =>
  rows.map((r, i) => ({
    id: `${id}-${i}`,
    ...Object.fromEntries(keys.map((k, j) => [k, r[j]])),
  }));
const PLAIN = { align: "left", max_width: "1200px", padding: "72px 24px" };
const BAND = { ...PLAIN, bg_color: "#0c0d14" };

const ABOUT_PASTOR = {
  id: "starter-about-pastor",
  name: "About our pastor (new design)",
  description:
    "A complete About page for your pastor: introduction, highlights, testimony, journey, books, quote, missions and family.",
  sections: [
    s(
      "ab1",
      "Introduction",
      [
        cols(
          "ab1c",
          58,
          [
            eyebrow("ab1k", "About our pastor"),
            heading("ab1h", "[Pastor’s full name]", "h1"),
            text(
              "ab1t",
              "<p><strong>[Title], [Church name]</strong></p>" +
                "<p>[One or two sentences introducing your pastor: their calling, the church they lead and what God has placed on their heart.]</p>",
            ),
            btns("ab1b", [
              ["Watch messages", "/catalog"],
              ["Become a Partner", "/partnership", "outline"],
            ]),
            text("ab1m", "<p>[City, State] · [Role] since [year]</p>"),
          ],
          [img("ab1i", LeaderPhoto, "Our pastor")],
        ),
      ],
      { ...PLAIN, padding: "88px 24px" },
    ),
    s(
      "ab2",
      "Highlights",
      [
        {
          id: "ab2s",
          type: "stats",
          cols: "4",
          items: items(
            "ab2s",
            [
              ["25", "years in ministry"],
              ["3", "campuses and outreach locations"],
              ["1,200", "lives touched every week"],
              ["4", "books and teaching series"],
            ],
            ["value", "label"],
          ),
        },
      ],
      { ...PLAIN, padding: "24px 24px" },
    ),
    s(
      "ab3",
      "Pastor and leader",
      [
        cols(
          "ab3c",
          50,
          [
            eyebrow("ab3k", "Pastor · Leader · Innovator"),
            heading(
              "ab3h",
              "Building a church that reaches people with the gospel",
            ),
            text(
              "ab3t",
              "<p>[Describe your pastor’s leadership and how the church has grown under it.]</p>" +
                "<p>[Share a testimony of what God has done through the ministry.]</p>",
            ),
          ],
          [
            // set the testimony video's address in this card's "Video link"
            {
              id: "ab3v",
              type: "videocard",
              image_url: MinistryPhoto,
              kicker: "Testimony",
              title: "Watch the testimony",
              subtitle: "",
              link: "",
            },
          ],
          "stretch",
        ),
      ],
      PLAIN,
    ),
    s(
      "ab4",
      "Journey",
      [
        heading("ab4h", "The journey"),
        {
          id: "ab4t",
          type: "timeline",
          items: items(
            "ab4t",
            [
              ["[Year]", "[Milestone — e.g. becomes Senior Pastor]"],
              ["[Year]", "[Milestone]"],
              ["[Year]", "[Milestone]"],
              ["[Year]", "[Milestone]"],
              ["[Year]", "[Milestone]"],
              ["Today", "[Where the ministry is today]"],
            ],
            ["when", "text"],
          ),
        },
      ],
      BAND,
    ),
    s(
      "ab5",
      "Author",
      [
        eyebrow("ab5k", "Author"),
        heading("ab5h", "Books by our pastor"),
        {
          id: "ab5b",
          type: "books",
          items: items(
            "ab5b",
            [
              ["[Book title]", "[One line about this book.]", "", ""],
              ["[Book title]", "[One line about this book.]", "", ""],
              ["[Book title]", "[One line about this book.]", "", ""],
              ["[Book title]", "[One line about this book.]", "", ""],
              ["[Book title]", "[One line about this book.]", "", "NEW"],
            ],
            ["title", "text", "image_url", "badge"],
          ),
        },
        btns("ab5s", [
          ["Visit the store", "https://your-store.example.com", "outline"],
        ]),
      ],
      PLAIN,
    ),
    s(
      "ab6",
      "Quote",
      [
        {
          id: "ab6q",
          type: "quote",
          text: "[A quote that captures your pastor’s heart for ministry.]",
          name: "",
          role: "",
          image_url: "",
          align: "center",
        },
      ],
      { ...PLAIN, align: "center", max_width: "980px" },
    ),
    s(
      "ab7",
      "Missions",
      [
        cols(
          "ab7c",
          50,
          [
            eyebrow("ab7k", "Missions"),
            heading("ab7h", "Called to the nations"),
            text(
              "ab7t",
              "<p>[Describe your pastor’s mission work: the ministries and partners you serve with.]</p>",
            ),
          ],
          [
            {
              id: "ab7g",
              type: "tags",
              caption: "Nations our missions have reached",
              items: items(
                "ab7g",
                [
                  ["[Country]"],
                  ["[Country]"],
                  ["[Country]"],
                  ["[Country]"],
                  ["[Country]"],
                  ["[Country]"],
                  ["[Country]"],
                  ["[Country]"],
                  ["[Country]"],
                  ["[Country]"],
                ],
                ["text"],
              ),
            },
          ],
          "start",
        ),
      ],
      BAND,
    ),
    s(
      "ab8",
      "Family and calling",
      [
        cols(
          "ab8c",
          42,
          [img("ab8i", FamilyPhoto, "Our pastor and family")],
          [
            eyebrow("ab8k", "Family & calling"),
            heading("ab8h", "Committed to changing lives with the Word"),
            text(
              "ab8t",
              "<p>[Your pastor’s training, honors and the leaders they serve alongside.]</p>" +
                "<p>[Family, if they would like to share it.]</p>",
            ),
          ],
        ),
      ],
      PLAIN,
    ),
    s(
      "ab9",
      "Call to action",
      [
        {
          id: "ab9c",
          type: "ctaband",
          title: "Every message. Every service.",
          text: "Watch the library of messages, join the live service each week, or partner with the ministry.",
          buttons: items(
            "ab9c",
            [
              ["Watch messages", "/catalog", "primary"],
              ["Join the live service", "/live-streaming", "outline"],
              ["Become a Partner", "/partnership", "outline"],
            ],
            ["label", "href", "style"],
          ),
        },
      ],
      { ...PLAIN, padding: "24px 24px 96px" },
    ),
  ],
};

const PASTORAL_LEADERSHIP = {
  id: "starter-pastoral-leadership",
  name: "Pastoral Leadership (new design)",
  description:
    "A page for your pastor’s work with other pastors: introduction, then and now, how they help, a quote and a free consultation.",
  sections: [
    s(
      "pl1",
      "Introduction",
      [
        cols(
          "pl1c",
          58,
          [
            eyebrow("pl1k", "Pastoral Leadership"),
            heading(
              "pl1h",
              "Helping pastors grow their ministry — in number and in foundation",
              "h1",
            ),
            text(
              "pl1t",
              "<p>[Describe your pastor’s experience helping other pastors and churches grow.]</p>",
            ),
            btns("pl1b", [
              ["Schedule a free consultation", "/contact"],
              ["Send a message", "/contact", "outline"],
            ]),
          ],
          [img("pl1i", LeaderPhoto, "Our pastor")],
        ),
      ],
      { ...PLAIN, padding: "88px 24px" },
    ),
    s(
      "pl2",
      "Then and now",
      [
        eyebrow("pl2k", "A proven track record"),
        heading("pl2h", "From small beginnings to a growing ministry"),
        {
          id: "pl2c",
          type: "compare",
          before_label: "[Year] — when the journey began",
          after_label: "Today",
          after_text:
            "[Where the ministry is today: congregation, campus and outreach.]",
          before_items: items(
            "pl2b",
            [
              ["1", "acres of land"],
              ["50", "members"],
            ],
            ["value", "label"],
          ),
          after_items: items(
            "pl2a",
            [
              ["10", "acres of campus"],
              ["5,000", "sq ft sanctuary"],
              ["1", "transitional homes"],
            ],
            ["value", "label"],
          ),
        },
      ],
      PLAIN,
    ),
    s(
      "pl3",
      "How he helps pastors",
      [
        heading("pl3h", "How our pastor helps pastors"),
        text(
          "pl3t",
          "<p>[How your pastor teaches and coaches: methods, experience and results.]</p>",
        ),
        {
          id: "pl3f",
          type: "features",
          cols: "4",
          items: items(
            "pl3f",
            [
              [
                "chart",
                "Church growth",
                "Growth in number — and in the underlying framework needed to support it.",
              ],
              [
                "team",
                "Winning teams",
                "Tried and proven methods to build strong ministry teams.",
              ],
              [
                "building",
                "Land acquisition",
                "Experience growing a campus and facilities.",
              ],
              [
                "coins",
                "Economic development",
                "Keeping the vision alive at every level of the organization.",
              ],
            ],
            ["icon", "title", "text"],
          ),
        },
      ],
      PLAIN,
    ),
    s(
      "pl4",
      "Quote",
      [
        {
          id: "pl4q",
          type: "quote",
          text: "He has been called and equipped “for such a time as this!”",
          name: "",
          role: "",
          image_url: "",
          align: "center",
        },
        text("pl4t", "<p>[Where your pastor travels and who they serve.]</p>", {
          align: "center",
        }),
      ],
      { ...BAND, align: "center", max_width: "980px" },
    ),
    s(
      "pl5",
      "Free consultation",
      [
        cols(
          "pl5c",
          42,
          [img("pl5i", MinistryPhoto, "Our pastor preaching")],
          [
            {
              id: "pl5a",
              type: "ctaband",
              title: "Build a strong team and infrastructure for your ministry",
              text: "Call [phone number] to schedule a free phone consultation and discuss how our pastor might work with you.",
              buttons: items(
                "pl5a",
                [
                  ["Call [phone number]", "/contact", "primary"],
                  ["Send a message", "/contact", "outline"],
                ],
                ["label", "href", "style"],
              ),
            },
          ],
        ),
      ],
      { ...PLAIN, padding: "72px 24px 96px" },
    ),
  ],
};

const BECOME_PARTNER = {
  id: "starter-become-partner",
  name: "Become a Partner (new design)",
  description:
    "A partnership page: the connection, the promise, a partner’s part, the benefits and Join today.",
  sections: [
    s(
      "pt1",
      "Introduction",
      [
        cols(
          "pt1c",
          58,
          [
            eyebrow("pt1k", "Become a Partner"),
            heading("pt1h", "[Partner program name]", "h1"),
            text(
              "pt1t",
              "<p><strong>A Divine Partnership. A Kingdom Connection.</strong></p>" +
                "<p>A partner of [partner program name] is an individual or organization that commits to consistently pray for the ministry and support it financially each month.</p>",
            ),
            btns("pt1b", [
              ["Join today", "/contact"],
              ["Questions? Contact us", "/contact", "outline"],
            ]),
          ],
          [img("pt1i", FamilyPhoto, "Our pastor and family")],
        ),
      ],
      { ...PLAIN, padding: "88px 24px" },
    ),
    s(
      "pt2",
      "The promise",
      [
        {
          id: "pt2q",
          type: "quote",
          text: "Your divine connection positions you to receive the anointing and blessings that rest upon the ministry.",
          name: "",
          role: "",
          image_url: "",
          align: "center",
        },
        text(
          "pt2t",
          "<p>Only those who are connected have a right to receive the same blessings that are on the ministry.</p>",
        ),
      ],
      { ...BAND, align: "center", max_width: "980px" },
    ),
    s(
      "pt3",
      "Your part",
      [
        eyebrow("pt3k", "Your part"),
        heading("pt3h", "What it means to be a partner"),
        {
          id: "pt3f",
          type: "features",
          cols: "3",
          items: items(
            "pt3f",
            [
              [
                "heart",
                "Pray",
                "Pray for our pastor and their family on a consistent basis.",
              ],
              [
                "globe",
                "Stay connected",
                "Through Facebook, Twitter, Instagram, and watching the archived messages.",
              ],
              [
                "coins",
                "Sow monthly",
                "Support the ministry financially through your monthly pledge.",
              ],
              [
                "mail",
                "Write to us",
                "Share, from time to time, how God is moving in your life.",
              ],
              [
                "calendar",
                "Attend",
                "Attend meetings and conferences in your area.",
              ],
              [
                "share",
                "Share",
                "Share the ministry with others as your life is blessed.",
              ],
            ],
            ["icon", "title", "text"],
          ),
        },
      ],
      PLAIN,
    ),
    s(
      "pt4",
      "Benefits",
      [
        eyebrow("pt4k", "Our commitment to you"),
        heading("pt4h", "The benefits of being a partner"),
        {
          id: "pt4s",
          type: "stats",
          cols: "3",
          items: items(
            "pt4s",
            [
              [
                "01",
                "Praying for peace, power, and the provision of God to manifest in your household.",
              ],
              [
                "02",
                "Being good stewards over the resources entrusted to the ministry.",
              ],
              [
                "03",
                "Teachings on messages specially selected by our pastor — for partners only.",
              ],
              ["04", "A personal letter from our pastor each quarter."],
              ["05", "Priority seating and registration at conferences."],
            ],
            ["value", "label"],
          ),
        },
      ],
      PLAIN,
    ),
    s(
      "pt5",
      "Join",
      [
        {
          id: "pt5c",
          type: "ctaband",
          title: "Join [partner program name]",
          text: "Commit to pray for the ministry and sow into it each month.",
          buttons: items(
            "pt5c",
            [
              ["Join today", "/contact", "primary"],
              ["Questions? Contact us", "/contact", "outline"],
            ],
            ["label", "href", "style"],
          ),
        },
      ],
      { ...PLAIN, padding: "24px 24px 96px" },
    ),
  ],
};

const CONTACT_PAGE = {
  id: "starter-contact",
  name: "Contact (new design)",
  description:
    "Contact cards (email, phone, address), the contact form and a map.",
  sections: [
    s(
      "ct1",
      "Introduction",
      [
        eyebrow("ct1k", "We’d love to hear from you"),
        heading("ct1h", "Contact", "h1"),
        text(
          "ct1t",
          "<p>Questions about your membership, a message, or the live services? Send us a note.</p>",
        ),
      ],
      { ...PLAIN, padding: "72px 24px 8px" },
    ),
    s(
      "ct2",
      "Details and form",
      [
        cols(
          "ct2c",
          42,
          [
            {
              id: "ct2a",
              type: "contactcards",
              items: items(
                "ct2a",
                [
                  [
                    "mail",
                    "Email",
                    "[email address]",
                    "mailto:info@example.org",
                    "",
                  ],
                  [
                    "phone",
                    "Phone",
                    "[phone number]",
                    "tel:+10000000000",
                    "[Office hours]",
                  ],
                  [
                    "pin",
                    "Address",
                    "[Street, City, State ZIP]",
                    "https://www.google.com/maps",
                    "Get directions",
                  ],
                ],
                ["icon", "label", "value", "link", "note"],
              ),
            },
          ],
          [
            heading("ct2h", "Send us a message", "h2"),
            {
              // messages go to Admin › Form Submissions (the editor gives the form
              // a new id when the template is applied; any id works)
              id: "contact-form",
              type: "form",
              title: "Send us a message",
              submit_text: "Send message",
              notify_email: "",
              success_message: "Thank you! We’ll get back to you soon.",
              fields: [
                { id: "name", label: "Name", type: "text", required: true },
                { id: "email", label: "Email", type: "email", required: true },
                { id: "phone", label: "Phone", type: "phone", required: false },
                {
                  id: "message",
                  label: "Message",
                  type: "textarea",
                  required: true,
                },
              ],
            },
          ],
          "start",
        ),
      ],
      PLAIN,
    ),
    s(
      "ct3",
      "Find us",
      [
        heading("ct3h", "Find us"),
        {
          id: "ct3m",
          type: "map",
          address: "[Street, City, State ZIP]",
          zoom: 15,
          height: 380,
        },
      ],
      { ...PLAIN, padding: "24px 24px 96px" },
    ),
  ],
};

export const STARTER_PAGES = [
  ABOUT_PASTOR,
  PASTORAL_LEADERSHIP,
  BECOME_PARTNER,
  CONTACT_PAGE,
  {
    id: "starter-sermon",
    name: "Sermon page",
    description: "A featured message, a key quote and more teachings.",
    sections: [
      s("ss1", "Message", [
        heading("ss1h", "Message title", "h1", center),
        text("ss1t", "<p>Speaker · Date · Series</p>", center),
        { id: "ss1v", type: "video", url: "", title: "Message" },
        text(
          "ss1d",
          "<p>Write a short summary of this message and its key scripture.</p>",
        ),
      ]),
      s("ss2", "Key quote", [
        {
          id: "ss2q",
          type: "quote",
          text: "Add a key quote from the message.",
          name: "Speaker name",
          role: "",
          image_url: "",
          align: "center",
        },
      ]),
      s("ss3", "More teachings", [
        heading("ss3h", "More teachings", "h2"),
        {
          id: "ss3g",
          type: "videos",
          source: "latest",
          collection: "",
          order: "newest",
          count: 6,
          cols: 3,
          show_titles: true,
        },
        button("ss3b", "Browse all messages", "/catalog"),
      ]),
    ],
  },
  {
    id: "starter-event",
    name: "Event page",
    description: "Date and details, an image, registration and questions.",
    sections: [
      s("se1", "Event", [
        heading("se1h", "Event name", "h1", center),
        text(
          "se1t",
          "<p><strong>Date and time</strong> · Location</p>",
          center,
        ),
        {
          id: "se1i",
          type: "image",
          src: "",
          alt: "",
          link: "",
          width: 100,
          align: "center",
        },
        text(
          "se1d",
          "<p>Describe the event: who it's for, what to expect and what to bring.</p>",
        ),
        button("se1b", "Register now", "/signup"),
      ]),
      s("se2", "Questions", [
        heading("se2h", "Questions", "h2"),
        faq("se2f", [
          ["Is there a cost?", "Add the answer here."],
          ["Is childcare available?", "Add the answer here."],
        ]),
      ]),
    ],
  },
  {
    id: "starter-about",
    name: "About page",
    description: "A photo with your story, a quote and your ministries.",
    sections: [
      s("sa1", "About", [
        columns2(
          "sa1c",
          [
            {
              id: "sa1i",
              type: "image",
              src: "",
              alt: "",
              link: "",
              width: 100,
              align: "center",
            },
          ],
          [
            heading("sa1h", "About our pastor", "h1"),
            text(
              "sa1t",
              "<p>Share the story, calling and vision of the ministry.</p>",
            ),
          ],
        ),
      ]),
      s("sa2", "Quote", [
        {
          id: "sa2q",
          type: "divider",
          line: "solid",
          thickness: 1,
          width: 40,
          color: "",
        },
        {
          id: "sa2r",
          type: "quote",
          text: "Add a quote that captures the ministry.",
          name: "",
          role: "",
          image_url: "",
          align: "center",
        },
      ]),
      s("sa3", "Ministries", [
        heading("sa3h", "Our ministries", "h2", center),
        cards("sa3g", [
          ["Worship", "Describe this ministry."],
          ["Teaching", "Describe this ministry."],
          ["Outreach", "Describe this ministry."],
        ]),
      ]),
    ],
  },
  {
    id: "starter-give",
    name: "Give / Partner page",
    description: "Ways to give, a call to action and common questions.",
    sections: [
      s("sg1", "Give", [
        heading("sg1h", "Partner with the ministry", "h1", center),
        text(
          "sg1t",
          "<p>Explain how giving supports the ministry's work.</p>",
          center,
        ),
        cards("sg1g", [
          ["Give once", "A one-time gift."],
          ["Give monthly", "Become a monthly partner."],
          ["Other ways", "Mail, events and more."],
        ]),
        button("sg1b", "Give now", "/give"),
      ]),
      s("sg2", "Questions", [
        heading("sg2h", "Questions about giving", "h2"),
        faq("sg2f", [
          ["Is my gift tax-deductible?", "Add the answer here."],
          ["Can I change my monthly gift?", "Add the answer here."],
        ]),
      ]),
    ],
  },
  {
    id: "starter-landing",
    name: "Ministry landing page",
    description: "A bold welcome, highlights, videos and a call to action.",
    sections: [
      s("sl1", "Welcome", [
        container(
          "sl1c",
          [
            heading("sl1h", "Welcome to the ministry", "h1", center),
            text(
              "sl1t",
              "<p>One sentence that tells visitors what you offer.</p>",
              center,
            ),
            button("sl1b", "Start watching", "/catalog"),
          ],
          {
            width_mode: "boxed",
            min_height: 320,
            justify: "center",
            align_items: "center",
            styles: { bg_color: "#1e1b4b", padding_px: "48", radius_px: "18" },
          },
        ),
      ]),
      s("sl2", "Highlights", [
        spacer("sl2s", 16),
        cards("sl2g", [
          ["Live services", "Join us live every week."],
          ["Teachings", "Messages to strengthen your walk."],
          ["Community", "Connect and grow together."],
        ]),
      ]),
      s("sl3", "Latest videos", [
        heading("sl3h", "Latest videos", "h2"),
        {
          id: "sl3g",
          type: "videos",
          source: "latest",
          collection: "",
          order: "newest",
          count: 3,
          cols: 3,
          show_titles: true,
        },
      ]),
      s("sl4", "Call to action", [
        container(
          "sl4c",
          [
            heading("sl4h", "Ready to go deeper?", "h2", center),
            button("sl4b", "Create a free account", "/signup"),
          ],
          {
            width_mode: "boxed",
            styles: { bg_color: "#312e81", padding_px: "32", radius_px: "16" },
          },
        ),
      ]),
    ],
  },
];
