import { router, adminProcedure } from "../../_core/trpc";

export const agentRunsRouter = router({
  list: adminProcedure.query(async () => {
    return [];
  }),
});

export const agentEventsRouter = router({
  list: adminProcedure.query(async () => {
    return [];
  }),
});

export const agentArtifactsRouter = router({
  list: adminProcedure.query(async () => {
    return [];
  }),
});
