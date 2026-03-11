# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at http://localhost:5173
npm run build     # TypeScript check + Vite production build → /dist
npm run lint      # Run ESLint
npm run preview   # Preview production build
```

## Architecture

Single-page React 19 + Vite + TypeScript app for a luxury jewelry brand ("Aurem Gs Joyería"). No routing — one page with stacked sections.

**Component tree** (`src/App.tsx`):
```
App → Navbar → Hero → Collections → TiltedCarousel → Footer
```

**`src/components/`**
- `Navbar.jsx` — Sticky glass-morphism navbar, scroll-aware padding/shadow
- `Hero.jsx` — Left: heading/CTAs/social proof; Right: dual-column animated image ticker
- `Collections.jsx` — 3-column grid (Anillos, Collares, Pulseras) with hover folder-icon animation
- `TiltedCarousel.jsx` / `TiltedCarousel.css` — Infinite horizontal scroll (-3deg tilt, 40s loop via duplicated array)
- `Footer.jsx` — Dark footer with brand/links/contact grid

**Static assets** live in `public/assets/` (not `src/assets/`): `hero1-3.png`, `rings.png`, `necklaces.png`, `bracelets.png`.

## Design System

CSS custom properties in `src/index.css`:

| Variable | Value | Use |
|---|---|---|
| `--accent-gold` | `#D4AF37` | Primary brand accent |
| `--accent-red` | `#ea4335` | Secondary accent |
| `--text-primary` | `#111111` | Body text |
| `--transition-smooth` | `all 0.4s cubic-bezier(0.16, 1, 0.3, 1)` | All transitions |

Key animation classes: `fadeInUp`, `.delay-1/2/3` (stagger 0.2s steps), `tickerDown`/`tickerUp`, `scrollCarousel`.

Button variants: `.btn-premium`, `.btn-pill` (with `.black`, `.light`, `.light-fill` modifiers), `.red-circle` (rotating accent inside button).

Responsive breakpoint: `768px`.

## TypeScript Config

`tsconfig.app.json` enables `strict`, `noUnusedLocals`, and `noUnusedParameters`. Components can be `.jsx` or `.tsx` — both are in use.
