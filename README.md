# SkillFlow

Skill-based wagering platform — bet on your own ability in head-to-head games. No luck. No house edge.

## Tech

- **Next.js 14** (App Router)
- **Tailwind CSS**
- **TypeScript**

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm start
```

Build requires network access once (Next.js fetches the Inter font from Google).

## Project structure

- `src/app/` — App Router layout and landing page
- `src/components/` — Navbar, Hero, How It Works, Games, Stats, FAQ, CTA, Footer, ScrollReveal

Waitlist CTAs currently `console.log` the email; backend can be wired up later.
