#!/usr/bin/env node

import { spawn } from 'child_process';

// Test environment variables
const testEnv = {
  FIREWALLA_MSP_API_KEY: 'test-api-key',
  FIREWALLA_MSP_DOMAIN: 'test.firewalla.net'
};

console.log('Starting Firewalla MSP MCP server test...');
console.log('Environment:', testEnv);

const server = spawn('node', ['../dist/index.js'], {
  env: { ...process.env, ...testEnv },
  stdio: ['pipe', 'pipe', 'pipe']
});

server.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
  if (data.toString().includes('Firewalla MSP MCP server running')) {
    console.log('\n✅ Server started successfully!');
    console.log('The server is now ready to accept MCP connections.');
    
    // Send a test request to list tools
    const testRequest = {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1
    };
    
    server.stdin.write(JSON.stringify(testRequest) + '\n');
  }
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.kill();
  process.exit(0);
});

console.log('Press Ctrl+C to stop the server.');