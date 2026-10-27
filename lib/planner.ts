import "server-only";
import { chatJson } from "./openai";
import { PLAN_SCHEMA, PLAN_SYSTEM, planUserPrompt, type PlanResult } from "./prompts";
import type { Character, Palette } from "./types";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Ask the text model for a full plan, topping up if it returns too few pages. */
export async function createPlan(opts: {
  title: string;
  description: string;
  pageCount: number;
  characters: Character[];
  avoidPalettes: Palette[];
}): Promise<PlanResult> {
  const first = await chatJson<PlanResult>({
    system: PLAN_SYSTEM,
    user: planUserPrompt(opts),
    schemaName: "book_plan",
    schema: PLAN_SCHEMA as unknown as Record<string, unknown>,
  });
  const pages = [...first.pages];

  for (let attempt = 0; pages.length < opts.pageCount && attempt < 3; attempt++) {
    const more = await chatJson<PlanResult>({
      system: PLAN_SYSTEM,
      user: planUserPrompt({
        ...opts,
        pageCount: opts.pageCount - pages.length,
        existingTitles: pages.map((p) => p.title),
      }),
      schemaName: "book_plan",
      schema: PLAN_SCHEMA as unknown as Record<string, unknown>,
    });
    pages.push(...more.pages);
  }
  if (pages.length < opts.pageCount) {
    throw new Error(`The planner returned ${pages.length} of ${opts.pageCount} pages. Please try again.`);
  }

  const colors = first.palette.colors.filter((c) => HEX.test(c)).slice(0, 6);
  return {
    palette: {
      name: first.palette.name || "Untitled palette",
      colors: colors.length >= 3 ? colors : ["#2E4A62", "#E9C9B7", "#A9C5B4", "#F3E6C8", "#7E6A9B"],
    },
    cover_concept: first.cover_concept,
    pages: pages.slice(0, opts.pageCount),
  };
}

/** Map character names in a plan back to library ids (case-insensitive). */
export function resolveCharacterIds(names: string[], chars: Character[]): string[] {
  const ids = new Set<string>();
  for (const name of names) {
    const match = chars.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (match) ids.add(match.id);
  }
  return [...ids];
}
