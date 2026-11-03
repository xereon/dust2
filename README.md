# DUST II

A browser tactical shooter on a from-scratch recreation of the Dust II layout, built in Three.js.

Open `index.html` over HTTP (GitHub Pages works as-is; locally: `npx serve .`). No build step:
pure ES modules, Three.js r180 vendored under `vendor/`, and every texture, mesh and sound is
generated procedurally at runtime — no game assets are shipped.

* `CONTRACT.md` — module interfaces, units (Source units, Source angle convention), events.
* `AGENTS.md` — how to run the headless screenshot/probe harness in `tools/`.
* Controls: WASD move, mouse aim/fire, Space jump, Ctrl crouch, Shift walk, R reload,
  B buy menu, Tab scoreboard, 1–5 / Q weapon slots, G drop, E use/defuse.
