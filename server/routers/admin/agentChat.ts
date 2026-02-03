import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { createOpsChatThread, listOpsChatMessages, listOpsChatThreads, postOpsChatMessage } from "../../swarm/chatStore";

export const agentChatRouter = router({
  threads: router({
    list: adminProcedure.query(async () => {
      return await listOpsChatThreads();
    }),

    create: adminProcedure
      .input(
        z
          .object({
            title: z.string().optional(),
          })
          .optional()
      )
      .mutation(async ({ input }) => {
        return await createOpsChatThread(input);
      }),
  }),

  messages: router({
    list: adminProcedure
      .input(
        z.object({
          threadId: z.string(),
        })
      )
      .query(async ({ input }) => {
        return await listOpsChatMessages(input.threadId);
      }),

    send: adminProcedure
      .input(
        z.object({
          threadId: z.string(),
          text: z.string(),
          meta: z.record(z.unknown()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await postOpsChatMessage({
          threadId: input.threadId,
          role: "user",
          text: input.text,
          meta: input.meta,
        });
      }),
  }),
});
