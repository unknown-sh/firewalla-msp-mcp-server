#!/usr/bin/env node

/**
 * Read-only test script for Firewalla MSP MCP Server
 * This script ONLY performs read operations - no modifications to your network
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from 'dotenv';

// Load environment variables from .env file
config({ path: '../.env' });

console.log('🔒 SAFE READ-ONLY TEST - No modifications will be made to your Firewalla\n');

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../dist/index.js'],
    env: {
      ...process.env,
    },
  });

  const client = new Client({
    name: 'readonly-test-client',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to Firewalla MSP MCP Server\n');

    // Test 1: List your Firewalla boxes (READ ONLY)
    console.log('📦 TEST 1: Listing Firewalla Boxes (READ ONLY)');
    console.log('─'.repeat(50));
    try {
      const boxesResult = await client.callTool({
        name: 'list_boxes',
        arguments: {},
      });
      const boxes = JSON.parse(boxesResult.content[0].text);
      console.log(`Found ${boxes.results?.length || 0} Firewalla box(es):`);
      boxes.results?.forEach(box => {
        console.log(`  • ${box.name} (${box.model})`);
        console.log(`    Status: ${box.online ? '🟢 Online' : '🔴 Offline'}`);
        console.log(`    Mode: ${box.mode}`);
        console.log(`    Version: ${box.version || 'N/A'}`);
      });
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 2: List devices (READ ONLY)
    console.log('📱 TEST 2: Listing Connected Devices (READ ONLY)');
    console.log('─'.repeat(50));
    try {
      const devicesResult = await client.callTool({
        name: 'list_devices',
        arguments: {},
      });
      const devices = JSON.parse(devicesResult.content[0].text);
      console.log(`Found ${devices.results?.length || 0} device(s):`);
      
      // Show first 5 devices only
      const deviceList = devices.results?.slice(0, 5) || [];
      deviceList.forEach(device => {
        console.log(`  • ${device.name || 'Unnamed Device'}`);
        console.log(`    IP: ${device.ip || 'N/A'}`);
        console.log(`    MAC: ${device.mac || 'N/A'}`);
        console.log(`    Status: ${device.online ? '🟢 Online' : '🔴 Offline'}`);
      });
      
      if (devices.results?.length > 5) {
        console.log(`  ... and ${devices.results.length - 5} more devices`);
      }
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 3: Check for active alarms (READ ONLY)
    console.log('🚨 TEST 3: Checking Active Alarms (READ ONLY)');
    console.log('─'.repeat(50));
    try {
      const alarmsResult = await client.callTool({
        name: 'list_alarms',
        arguments: {
          query: 'status:active',
          limit: 5,
        },
      });
      const alarms = JSON.parse(alarmsResult.content[0].text);
      
      if (alarms.results?.length > 0) {
        console.log(`Found ${alarms.results.length} active alarm(s):`);
        alarms.results.forEach(alarm => {
          console.log(`  ⚠️  ${alarm.message}`);
          console.log(`     Type: ${alarm.type}`);
        });
      } else {
        console.log('  ✅ No active alarms - your network looks good!');
      }
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 4: List rules (READ ONLY)
    console.log('📋 TEST 4: Listing Security Rules (READ ONLY)');
    console.log('─'.repeat(50));
    try {
      const rulesResult = await client.callTool({
        name: 'list_rules',
        arguments: {},
      });
      const rules = JSON.parse(rulesResult.content[0].text);
      console.log(`Found ${rules.results?.length || 0} rule(s):`);
      
      // Show first 5 rules
      const ruleList = rules.results?.slice(0, 5) || [];
      ruleList.forEach(rule => {
        console.log(`  • ${rule.name}`);
        console.log(`    Status: ${rule.status === 'active' ? '✅ Active' : '⏸️  Paused'}`);
        console.log(`    Action: ${rule.action}`);
      });
      
      if (rules.results?.length > 5) {
        console.log(`  ... and ${rules.results.length - 5} more rules`);
      }
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 5: List target lists (READ ONLY)
    console.log('🎯 TEST 5: Listing Target Lists (READ ONLY)');
    console.log('─'.repeat(50));
    try {
      const targetListsResult = await client.callTool({
        name: 'list_target_lists',
        arguments: {},
      });
      const targetLists = JSON.parse(targetListsResult.content[0].text);
      console.log(`Found ${targetLists.results?.length || 0} target list(s):`);
      
      targetLists.results?.forEach(list => {
        console.log(`  • ${list.name}`);
        console.log(`    Category: ${list.category || 'N/A'}`);
        console.log(`    Targets: ${list.targets?.length || 0} entries`);
      });
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Summary
    console.log('=' .repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('=' .repeat(60));
    console.log('✅ All read-only tests completed');
    console.log('🔒 No modifications were made to your Firewalla');
    console.log('\nNext steps:');
    console.log('1. Review the output above to verify data is correct');
    console.log('2. If everything looks good, you can test write operations');
    console.log('3. Always test write operations on non-critical data first');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from server');
  }
}

// Check for .env file
import { existsSync } from 'fs';
if (!existsSync('../.env')) {
  console.error('❌ Missing .env file');
  console.error('Please copy .env.example to .env and add your credentials');
  process.exit(1);
}

main().catch(console.error);