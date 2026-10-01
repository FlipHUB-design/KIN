import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KIN",
    short_name: "KIN",
    description: "Family admin, shared. Know what's happening, what needs doing and who's doing it.",
    start_url: "/circles",
    display: "standalone",
    background_color: "#F2F4F1",
    theme_color: "#2B6A55",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
