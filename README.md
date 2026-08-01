# FitCheck

Built for the IBM AI Builders Challenge, July 2026: "Reimagine Creative Industries with AI"

## Problem Statement

Building an outfit, whether from a store's catalog or from clothes you already own, usually means guessing. Shoppers don't know if a jacket will actually pair well with the trousers they have, whether a "Medium" will run tight or loose against their own body, or what colour combinations genuinely work together versus clash. People who split their time between wardrobes in different places, a different city, a different country, a different bag for the gym, also lose track of what they own and where it actually is. There's no easy way to get a second opinion that's both stylistically honest and grounded in your real measurements.

## Solution Description

FitCheck is an AI styling assistant built around a real clothing catalog, a user's own body measurements, and their own physical wardrobe.

A user can ask Fitzy, a conversational AI stylist, for outfit ideas in plain language, such as something smart-casual for a dinner date, and get real catalog picks back, filtered to their gender. They can also build outfits piece by piece in Pick & Match, swiping through every category (outerwear, tops, bottoms, shoes) and getting a genuine, detailed AI review of the finished outfit, covering how the colours and silhouettes work together, along with a specific size recommendation for every item using the sizing logic available for that item.

Users can also upload their own wardrobe. They photograph clothes they already own, Fitzy identifies the item and categorises it, and the user can style it alongside the full catalog. Items can be organised into user-named collections, whether by location, occasion, or however someone wants to group their own clothes, and Fitzy understands and respects those groupings in conversation, including temporary exclusions such as "don't suggest anything from my [collection] right now."

Users can save and revisit outfits and items at any time from a dedicated Saved page.

FitCheck never scores an outfit as good or bad. It gives specific, honest reasoning, such as why a colour pairing works or doesn't, or why a size runs tight or loose, so the user can make their own call.

## Selected Challenge Theme

Reimagine Creative Industries with AI. FitCheck acts as a personal styling partner, helping users make faster, more confident creative decisions about how they dress, grounded in their actual body and actual wardrobe rather than guesswork.

## AI Approach and Architecture

The frontend and backend are built with Next.js (App Router, React and API routes) on Node.js, styled with Tailwind CSS. Supabase handles authentication (email/OTP), Postgres data storage with row-level security, and stores user profiles, measurements, saved items and outfits, and wardrobe items, including user-created collections.

The catalog includes 84 clothing items with product metadata such as price, available sizes, and size-chart references where available.

The AI model is Google Gemma, accessed via the Hugging Face Inference API. The same model powers Fitzy's conversations, fit and outfit reviews, wardrobe image analysis, styling suggestions, and Autofit.

Fitzy's conversational search parses natural-language requests and returns relevant catalog items filtered to the user's gender, with genuine reasoning behind each pick covering colour, formality, and silhouette. Fitzy distinguishes between conversational chat and search intent, and understands user-defined wardrobe collections when discussing a user's own items. Separate fit and outfit-review flows use the user's saved measurements to provide size guidance.

Fit and outfit review uses available size data and chart-based sizing logic where supported, with sensible category-based guidance otherwise, to produce a specific size recommendation and fit description for every item, whether reviewing a single piece or a full outfit.

Wardrobe item recognition analyses an uploaded photo of a user's own clothing to identify category, colour, and style, so it can be styled alongside the catalog, with dedicated styling-suggestion and Autofit flows.

Users provide their measurements manually or through a guided estimate flow, and these feed directly into the size-recommendation logic rather than being cosmetic.

## How IBM Bob Was Used

IBM Bob was the primary development environment throughout this project, used across the full lifecycle rather than for isolated code generation.

Bob built out the Next.js App Router structure, the Supabase integration (auth, RLS policies, schema migrations), and every core feature, including Fitzy, Pick & Match, Wardrobe, and Saved.

Bob was also used to diagnose and fix real, live issues as they surfaced during testing. This included a gender-filtering bug, found through live user testing, that existed independently in four separate parts of the codebase; an outfit-selection state bug caused by a React Strict Mode interaction; and a genuine rate-limit and credit exhaustion issue on the underlying AI provider.

UI changes were mocked up and reviewed before being handed to Bob as scoped, sequential prompts, rather than large speculative rewrites, to keep changes verifiable and low-risk.

Bob was also used to safely resolve a real merge conflict between two team members' concurrent changes to the same file, explaining both sides of the change before proposing a combined resolution.

Shortly before submission, Bob performed a full functional and code-quality audit, reviewing gender filtering, outfit-size recommendation coverage, and dead or duplicate code across the codebase.

## Team

Ibrahim El Damisi and Abdulrahman Hirsi.

## Status

Complete, working prototype submitted for the IBM AI Builders Challenge, July 2026. Core features, Fitzy conversational styling, Pick & Match outfit building with AI-driven size and style review, and personal wardrobe management with user-defined collections, are implemented and functional. Submission deadline: July 31, 2026.
