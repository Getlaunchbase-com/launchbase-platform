/**
 * Agent Chat Router
 * Proxies to agent-stack VM/brain gateway for real agent/vm conversations
 */

import { router, adminProcedure } from "../../_core/trpc";
import { z } from "zod";

export const agentChatRouter = router({
  threads: router({
    list: adminProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(100).default(50),
      }).optional())
      .query(async ({ input }) => {
        // TODO: Call agent-stack service to list threads
        // For now, return empty array
        return {
          threads: [],
          total: 0,
        };
      }),

    create: adminProcedure
      .input(z.object({
        title: z.string().min(1).max(200),
        initialMessage: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // TODO: Call agent-stack service to create thread
        // For now, return placeholder
        return {
          id: `thread_${Date.now()}`,
          title: input.title,
          createdAt: new Date(),
          messageCount: input.initialMessage ? 1 : 0,
        };
      }),
  }),

  messages: router({
    list: adminProcedure
      .input(z.object({
        threadId: z.string(),
        limit: z.number().int().min(1).max(100).default(50),
      }))
      .query(async ({ input }) => {
        // TODO: Call agent-stack service to list messages in thread
        // For now, return empty array
        return {
          messages: [],
          threadId: input.threadId,
        };
      }),

    send: adminProcedure
      .input(z.object({
        threadId: z.string(),
        content: z.string().min(1).max(8000),
      }))
      .mutation(async ({ input }) => {
        // TODO: Send message to agent-stack VM/brain gateway
        // This should stream the response back (SSE or WebSocket)
        // For now, return placeholder response
        return {
          id: `msg_${Date.now()}`,
          threadId: input.threadId,
          role: "assistant",
          content: "This is a placeholder response. Agent-stack service not yet integrated.",
          createdAt: new Date(),
          streaming: false,
        };
      }),
  }),
});
