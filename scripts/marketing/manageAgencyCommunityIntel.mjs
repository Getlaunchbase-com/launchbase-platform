#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "scripts", "marketing", "sources", "agency-community-intel.json");
if (!fs.existsSync(file)) {
  console.error(`Missing source file: ${file}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const cmd = args[0] ?? "list";
const source = JSON.parse(fs.readFileSync(file, "utf8"));

function save() {
  fs.writeFileSync(file, JSON.stringify(source, null, 2), "utf8");
}

function getArg(name, fallback = "") {
  const i = args.indexOf(`--${name}`);
  if (i < 0 || i + 1 >= args.length) return fallback;
  return args[i + 1];
}

if (cmd === "list") {
  console.log(`agencies=${source.top_agencies.length} communities=${source.professional_communities.length}`);
  process.exit(0);
}

if (cmd === "add-agency") {
  const name = getArg("name");
  if (!name) throw new Error("add-agency requires --name");
  const type = getArg("type", "independent");
  const focus = getArg("focus", "performance").split(",").map((s) => s.trim()).filter(Boolean);
  source.top_agencies.push({ name, type, focus });
  save();
  console.log(`added agency: ${name}`);
  process.exit(0);
}

if (cmd === "remove-agency") {
  const name = getArg("name");
  if (!name) throw new Error("remove-agency requires --name");
  source.top_agencies = source.top_agencies.filter((a) => String(a.name).toLowerCase() !== name.toLowerCase());
  save();
  console.log(`removed agency: ${name}`);
  process.exit(0);
}

if (cmd === "add-community") {
  const name = getArg("name");
  const url = getArg("url");
  if (!name || !url) throw new Error("add-community requires --name and --url");
  const type = getArg("type", "community");
  const method = getArg("collection_method", "public_content_only");
  source.professional_communities.push({
    name,
    url,
    type,
    collection_method: method,
  });
  save();
  console.log(`added community: ${name}`);
  process.exit(0);
}

if (cmd === "remove-community") {
  const name = getArg("name");
  if (!name) throw new Error("remove-community requires --name");
  source.professional_communities = source.professional_communities.filter(
    (c) => String(c.name).toLowerCase() !== name.toLowerCase()
  );
  save();
  console.log(`removed community: ${name}`);
  process.exit(0);
}

throw new Error(`Unknown command: ${cmd}`);
