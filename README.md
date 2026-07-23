FitCheck

Built for the IBM AI Builders Challenge — July 2026: "Reimagine Creative Industries with AI"

Problem Statement

Shopping online is difficult when you don't know if something will actually suit you. Product photos show clothes on a model whose body doesn't match your own, so it's hard to tell whether a piece will fit well or work with what you already own. Shoppers end up guessing, ordering multiple sizes just in case, or avoiding new styles altogether — all without a real way to preview how something would look on their own body before buying it.

Solution Description

FitCheck is a styling tool: a user generates a simplified 2D avatar from their own body measurements, then browses a catalog of clothing items to build outfits. The core value is recommendation — when a user picks an item, FitCheck surfaces 5 complementary items (filterable by category, color, and style) chosen for how well they'd work together, so the user can put a full outfit together rather than evaluating one piece in isolation. Fit information comes in specifically when choosing a size for an item: FitCheck returns a plain-language, non-evaluative comparison between that garment's measurements and the user's own, rendered on the avatar at true relative proportions so a mismatch is visually apparent, not simulated. FitCheck does not judge fit as "good" or "bad" — it surfaces factual comparisons and lets the user decide what works for them.

Core features:


Manual measurement input (height, shoulder width, chest, waist, hip, inseam) mapped to a parametrically scaled 2D avatar, collected via a step-by-step guided flow with measuring instructions for each field
An "Estimate my measurements" alternate path for users without a tape measure — steps through height, weight, usual sizes, and fit notes, then calls /api/estimate to return AI-estimated body measurements pre-filled into the manual review form for the user to confirm before submitting
A catalog of real clothing items, browsable and filterable by category, color, and style
A combination view that overlays selected items on the user's avatar at true relative scale, using fixed anchor points, so fit mismatches are visible through accurate geometry
On item selection, a single AI call returns: (1) descriptive fit language comparing the garment's measurements to the user's ("runs narrow through the shoulders relative to your measurements" — no scores, no "too small/too big" judgments), and (2) 2-3 recommended complementary catalog items, respecting any active filters. Shoe items receive complementary recommendations only, since there is no comparable body measurement for footwear.


Selected Challenge Theme

Reimagine Creative Industries with AI — FitCheck acts as a creative styling assistant, helping users express personal style and make faster creative decisions about how they present themselves, without the friction of traditional shopping workflows.

AI Approach and Architecture


Frontend/Backend: Next.js (React + API routes), Node.js runtime
Styling: Tailwind CSS
Data layer: Clothing items stored as structured JSON (id, category, color, style tags, image reference, garment measurements), accessed through a dedicated data-access module rather than imported directly into UI components — this keeps the door open to swapping in a live API without restructuring the app
AI component: Three AI-backed routes, all sharing a single model client in app/lib/ai.ts:
- /api/fit — triggered on item selection. Input: user measurements, selected item measurements (resolved via size chart reference), full catalog, active filters. Output: (1) descriptive, non-evaluative fit language comparing garment to user measurements, (2) 2-3 recommended complementary items respecting active filters, reasoned on color and style compatibility. No scoring, no good/bad verdicts — the model describes, it doesn't judge. Shoe items receive complementary recommendations only.
- /api/search — triggered by free-text catalog search. Input: user query, full catalog, active filters. Output: ranked matching items with a per-item reason. Budget queries are detected and a clarifying note is shown, since price data is not currently available.
- /api/estimate — triggered by the "Estimate my measurements" flow. Input: height, weight, usual top/bottom/shoe size, fit notes. Output: estimated body measurements (shoulder width, chest, waist, hip, inseam) pre-filled into the manual review form.

Model hosting: We initially planned to serve IBM Granite via watsonx.ai. We hit a confirmed platform-side account provisioning issue on IBM Cloud that we couldn't resolve within the challenge timeline (flagged to organizers). To keep development moving, we run Granite locally via Ollama during development and testing, and use Google's Gemma 4 model via Hugging Face's Inference API (confirmed publicly available, unlike several Granite variants we checked) for the version that needs to work without a local machine running. The AI client is isolated behind a single shared function in app/lib/ai.ts, so swapping the model/provider — including back to watsonx.ai, if access is resolved — is a small, contained change rather than a rewrite.



Avatar generation: Parametric scaling of a 2D SVG template based on user-entered measurements, with fixed anchor points (shoulder, waist, hem lines) so clothing overlays render at true relative proportions across different body sizes — fit mismatches are visible through this accurate geometry, not through AI-driven visual changes


How IBM Bob Was Used

Bob is our primary development environment for this project. Concrete examples so far:


Rebuilt the measurement input form from a single long form into a step-by-step guided flow, one field per screen, with instructional copy for how to physically take each measurement.
Fixed an avatar rendering bug where arms were not appearing correctly, by widening the SVG viewBox and correcting arm geometry — resolved through adjusting the existing parametric scaling rather than adding new user inputs.
Built an initial "Estimate my measurements" form and endpoint. On review, we caught that the endpoint was using a hardcoded size-lookup table rather than a real AI call, and was silently ignoring two of its six inputs. We deleted the placeholder endpoint and disabled the related button rather than ship functionality that looked complete but wasn't — this feature will be rebuilt properly once time allows, reusing the same client and integration pattern.
Built the /api/fit route end to end, including prompt construction, error handling (no silent fallback to fake data if the AI call fails), and the shoe-category special case. Verified live — not just reviewed — by testing real requests against the model and confirming correct responses, including the failure paths (invalid item ID, invalid token).
Built the full catalog page: filterable grid (category, gender, style), product cards, and a fit-check panel that calls /api/fit and displays the result.
Added Supabase auth (passwordless email OTP), database schema (profiles, measurements, saved_items, saved_outfits with full RLS), browser and server Supabase clients, and session-refresh middleware. Split the measurement and avatar screens into real Next.js routes (/measure, /avatar) to fix a back-button regression where the entire pre-catalog flow was a single history entry.
Rebuilt /api/estimate as a real AI call (replacing the earlier placeholder) and wired it into the estimate flow with a full-screen cycling loading state. The estimate result pre-fills the manual review form so the user can confirm values before submitting.


Team


Ibrahim El Damisi
Abdulrahman Hirsi


Status

Prototype in active development for the July 2026 IBM AI Builders Challenge. The full core loop is built and working end to end: passwordless email sign-in, measurement entry (manual step-by-step flow and AI-estimated path), avatar generation, catalog browsing with conversational search, and the AI fit-check and recommendation call. The catalog currently contains tops, outerwear, and bottoms sourced from Old Navy; a shoes category is still being populated. Saved items and saved outfits (schema and RLS in place) are not yet surfaced in the UI. Public deployment (beyond local development) is in progress. Submission deadline: July 31, 2026.
