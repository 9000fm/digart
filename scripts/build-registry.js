const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "src", "data");
const all = require(path.join(DATA_DIR, "music-channels.json"));
const approved = require(path.join(DATA_DIR, "approved-channels.json"));
const rejected = require(path.join(DATA_DIR, "rejected-channels.json"));
const unsub = require(path.join(DATA_DIR, "unsubscribe-channels.json"));

const approvedIds = new Set(approved.map((c) => c.id));
const rejectedIds = new Set(rejected.map((c) => c.id));
const unsubIds = new Set(unsub.map((c) => c.id));

const registry = {};

for (const ch of all) {
  let reviewedAt = null;
  if (approvedIds.has(ch.id) || rejectedIds.has(ch.id) || unsubIds.has(ch.id)) {
    reviewedAt = "2026-02-25T00:00:00Z";
  }

  registry[ch.id] = {
    id: ch.id,
    name: ch.name,
    importedAt: "2026-02-25T00:00:00Z",
    importSource: "subscription",
    reviewedAt,
    lastScannedAt: null,
    uploadsFetched: 0,
    scanError: null,
  };
}

const outPath = path.join(DATA_DIR, "channel-registry.json");
fs.writeFileSync(outPath, JSON.stringify(registry, null, 2));
console.log("Registry created with", Object.keys(registry).length, "entries");
console.log("Written to", outPath);
