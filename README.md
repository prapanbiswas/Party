# LuminaParty — Free Party Light Online Controller

> Turn any phone screen into a music-reactive party light. No app. No download. 100% free.

**Live demo →** [prapanbiswas.github.io/Party](https://prapanbiswas.github.io/Party/)

---

## What It Does

LuminaParty is a browser-based party light controller. Open it on any phone or computer, host a session, share a 4-digit room code with friends, and every joined screen becomes a synchronized light node that reacts to music in real time.

No installation. No account. No cost. Works in Chrome, Firefox, Safari, and Edge.

---

## Features

| Feature | Detail |
|---|---|
| 14 Lighting Effects | Solid, Chase, Split, Rainbow, Pulse, Cascade, Meteor, Fire, Ocean, Police, Thunder, Psychedelic, Rave, Cinema |
| Music Reactive Lights | 31-band DSP audio engine via browser microphone |
| Beat Detection | Real-time onset detection + BPM tracking |
| Multi-Device Sync | Host/join system via 4-digit room code (WebRTC) |
| 6 Audio Reactive Modes | Spectrum Map, Bass Color, Beat Flash, Psychedelic, Energy Pulse, Hue Rotate |
| RGB Color Engine | HSL wheel + RGBW faders + 24-color quick palette |
| 6 Show Programs | Club Night, Full Rave, Chill Vibes, Fire Show, Cinema, Blackout |
| Online Strobe Light | 1–60 Hz, adjustable duty cycle, any color |
| Hold Triggers | White Out, Black Out, Red Alert, Police |
| Help System | In-app instructions modal covering all features |
| Fully Responsive | Works on 320px mobile to 4K desktop |
| SEO Architecture | 30-keyword matrix, 4 structured data schemas, 3 programmatic sub-pages |

---

## Pages (Hub-and-Spoke SEO Architecture)

| URL | Target Keywords |
|---|---|
| `/Party/` | party light online, free party light online, online party light, virtual disco ball |
| `/Party/strobe-light/` | strobe light online, free online strobe tool, no app strobe light |
| `/Party/virtual-disco-ball/` | virtual disco ball, online disco light, disco light online free |
| `/Party/music-sync/` | party lights sync to music, sound activated disco lights online, beat sync light browser |

---

## How to Use

1. Open [prapanbiswas.github.io/Party](https://prapanbiswas.github.io/Party/)
2. Tap **Host Party** — a 4-digit room code appears at the top
3. Share the code with friends via WhatsApp or SMS
4. Friends open the same URL, tap **Join Lights**, enter the code
5. Each joined phone screen becomes a synchronized light node
6. Go to the **Audio** tab → tap **Enable Microphone Sync** → allow mic access
7. Play music — the lights react to beats, bass, and BPM in real time

---

## Tech Stack

- **Vanilla JavaScript** — no frameworks, no build step
- **Web Audio API** — microphone capture and DSP analysis
- **PeerJS / WebRTC** — peer-to-peer multi-device sync
- **HTML5 Canvas** — HSL color wheel, spectrum analyzer, particle canvas
- **OrdoAudio** — custom 19-module DSP engine (pitch, chroma, onset, spectral, LUFS, ZCR)
- **Hosted on GitHub Pages** — zero server cost, global CDN

---

## Deployment

This is a fully static site. No build step required.

**Deploy to your GitHub Pages `Party` directory:**

```
Party/
├── index.html          ← Main app + landing page
├── style.css           ← All styles
├── app.js              ← Full application logic
├── ordo-audio.js       ← DSP audio engine
├── sitemap.xml         ← All 4 URLs for search indexing
├── robots.txt          ← Allows all bots including AI crawlers
├── strobe-light/
│   └── index.html      ← Standalone strobe light tool
├── virtual-disco-ball/
│   └── index.html      ← Virtual disco ball effect
└── music-sync/
    └── index.html      ← Music sync explainer + demo
```

**After deploying:**
1. Open Google Search Console for `prapanbiswas.github.io`
2. Go to **URL Inspection** and paste `https://prapanbiswas.github.io/Party/`
3. Click **Request Indexing**
4. Repeat for each sub-page URL

---

## SEO Implementation

Based on a full 30-keyword competitive analysis targeting the browser-based party light utility vertical.

**Structured Data Schemas (4 total):**
- `SoftwareApplication` — features, pricing, creator, keyword list
- `FAQPage` — 7 Q&A pairs targeting long-tail queries
- `HowTo` — 5-step guide for "how to turn phone into party light"
- Per-page `SoftwareApplication` on each sub-page

**Keyword Clusters covered:**
- Primary Core Utility (5 terms)
- Secondary Visual Effects (5 terms)
- Audio-Reactive Integrations (5 terms)
- Hardware Replacement (2 terms)
- Long-Tail Action Oriented (5 terms)
- Network & Synchronization (4 terms)
- Frictionless Alternatives (3 terms)
- Safety & Environmental (1 term)

**Internal linking:** All sub-pages link back to root with keyword-matched anchor text. Root page links to all 3 sub-pages. Footer on every page cross-links the full hub-and-spoke architecture.

**AI Crawler permissions:** `robots.txt` explicitly allows PerplexityBot, Applebot, Amazonbot, ClaudeBot, GPTBot, Google-Extended, anthropic-ai, and Bytespider for generative engine citation visibility.

---

## Author

**Prapan Biswas** — [prapanbiswas.github.io](https://prapanbiswas.github.io/)

---

*Free party light online · Strobe light online · Virtual disco ball · Music reactive lights · No app · No download*
