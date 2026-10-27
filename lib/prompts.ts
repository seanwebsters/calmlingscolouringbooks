import type { Book, Character, Palette } from "./types";

/** Art direction applied to every interior page. Kept in one place so plans,
 *  generations and regenerations stay consistent. */
export const ART_DIRECTION = [
  "Sophisticated adult colouring book page (not a children's book).",
  "Intricate botanical and environmental detail: layered foliage, flowers, textures and patterns that reward slow colouring.",
  "Crisp, clean, confident black outlines on a pure white background.",
  "Absolutely no shading, hatching-as-shadow, grey fills, gradients, solid black areas or coloured backgrounds.",
  "Calm, immersive, peaceful environments with a sense of depth.",
  "Characters are generally small within the detailed scene (roughly 10–25% of the page) and drawn exactly as in their references.",
  "Elegant, refined illustration style — no childish cartoon styling, no thick bubbly outlines.",
  "No text, letters, numbers, signatures, borders with words or watermarks anywhere on the page.",
];

export const CHARACTER_FIDELITY_RULES = [
  "Reproduce each character's design exactly from its reference image: same head shape, body shape, proportions, ears, eyes, markings and silhouette.",
  "Never invent or add tails, noses, mouths, limbs, fingers, wings, horns, clothing, hats or accessories that are not visible in the reference.",
  "Never remove features that are present in the reference.",
  "Do not merge characters together or swap their features.",
];

function characterBlock(chars: Character[], colourMode: "lineart" | "colour") {
  if (chars.length === 0) {
    return "CHARACTERS: None on this page — environment only. Do not add any creatures or characters.";
  }
  const lines = chars.map(
    (c, i) => `- Reference image ${i + 1} is "${c.name}"${c.description ? ` — ${c.description}` : ""}.`,
  );
  const conversion =
    colourMode === "lineart"
      ? "Render the characters as clean black outline art that matches the rest of the page — translate the reference into outlines only, with no colour, grey or shading."
      : "Keep each character's colours faithful to its reference.";
  return [
    "CHARACTERS: The attached reference image(s) show the official Calmlings characters. Each must appear exactly once unless the scene says otherwise.",
    ...lines,
    ...CHARACTER_FIDELITY_RULES.map((r) => `- ${r}`),
    `- ${conversion}`,
  ].join("\n");
}

export function pagePrompt(scene: string, chars: Character[]) {
  return [
    "Create one interior page for a premium adult colouring book.",
    "",
    `SCENE: ${scene.trim()}`,
    "",
    "ART DIRECTION:",
    ...ART_DIRECTION.map((r) => `- ${r}`),
    "",
    characterBlock(chars, "lineart"),
    "",
    "OUTPUT: pure white paper background, black line art only, the composition filling the page with a slim clean white margin. Reminder: no shading, no grey, no colour, no text.",
  ].join("\n");
}

export function coverPrompt(book: Book, chars: Character[], position: "top" | "center" | "bottom") {
  const palette = book.palette
    ? `Use this distinct palette as the colour story: "${book.palette.name}" — ${book.palette.colors.join(", ")}. Harmonious, sophisticated and slightly muted.`
    : "Use a sophisticated, harmonious, slightly muted palette.";
  const space =
    position === "top"
      ? "the upper third"
      : position === "bottom"
        ? "the lower third"
        : "a calm band across the middle";
  return [
    "Create a full-colour front cover illustration for a premium colouring book for adults.",
    "",
    `BOOK THEME: ${book.description || book.title}`,
    `COVER SCENE: ${book.cover_concept || "A serene, richly detailed botanical environment that captures the theme."}`,
    "",
    "STYLE:",
    "- Elegant, premium, calming and refined — aimed at adults, never childish.",
    "- Intricate botanical and environmental detail with crisp linework and soft, painterly colour.",
    `- ${palette}`,
    `- Leave clear, uncluttered negative space in ${space} of the image where title typography will be overlaid later.`,
    "- Edge-to-edge artwork with no border or frame.",
    "- Absolutely no text, letters, numbers, logos, signatures or watermarks — typography is added separately.",
    "",
    characterBlock(chars, "colour"),
  ].join("\n");
}

export const PLAN_SYSTEM = `You are the art director for "Calmlings", a premium series of adult colouring books.
You write page-by-page plans that an image model will turn into intricate black-and-white line art.
Every page must be a unique, calm, immersive scene with rich botanical and environmental detail.
Vary environments, seasons, times of day, vantage points and compositions across the book so no two pages feel alike, while keeping the book's theme coherent.
Characters should usually be small within the scene, doing quiet, gentle things (resting, observing, tending, wandering).
Never describe shading, colour, text, lettering or signage. Never give characters clothing, accessories, tails, limbs or features — their design comes only from reference images.
Only use character names from the provided list, spelled exactly.`;

export function planUserPrompt(opts: {
  title: string;
  description: string;
  pageCount: number;
  characters: Character[];
  avoidPalettes: Palette[];
  startIndex?: number;
  existingTitles?: string[];
}) {
  const chars =
    opts.characters.length > 0
      ? opts.characters.map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`).join("\n")
      : "(no characters selected — environment-only pages)";
  const avoid = opts.avoidPalettes.length
    ? `\nThese palettes are already used by other books in the series; choose a clearly different one:\n${opts.avoidPalettes
        .map((p) => `- ${p.name}: ${p.colors.join(", ")}`)
        .join("\n")}`
    : "";
  const existing = opts.existingTitles?.length
    ? `\nThese pages already exist; write new, different scenes that continue the book:\n${opts.existingTitles.map((t) => `- ${t}`).join("\n")}`
    : "";
  return `Book title: ${opts.title}
Theme / description: ${opts.description || "(none given — infer a calm theme from the title)"}

Available characters:
${chars}

Write exactly ${opts.pageCount} pages.
For each page give:
- "title": a short evocative scene name (2–5 words).
- "scene": 60–120 words describing the environment, botanical/architectural detail, composition and foreground/background layers, and where any characters are and what they are quietly doing.
- "characters": names of the characters that appear (may be empty; usually 1–2).
Spread characters across the book so each appears regularly.

Also give:
- "palette": a distinct cover colour palette with a poetic name and 5 hex colours.
- "cover_concept": 40–80 words describing a striking, elegant cover scene.${avoid}${existing}`;
}

export const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["palette", "cover_concept", "pages"],
  properties: {
    palette: {
      type: "object",
      additionalProperties: false,
      required: ["name", "colors"],
      properties: {
        name: { type: "string" },
        colors: { type: "array", items: { type: "string" } },
      },
    },
    cover_concept: { type: "string" },
    pages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "scene", "characters"],
        properties: {
          title: { type: "string" },
          scene: { type: "string" },
          characters: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export type PlanResult = {
  palette: Palette;
  cover_concept: string;
  pages: { title: string; scene: string; characters: string[] }[];
};
