/**
 * Email smoke test procedures — requires Resend API key for test delivery.
 * Used in CI/CD pipeline validation.
 */

import { router } from "../../_core/trpc";

export const adminEmailSmokeRouter = router({});
