# Granger Brand Guide

> Last updated: 2026-04-02

---

## 1. Brand Identity

**Granger** is an AI Chief of Staff for knowledge teams. The visual identity communicates: intelligence, connectivity, precision, and calm confidence.

**Core metaphor:** Neural networks — dots connecting, synapses firing, layers of knowledge linking together.

---

## 2. Colors

### Primary Palette
| Name | Hex | Usage |
|------|-----|-------|
| **Mint** (primary) | `#34d399` | Buttons, accents, active states, links, brand highlight |
| **Mint Dark** | `#10b981` | Hover states, secondary accent |
| **Mint Light** | `#6ee7b7` | Subtle highlights, chart secondary |
| **Mint Tint** | `rgba(52,211,153,0.08)` | Card fills, subtle backgrounds |
| **Mint Glow** | `rgba(52,211,153,0.3)` | Text shadows, glows |

### Neutral Palette (Dark Mode)
| Name | Hex | Usage |
|------|-----|-------|
| **Background** | `hsl(160,15%,5%)` | Page background |
| **Card** | `hsl(160,12%,7%)` | Card/panel backgrounds |
| **Text Primary** | `#e5e7eb` | Body text |
| **Text Secondary** | `#9ca3af` | Secondary text, labels |
| **Text Muted** | `#6b7280` | Subtle text, placeholders |
| **Border** | `rgba(255,255,255,0.06)` | Card borders, dividers |
| **Border Accent** | `#1f2937` | Stronger borders |

### Usage Rules
- NEVER use solid bright backgrounds or gradients
- Subtle mint tints OK for card fills
- Text on dark backgrounds must have high contrast (minimum #9ca3af)
- Grid patterns: `rgba(52,211,153,1)` at 3% opacity

---

## 3. Typography

### Fonts
| Font | Variable | Usage |
|------|----------|-------|
| **Inter** | Default sans | Body text, UI elements, forms |
| **Space Grotesk** | `--font-display` / `font-display` | Headlines, logo, hero text, page titles |

### Scale
| Size | Tailwind | Usage |
|------|----------|-------|
| 10px | `text-[10px]` | Badges, meta labels, timestamps |
| 11px | `text-[11px]` | Tool call text, version labels |
| 12px | `text-xs` | Secondary text, descriptions |
| 13px | `text-sm` | Body text, chat messages |
| 14px | `text-sm` | Buttons, nav items |
| 18px | `text-lg` | Section headings |
| 24px | `text-2xl` | Page titles |
| 30-36px | `text-3xl`-`text-4xl` | Hero headings (font-display) |

### Rules
- Minimum font size: 12px for body, 10px for labels
- font-weight: 400 body, 500-600 buttons/labels, 700 headings
- tracking-tight on display headings
- NO font-family changes in inline HTML — inherit from app

---

## 4. The Neural Animation

### NeuralDots Component
The signature Granger visual — SVG-based neural network animation with:
- Multiple orbital layers of mint dots
- Cross-layer connections (fading lines)
- Center pulse glow
- Dots pulse in opacity and size

### Usage
| Context | Size | Dots | Example |
|---------|------|------|---------|
| Tool call indicator | 18px | 4 | Running tool spinner |
| Sidebar logo (collapsed) | 28px | 5 | Brand mark |
| Chat AI avatar | 36-44px | 6-8 | Next to AI messages |
| Loading/thinking state | 36px | 6 | With status text |
| Welcome/empty state | 80-96px | 12-14 | Centered hero |
| Hero background | 128px+ | 16+ | Decorative |

### Never use NeuralDots for:
- User avatars (use profile image or initial)
- Static icons (use Lucide icons)
- Backgrounds larger than 200px (use Entropy canvas instead)

### Entropy Canvas (Large Backgrounds Only)
- Canvas-based particle physics — heavy, use sparingly
- Mint colored particles (#34d399)
- Transparent background
- Only for: hero sections, splash screens, login page
- Always use opacity (15-30%) and mask/fade gradients

---

## 5. Component Patterns

### Cards
```
border: 1px solid rgba(255,255,255,0.06)
border-radius: 8-12px
background: transparent or hsl(160,12%,7%)
hover: border-color transitions to primary/30
```

### Badges
```
border: 1px solid primary/30
color: primary (#34d399)
background: transparent
border-radius: 9999px (pill)
padding: 2px 10px
font-size: 10-11px
```

### Buttons
```
Primary: bg-primary text-primary-foreground hover:bg-primary/90
Outline: border text-foreground hover:bg-accent
Ghost: text-muted-foreground hover:bg-muted hover:text-foreground
```

### Grid Background Pattern
```css
background-image:
  linear-gradient(rgba(52,211,153,1) 1px, transparent 1px),
  linear-gradient(90deg, rgba(52,211,153,1) 1px, transparent 1px);
background-size: 40px 40px;
opacity: 0.03;
```

---

## 6. Inline HTML Visuals (Chat)

When the AI generates inline HTML in chat, it MUST follow:

### Colors
- Text: `#e5e7eb` (primary), `#9ca3af` (secondary), `#6b7280` (muted)
- Accent: `#34d399` (mint)
- Fills: `rgba(52,211,153,0.08)` only. NO solid backgrounds.
- Borders: `1px solid rgba(255,255,255,0.06)`

### Animations
- Use CSS `@keyframes` for: pulse, fade, glow, slide, float
- Entrance animations on all visual elements (fade-in, slide-up)
- Subtle hover transitions where applicable
- Pulsing glow on accent elements: `box-shadow: 0 0 12px rgba(52,211,153,0.2)`

### Layout
- Transparent background ALWAYS
- border-radius: 8-12px on containers
- Compact: tight padding (8-12px), small gaps
- Flexbox/grid layouts, prefer horizontal over vertical
- Max height 500px per visual block

### Do NOT
- Set background-color on body or wrapper divs
- Use gradients
- Use emojis
- Change font-family
- Create oversized elements

---

## 7. Logo

### Mark
The Granger logo mark is the NeuralDots animation at 28px, representing the neural network / AI brain.

### Wordmark
"GRANGER" in Space Grotesk, font-display, tracking-widest, with subtle mint glow:
```css
font-family: var(--font-display);
letter-spacing: 0.1em;
color: #34d399;
text-shadow: 0 0 8px rgba(52,211,153,0.3);
```

### Combined
NeuralDots mark + GRANGER wordmark with gap-3.

---

## 8. CSS Variables Reference

```css
:root / .dark {
  --background: 160 15% 5%;
  --foreground: 155 15% 95%;
  --card: 160 12% 7%;
  --primary: 160 55% 55%;        /* #34d399 */
  --primary-foreground: 160 20% 5%;
  --secondary: 160 12% 12%;
  --muted: 160 12% 12%;
  --muted-foreground: 155 10% 55%;
  --accent: 160 12% 14%;
  --border: 160 10% 14%;
  --ring: 160 55% 55%;
}
```
