import type { Metadata } from "next";
import { ConfigBanner } from "@/components/ConfigBanner";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calmlings Book Studio",
  description: "Create sophisticated adult colouring books featuring the Calmlings.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream">
        <Header />
        <ConfigBanner />
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">{children}</main>
      </body>
    </html>
  );
}
