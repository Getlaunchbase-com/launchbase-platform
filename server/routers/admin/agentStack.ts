import { router, adminProcedure } from "../../_core/trpc";
import { z } from "zod";

export const agentStackRouter = router({
  list: adminProcedure.query(async () => {
    return [];
  }),
  
  get: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return null;
    }),
});
