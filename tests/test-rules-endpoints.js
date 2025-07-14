#!/usr/bin/env node

/**
 * Test script to discover available Rules API endpoints
 */

import { config } from 'dotenv';
import axios from 'axios';

config({ path: '../.env' });

const httpClient = axios.create({
  baseURL: `https://${process.env.FIREWALLA_MSP_DOMAIN}/v2`,
  headers: {
    'Authorization': `Token ${process.env.FIREWALLA_MSP_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

console.log('🔍 Testing Rules API endpoints...\n');

async function testEndpoint(method, path, data = null) {
  try {
    console.log(`Testing: ${method} ${path}`);
    const response = await httpClient.request({
      method,
      url: path,
      data,
    });
    console.log(`  ✅ ${response.status} - Success`);
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    if (error.response) {
      console.log(`  ❌ ${error.response.status} - ${error.response.statusText}`);
      return { success: false, status: error.response.status, error: error.response.statusText };
    } else {
      console.log(`  ❌ Network Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

async function main() {
  // Test known endpoints first
  console.log('=== Known Endpoints ===');
  await testEndpoint('GET', '/rules');
  
  // Get a rule ID for testing
  console.log('\n=== Getting Rule ID for Testing ===');
  let ruleId = null;
  try {
    const rulesResponse = await httpClient.get('/rules', { params: { limit: 1 } });
    const rules = Array.isArray(rulesResponse.data) ? rulesResponse.data : rulesResponse.data.results;
    if (rules && rules.length > 0) {
      ruleId = rules[0].id;
      console.log(`  Found rule ID: ${ruleId}`);
    }
  } catch (error) {
    console.log('  Could not get rule ID');
  }

  if (ruleId) {
    console.log('\n=== Testing Rule-Specific Endpoints ===');
    await testEndpoint('GET', `/rules/${ruleId}`);
    await testEndpoint('PUT', `/rules/${ruleId}`, { name: 'Test Update' });
    await testEndpoint('PATCH', `/rules/${ruleId}`, { status: 'active' });
    
    console.log('\n=== Testing Control Endpoints ===');
    await testEndpoint('POST', `/rules/${ruleId}/pause`);
    await testEndpoint('POST', `/rules/${ruleId}/resume`);
  }

  console.log('\n=== Testing Creation Endpoint ===');
  const testRule = {
    name: 'Test MCP Rule',
    action: 'allow',
    direction: 'outbound',
    protocol: 'tcp',
    target: {
      type: 'ip',
      value: '8.8.8.8'
    }
  };
  await testEndpoint('POST', '/rules', testRule);

  console.log('\n=== Testing Bulk Operations ===');
  await testEndpoint('GET', '/rules/bulk');
  await testEndpoint('POST', '/rules/bulk/pause');
  await testEndpoint('POST', '/rules/bulk/resume');
  await testEndpoint('DELETE', '/rules/bulk');

  console.log('\n=== Testing Alternative Paths ===');
  await testEndpoint('GET', '/rule'); // Singular form
  await testEndpoint('GET', '/firewalls');
  await testEndpoint('GET', '/policies');

  console.log('\nTesting complete!');
}

main().catch(console.error);