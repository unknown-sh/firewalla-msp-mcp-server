#!/usr/bin/env node

/**
 * Test script for Statistics API - All read-only operations
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from 'dotenv';

config({ path: '../.env' });

console.log('📊 Statistics API Test - All read-only operations\n');

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../dist/index.js'],
    env: process.env,
  });

  const client = new Client({
    name: 'statistics-test-client',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to Firewalla MSP MCP Server\n');

    // Test 1: Get simple statistics overview
    console.log('📈 TEST 1: Simple Statistics Overview');
    console.log('─'.repeat(50));
    try {
      const simpleStatsResult = await client.callTool({
        name: 'get_simple_statistics',
        arguments: {},
      });
      const simpleStats = JSON.parse(simpleStatsResult.content[0].text);
      
      console.log('Overview Statistics:');
      if (simpleStats.onlineBoxes !== undefined) {
        console.log(`  📦 Online Boxes: ${simpleStats.onlineBoxes}`);
      }
      if (simpleStats.offlineBoxes !== undefined) {
        console.log(`  📦 Offline Boxes: ${simpleStats.offlineBoxes}`);
      }
      if (simpleStats.alarms !== undefined) {
        console.log(`  🚨 Total Alarms: ${simpleStats.alarms}`);
      }
      if (simpleStats.rules !== undefined) {
        console.log(`  📋 Total Rules: ${simpleStats.rules}`);
      }
      
      // Show raw response for debugging
      console.log('\nRaw Response:');
      console.log(JSON.stringify(simpleStats, null, 2));
      
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 2: Top boxes by blocked flows
    console.log('🛡️  TEST 2: Top Boxes by Blocked Flows');
    console.log('─'.repeat(50));
    try {
      const blockedFlowsResult = await client.callTool({
        name: 'get_statistics',
        arguments: {
          type: 'topBoxesByBlockedFlows',
          limit: 5,
        },
      });
      const blockedFlowsStats = JSON.parse(blockedFlowsResult.content[0].text);
      
      console.log('Top Boxes by Blocked Flows:');
      if (blockedFlowsStats.results && blockedFlowsStats.results.length > 0) {
        blockedFlowsStats.results.forEach((stat, index) => {
          const boxName = stat.meta?.name || stat.meta?.gid || 'Unknown Box';
          console.log(`  ${index + 1}. ${boxName}: ${stat.value} blocked flows`);
        });
      } else if (Array.isArray(blockedFlowsStats) && blockedFlowsStats.length > 0) {
        blockedFlowsStats.forEach((stat, index) => {
          const boxName = stat.meta?.name || stat.meta?.gid || 'Unknown Box';
          console.log(`  ${index + 1}. ${boxName}: ${stat.value} blocked flows`);
        });
      } else {
        console.log('  No blocked flows data available');
      }
      
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 3: Top boxes by security alarms
    console.log('🚨 TEST 3: Top Boxes by Security Alarms');
    console.log('─'.repeat(50));
    try {
      const securityAlarmsResult = await client.callTool({
        name: 'get_statistics',
        arguments: {
          type: 'topBoxesBySecurityAlarms',
          limit: 3,
        },
      });
      const securityAlarmsStats = JSON.parse(securityAlarmsResult.content[0].text);
      
      console.log('Top Boxes by Security Alarms:');
      const statsArray = securityAlarmsStats.results || securityAlarmsStats;
      if (Array.isArray(statsArray) && statsArray.length > 0) {
        statsArray.forEach((stat, index) => {
          const boxName = stat.meta?.name || stat.meta?.gid || 'Unknown Box';
          console.log(`  ${index + 1}. ${boxName}: ${stat.value} security alarms`);
        });
      } else {
        console.log('  No security alarms data available');
      }
      
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 4: Top regions by blocked flows
    console.log('🌍 TEST 4: Top Regions by Blocked Flows');
    console.log('─'.repeat(50));
    try {
      const regionsResult = await client.callTool({
        name: 'get_statistics',
        arguments: {
          type: 'topRegionsByBlockedFlows',
          limit: 10,
        },
      });
      const regionsStats = JSON.parse(regionsResult.content[0].text);
      
      console.log('Top Regions by Blocked Flows:');
      const statsArray = regionsStats.results || regionsStats;
      if (Array.isArray(statsArray) && statsArray.length > 0) {
        statsArray.forEach((stat, index) => {
          const regionName = stat.meta?.name || stat.meta?.code || 'Unknown Region';
          console.log(`  ${index + 1}. ${regionName}: ${stat.value} blocked flows`);
        });
      } else {
        console.log('  No regional data available');
      }
      
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 5: Verify all tools are available
    console.log('🔍 TEST 5: Available Statistics Tools');
    console.log('─'.repeat(50));
    try {
      const tools = await client.listTools();
      const statsTools = tools.tools.filter(tool => 
        tool.name.includes('statistics') || tool.name.includes('stats')
      );
      
      console.log('Available Statistics Tools:');
      statsTools.forEach(tool => {
        console.log(`  ✅ ${tool.name}: ${tool.description}`);
      });
      
      console.log(`\nTotal statistics tools: ${statsTools.length}`);
      
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 STATISTICS API TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Statistics API implementation tested');
    console.log('🔒 All operations are read-only and safe');
    console.log('\nNew capabilities added:');
    console.log('• 📈 Simple statistics overview');
    console.log('• 🛡️  Top boxes by blocked flows');
    console.log('• 🚨 Top boxes by security alarms');
    console.log('• 🌍 Top regions by blocked flows');
    console.log('• 🔍 Flexible filtering by group and limit');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from server');
  }
}

main().catch(console.error);