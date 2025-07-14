#!/usr/bin/env node

/**
 * Basic usage example for Firewalla MSP MCP Server
 * 
 * This example demonstrates how to:
 * 1. Connect to the MCP server
 * 2. List available tools
 * 3. Call various tools to interact with the Firewalla MSP API
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Check environment variables
if (!process.env.FIREWALLA_MSP_API_KEY || !process.env.FIREWALLA_MSP_DOMAIN) {
  console.error('Please set FIREWALLA_MSP_API_KEY and FIREWALLA_MSP_DOMAIN environment variables');
  process.exit(1);
}

async function main() {
  // Create transport to communicate with the server
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../dist/index.js'],
    env: {
      FIREWALLA_MSP_API_KEY: process.env.FIREWALLA_MSP_API_KEY,
      FIREWALLA_MSP_DOMAIN: process.env.FIREWALLA_MSP_DOMAIN,
    },
  });

  // Create client
  const client = new Client({
    name: 'firewalla-example-client',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  try {
    // Connect to the server
    await client.connect(transport);
    console.log('Connected to Firewalla MSP MCP Server\n');

    // List available tools
    console.log('=== Available Tools ===');
    const tools = await client.listTools();
    tools.tools.forEach(tool => {
      console.log(`- ${tool.name}: ${tool.description}`);
    });
    console.log('\n');

    // Example 1: List all boxes
    console.log('=== Example 1: List Boxes ===');
    const boxesResult = await client.callTool({
      name: 'list_boxes',
      arguments: {},
    });
    const boxes = JSON.parse(boxesResult.content[0].text);
    console.log(`Found ${boxes.count || boxes.results.length} boxes:`);
    boxes.results?.forEach(box => {
      console.log(`- ${box.name} (${box.model}) - ${box.online ? 'Online' : 'Offline'}`);
    });
    console.log('\n');

    // Example 2: List devices with filtering
    console.log('=== Example 2: List Devices ===');
    const devicesResult = await client.callTool({
      name: 'list_devices',
      arguments: {
        // Optionally filter by box ID
        // box: boxes.results[0]?.gid,
      },
    });
    const devices = JSON.parse(devicesResult.content[0].text);
    console.log(`Found ${devices.count || devices.results.length} devices:`);
    devices.results?.slice(0, 5).forEach(device => {
      console.log(`- ${device.name} (${device.ip}) - ${device.online ? 'Online' : 'Offline'}`);
    });
    if (devices.results?.length > 5) {
      console.log(`... and ${devices.results.length - 5} more`);
    }
    console.log('\n');

    // Example 3: Get active alarms
    console.log('=== Example 3: Active Alarms ===');
    const alarmsResult = await client.callTool({
      name: 'list_alarms',
      arguments: {
        query: 'status:active',
        limit: 10,
      },
    });
    const alarms = JSON.parse(alarmsResult.content[0].text);
    console.log(`Found ${alarms.count || alarms.results.length} active alarms:`);
    alarms.results?.forEach(alarm => {
      console.log(`- [${alarm.type}] ${alarm.message}`);
    });
    console.log('\n');

    // Example 4: List rules
    console.log('=== Example 4: List Rules ===');
    const rulesResult = await client.callTool({
      name: 'list_rules',
      arguments: {},
    });
    const rules = JSON.parse(rulesResult.content[0].text);
    console.log(`Found ${rules.count || rules.results.length} rules:`);
    rules.results?.slice(0, 5).forEach(rule => {
      console.log(`- ${rule.name} (${rule.status}) - Action: ${rule.action}`);
    });
    console.log('\n');

    // Example 5: List target lists
    console.log('=== Example 5: Target Lists ===');
    const targetListsResult = await client.callTool({
      name: 'list_target_lists',
      arguments: {},
    });
    const targetLists = JSON.parse(targetListsResult.content[0].text);
    console.log(`Found ${targetLists.count || targetLists.results.length} target lists:`);
    targetLists.results?.forEach(list => {
      console.log(`- ${list.name} (${list.category}) - ${list.targets.length} targets`);
    });
    console.log('\n');

    // Example 6: Create a new target list
    console.log('=== Example 6: Create Target List ===');
    const newListResult = await client.callTool({
      name: 'create_target_list',
      arguments: {
        name: 'Example Blocked IPs',
        targets: ['10.0.0.1', '10.0.0.2'],
        category: 'security',
        notes: 'Created via MCP example',
      },
    });
    const newList = JSON.parse(newListResult.content[0].text);
    console.log(`Created target list: ${newList.name} (ID: ${newList.id})`);
    console.log('\n');

    // Example 7: Get network flows
    console.log('=== Example 7: Recent Network Flows ===');
    const flowsResult = await client.callTool({
      name: 'list_flows',
      arguments: {
        limit: 5,
        sortBy: 'ts:desc',
      },
    });
    const flows = JSON.parse(flowsResult.content[0].text);
    console.log(`Found ${flows.count || flows.results.length} flows:`);
    flows.results?.forEach(flow => {
      const totalMB = ((flow.download + flow.upload) / 1000000).toFixed(2);
      console.log(`- ${flow.device?.name || 'Unknown'} → ${flow.domain} (${totalMB} MB)`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect from the server
    await client.close();
    console.log('\nDisconnected from server');
  }
}

// Run the example
main().catch(console.error);