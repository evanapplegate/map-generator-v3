# Map Generator v2-refactor

It's a map generator. Load it up > enter Anthropic API Key > enter a map request, e.g. "world map with Australia and the U.S. labeled, color them green > Claude reads the request, returns a JSON that's fed to D3 > returns an SVG map you can save and cute up in Illustrator + a packaged D3.js map you can embed.

I prototyped with Lovable so it's insanely bloated; it uses Vite, TypeScript, React, shadcn-ui, Tailwind CSS. Let's get this down to HTML, CSS, JS.