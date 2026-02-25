/**
 * Agent stack management — runtime-populated by agent-stack at connection time.
 * Tools registry and agent configuration are managed by the external agent process.
 */

import { router } from "../../_core/trpc";

export const agentStackRouter = router({});
