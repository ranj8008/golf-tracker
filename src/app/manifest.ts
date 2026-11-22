import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Golf tracker",
    short_name: "Golf",
    description: "My golf rounds, scorecards and stats",
    start_url: "/",
    display: "standalone",
    background_color: "#0e121a",
    theme_color: "#1d4fc4",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
