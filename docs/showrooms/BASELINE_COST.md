# LaunchBase Baseline Cost

**Status:** Not yet measured (placeholder)

## Cost Tracking

This file will be populated after the first swarm run with:

- **Total tokens:** Input + output tokens across all specialist calls
- **Total cost (USD):** Actual spend via AIML API
- **Per-specialist breakdown:** craft, critic, Field General collapse
- **Model IDs:** Which models were selected by router
- **Timestamp:** When baseline was established

## Measurement Methodology

1. Run swarm with `swarm_premium_v1` policy
2. Capture `rawInbound.swarm` artifact metadata
3. Sum tokens and costs across all specialist calls
4. Record model IDs from router selection
5. Commit baseline to this file

## Future Comparisons

Once baseline is established, future runs will compare:
- **Cost delta:** % change from baseline
- **Quality delta:** Success criteria pass rate
- **ROI:** Quality improvement per dollar spent

---

**Version:** 1.0  
**Last Updated:** January 13, 2026  
**Status:** Awaiting first swarm run
