import { BookWorkspace, type Tab } from "@/components/book/BookWorkspace";

const TABS: Tab[] = ["plan", "pages", "cover", "export"];

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <BookWorkspace id={id} initialTab={TABS.includes(tab as Tab) ? (tab as Tab) : undefined} />;
}
