#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read polls-config.json from repo root
const configPath = path.join(__dirname, '../../..', 'polls-config.json');
let config;

try {
  const configContent = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(configContent);
} catch (error) {
  console.error('❌ Error reading polls-config.json:', error.message);
  process.exit(1);
}

// Validate config
if (!config.pollsRoot || !config.activePoll) {
  console.error('❌ Error: pollsRoot or activePoll not configured in polls-config.json');
  process.exit(1);
}

// Resolve active poll folder
const activePollFolder = path.join(config.pollsRoot, config.activePoll);

// Verify folder exists
if (!fs.existsSync(activePollFolder)) {
  console.error(`❌ Error: Active poll folder not found: ${activePollFolder}`);
  process.exit(1);
}

console.log(`🔄 Resetting poll: ${activePollFolder}\n`);

// Get all contents of the active poll folder
const contents = fs.readdirSync(activePollFolder, { withFileTypes: true });

const deletedItems = [];
const preservedItems = [];

// Process each item
contents.forEach((item) => {
  const itemPath = path.join(activePollFolder, item.name);

  // Preserve Poll init.md
  if (item.name === 'Poll init.md') {
    preservedItems.push(item.name);
    return;
  }

  // Delete everything else
  try {
    if (item.isDirectory()) {
      // Recursively delete directory
      deleteRecursive(itemPath);
      deletedItems.push(`📁 ${item.name}/`);
    } else {
      // Delete file
      fs.unlinkSync(itemPath);
      deletedItems.push(`📄 ${item.name}`);
    }
  } catch (error) {
    console.error(`⚠️  Failed to delete ${item.name}:`, error.message);
  }
});

// Helper function to recursively delete directories
function deleteRecursive(dirPath) {
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  items.forEach((item) => {
    const itemPath = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      deleteRecursive(itemPath);
    } else {
      fs.unlinkSync(itemPath);
    }
  });

  fs.rmdirSync(dirPath);
}

// Output summary
console.log('Deleted items:');
if (deletedItems.length > 0) {
  deletedItems.forEach((item) => console.log(`  ${item}`));
} else {
  console.log('  (none)');
}

console.log('\nPreserved items:');
if (preservedItems.length > 0) {
  preservedItems.forEach((item) => console.log(`  ✅ ${item}`));
} else {
  console.log('  (none)');
}

console.log(`\n✅ Poll has been reset. You can now run /poll-create to recreate it.`);
