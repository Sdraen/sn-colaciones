import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { getCurrentApiUser } from "@/lib/api/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SN Colaciones",
    template: "%s | SN Colaciones",
  },
  description:
    "Gestión simple y sincronizada de menús, pedidos y colaciones disponibles.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const currentUser = await getCurrentApiUser();

  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <SiteHeader currentUser={currentUser} />
        {children}
      </body>
    </html>
  );
}
