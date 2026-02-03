import { router, adminProcedure } from "../../_core/trpc";
import { z } from "zod";

export const swarmOpsChatRouter = router({
  threads: router({
    list: adminProcedure.query(async () => {
      return [];
    }),
    create: adminProcedure
      .input(z.object({ title: z.string() }))
      .mutation(async ({ input }) => {
        return { id: "1", title: input.title };
      }),
  }),
  messages: router({
    list: adminProcedure
      .input(z.object({ threadId: z.string() }))
      .query(async ({ input }) => {
        return [];
      }),
    send: adminProcedure
      .input(z.object({ threadId: z.string(), content: z.string() }))
      .mutation(async ({ input }) => {
        return { id: "1", content: input.content };
      }),
  }),
});
