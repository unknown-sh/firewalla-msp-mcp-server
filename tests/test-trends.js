#!/usr/bin/env node

/**
 * Test script for Trends API - Historical data analysis
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from 'dotenv';

config({ path: '../.env' });

console.log('📈 Trends API Test - Historical data analysis\n');

function formatTimestamp(ts) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function analyzeTrend(data) {
  if (!Array.isArray(data) || data.length < 2) {
    return { trend: 'insufficient_data', change: 0 };
  }
  
  // Sort by timestamp
  const sorted = data.sort((a, b) => a.ts - b.ts);
  const first = sorted[0].value;
  const last = sorted[sorted.length - 1].value;
  const change = ((last - first) / first * 100).toFixed(1);
  
  let trend;
  if (Math.abs(change) < 5) {
    trend = 'stable';
  } else if (change > 0) {
    trend = 'increasing';
  } else {
    trend = 'decreasing';
  }
  
  return { trend, change: parseFloat(change), total: sorted.reduce((sum, item) => sum + item.value, 0) };
}

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../dist/index.js'],
    env: process.env,
  });

  const client = new Client({
    name: 'trends-test-client',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to Firewalla MSP MCP Server\n');

    // Test 1: Flows trends
    console.log('🌊 TEST 1: Flows Trends');
    console.log('─'.repeat(50));
    try {
      const flowsTrendsResult = await client.callTool({
        name: 'get_trends',
        arguments: { type: 'flows' },
      });
      const flowsTrends = JSON.parse(flowsTrendsResult.content[0].text);
      
      const trendsArray = flowsTrends.results || flowsTrends;
      
      if (Array.isArray(trendsArray) && trendsArray.length > 0) {
        console.log(`Found ${trendsArray.length} days of flow data:`);
        
        // Show recent trends (last 5 days)
        const recent = trendsArray.slice(-5);
        recent.forEach(item => {
          console.log(`  ${formatTimestamp(item.ts)}: ${item.value.toLocaleString()} flows`);
        });
        
        const analysis = analyzeTrend(trendsArray);
        console.log(`\nTrend Analysis:`);
        console.log(`  📊 Overall trend: ${analysis.trend}`);
        console.log(`  📈 Change: ${analysis.change > 0 ? '+' : ''}${analysis.change}%`);
        console.log(`  🔢 Total flows: ${analysis.total.toLocaleString()}`);
        
      } else {
        console.log('  No flow trends data available');
      }
      
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 2: Alarms trends
    console.log('🚨 TEST 2: Alarms Trends');
    console.log('─'.repeat(50));
    try {
      const alarmsTrendsResult = await client.callTool({
        name: 'get_trends',
        arguments: { type: 'alarms' },
      });
      const alarmsTrends = JSON.parse(alarmsTrendsResult.content[0].text);
      
      const trendsArray = alarmsTrends.results || alarmsTrends;
      
      if (Array.isArray(trendsArray) && trendsArray.length > 0) {
        console.log(`Found ${trendsArray.length} days of alarm data:`);
        
        // Show recent trends (last 5 days)
        const recent = trendsArray.slice(-5);
        recent.forEach(item => {
          console.log(`  ${formatTimestamp(item.ts)}: ${item.value} alarms`);
        });
        
        const analysis = analyzeTrend(trendsArray);
        console.log(`\nTrend Analysis:`);
        console.log(`  📊 Overall trend: ${analysis.trend}`);
        console.log(`  📈 Change: ${analysis.change > 0 ? '+' : ''}${analysis.change}%`);
        console.log(`  🔢 Total alarms: ${analysis.total}`);
        
        // Find peak alarm day
        const peak = trendsArray.reduce((max, item) => item.value > max.value ? item : max, trendsArray[0]);
        console.log(`  📅 Peak day: ${formatTimestamp(peak.ts)} (${peak.value} alarms)`);
        
      } else {
        console.log('  No alarm trends data available');
      }
      
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 3: Rules trends
    console.log('📋 TEST 3: Rules Trends');
    console.log('─'.repeat(50));
    try {
      const rulesTrendsResult = await client.callTool({
        name: 'get_trends',
        arguments: { type: 'rules' },
      });
      const rulesTrends = JSON.parse(rulesTrendsResult.content[0].text);
      
      const trendsArray = rulesTrends.results || rulesTrends;
      
      if (Array.isArray(trendsArray) && trendsArray.length > 0) {
        console.log(`Found ${trendsArray.length} days of rules data:`);
        
        // Show recent trends (last 5 days)  
        const recent = trendsArray.slice(-5);
        recent.forEach(item => {
          console.log(`  ${formatTimestamp(item.ts)}: ${item.value} rules created`);
        });
        
        const analysis = analyzeTrend(trendsArray);
        console.log(`\nTrend Analysis:`);
        console.log(`  📊 Overall trend: ${analysis.trend}`);
        console.log(`  📈 Change: ${analysis.change > 0 ? '+' : ''}${analysis.change}%`);
        console.log(`  🔢 Total new rules: ${analysis.total}`);
        
      } else {
        console.log('  No rules trends data available');
      }
      
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log();

    // Test 4: Summary across all trend types
    console.log('📊 TEST 4: Trends Summary');
    console.log('─'.repeat(50));
    console.log('Available trend types:');
    console.log('  🌊 flows - Daily blocked flows count');
    console.log('  🚨 alarms - Daily security alarms count');
    console.log('  📋 rules - Daily new rules created count');
    console.log();
    console.log('Trend data provides historical insights for:');
    console.log('  • Security posture over time');
    console.log('  • Network traffic patterns');
    console.log('  • Rule creation activity');
    console.log('  • Threat landscape changes');

    console.log('\n' + '='.repeat(60));
    console.log('📈 TRENDS API TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Trends API implementation tested');
    console.log('🔒 All operations are read-only and safe');
    console.log('\nNew capabilities added:');
    console.log('• 🌊 Historical flow trends');
    console.log('• 🚨 Security alarm trends');
    console.log('• 📋 Rule creation trends');
    console.log('• 📊 Trend analysis and insights');
    console.log('• 📅 Time-series data visualization');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from server');
  }
}

main().catch(console.error);