import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import {
  appendOpsChatMessage,
  createOpsChatThread,
  listOpsChatMessages,
  listOpsChatThreads,
} from "../../swarm/chatStore";

export const swarmOpsChatRouter = router({
  threads: router({
    list: adminProcedure.query(async () => {
      return await listOpsChatThreads();
    }),

    create: adminProcedure
      .input(z.object({ title: z.string().optional() }).optional())
      .mutation(async ({ input }) => {
        return await createOpsChatThread({ title: input?.title });
      }),
  }),

  messages: router({
    list: adminProcedure
      .input(z.object({ threadId: z.string().min(1) }))
      .query(async ({ input }) => {
        return await listOpsChatMessages(input.threadId);
      }),

    send: adminProcedure
      .input(z.object({ threadId: z.string().min(1), text: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const msg = await appendOpsChatMessage(input.threadId, {
          role: "user",
          text: input.text,
          meta: {
            userId: ctx.user?.id,
            userEmail: ctx.user?.email,
            userName: ctx.user?.name,
          },
        });
        return msg;
      }),
  }),
});
