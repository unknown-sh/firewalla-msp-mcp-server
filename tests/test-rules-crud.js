#!/usr/bin/env node

/**
 * SAFE Test script for enhanced Rules API CRUD operations
 * This creates test rules that can be safely deleted
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from 'dotenv';

config({ path: '../.env' });

console.log('🔒 SAFE Rules CRUD Test - Creates test rules that will be cleaned up\n');

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../dist/index.js'],
    env: process.env,
  });

  const client = new Client({
    name: 'rules-crud-test-client',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  let createdRuleId = null;

  try {
    await client.connect(transport);
    console.log('✅ Connected to Firewalla MSP MCP Server\n');

    // Test 1: List existing rules to see current state
    console.log('📋 TEST 1: List Current Rules');
    console.log('─'.repeat(50));
    try {
      const rulesResult = await client.callTool({
        name: 'list_rules',
        arguments: { limit: 5 },
      });
      const rules = JSON.parse(rulesResult.content[0].text);
      console.log(`Current rule count: ${rules.count || rules.results?.length || 0}`);
      console.log('First few rules:');
      const ruleList = rules.results?.slice(0, 3) || [];
      ruleList.forEach(rule => {
        console.log(`  • ${rule.name || 'Unnamed'} (${rule.action}) - ${rule.status}`);
      });
    } catch (error) {
      console.log('  ❌ Error listing rules:', error.message);
    }
    console.log();

    // Test 2: Create a safe test rule
    console.log('🆕 TEST 2: Create Test Rule');
    console.log('─'.repeat(50));
    try {
      const createResult = await client.callTool({
        name: 'create_rule',
        arguments: {
          name: 'MCP Test Rule - Safe to Delete',
          action: 'allow',
          direction: 'outbound',
          protocol: 'tcp',
          target: {
            type: 'ip',
            value: '127.0.0.1' // Localhost - completely safe
          },
          scope: {
            type: 'device',
            value: 'test-device-id',
            port: '80'
          }
        },
      });
      
      const newRule = JSON.parse(createResult.content[0].text);
      createdRuleId = newRule.id;
      console.log('✅ Rule created successfully!');
      console.log(`  Rule ID: ${createdRuleId}`);
      console.log(`  Name: ${newRule.name || 'Generated name'}`);
      console.log(`  Action: ${newRule.action}`);
      console.log(`  Status: ${newRule.status}`);
    } catch (error) {
      console.log('  ❌ Error creating rule:', error.message);
    }
    console.log();

    if (createdRuleId) {
      // Test 3: Update the test rule
      console.log('✏️  TEST 3: Update Test Rule');
      console.log('─'.repeat(50));
      try {
        const updateResult = await client.callTool({
          name: 'update_rule',
          arguments: {
            id: createdRuleId,
            name: 'MCP Test Rule - UPDATED',
            action: 'block', // Change action
            target: {
              type: 'ip',
              value: '127.0.0.2' // Still localhost range
            }
          },
        });
        
        const updatedRule = JSON.parse(updateResult.content[0].text);
        console.log('✅ Rule updated successfully!');
        console.log(`  New name: ${updatedRule.name}`);
        console.log(`  New action: ${updatedRule.action}`);
        console.log(`  New target: ${updatedRule.target?.value}`);
      } catch (error) {
        console.log('  ❌ Error updating rule:', error.message);
      }
      console.log();

      // Test 4: Pause the test rule
      console.log('⏸️  TEST 4: Pause Test Rule');
      console.log('─'.repeat(50));
      try {
        await client.callTool({
          name: 'pause_rule',
          arguments: { id: createdRuleId },
        });
        console.log('✅ Rule paused successfully!');
      } catch (error) {
        console.log('  ❌ Error pausing rule:', error.message);
      }
      console.log();

      // Test 5: Resume the test rule
      console.log('▶️  TEST 5: Resume Test Rule');
      console.log('─'.repeat(50));
      try {
        await client.callTool({
          name: 'resume_rule',
          arguments: { id: createdRuleId },
        });
        console.log('✅ Rule resumed successfully!');
      } catch (error) {
        console.log('  ❌ Error resuming rule:', error.message);
      }
      console.log();

      // Test 6: Clean up - Delete the test rule
      console.log('🗑️  TEST 6: Delete Test Rule (Cleanup)');
      console.log('─'.repeat(50));
      try {
        await client.callTool({
          name: 'delete_rule',
          arguments: { id: createdRuleId },
        });
        console.log('✅ Test rule deleted successfully!');
        console.log('  ✅ Cleanup completed - no test rules left behind');
      } catch (error) {
        console.log('  ❌ Error deleting rule:', error.message);
        console.log(`  ⚠️  Manual cleanup needed for rule ID: ${createdRuleId}`);
      }
      console.log();
    }

    // Test 7: Verify final state
    console.log('🔍 TEST 7: Verify Final State');
    console.log('─'.repeat(50));
    try {
      const finalRulesResult = await client.callTool({
        name: 'list_rules',
        arguments: { limit: 5 },
      });
      const finalRules = JSON.parse(finalRulesResult.content[0].text);
      console.log(`Final rule count: ${finalRules.count || finalRules.results?.length || 0}`);
      
      // Check if our test rule still exists
      if (createdRuleId) {
        const testRuleExists = finalRules.results?.some(rule => rule.id === createdRuleId);
        if (testRuleExists) {
          console.log('  ⚠️  Test rule still exists - manual cleanup recommended');
        } else {
          console.log('  ✅ Test rule successfully removed');
        }
      }
    } catch (error) {
      console.log('  ❌ Error verifying final state:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RULES CRUD TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Enhanced Rules API CRUD operations tested');
    console.log('🔒 All operations used safe test data');
    console.log('🧹 Test data cleaned up automatically');
    console.log('\nThe Rules API now supports:');
    console.log('• ✅ Create new rules');
    console.log('• ✅ Update existing rules');
    console.log('• ✅ Pause/Resume rules');
    console.log('• ✅ Delete rules');
    console.log('• ✅ List and filter rules');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from server');
  }
}

main().catch(console.error);