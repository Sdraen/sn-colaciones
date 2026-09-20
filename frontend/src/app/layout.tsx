import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LegacyServiceWorkerCleanup } from "@/components/legacy-service-worker-cleanup";
import { SiteHeader } from "@/components/site-header";
import type { NotificationDto } from "@/lib/api/contracts";
import { backendRequest, getCurrentApiUser } from "@/lib/api/server";
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
  const currentUserPromise = getCurrentApiUser();
  const notificationsPromise = currentUserPromise.then(async (currentUser) => {
    if (!currentUser) return [];
    try {
      return await backendRequest<NotificationDto[]>("/api/v1/notifications?limit=20");
    } catch {
      return [];
    }
  });
  const [currentUser, initialNotifications] = await Promise.all([
    currentUserPromise,
    notificationsPromise,
  ]);

  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <LegacyServiceWorkerCleanup />
        <SiteHeader
          currentUser={currentUser}
          initialNotifications={initialNotifications}
        />
        {children}
      </body>
    </html>
  );
}
