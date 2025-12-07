/**
 * Social Caption Generator - create captions for different platforms & tones.
 *
 * Design goals:
 * - Capture "caption sessions" per campaign or post idea.
 * - Generate multiple caption variants per platform (Instagram, LinkedIn, etc.).
 * - Support reusable templates for future.
 */

import { defineTable, column, NOW } from "astro:db";

export const CaptionSessions = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    name: column.text(),                          // e.g. "New product launch promo"
    description: column.text({ optional: true }),
    coreMessage: column.text({ optional: true }), // central idea/offer
    targetAudience: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const Captions = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    sessionId: column.text({
      references: () => CaptionSessions.columns.id,
    }),
    platform: column.text({ optional: true }),    // "instagram", "linkedin", "twitter", etc.
    tone: column.text({ optional: true }),        // "fun", "formal", "casual", etc.
    variantLabel: column.text({ optional: true }),// "A", "B", "Carousel Slide 1", etc.
    captionText: column.text(),
    hashtags: column.text({ optional: true }),    // hashtags string or JSON
    createdAt: column.date({ default: NOW }),
  },
});

export const CaptionTemplates = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text({ optional: true }),      // null -> global/system template
    name: column.text(),
    platform: column.text({ optional: true }),
    tone: column.text({ optional: true }),
    body: column.text(),                          // template with placeholders
    isSystem: column.boolean({ default: false }),
    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  CaptionSessions,
  Captions,
  CaptionTemplates,
} as const;
