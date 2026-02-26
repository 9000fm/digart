const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "src", "data");
const all = require(path.join(DATA_DIR, "music-channels.json"));
const rejected = require(path.join(DATA_DIR, "rejected-channels.json"));

const CONFLICT_ID = "UCckSlww8DDaPJ0VQRvvHU-Q";

// Build name lookup from all channels
const lookup = new Map(all.map((c) => [c.id, c.name]));

// Convert rejected IDs to {name, id}, removing the conflict
const migrated = rejected
  .filter((id) => id !== CONFLICT_ID)
  .map((id) => ({
    name: lookup.get(id) || "UNKNOWN",
    id,
  }));

const unknowns = migrated.filter((c) => c.name === "UNKNOWN");
console.log("Unknowns:", unknowns.length);
unknowns.forEach((c) => console.log("  ", c.id));
console.log("Migrated count:", migrated.length, "(was", rejected.length, ")");
console.log("Removed conflict: Collector Drum Breaks", CONFLICT_ID);

fs.writeFileSync(
  path.join(DATA_DIR, "rejected-channels.json"),
  JSON.stringify(migrated, null, 2)
);
console.log("Written rejected-channels.json");
