import { router, adminProcedure } from "../../_core/trpc";

export const swarmConsoleRouter = router({
  list: adminProcedure.query(async () => {
    return [];
  }),
});
