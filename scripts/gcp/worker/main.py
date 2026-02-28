import base64
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from google.cloud import bigquery

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

PROJECT_ID = os.getenv("PROJECT_ID", "")
BQ_DATASET_MARKETING = os.getenv("BQ_DATASET_MARKETING", "launchbase_marketing")
bq_client = bigquery.Client()


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def table_ref(table_name: str) -> str:
    return f"{PROJECT_ID}.{BQ_DATASET_MARKETING}.{table_name}"


def insert_rows(table_name: str, rows: list[dict]):
    if not rows:
        return
    errors = bq_client.insert_rows_json(table_ref(table_name), rows)
    if errors:
        raise RuntimeError(f"BigQuery insert failed for {table_name}: {errors}")


def parse_relaxed_payload(raw: str) -> dict:
    text = raw.strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except Exception:
        pass

    # Handle relaxed payloads like: {job:fetch-trends,approved:true,source:manual-test}
    if text.startswith("{") and text.endswith("}") and ":" in text:
        body = text[1:-1]
        out = {}
        for pair in body.split(","):
            if ":" not in pair:
                continue
            k, v = pair.split(":", 1)
            key = k.strip().strip('"').strip("'")
            value = v.strip().strip('"').strip("'")
            if value.lower() == "true":
                out[key] = True
            elif value.lower() == "false":
                out[key] = False
            elif value.lower() == "null":
                out[key] = None
            elif re.fullmatch(r"-?\d+(\.\d+)?", value):
                out[key] = float(value) if "." in value else int(value)
            else:
                out[key] = value
        return out

    return {"raw_payload": text}


def log_run(job: str, status: str, rows_processed: int, notes: str):
    insert_rows(
        "agent_run_audit",
        [
            {
                "started_at": utc_now(),
                "finished_at": utc_now(),
                "job": job,
                "status": status,
                "rows_processed": rows_processed,
                "cost_estimate_usd": 0.0,
                "notes": notes[:1024],
            }
        ],
    )


def handle_fetch_trends(payload: dict) -> int:
    vertical = payload.get("vertical", "small-business-ops")
    signals = payload.get("signals") or [
        "quickbooks integration for contractors",
        "electrical contractor website lead generation",
        "ai automation for small service business",
        "blueprint to quote automation",
        "field service scheduling automation",
    ]
    rows = []
    score = 1.0
    for s in signals:
        rows.append(
            {
                "captured_at": utc_now(),
                "source": payload.get("source", "scheduler"),
                "vertical": vertical,
                "signal": str(s),
                "score": score,
                "raw": json.dumps({"payload": payload}, separators=(",", ":")),
            }
        )
        score = max(0.1, round(score - 0.1, 2))
    insert_rows("trend_snapshots", rows)
    return len(rows)


def handle_vertical_research(payload: dict) -> int:
    verticals = payload.get("verticals") or [
        "small business websites",
        "quickbooks integration",
        "workflow automation",
        "ai agents for service contractors",
    ]
    rows = []
    for v in verticals:
        rows.append(
            {
                "captured_at": utc_now(),
                "lead_id": f"research-{uuid.uuid4().hex[:10]}",
                "vertical": v,
                "event_type": "vertical_insight",
                "event_value": "researched",
                "source": payload.get("source", "scheduler"),
            }
        )
    insert_rows("lead_events", rows)
    return len(rows)


def handle_campaign_generate(payload: dict) -> int:
    verticals = payload.get("verticals") or [
        "small business websites",
        "quickbooks integration",
        "workflow automation",
    ]
    variants = []
    for v in verticals:
        campaign_id = f"cmp-{uuid.uuid4().hex[:8]}"
        templates = [
            f"{v}: Get a production-ready setup in 14 days.",
            f"{v}: Reduce manual admin and speed up your close rate.",
            f"{v}: Launch with AI + automation without hiring a full dev team.",
        ]
        for i, text in enumerate(templates, start=1):
            variants.append(
                {
                    "created_at": utc_now(),
                    "campaign_id": campaign_id,
                    "vertical": v,
                    "channel": "outbound_email",
                    "variant_id": f"{campaign_id}-v{i}",
                    "copy": text,
                    "status": "draft",
                }
            )
    insert_rows("campaign_variants", variants)
    return len(variants)


def handle_ab_evaluate(payload: dict) -> int:
    query = f"""
      SELECT campaign_id, variant_id, SUM(impressions) AS impressions, SUM(clicks) AS clicks,
             SUM(replies) AS replies, SUM(booked_calls) AS booked_calls, SUM(spend_usd) AS spend
      FROM `{table_ref("ab_results")}`
      WHERE captured_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)
      GROUP BY campaign_id, variant_id
      ORDER BY booked_calls DESC, replies DESC
      LIMIT 25
    """
    rows = list(bq_client.query(query).result())
    summary = {
        "rows": len(rows),
        "top_variant": rows[0]["variant_id"] if rows else None,
    }
    insert_rows(
        "lead_events",
        [
            {
                "captured_at": utc_now(),
                "lead_id": f"ab-{uuid.uuid4().hex[:10]}",
                "vertical": payload.get("vertical", "all"),
                "event_type": "ab_summary",
                "event_value": json.dumps(summary, separators=(",", ":")),
                "source": payload.get("source", "scheduler"),
            }
        ],
    )
    return len(rows)


def handle_daily_report(payload: dict) -> int:
    query = f"""
      SELECT
        (SELECT COUNT(*) FROM `{table_ref("trend_snapshots")}` WHERE captured_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)) AS trend_rows,
        (SELECT COUNT(*) FROM `{table_ref("campaign_variants")}` WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)) AS variants_created,
        (SELECT COUNT(*) FROM `{table_ref("lead_events")}` WHERE captured_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)) AS lead_events
    """
    row = list(bq_client.query(query).result())[0]
    logging.info(
        json.dumps(
            {
                "event": "marketing_daily_report",
                "generated_at": utc_now(),
                "trend_rows_24h": int(row["trend_rows"]),
                "variants_created_24h": int(row["variants_created"]),
                "lead_events_24h": int(row["lead_events"]),
            }
        )
    )
    return 1


def dispatch_job(job: str, payload: dict) -> int:
    if job == "fetch-trends":
        return handle_fetch_trends(payload)
    if job == "vertical-research":
        return handle_vertical_research(payload)
    if job == "campaign-generate":
        return handle_campaign_generate(payload)
    if job == "ab-evaluate":
        return handle_ab_evaluate(payload)
    if job == "daily-report":
        return handle_daily_report(payload)
    return 0


@app.get("/healthz")
def healthz():
    return jsonify(
        {
            "ok": True,
            "service": "launchbase-marketing-ops-worker",
            "project_id": PROJECT_ID,
            "dataset": BQ_DATASET_MARKETING,
        }
    )


@app.post("/pubsub/push")
def pubsub_push():
    envelope = request.get_json(silent=True) or {}
    message = envelope.get("message", {})
    attributes = message.get("attributes", {}) or {}
    data_b64 = message.get("data", "")

    payload = {}
    if data_b64:
        try:
            decoded = base64.b64decode(data_b64).decode("utf-8")
            payload = parse_relaxed_payload(decoded)
        except Exception:
            payload = {"raw_data_b64": data_b64}

    job = payload.get("job") or attributes.get("job") or "unknown"
    started_at = utc_now()
    logging.info(
        json.dumps(
            {
                "event": "marketing_job_triggered",
                "received_at": started_at,
                "job": job,
                "payload": payload,
                "attributes": attributes,
            }
        )
    )

    try:
        processed = dispatch_job(job, payload)
        log_run(job=job, status="success", rows_processed=processed, notes="ok")
        return jsonify({"ok": True, "job": job, "rows_processed": processed})
    except Exception as exc:
        logging.exception("job_failed")
        log_run(job=job, status="failed", rows_processed=0, notes=str(exc))
        return jsonify({"ok": False, "job": job, "error": str(exc)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
