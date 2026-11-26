/** Root layout shared by all FamilyAdmin apps (portal and module apps). */
import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "../globals.css";
import { headers } from "next/headers";
import { parseHost } from "../modules";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { module } = parseHost((await headers()).get("host") ?? "");
  const name = module?.name ?? "FamilyAdmin";
  return {
    title: module ? name : "FamilyAdmin — Baier Family Hub",
    description: "Der private Verwaltungsbereich für die Familie Baier.",
    appleWebApp: { title: name },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#fafaf7",
  viewportFit: "cover",
};

export function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
