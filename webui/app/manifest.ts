import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Nova Lab",
    short_name: "Nova Lab",
    description: "Nova Lab workspace",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1a1a1a",
    theme_color: "#1a1a1a",
    orientation: "any",
    categories: ["developer", "productivity"],
    lang: "en",
    icons: [
      {
        src: "/icons/nova-lab.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
