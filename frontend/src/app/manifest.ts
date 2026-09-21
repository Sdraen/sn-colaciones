import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SN Colaciones",
    short_name: "SN Colaciones",
    description: "Gestión diaria de menús, pedidos, producción y entrega de colaciones.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fff6e5",
    theme_color: "#d84b2a",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
