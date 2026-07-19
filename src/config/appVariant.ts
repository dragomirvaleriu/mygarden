// ─────────────────────────────────────────────────────────────
// My Garden — homeowner (PF) edition of the platform.
//
// This project was forked from the shared LandscapeOS/Scapeflow codebase so the
// two products can evolve independently. Everything here is the homeowner side:
// garden care guide, treatment calculators, journal, gallery and AI plant-scan.
//
// APP_VARIANT is the single switch the rest of the app reads to stay PF-first.
// When 'PF', onboarding should default new accounts to accountType 'PF' and the
// business-only (PJ) surfaces stay hidden.
// ─────────────────────────────────────────────────────────────

export const APP_VARIANT: 'PF' | 'PJ' = 'PF';

export const APP_NAME = 'My Garden';
export const APP_TAGLINE = 'Your garden, smartly cared for';

export const isHomeownerApp = APP_VARIANT === 'PF';
