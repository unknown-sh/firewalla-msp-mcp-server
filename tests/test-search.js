#!/usr/bin/env node

/**
 * Test script for Search API - Global search functionality
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from 'dotenv';

config({ path: '../.env' });

console.log('🔍 Search API Test - Global search functionality\n');

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../dist/index.js'],
    env: process.env,
  });

  const client = new Client({
    name: 'search-test-client',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to Firewalla MSP MCP Server\n');

    // Test 1: Global search across all entity types
    console.log('🌐 TEST 1: Global Search - All Entity Types');
    console.log('─'.repeat(50));
    try {
      const globalSearchResult = await client.callTool({
        name: 'search_global',
        arguments: {
          query: 'apple',
          limit: 5,
        },
      });
      const globalSearch = JSON.parse(globalSearchResult.content[0].text);
      
      console.log(`Search query: "${globalSearch.query}"`);
      console.log(`Total matches: ${globalSearch.total_count}`);
      console.log('\nResults by entity type:');
      
      Object.entries(globalSearch.results).forEach(([entityType, results]) => {
        if (results.error) {
          console.log(`  ${entityType}: ❌ ${results.error}`);
        } else if (Array.isArray(results) && results.length > 0) {
          console.log(`  ${entityType}: ✅ ${results.length} matches`);
          // Show first match as example
          if (results[0]) {
            const firstMatch = results[0];
            const identifier = firstMatch.name || firstMatch.gid || firstMatch.id || 'Unknown';
            console.log(`    └─ Example: ${identifier}`);
          }
        } else {
          console.log(`  ${entityType}: 📭 No matches`);
        }
      });
      
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 2: Device-specific search
    console.log('📱 TEST 2: Device Search');
    console.log('─'.repeat(50));
    try {
      const deviceSearchResult = await client.callTool({
        name: 'search_devices',
        arguments: {
          query: 'iphone',
          limit: 10,
        },
      });
      const deviceSearch = JSON.parse(deviceSearchResult.content[0].text);
      
      const devices = deviceSearch.results || deviceSearch;
      if (Array.isArray(devices) && devices.length > 0) {
        console.log(`Found ${devices.length} devices matching "iphone":`);
        devices.slice(0, 5).forEach((device, index) => {
          const name = device.name || device.hostname || 'Unknown Device';
          const mac = device.mac || 'Unknown MAC';
          const ip = device.ipv4Addr || device.ip || 'Unknown IP';
          console.log(`  ${index + 1}. ${name} (${mac}) - ${ip}`);
        });
      } else {
        console.log('  No devices found matching "iphone"');
      }
      
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 3: Alarm search with status filter
    console.log('🚨 TEST 3: Alarm Search with Status Filter');
    console.log('─'.repeat(50));
    try {
      const alarmSearchResult = await client.callTool({
        name: 'search_alarms',
        arguments: {
          query: 'security',
          status: 'active',
          limit: 5,
        },
      });
      const alarmSearch = JSON.parse(alarmSearchResult.content[0].text);
      
      const alarms = alarmSearch.results || alarmSearch;
      if (Array.isArray(alarms) && alarms.length > 0) {
        console.log(`Found ${alarms.length} active security alarms:`);
        alarms.forEach((alarm, index) => {
          const message = alarm.message || alarm.title || 'Unknown alarm';
          const type = alarm.type || 'Unknown type';
          const timestamp = alarm.ts ? new Date(alarm.ts * 1000).toLocaleString() : 'Unknown time';
          console.log(`  ${index + 1}. [${type}] ${message}`);
          console.log(`      └─ ${timestamp}`);
        });
      } else {
        console.log('  No active security alarms found');
      }
      
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 4: Flow search with protocol filter
    console.log('🌊 TEST 4: Flow Search with Protocol Filter');
    console.log('─'.repeat(50));
    try {
      const flowSearchResult = await client.callTool({
        name: 'search_flows',
        arguments: {
          query: 'google',
          protocol: 'tcp',
          limit: 3,
        },
      });
      const flowSearch = JSON.parse(flowSearchResult.content[0].text);
      
      const flows = flowSearch.results || flowSearch;
      if (Array.isArray(flows) && flows.length > 0) {
        console.log(`Found ${flows.length} TCP flows to/from Google:`);
        flows.forEach((flow, index) => {
          const dest = flow.destination || flow.dest || 'Unknown destination';
          const port = flow.dport || flow.port || 'Unknown port';
          const protocol = flow.protocol || 'Unknown protocol';
          console.log(`  ${index + 1}. ${dest}:${port} (${protocol})`);
        });
      } else {
        console.log('  No TCP flows found matching "google"');
      }
      
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 5: Targeted search - specific entity types
    console.log('🎯 TEST 5: Targeted Search - Specific Entity Types');
    console.log('─'.repeat(50));
    try {
      const targetedSearchResult = await client.callTool({
        name: 'search_global',
        arguments: {
          query: 'blocked',
          types: ['alarms', 'flows'],
          limit: 3,
        },
      });
      const targetedSearch = JSON.parse(targetedSearchResult.content[0].text);
      
      console.log(`Targeted search for "blocked" in alarms and flows:`);
      console.log(`Total matches: ${targetedSearch.total_count}`);
      
      Object.entries(targetedSearch.results).forEach(([entityType, results]) => {
        if (results.error) {
          console.log(`  ${entityType}: ❌ ${results.error}`);
        } else if (Array.isArray(results)) {
          console.log(`  ${entityType}: ${results.length} matches`);
        } else {
          console.log(`  ${entityType}: No matches`);
        }
      });
      
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 6: Available search tools
    console.log('🔧 TEST 6: Available Search Tools');
    console.log('─'.repeat(50));
    try {
      const tools = await client.listTools();
      const searchTools = tools.tools.filter(tool => 
        tool.name.includes('search')
      );
      
      console.log('Available Search Tools:');
      searchTools.forEach(tool => {
        console.log(`  ✅ ${tool.name}: ${tool.description}`);
      });
      
      console.log(`\nTotal search tools: ${searchTools.length}`);
      
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🔍 SEARCH API TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Search API implementation tested');
    console.log('🔒 All operations are read-only and safe');
    console.log('\nNew search capabilities added:');
    console.log('• 🌐 Global search across all entity types');
    console.log('• 📱 Device-specific search (by name, MAC, IP)');
    console.log('• 🚨 Alarm search with status filtering');
    console.log('• 🌊 Flow search with protocol filtering');
    console.log('• 🎯 Targeted search by entity type');
    console.log('• 🔧 Advanced query building and filtering');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from server');
  }
}

main().catch(console.error);