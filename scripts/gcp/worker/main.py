import base64
import json
import logging
import os
from datetime import datetime, timezone

from flask import Flask, jsonify, request

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

PROJECT_ID = os.getenv("PROJECT_ID", "")
BQ_DATASET_MARKETING = os.getenv("BQ_DATASET_MARKETING", "launchbase_marketing")


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
          payload = json.loads(base64.b64decode(data_b64).decode("utf-8"))
      except Exception:  # keep worker resilient, never crash on malformed messages
          payload = {"raw_data_b64": data_b64}

    job = payload.get("job") or attributes.get("job") or "unknown"
    logging.info(
        json.dumps(
            {
                "event": "marketing_job_triggered",
                "received_at": datetime.now(timezone.utc).isoformat(),
                "job": job,
                "payload": payload,
                "attributes": attributes,
            }
        )
    )

    # v1 behavior: acknowledge + log.
    # v2 will dispatch role-specific executors (trend fetch, campaign gen, AB eval).
    return jsonify({"ok": True, "job": job})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
