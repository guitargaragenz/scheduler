# DESIGN.md: Matakana Superfoods (Creatine Synergy PDP)

## Source
- URL: https://www.matakanasuperfoods.com/products/creatine-synergy?variant=44153430704171
- Capture date: 2026-07-05
- Evidence: Firecrawl `branding` + `images` scrape, page markdown scrape. Full-page screenshot capture failed repeatedly on this URL (Firecrawl returned an unrelated Shopify JSON payload instead of image bytes across 4 retries, with and without the variant query string) — tokens below are derived from structured branding data and page markdown only, no visual screenshot reference.

## Design Summary
A clean, premium NZ health-supplement ecommerce PDP (Shopify). Calm, trustworthy, "clinical-but-natural" feel — dark forest green + off-white, serif display headings paired with a plain sans body, generous white space, rounded 8px corners on buttons/cards, no heavy shadows or gradients. Content is organized in clearly separated horizontal bands (hero → benefit icons → purchase box → description → ingredients table → how-to-use steps → comparison table → brand pillars → testimonials → FAQ accordion → reviews → cross-sell carousel → subscription benefits). Voice is calm and expertise-driven ("Supports...", "Researched aligned dose") rather than hypey.

## Design Tokens

### Colors
| Role | Value | Notes |
|---|---|---|
| Primary / brand | `#083723` | deep forest green — logo mark, primary button bg |
| Secondary | `#191D48` | dark navy — observed in branding data, not visually prominent on this page |
| Accent | `#083723` | same as primary |
| Background | `#FFFFFF` | page background |
| Text (primary) | `#1E1B1B` | near-black, body copy |
| Link / muted accent | `#567348` | sage green — links, theme-color meta tag |
| Button secondary bg | `#E0ECE0` | pale mint — "Subscribe & Save" secondary CTA |
| Button secondary text | `#1E1B1B` | |
| Wordmark accent (logo) | `#7DAB48` | mid-green used in the leaf/logo glyph — inferred from logo SVG paths |

### Typography
- Heading font: **GT Super** (serif) — fallback stack: `"GT Super", serif`
- Body font: **GT Ultra** (sans-serif) — fallback stack: `"GT Ultra", sans-serif` (branding data also flagged a `Times New Roman` fallback signal — treat as noise, use GT Ultra/sans-serif as the real body stack)
- Font sizes (observed): H1 `40px`, H2 `20px`, body `16px`
- Headings read as calm serif display type contrasted against a plain, small-size sans body — lots of line-height, not tightly kerned

### Spacing And Layout
- Base spacing unit: `4px`
- Border radius: `8px` standard (buttons, cards); secondary/utility elements use `0px` (sharp corners) — used deliberately to differentiate primary CTAs from secondary UI
- No shadows on buttons or inputs (`shadow: none` across the board) — flat design, relies on color/whitespace for hierarchy, not elevation
- Content is centered in a constrained column with wide margins; sections stack vertically with clear full-bleed background breaks between bands (white → pale mint → white, etc.)

## Components

**Buttons**
- Primary: bg `#083723`, text `#FFFFFF`, radius `8px`, no shadow. Used for "Add to Cart".
- Secondary: bg `#E0ECE0`, text `#1E1B1B`, radius `0px`, no shadow. Used for "Subscribe & Save".
- Both are full-width or near-full-width within the purchase box, stacked.

**Purchase box** (sticky/prominent on PDP)
- Product thumbnail + name + size (e.g. "300g")
- Toggle: One-time purchase vs. Subscribe & Save (15% off badge)
- Frequency selector (30/60/90 days) shown only when subscribe is selected
- Quantity stepper (`-` / `+`)
- Primary CTA button showing live price
- Payment method icons row below CTA (Afterpay, PayPal, Apple Pay, Amex, Mastercard, Visa, Shop Pay) — small greyscale/brand-colored icons in a single row

**Benefit icon row** — 3–4 small SVG icons + one-line label each (e.g. "Supports Exercise Recovery", "Supports Lean Muscle Mass", "Supports Memory & Focus"), horizontally arranged directly under the product title, repeated again lower on the page as a divider band

**Comparison table** ("Why Choose Us?")
- 3-column table: Feature / Us (with product thumbnail in header) / Others
- ✓ / ✗ checkmarks, no color-coding beyond the glyph itself — simple and legible

**Brand pillars** ("The Matakana Difference")
- 3-column layout, each with a short bold heading (Quality / Expertise / Wellness) + 2–3 sentence description, no icons — text-led

**Testimonials**
- 2-up card layout: circular/rounded portrait photo, role (e.g. "UFC Heavyweight"), name, social handle link, 1–2 sentence quote

**FAQ accordion**
- Plain text question rows that expand to answer paragraphs, no card borders — minimal accordion, relies on generous vertical spacing

**Ingredients table**
- Simple 3-column data table: Ingredient / Strength / Units, thin row borders, no zebra striping

**How-to-use steps**
- 3 numbered steps, each with a square product-photography image above a short bold caption and a numeral

**Cross-sell / "Pair it with" and "Related Products"**
- Horizontal card carousel: product image, name, brand, price (with strikethrough original price when discounted), 2 tag pills (e.g. "Lean Muscle Mass", "Brain Health"), "Quick add" link

**Subscription benefits band**
- 4-column icon-free text blocks (Health made easy / Savings / Flexibility / Exclusive Benefits), each a bold short heading + 1-sentence description

**Header / nav**
- Logo (SVG wordmark, left) + mega-menu nav ("Shop", "Subscribe & Save", "Learn") + currency selector + login
- Shop mega-menu is organized into named sub-groups (Nutrition & Wellness, Everyday Essentials, Supplements, Targeted Wellness, Focus, Goals, Diet) each with a text link list, plus promotional image tiles (collection hero + "Shop Now" CTA) interspersed between groups

## Page Patterns
1. Header with mega-menu
2. Breadcrumb (Shop / Supplements by Type)
3. Hero: product image + "New Arrival" tag + title + benefit icon row + short 2-sentence pitch
4. Purchase box (subscribe/one-time toggle, frequency, qty, CTA, payment icons)
5. "Pair it with" cross-sell mini-carousel
6. Product Description + Health Benefits bullet list
7. Ingredients table + Directions + Cautions & Storage
8. Repeated purchase box (mobile sticky pattern duplicated in markdown — likely a sticky/mobile variant of step 4)
9. Repeated Description/Ingredients (again, likely desktop vs. mobile duplicate rendering)
10. "How To Use" 3-step image block
11. "Why Choose Us?" comparison table
12. "The Matakana Difference" 3-column pillars
13. "Trusted by Experts & Athletes" testimonials
14. FAQ accordion
15. Customer Reviews block (empty state: "Be the first to write a review")
16. Related Products carousel
17. "Upgrade & Save" bundle upsell (Rebuy-powered)
18. "Why Subscribe?" 4-column benefit band
19. Footer (assumed standard Shopify footer, not fully captured in this scrape)

Responsive assumption: mobile likely collapses the mega-menu into a drawer, and the purchase box likely becomes sticky-bottom on scroll (common Shopify PDP pattern, inferred — not directly observed).

## Content Style
- Calm, benefit-led, second-person-light voice: "Supports ATP production", "Supports brain health" — declarative, not exclamation-heavy
- CTA wording is plain and functional: "Add to Cart", "Subscribe & Save", "Shop Now", "Quick add", "Learn More" — no urgency/hype language ("limited time", "hurry")
- FAQ answers are genuinely educational/long-form, written in a reassuring clinical-but-friendly tone, often ending with a doctor/healthcare-professional caveat
- Numbers and specificity used for credibility (exact gram doses, percentages, "decades of experience") rather than vague superlatives

## Agent Build Instructions
To recreate this style for a new landing page:
1. Set base palette: background `#FFFFFF`, primary text `#1E1B1B`, primary/CTA color `#083723` (deep forest green), secondary/pale surface `#E0ECE0`, link/accent `#567348`.
2. Pair a serif display font (GT Super or a similar humanist serif like "Fraunces"/"Playfair Display" as a substitute) for H1/H2 headings with a plain sans body font (GT Ultra, or substitute "Inter"/"Public Sans") at 16px base.
3. Use `8px` border radius on primary buttons and cards; keep secondary/utility UI sharp-cornered (`0px`) to visually demote it below primary actions.
4. No shadows anywhere — rely on flat color blocks and whitespace bands to separate sections (alternate white and pale-mint full-bleed backgrounds between sections).
5. Structure any product/landing page as stacked horizontal bands in this order: hero w/ benefit icon row → purchase/CTA box → cross-sell strip → long-form description/specs → visual how-to-use steps → comparison table vs. competitors → brand-pillar 3-column trust block → testimonials → FAQ accordion → related items carousel → subscription/benefit summary band.
6. Write copy in a calm, plain, benefit-first voice ("Supports X", "Backed by Y") — avoid hype/urgency language; back up claims with specific numbers.
7. Do not reuse Matakana Superfoods' actual product photography, logo, or copy verbatim — these are third-party assets; use them only as compositional/style reference for a new build.

## Rerun Inputs
workflow: firecrawl-website-design-clone
source_url: https://www.matakanasuperfoods.com/products/creatine-synergy?variant=44153430704171
target_stack: (not yet specified — ask before implementing)
output: DESIGN.md
