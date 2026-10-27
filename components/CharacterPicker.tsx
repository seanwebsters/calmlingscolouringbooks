"use client";

import type { CharacterView } from "@/lib/view";

/** Toggleable character chips with reference thumbnails. */
export function CharacterPicker({
  characters,
  selected,
  onChange,
  size = "md",
}: {
  characters: CharacterView[];
  selected: string[];
  onChange: (ids: string[]) => void;
  size?: "sm" | "md";
}) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="flex flex-wrap gap-2">
      {characters.map((c) => {
        const on = selected.includes(c.id);
        return (
          <button
            type="button"
            key={c.id}
            onClick={() => toggle(c.id)}
            aria-pressed={on}
            className={`flex items-center gap-2 rounded-full border transition ${size === "sm" ? "py-0.5 pl-0.5 pr-2.5 text-xs" : "py-1 pl-1 pr-3.5 text-sm"} ${
              on ? "border-lavender-deep/40 bg-lavender/70 text-navy" : "border-line bg-paper text-navy-soft hover:border-navy/20"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.image_url} alt="" className={`${size === "sm" ? "size-5" : "size-7"} rounded-full bg-white object-contain`} />
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
