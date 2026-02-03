import { router, adminProcedure } from "../../_core/trpc";

export const adminEmailMetricsRouter = router({
  get: adminProcedure.query(async () => {
    return { sent: 0, bounced: 0, delivered: 0 };
  }),
});
