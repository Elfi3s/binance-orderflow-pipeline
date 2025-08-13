// test-output.js
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { config } from './config.js';

// Test file output functionality
console.log(chalk.blue('🧪 Testing file output...'));

// Ensure directories exist
try {
  if (!fs.existsSync(config.outputPath)) {
    fs.mkdirSync(config.outputPath, { recursive: true });
    console.log(chalk.green(`✅ Created output directory: ${config.outputPath}`));
  }
  
  if (!fs.existsSync(config.logPath)) {
    fs.mkdirSync(config.logPath, { recursive: true });
    console.log(chalk.green(`✅ Created log directory: ${config.logPath}`));
  }
} catch (error) {
  console.error(chalk.red('❌ Failed to create directories:'), error);
  process.exit(1);
}

// Create test snapshot
const testSnapshot = {
  timestamp: Date.now(),
  barStart: Date.now() - (4 * 60 * 60 * 1000),
  barEnd: Date.now(),
  symbol: "ETHUSDT",
  test: true,
  message: "This is a test snapshot to verify file output works"
};

// Try to save file
const fileName = `test_snapshot_${Date.now()}.json`;
const filePath = path.join(config.outputPath, fileName);

try {
  fs.writeFileSync(filePath, JSON.stringify(testSnapshot, null, 2));
  console.log(chalk.green(`✅ Test snapshot saved: ${filePath}`));
  
  // Verify file was created and can be read
  const readData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(chalk.green('✅ File read back successfully'));
  console.log(chalk.gray('Test data:'), readData);
  
  // Clean up test file
  fs.unlinkSync(filePath);
  console.log(chalk.gray('🗑️ Test file cleaned up'));
  
} catch (error) {
  console.error(chalk.red('❌ Failed to save/read test file:'), error);
  process.exit(1);
}

console.log(chalk.green('🎉 File output test completed successfully!'));
