# FitCheck

Built for the IBM AI Builders Challenge — July 2026: "Reimagine Creative Industries with AI"

## Problem Statement

Comparing clothing items across multiple online shops is tedious and visually disconnected. Shoppers open dozens of tabs, mentally compare colors and styles across different product photos, and struggle to judge whether pieces from different retailers would actually look good together. There's no easy way to preview a personal outfit combination without physically owning the items or shopping in person.

## Solution Description

FitCheck lets a user generate a simplified 2D avatar based on their own body measurements, then browse a catalog of clothing items and see them rendered on that avatar at true relative proportions — so a garment that's too short or too narrow for the user's frame is visually apparent, not simulated. When a user selects an item, the app returns a plain-language, non-evaluative comparison between the garment's measurements and the user's own, plus a small set of recommended complementary items. FitCheck does not judge fit as "good" or "bad" — it surfaces factual comparisons and lets the user decide what works for them.

**Core features:**
- Manual measurement input (height, shoulder width, chest, waist, hip, inseam) mapped to a parametrically scaled 2D avatar, collected via a step-by-step guided flow with measuring instructions for each field
- An "Estimate my measurements" alternate path for users without a tape measure (in progress — currently disabled pending completion of the core AI integration below)
- A catalog of real clothing items, browsable and filterable by category, color, and style
- A combination view that overlays selected items on the user's avatar at true relative scale, using fixed anchor points, so fit mismatches are visible through accurate geometry
- On item selection, a single AI call returns: (1) descriptive fit language comparing the garment's measurements to the user's ("runs narrow through the shoulders relative to your measurements" — no scores, no "too small/too big" judgments), and (2) 2-3 recommended complementary catalog items, respecting any active filters. Shoe items receive complementary recommendations only, since there is no comparable body measurement for footwear.
- User accounts with saved measurements, outfit history, and preferences — so returning users don't re-enter their measurements each visit

## Selected Challenge Theme

Reimagine Creative Industries with AI — FitCheck acts as a creative styling assistant, helping users express personal style and make faster creative decisions about how they present themselves, without the friction of traditional shopping workflows.

## AI Approach and Architecture

- **Frontend/Backend:** Next.js (React + API routes), Node.js runtime
- **Styling:** Tailwind CSS
- **Data layer:** Clothing items stored as structured JSON (id, category, color, style tags, image reference, garment measurements), accessed through a dedicated data-access module rather than imported directly into UI components — this keeps the door open to swapping in a live API without restructuring the app
- **AI component:** A single AI call triggered on item selection, using IBM Granite via watsonx.ai. Input: the user's measurements, the selected item's measurements (resolved via its size chart reference), the full catalog, and any active filters. Output: (1) descriptive, non-evaluative fit language comparing garment to user measurements, and (2) 2-3 recommended complementary items from the catalog that respect the user's active filters. No scoring, no good/bad verdicts — the model describes, it doesn't judge.
- **Avatar generation:** Parametric scaling of a 2D SVG template based on user-entered measurements, with fixed anchor points (shoulder, waist, hem lines) so clothing overlays render at true relative proportions across different body sizes — fit mismatches are visible through this accurate geometry, not through AI-driven visual changes

## How IBM Bob Was Used

Bob is our primary development environment for this project. Concrete examples so far:

- Rebuilt the measurement input form from a single long form into a step-by-step guided flow, one field per screen, with instructional copy for how to physically take each measurement.
- Fixed an avatar rendering bug where arms were not appearing correctly, by widening the SVG viewBox and correcting arm geometry — resolved through adjusting the existing parametric scaling rather than adding new user inputs.
- Built an initial "Estimate my measurements" form and endpoint. On review, we caught that the endpoint was using a hardcoded size-lookup table rather than a real AI call, and was silently ignoring two of its six inputs. We deleted the placeholder endpoint and disabled the related button rather than ship functionality that looked complete but wasn't — this feature will be rebuilt properly once the core AI call is complete, reusing the same client and integration pattern.

## Team

- Ibrahim El Damisi
- Abdulrahman Hirsi

## Future Directions

The following were consciously scoped out of this prototype due to the challenge's time constraints, and are documented here as intentional cuts rather than oversights:

- **Photo-based body estimation.** Deliberately excluded — measurements are collected manually or, in a planned feature, estimated from self-reported height, weight, usual clothing sizes, and a fit description.
- **Live external retailer APIs.** The catalog is a hardcoded, curated dataset rather than a live feed, to keep the prototype's scope and reliability within the challenge timeline.
- **Garment fit simulation.** Fit mismatches are shown through accurate avatar geometry and descriptive AI language, not through simulated cloth physics.

## Status

Prototype in active development for the July 2026 IBM AI Builders Challenge. Submission deadline: July 31, 2026.
