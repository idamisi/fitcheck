# FitCheck

Built for the IBM AI Builders Challenge — July 2026: "Reimagine Creative Industries with AI"

## Problem Statement

Comparing clothing items across multiple online shops is tedious and visually disconnected. Shoppers open dozens of tabs, mentally compare colors and styles across different product photos, and struggle to judge whether pieces from different retailers would actually look good together. There's no easy way to preview a personal outfit combination without physically owning the items or shopping in person.

## Solution Description

FitCheck lets a user generate a simplified 2D avatar based on their own body measurements, then browse a catalog of clothing items and preview combinations directly on that avatar. The goal is not garment fit simulation — it's fast, low-friction visual style-matching, so users can judge whether pieces work together before ever visiting a store.

**Core features:**
- Manual measurement input (height, shoulder width, chest, waist, hip, inseam) mapped to a parametrically scaled 2D avatar
- A catalog of ~150 clothing items, browsable by category, color, and style
- A combination view that overlays selected items on the user's avatar
- AI-assisted outfit scoring that reasons over item attributes and returns a compatibility verdict with a plain-language explanation
- AI-powered outfit suggestions that proactively recommend complementary pieces from the catalog based on what the user has already selected

## Selected Challenge Theme

Reimagine Creative Industries with AI — FitCheck acts as a creative styling assistant, helping users express personal style and make faster creative decisions about how they present themselves, without the friction of traditional shopping workflows.

## AI Approach and Architecture

- **Frontend/Backend:** Next.js (React + API routes), Node.js runtime
- **Data layer:** ~150 clothing items stored as structured JSON (id, category, color, style tags, image reference), accessed through a dedicated data-access module rather than imported directly into UI components — keeping the door open to swapping in a live API without restructuring the app
- **AI component:** Rule-based compatibility scoring as a baseline, with an LLM call layered on top to reason over item attributes and generate natural-language outfit explanations and proactive suggestions
- **Avatar generation:** Parametric scaling of a 2D SVG template based on user-entered measurements, with fixed anchor points (shoulder, waist, hem lines) so clothing overlays align correctly across different body proportions

## How IBM Bob Was Used

Bob is our primary development environment for this project — used to scaffold the Next.js project structure, build out components, and implement the matching and avatar logic. Specific examples of Bob's contributions (and where we adjusted its output) will be documented here as development progresses.

## Repository Structure

```
fitcheck/
├── frontend/        # Next.js application (UI + API routes)
└── data/            # Structured JSON clothing catalog
```

## Team

- Ibrahim El Damisi
- Abdulrahman Hirsi

## Status

Prototype in active development for the July 2026 IBM AI Builders Challenge. Submission deadline: July 31, 2026.
