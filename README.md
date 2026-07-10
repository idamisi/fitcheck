FitCheck

Built for the IBM AI Builders Challenge — July 2026: "Reimagine Creative Industries with AI"

Problem Statement

Comparing clothing items across multiple online shops is tedious and visually disconnected. Shoppers open dozens of tabs, mentally compare colors and styles across different product photos, and struggle to judge whether pieces from different retailers would actually look good together. There's no easy way to preview a personal outfit combination without physically owning the items or shopping in person.

Solution Description

FitCheck lets a user generate a simplified 2D avatar based on their own body measurements, then browse a catalog of clothing items and see them rendered on that avatar at true relative proportions — so a garment that's too short or too narrow for the user's frame is visually apparent, not simulated. When a user selects an item, the app returns a plain-language, non-evaluative comparison between the garment's measurements and the user's own, plus a small set of recommended complementary items. FitCheck does not judge fit as "good" or "bad" — it surfaces factual comparisons and lets the user decide what works for them.

Core features:


Manual measurement input (height, shoulder width, chest, waist, hip, inseam) mapped to a parametrically scaled 2D avatar
A catalog of ~150 clothing items, browsable and filterable by category, color, and style
A combination view that overlays selected items on the user's avatar at true relative scale, using fixed anchor points, so fit mismatches are visible through accurate geometry
On item selection, a single AI call returns: (1) descriptive fit language comparing the garment's measurements to the user's ("runs narrow through the shoulders relative to your measurements" — no scores, no "too small/too big" judgments), and (2) 2-3 recommended complementary catalog items, reasoned specifically on color and style compatibility (e.g. explaining why a color or style pairing works), respecting any active filters


Selected Challenge Theme

Reimagine Creative Industries with AI — FitCheck acts as a creative styling assistant, helping users express personal style and make faster creative decisions about how they present themselves, without the friction of traditional shopping workflows.

AI Approach and Architecture


Frontend/Backend: Next.js (React + API routes), Node.js runtime, Tailwind CSS for styling
Data layer: ~150 clothing items stored as structured JSON (id, category, color, style tags, image reference, garment measurements), accessed through a dedicated data-access module rather than imported directly into UI components — this keeps the door open to swapping in a live API without restructuring the app
AI component: A single AI call to IBM Granite via watsonx.ai, triggered on item selection. Input: the user's measurements, the selected item's measurements and attributes (color, style, category), the full catalog, and any active filters. Output: (1) descriptive, non-evaluative fit language comparing garment to user measurements, and (2) 2-3 recommended complementary items from the catalog, reasoned specifically on color and style compatibility, that respect the user's active filters. No scoring, no good/bad verdicts — the model describes, it doesn't judge.
Avatar generation: parametric scaling of a 2D SVG template based on user-entered measurements, with fixed anchor points (shoulder, waist, hem lines) so clothing overlays render at true relative proportions across different body sizes — fit mismatches are visible through this accurate geometry, not through AI-driven visual changes


How IBM Bob Was Used

This section will be filled in as development progresses. Bob is our primary development environment for this project — used to scaffold the Next.js project structure, build out components, and implement the matching/avatar logic. Specific examples of Bob's contributions (and where we adjusted its output) will be documented here as they happen.

Future Directions

Out of scope for this submission, but worth noting: user accounts with saved measurements and recent search/selection history, so returning users don't need to re-enter their measurements each visit. Cut from this prototype to keep the build tight and fully working within the challenge deadline, but a natural next step post-submission.

Team


Ibrahim El Damisi
Abdulrahman Hirsi


Status

Prototype in active development for the July 2026 IBM AI Builders Challenge. Submission deadline: July 31, 2026.