#!/usr/bin/env node
/**
 * submitVertexFineTune.mjs
 * Submits a LoRA fine-tuning job to Vertex AI for the marketing 8B model.
 *
 * Prerequisites:
 *   - gcloud auth configured with project engaged-style-456320-t4
 *   - Training data uploaded to gs://lb-ai-models-engaged-style-456320-t4-us/curated/sft/
 *   - Base model weights at gs://lb-ai-models-engaged-style-456320-t4-us/main-8b-governed/weights/
 *
 * Usage:
 *   node scripts/marketing/submitVertexFineTune.mjs [--dry-run] [--spot] [--gpu t4|a100]
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const PROJECT = "engaged-style-456320-t4";
const REGION = "us-central1";
const BUCKET = "gs://lb-ai-models-engaged-style-456320-t4-us";
const SFT_DATA = `${BUCKET}/curated/sft/master_sft.jsonl`;
const BASE_WEIGHTS = `${BUCKET}/main-8b-governed/weights/main-llama-8b-q4_k_m.gguf`;
const OUTPUT_DIR = `${BUCKET}/adapters/marketing-v1`;
const EVAL_SET = `${BUCKET}/eval/frozen/golden_eval_set.jsonl`;

const ROOT = process.cwd();
const RUNS_DIR = path.join(ROOT, "runs", "marketing", "training-jobs");
fs.mkdirSync(RUNS_DIR, { recursive: true });

// Parse args
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const USE_SPOT = args.includes("--spot");
const GPU_TYPE = args.includes("--gpu") ? args[args.indexOf("--gpu") + 1] : "t4";

const GPU_CONFIG = {
  t4: { machineType: "n1-standard-8", acceleratorType: "NVIDIA_TESLA_T4", acceleratorCount: 1 },
  a100: { machineType: "a2-highgpu-1g", acceleratorType: "NVIDIA_TESLA_A100", acceleratorCount: 1 },
};

const gpu = GPU_CONFIG[GPU_TYPE] || GPU_CONFIG.t4;

function run(cmd) {
  console.log(`  $ ${cmd.slice(0, 120)}...`);
  if (DRY_RUN) { console.log("  [DRY-RUN] skipped"); return ""; }
  return execSync(cmd, { encoding: "utf8", timeout: 60_000 }).trim();
}

function main() {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const jobName = `mkt-finetune-${ts}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60);

  console.log("=== Vertex AI Marketing Fine-Tune Job ===");
  console.log(`  Job name:     ${jobName}`);
  console.log(`  Project:      ${PROJECT}`);
  console.log(`  Region:       ${REGION}`);
  console.log(`  GPU:          ${gpu.acceleratorType} x${gpu.acceleratorCount}`);
  console.log(`  Machine:      ${gpu.machineType}`);
  console.log(`  Spot:         ${USE_SPOT}`);
  console.log(`  Training data: ${SFT_DATA}`);
  console.log(`  Base weights:  ${BASE_WEIGHTS}`);
  console.log(`  Output:        ${OUTPUT_DIR}`);
  console.log(`  Mode:          ${DRY_RUN ? "DRY-RUN" : "LIVE"}`);
  console.log("");

  // Step 1: Validate training data exists
  console.log("[1/5] Validating training data...");
  try {
    const sftCheck = execSync(`gcloud storage ls ${SFT_DATA} 2>&1`, { encoding: "utf8" });
    console.log(`  Found: ${SFT_DATA}`);
  } catch {
    console.error(`  ERROR: Training data not found at ${SFT_DATA}`);
    process.exit(1);
  }

  // Step 2: Validate eval set exists
  console.log("[2/5] Validating eval set...");
  try {
    execSync(`gcloud storage ls ${EVAL_SET} 2>&1`, { encoding: "utf8" });
    console.log(`  Found: ${EVAL_SET}`);
  } catch {
    console.warn(`  WARNING: Eval set not found at ${EVAL_SET} — training will proceed without eval`);
  }

  // Step 3: Build job spec
  console.log("[3/5] Building job specification...");

  const jobSpec = {
    displayName: jobName,
    jobSpec: {
      workerPoolSpecs: [
        {
          machineSpec: {
            machineType: gpu.machineType,
            acceleratorType: gpu.acceleratorType,
            acceleratorCount: gpu.acceleratorCount,
          },
          replicaCount: "1",
          containerSpec: {
            imageUri: "us-docker.pkg.dev/deeplearning-platform-release/gcr.io/huggingface-text-generation-inference-cu121.2-3.ubuntu2204.py311",
            args: [
              "--model_name_or_path", "meta-llama/Meta-Llama-3.1-8B-Instruct",
              "--train_file", "/gcs/curated/sft/master_sft.jsonl",
              "--output_dir", "/gcs/adapters/marketing-v1",
              "--num_train_epochs", "3",
              "--per_device_train_batch_size", "4",
              "--gradient_accumulation_steps", "4",
              "--learning_rate", "2e-4",
              "--warmup_ratio", "0.03",
              "--lr_scheduler_type", "cosine",
              "--logging_steps", "10",
              "--save_strategy", "epoch",
              "--bf16", "true",
              "--lora_r", "16",
              "--lora_alpha", "32",
              "--lora_target_modules", "q_proj,v_proj,k_proj,o_proj",
              "--lora_dropout", "0.05",
            ],
            env: [
              { name: "HF_TOKEN", value: process.env.HF_TOKEN || "" },
              { name: "WANDB_DISABLED", value: "true" },
            ],
          },
          diskSpec: {
            bootDiskType: "pd-ssd",
            bootDiskSizeGb: 200,
          },
        },
      ],
      scheduling: USE_SPOT ? { strategy: "SPOT" } : {},
      baseOutputDirectory: { outputUriPrefix: OUTPUT_DIR },
    },
  };

  const specPath = path.join(RUNS_DIR, `${jobName}-spec.json`);
  fs.writeFileSync(specPath, JSON.stringify(jobSpec, null, 2), "utf8");
  console.log(`  Spec written: ${specPath}`);

  // Step 4: Submit job
  console.log("[4/5] Submitting training job...");
  const submitCmd = [
    "gcloud", "ai", "custom-jobs", "create",
    `--project=${PROJECT}`,
    `--region=${REGION}`,
    `--display-name=${jobName}`,
    `--config=${specPath.replace(/\//g, "\\")}`,
  ].join(" ");

  const result = run(submitCmd);
  if (result) console.log(`  ${result.slice(0, 300)}`);

  // Step 5: Record job metadata
  console.log("[5/5] Recording job metadata...");
  const metadata = {
    jobName,
    submittedAt: new Date().toISOString(),
    project: PROJECT,
    region: REGION,
    gpu: gpu.acceleratorType,
    spot: USE_SPOT,
    trainingData: SFT_DATA,
    baseWeights: BASE_WEIGHTS,
    outputDir: OUTPUT_DIR,
    evalSet: EVAL_SET,
    loraConfig: { r: 16, alpha: 32, target_modules: "q_proj,v_proj,k_proj,o_proj", dropout: 0.05 },
    hyperparams: { epochs: 3, batch_size: 4, gradient_accumulation: 4, lr: "2e-4", scheduler: "cosine" },
    dryRun: DRY_RUN,
  };

  const metaPath = path.join(RUNS_DIR, `${jobName}-metadata.json`);
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), "utf8");
  console.log(`  Metadata: ${metaPath}`);

  console.log("\n=== Job submission complete ===");
  if (!DRY_RUN) {
    console.log(`Monitor: gcloud ai custom-jobs list --project=${PROJECT} --region=${REGION}`);
    console.log(`Describe: gcloud ai custom-jobs describe JOB_ID --project=${PROJECT} --region=${REGION}`);
  }
}

main();
