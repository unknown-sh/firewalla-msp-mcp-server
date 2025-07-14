#!/usr/bin/env node

/**
 * Pagination example for Firewalla MSP MCP Server
 * 
 * This example demonstrates how to handle paginated results
 * when dealing with large datasets.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function fetchAllResults(client, toolName, baseArgs = {}) {
  const allResults = [];
  let cursor = null;
  let pageCount = 0;

  console.log(`Fetching all ${toolName} results...`);

  while (true) {
    pageCount++;
    
    // Add cursor to arguments if we have one
    const args = cursor ? { ...baseArgs, cursor } : baseArgs;
    
    // Call the tool
    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });
    
    const data = JSON.parse(result.content[0].text);
    
    // Add results to our collection
    if (data.results) {
      allResults.push(...data.results);
      console.log(`  Page ${pageCount}: Retrieved ${data.results.length} items`);
    }
    
    // Check if there's a next page
    if (!data.next_cursor) {
      break;
    }
    
    cursor = data.next_cursor;
  }

  console.log(`Total items retrieved: ${allResults.length}\n`);
  return allResults;
}

async function main() {
  if (!process.env.FIREWALLA_MSP_API_KEY || !process.env.FIREWALLA_MSP_DOMAIN) {
    console.error('Please set FIREWALLA_MSP_API_KEY and FIREWALLA_MSP_DOMAIN environment variables');
    process.exit(1);
  }

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../dist/index.js'],
    env: {
      FIREWALLA_MSP_API_KEY: process.env.FIREWALLA_MSP_API_KEY,
      FIREWALLA_MSP_DOMAIN: process.env.FIREWALLA_MSP_DOMAIN,
    },
  });

  const client = new Client({
    name: 'pagination-example-client',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  try {
    await client.connect(transport);
    console.log('Connected to Firewalla MSP MCP Server\n');

    // Example 1: Fetch all alarms with pagination
    console.log('=== Fetching All Alarms ===');
    const allAlarms = await fetchAllResults(client, 'list_alarms', {
      limit: 50, // Fetch 50 at a time
    });
    
    // Show summary
    const activeAlarms = allAlarms.filter(a => a.status === 'active');
    console.log(`Summary:`);
    console.log(`- Total alarms: ${allAlarms.length}`);
    console.log(`- Active alarms: ${activeAlarms.length}`);
    console.log(`- Archived alarms: ${allAlarms.length - activeAlarms.length}`);
    console.log('\n');

    // Example 2: Fetch flows for a specific time range
    console.log('=== Fetching Flows for Last 24 Hours ===');
    const now = Math.floor(Date.now() / 1000);
    const yesterday = now - (24 * 60 * 60);
    
    const allFlows = await fetchAllResults(client, 'list_flows', {
      query: `ts:${yesterday}-${now}`,
      limit: 100,
    });
    
    // Calculate statistics
    let totalDownload = 0;
    let totalUpload = 0;
    const deviceTraffic = {};

    allFlows.forEach(flow => {
      totalDownload += flow.download || 0;
      totalUpload += flow.upload || 0;
      
      const deviceName = flow.device?.name || 'Unknown';
      if (!deviceTraffic[deviceName]) {
        deviceTraffic[deviceName] = { download: 0, upload: 0 };
      }
      deviceTraffic[deviceName].download += flow.download || 0;
      deviceTraffic[deviceName].upload += flow.upload || 0;
    });

    console.log(`Traffic Summary (Last 24 Hours):`);
    console.log(`- Total Download: ${(totalDownload / 1000000000).toFixed(2)} GB`);
    console.log(`- Total Upload: ${(totalUpload / 1000000000).toFixed(2)} GB`);
    console.log(`\nTop 5 Devices by Traffic:`);
    
    const sortedDevices = Object.entries(deviceTraffic)
      .sort((a, b) => (b[1].download + b[1].upload) - (a[1].download + a[1].upload))
      .slice(0, 5);
    
    sortedDevices.forEach(([device, traffic]) => {
      const total = ((traffic.download + traffic.upload) / 1000000000).toFixed(2);
      console.log(`- ${device}: ${total} GB`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from server');
  }
}

main().catch(console.error);