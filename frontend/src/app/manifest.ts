import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SN Colaciones",
    short_name: "SN Colaciones",
    description: "Gestión diaria de menús, pedidos, producción y entrega de colaciones.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4e7cb",
    theme_color: "#b84b16",
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
