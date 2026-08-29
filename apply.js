#!/usr/bin/env node
// apply.js
//
// Drops CoordinateDisplay.js into a deployed RPG Maker MV/MZ game
// and registers it in js/plugins.js — no editor required.
//
// Usage:
//   node apply.js "C:\path\to\GameFolder"
//   node apply.js "/path/to/GameFolder"
//
// Run it from the same folder as CoordinateDisplay.js.

const fs = require("fs");
const path = require("path");

const gameDir = process.argv[2];
if (!gameDir) {
  console.error('Usage: node apply.js "<path to game folder>"');
  process.exit(1);
}

const pluginSrc = path.join(__dirname, "CoordinateDisplay.js");
const pluginsDir = path.join(gameDir, "js", "plugins");
const pluginsListPath = path.join(gameDir, "js", "plugins.js");

if (!fs.existsSync(pluginSrc)) {
  console.error("CoordinateDisplay.js not found next to apply.js.");
  process.exit(1);
}

if (!fs.existsSync(pluginsDir) || !fs.existsSync(pluginsListPath)) {
  console.error("This doesn't look like an RPG Maker MV/MZ game folder (js/plugins.js not found).");
  process.exit(1);
}

// 1. Back up plugins.js once, if we haven't already
const backupPath = pluginsListPath + ".bak";
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(pluginsListPath, backupPath);
  console.log("Backed up plugins.js -> plugins.js.bak");
}

// 2. Copy the plugin file in
fs.copyFileSync(pluginSrc, path.join(pluginsDir, "CoordinateDisplay.js"));

// 3. Patch plugins.js
let content = fs.readFileSync(pluginsListPath, "utf8");
if (content.includes('"name":"CoordinateDisplay"')) {
  console.log("CoordinateDisplay is already registered. Nothing to do.");
  process.exit(0);
}

const entry =
  '{"name":"CoordinateDisplay","status":true,"description":"Shows map coordinates top-right.",' +
  '"parameters":{"fontSize":"20","textColor":"#ffffff","outlineColor":"#000000"}}';

const closingIndex = content.lastIndexOf("];");
if (closingIndex === -1) {
  console.error("Could not parse plugins.js — unexpected format. No changes made.");
  process.exit(1);
}

const before = content.slice(0, closingIndex).trimEnd();
const needsComma = before.endsWith("}");
const insertion = (needsComma ? ",\n" : "\n") + entry + "\n";
content = before + insertion + content.slice(closingIndex);

fs.writeFileSync(pluginsListPath, content, "utf8");
console.log("CoordinateDisplay installed and enabled. Launch the game to see it.");
