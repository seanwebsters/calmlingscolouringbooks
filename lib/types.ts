export type PageSize = "letter" | "square";
export type PageStatus = "pending" | "queued" | "generating" | "complete" | "failed";
export type CoverStatus = "none" | "queued" | "generating" | "complete" | "failed";
export type PlanStatus = "none" | "planning" | "ready" | "failed";

export type Character = {
  id: string;
  name: string;
  description: string;
  image_path: string;
  mime_type: string;
  created_at: string;
  updated_at: string;
};

export type Palette = { name: string; colors: string[] };

export type CoverSettings = {
  title?: string;
  subtitle?: string;
  font?: "serif" | "sans";
  textColor?: string;
  position?: "top" | "center" | "bottom";
  showLogo?: boolean;
  /** Draw a soft panel behind the title for legibility. */
  panel?: boolean;
};

export type Book = {
  id: string;
  title: string;
  description: string;
  page_size: PageSize;
  page_count: number;
  character_ids: string[];
  palette: Palette | null;
  cover_concept: string;
  cover_prompt: string;
  cover_settings: CoverSettings;
  cover_status: CoverStatus;
  cover_image_path: string | null;
  cover_width: number | null;
  cover_height: number | null;
  cover_error: string | null;
  cover_job_id: string | null;
  plan_status: PlanStatus;
  plan_error: string | null;
  approved_at: string | null;
  parent_book_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Page = {
  id: string;
  book_id: string;
  position: number;
  title: string;
  prompt: string;
  character_ids: string[];
  status: PageStatus;
  image_path: string | null;
  image_width: number | null;
  image_height: number | null;
  error: string | null;
  current_job_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Job = {
  id: string;
  kind: "page" | "cover";
  book_id: string;
  page_id: string | null;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  attempts: number;
  max_attempts: number;
  sort_key: number;
  error: string | null;
  run_after: string;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BookStatusLabel =
  | "Draft"
  | "Planning"
  | "Plan ready"
  | "Generating"
  | "Needs attention"
  | "In review"
  | "Approved";
