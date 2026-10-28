import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Many Hands",
    short_name: "Many Hands",
    description: "Many hands make light work. Keeping families connected. Making care simple.",
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
