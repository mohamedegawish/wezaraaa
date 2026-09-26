Covers spec (P4) — local offline placeholders
- Files: solar-2026.svg, modernization-2026.svg, import-substitution-2026.svg
- Size: 1200x675 (16:9), SVG with gov palette (Navy #0B192C / Gold #C5A059 / Teal #0F766E)
- Usage: /covers/*.svg referenced from mockData.ts coverImage
- Fallback: card has gradient background (gov-primary-950 → gov-primary-800); <img loading=lazy onError hides img> so gradient + badges stay visible offline
- Final production swap: replace with JPG 1600x900 (~200-400KB) keeping SAME filenames but .jpg + update mockData.ts paths; no unsplash/external URLs allowed
