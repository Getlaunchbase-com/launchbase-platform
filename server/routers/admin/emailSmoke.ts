import { router, adminProcedure } from "../../_core/trpc";

export const adminEmailSmokeRouter = router({
  run: adminProcedure.mutation(async () => {
    return { success: true };
  }),
});
