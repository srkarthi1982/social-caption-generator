import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import {
  CaptionSessions,
  Captions,
  CaptionTemplates,
  and,
  db,
  eq,
  or,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnedSession(sessionId: string, userId: string) {
  const [session] = await db
    .select()
    .from(CaptionSessions)
    .where(and(eq(CaptionSessions.id, sessionId), eq(CaptionSessions.userId, userId)));

  if (!session) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Caption session not found.",
    });
  }

  return session;
}

async function ensureTemplateAccessible(templateId: string, userId: string) {
  const [template] = await db
    .select()
    .from(CaptionTemplates)
    .where(eq(CaptionTemplates.id, templateId));

  if (!template) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Template not found.",
    });
  }

  if (template.userId && template.userId !== userId) {
    throw new ActionError({
      code: "FORBIDDEN",
      message: "You do not have access to this template.",
    });
  }

  return template;
}

export const server = {
  createCaptionSession: defineAction({
    input: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      coreMessage: z.string().optional(),
      targetAudience: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [session] = await db
        .insert(CaptionSessions)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          name: input.name,
          description: input.description,
          coreMessage: input.coreMessage,
          targetAudience: input.targetAudience,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { session } };
    },
  }),

  updateCaptionSession: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        coreMessage: z.string().optional(),
        targetAudience: z.string().optional(),
      })
      .refine(
        (input) =>
          input.name !== undefined ||
          input.description !== undefined ||
          input.coreMessage !== undefined ||
          input.targetAudience !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSession(input.id, user.id);

      const [session] = await db
        .update(CaptionSessions)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.coreMessage !== undefined ? { coreMessage: input.coreMessage } : {}),
          ...(input.targetAudience !== undefined
            ? { targetAudience: input.targetAudience }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(CaptionSessions.id, input.id))
        .returning();

      return { success: true, data: { session } };
    },
  }),

  listCaptionSessions: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const sessions = await db
        .select()
        .from(CaptionSessions)
        .where(eq(CaptionSessions.userId, user.id));

      return { success: true, data: { items: sessions, total: sessions.length } };
    },
  }),

  createCaption: defineAction({
    input: z.object({
      sessionId: z.string().min(1),
      platform: z.string().optional(),
      tone: z.string().optional(),
      variantLabel: z.string().optional(),
      captionText: z.string().min(1),
      hashtags: z.string().optional(),
      templateId: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSession(input.sessionId, user.id);

      if (input.templateId) {
        await ensureTemplateAccessible(input.templateId, user.id);
      }

      const [caption] = await db
        .insert(Captions)
        .values({
          id: crypto.randomUUID(),
          sessionId: input.sessionId,
          platform: input.platform,
          tone: input.tone,
          variantLabel: input.variantLabel,
          captionText: input.captionText,
          hashtags: input.hashtags,
          createdAt: new Date(),
        })
        .returning();

      return { success: true, data: { caption } };
    },
  }),

  updateCaption: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        sessionId: z.string().min(1),
        platform: z.string().optional(),
        tone: z.string().optional(),
        variantLabel: z.string().optional(),
        captionText: z.string().optional(),
        hashtags: z.string().optional(),
      })
      .refine(
        (input) =>
          input.platform !== undefined ||
          input.tone !== undefined ||
          input.variantLabel !== undefined ||
          input.captionText !== undefined ||
          input.hashtags !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSession(input.sessionId, user.id);

      const [existing] = await db
        .select()
        .from(Captions)
        .where(and(eq(Captions.id, input.id), eq(Captions.sessionId, input.sessionId)));

      if (!existing) {
        throw new ActionError({ code: "NOT_FOUND", message: "Caption not found." });
      }

      const [caption] = await db
        .update(Captions)
        .set({
          ...(input.platform !== undefined ? { platform: input.platform } : {}),
          ...(input.tone !== undefined ? { tone: input.tone } : {}),
          ...(input.variantLabel !== undefined ? { variantLabel: input.variantLabel } : {}),
          ...(input.captionText !== undefined ? { captionText: input.captionText } : {}),
          ...(input.hashtags !== undefined ? { hashtags: input.hashtags } : {}),
        })
        .where(eq(Captions.id, input.id))
        .returning();

      return { success: true, data: { caption } };
    },
  }),

  deleteCaption: defineAction({
    input: z.object({
      id: z.string().min(1),
      sessionId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSession(input.sessionId, user.id);

      const result = await db
        .delete(Captions)
        .where(and(eq(Captions.id, input.id), eq(Captions.sessionId, input.sessionId)));

      if (result.rowsAffected === 0) {
        throw new ActionError({ code: "NOT_FOUND", message: "Caption not found." });
      }

      return { success: true };
    },
  }),

  listCaptions: defineAction({
    input: z.object({
      sessionId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSession(input.sessionId, user.id);

      const captions = await db
        .select()
        .from(Captions)
        .where(eq(Captions.sessionId, input.sessionId));

      return { success: true, data: { items: captions, total: captions.length } };
    },
  }),

  createTemplate: defineAction({
    input: z.object({
      name: z.string().min(1),
      platform: z.string().optional(),
      tone: z.string().optional(),
      body: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [template] = await db
        .insert(CaptionTemplates)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          name: input.name,
          platform: input.platform,
          tone: input.tone,
          body: input.body,
          isSystem: false,
          createdAt: new Date(),
        })
        .returning();

      return { success: true, data: { template } };
    },
  }),

  listTemplates: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const templates = await db
        .select()
        .from(CaptionTemplates)
        .where(or(eq(CaptionTemplates.userId, user.id), eq(CaptionTemplates.userId, null)));

      return { success: true, data: { items: templates, total: templates.length } };
    },
  }),
};
