import { router, adminProcedure } from "../../_core/trpc";

export const adminStripeWebhooksRouter = router({
  list: adminProcedure.query(async () => {
    return [];
  }),
});
