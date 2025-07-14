import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { spawn, ChildProcess } from 'child_process';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Mock API server for integration tests
const mockApiServer = setupServer(
  http.get('https://test.firewalla.net/v2/boxes', () => {
    return HttpResponse.json({
      count: 1,
      results: [
        {
          gid: 'test-box',
          name: 'Test Firewalla',
          model: 'Gold Plus',
          online: true,
        },
      ],
    });
  }),

  http.get('https://test.firewalla.net/v2/alarms/:gid/:aid', ({ params }) => {
    if (params.gid === 'invalid' || params.aid === 'invalid') {
      return HttpResponse.json(
        { message: 'Not Found' },
        { status: 404 }
      );
    }
    
    return HttpResponse.json({
      gid: params.gid,
      aid: params.aid,
      message: 'Test alarm',
      status: 'active',
    });
  }),

  http.all('*', () => {
    return HttpResponse.json(
      { message: 'Unauthorized' },
      { status: 401 }
    );
  }),
);

describe.skip('MCP Integration Tests', () => {
  let serverProcess: ChildProcess;
  let client: Client;

  beforeAll(async () => {
    mockApiServer.listen();

    // Start the MCP server
    serverProcess = spawn('node', ['dist/index.js'], {
      env: {
        ...process.env,
        FIREWALLA_MSP_API_KEY: 'test-key',
        FIREWALLA_MSP_DOMAIN: 'test.firewalla.net',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Create MCP client
    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Wait for server to start
    await new Promise((resolve) => {
      serverProcess.stderr?.on('data', (data) => {
        if (data.toString().includes('Firewalla MSP MCP server running')) {
          resolve(undefined);
        }
      });
    });
  });

  afterAll(async () => {
    mockApiServer.close();
    serverProcess.kill();
    await new Promise((resolve) => {
      serverProcess.on('close', resolve);
    });
  });

  describe('MCP Protocol', () => {
    it('should handle tools/list request', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/list',
        id: 1,
      };

      const response = await sendRequest(serverProcess, request);
      
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeInstanceOf(Array);
      expect(response.result.tools.length).toBeGreaterThan(0);
      
      const toolNames = response.result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('list_boxes');
      expect(toolNames).toContain('list_devices');
      expect(toolNames).toContain('create_target_list');
    });

    it('should handle tools/call for list_boxes', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'list_boxes',
          arguments: {},
        },
        id: 2,
      };

      const response = await sendRequest(serverProcess, request);
      
      expect(response.result).toBeDefined();
      expect(response.result.content).toBeInstanceOf(Array);
      expect(response.result.content[0].type).toBe('text');
      
      const data = JSON.parse(response.result.content[0].text);
      expect(data.results).toBeInstanceOf(Array);
      expect(data.results[0].name).toBe('Test Firewalla');
    });

    it('should handle tools/call with required parameters', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'get_alarm',
          arguments: {
            gid: 'test-box',
            aid: 'test-alarm',
          },
        },
        id: 3,
      };

      const response = await sendRequest(serverProcess, request);
      
      expect(response.result).toBeDefined();
      expect(response.result.content[0].type).toBe('text');
      
      const data = JSON.parse(response.result.content[0].text);
      expect(data.gid).toBe('test-box');
      expect(data.aid).toBe('test-alarm');
    });

    it('should handle missing required parameters', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'get_alarm',
          arguments: {
            gid: 'test-box',
            // Missing aid
          },
        },
        id: 4,
      };

      const response = await sendRequest(serverProcess, request);
      
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602); // Invalid params
    });

    it('should handle unknown tool', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
        id: 5,
      };

      const response = await sendRequest(serverProcess, request);
      
      expect(response.error).toBeDefined();
      expect(response.error.message).toContain('Unknown tool');
    });

    it('should handle API errors gracefully', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'get_alarm',
          arguments: {
            gid: 'invalid',
            aid: 'invalid',
          },
        },
        id: 6,
      };

      const response = await sendRequest(serverProcess, request);
      
      expect(response.error).toBeDefined();
      expect(response.error.message).toContain('Not found');
    });
  });
});

// Helper function to send JSON-RPC request
async function sendRequest(process: ChildProcess, request: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const messageHandler = (data: Buffer) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.id === request.id) {
          process.stdout?.off('data', messageHandler);
          resolve(response);
        }
      } catch (e) {
        // Ignore parse errors for partial messages
      }
    };

    process.stdout?.on('data', messageHandler);
    process.stdin?.write(JSON.stringify(request) + '\n');

    // Timeout after 5 seconds
    setTimeout(() => {
      process.stdout?.off('data', messageHandler);
      reject(new Error('Request timeout'));
    }, 5000);
  });
}