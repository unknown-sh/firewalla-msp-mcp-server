#!/usr/bin/env node

/**
 * Error handling example for Firewalla MSP MCP Server
 * 
 * This example demonstrates how to properly handle various
 * error scenarios when using the MCP server.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function demonstrateErrorHandling(client) {
  console.log('=== Error Handling Examples ===\n');

  // Example 1: Missing required parameters
  console.log('1. Missing Required Parameters:');
  try {
    await client.callTool({
      name: 'get_alarm',
      arguments: {
        gid: 'box1',
        // Missing 'aid' parameter
      },
    });
  } catch (error) {
    console.log(`   ❌ Expected error: ${error.message}`);
  }
  console.log();

  // Example 2: Invalid tool name
  console.log('2. Invalid Tool Name:');
  try {
    await client.callTool({
      name: 'invalid_tool_name',
      arguments: {},
    });
  } catch (error) {
    console.log(`   ❌ Expected error: ${error.message}`);
  }
  console.log();

  // Example 3: API errors (simulated)
  console.log('3. API Error Scenarios:');
  
  // 404 - Resource not found
  console.log('   a) Resource not found:');
  try {
    const result = await client.callTool({
      name: 'get_alarm',
      arguments: {
        gid: 'nonexistent-box',
        aid: 'nonexistent-alarm',
      },
    });
    // In a real scenario, this might return an error
    console.log('   ⚠️  Note: Actual 404 errors depend on API implementation');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log();

  // Example 4: Invalid query syntax
  console.log('4. Invalid Query Syntax:');
  try {
    const result = await client.callTool({
      name: 'list_alarms',
      arguments: {
        query: 'invalid:syntax:here',
        // This might cause an error depending on API validation
      },
    });
    console.log('   ⚠️  Query executed - API may handle invalid syntax gracefully');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log();

  // Example 5: Rate limiting simulation
  console.log('5. Handling Rate Limits (Simulation):');
  console.log('   Making multiple rapid requests...');
  
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      client.callTool({
        name: 'list_boxes',
        arguments: {},
      }).catch(error => ({ error, index: i }))
    );
  }
  
  const results = await Promise.all(promises);
  const errors = results.filter(r => r.error);
  
  if (errors.length > 0) {
    console.log(`   ❌ ${errors.length} requests failed (possible rate limiting)`);
  } else {
    console.log('   ✅ All requests succeeded');
  }
  console.log();

  // Example 6: Timeout handling
  console.log('6. Timeout Handling:');
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), 5000);
  });
  
  try {
    const result = await Promise.race([
      client.callTool({
        name: 'list_flows',
        arguments: {
          limit: 500, // Large request that might take time
        },
      }),
      timeoutPromise,
    ]);
    console.log('   ✅ Request completed within timeout');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log();
}

async function demonstrateRecoveryStrategies(client) {
  console.log('=== Recovery Strategies ===\n');

  // Strategy 1: Retry with exponential backoff
  console.log('1. Retry with Exponential Backoff:');
  
  async function retryWithBackoff(fn, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        console.log(`   Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
  
  try {
    const result = await retryWithBackoff(() => 
      client.callTool({
        name: 'list_alarms',
        arguments: {},
      })
    );
    console.log('   ✅ Request succeeded');
  } catch (error) {
    console.log(`   ❌ All retries failed: ${error.message}`);
  }
  console.log();

  // Strategy 2: Fallback values
  console.log('2. Using Fallback Values:');
  
  async function getAlarmsWithFallback() {
    try {
      const result = await client.callTool({
        name: 'list_alarms',
        arguments: { limit: 10 },
      });
      return JSON.parse(result.content[0].text);
    } catch (error) {
      console.log('   ⚠️  Using fallback data due to error');
      return {
        count: 0,
        results: [],
        error: error.message,
      };
    }
  }
  
  const alarms = await getAlarmsWithFallback();
  console.log(`   Retrieved ${alarms.count || 0} alarms (or fallback)`);
  console.log();

  // Strategy 3: Partial failure handling
  console.log('3. Handling Partial Failures:');
  
  const operations = [
    { name: 'list_boxes', args: {} },
    { name: 'list_devices', args: {} },
    { name: 'invalid_operation', args: {} }, // This will fail
    { name: 'list_rules', args: {} },
  ];
  
  const results = await Promise.allSettled(
    operations.map(op => 
      client.callTool({
        name: op.name,
        arguments: op.args,
      })
    )
  );
  
  const successful = results.filter(r => r.status === 'fulfilled');
  const failed = results.filter(r => r.status === 'rejected');
  
  console.log(`   ✅ Successful: ${successful.length}/${results.length}`);
  console.log(`   ❌ Failed: ${failed.length}/${results.length}`);
  
  failed.forEach((result, index) => {
    const op = operations[results.indexOf(result)];
    console.log(`      - ${op.name}: ${result.reason.message}`);
  });
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
    name: 'error-handling-example',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  try {
    await client.connect(transport);
    console.log('Connected to Firewalla MSP MCP Server\n');

    await demonstrateErrorHandling(client);
    await demonstrateRecoveryStrategies(client);

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from server');
  }
}

main().catch(console.error);