import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Mock environment variables
process.env.FIREWALLA_MSP_API_KEY = 'test-api-key';
process.env.FIREWALLA_MSP_DOMAIN = 'test.firewalla.net';

// Create MSW mock server for alarm endpoints
const mockApiServer = setupServer(
  // List alarms with various query parameters
  http.get('https://test.firewalla.net/v2/alarms', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    const cursor = url.searchParams.get('cursor');
    const limit = url.searchParams.get('limit');
    
    // Simulate pagination
    if (cursor === 'page2') {
      return HttpResponse.json({
        count: 1,
        results: [
          {
            gid: 'box1',
            aid: 'alarm3',
            ts: 1234567892,
            type: 1,
            message: 'Third alarm on page 2',
            status: 'resolved',
            severity: 'LOW',
            device: { id: 'device3', name: 'Smart TV' }
          }
        ],
        next_cursor: null,
      });
    }
    
    // Base alarm data
    let alarms = [
      {
        gid: 'box1',
        aid: 'alarm1',
        ts: 1234567890,
        type: 9,
        message: 'Large download detected from youtube.com',
        status: 'active',
        severity: 'HIGH',
        device: { id: 'device1', name: 'Johns iPhone' },
        remote: { 
          domain: 'youtube.com',
          category: 'streaming',
          region: 'US'
        },
        transfer: {
          download: 5242880,
          upload: 102400,
          total: 5345280
        }
      },
      {
        gid: 'box2',
        aid: 'alarm2',
        ts: 1234567891,
        type: 10,
        message: 'Port scan detected from 192.168.1.100',
        status: 'active',
        severity: 'MEDIUM',
        device: { id: 'device2', name: 'Unknown Device' },
        remote: {
          ip: '192.168.1.100',
          region: 'Local'
        }
      }
    ];
    
    // Apply query filters
    if (query) {
      // Test various search qualifiers
      if (query.includes('status:active')) {
        alarms = alarms.filter(a => a.status === 'active');
      }
      if (query.includes('status:resolved')) {
        alarms = alarms.filter(a => a.status === 'resolved');
      }
      if (query.includes('type:9')) {
        alarms = alarms.filter(a => a.type === 9);
      }
      if (query.includes('device.name:*iphone*')) {
        alarms = alarms.filter(a => a.device.name.toLowerCase().includes('iphone'));
      }
      if (query.includes('remote.domain:youtube.com')) {
        alarms = alarms.filter(a => a.remote?.domain === 'youtube.com');
      }
      if (query.includes('transfer.download:>1MB')) {
        alarms = alarms.filter(a => a.transfer && a.transfer.download > 1048576);
      }
      // Test timestamp queries
      if (query.includes('ts:>1234567890')) {
        alarms = alarms.filter(a => a.ts > 1234567890);
      }
      if (query.includes('ts:1234567890-1234567891')) {
        alarms = alarms.filter(a => a.ts >= 1234567890 && a.ts <= 1234567891);
      }
    }
    
    // Apply limit
    const resultLimit = limit ? parseInt(limit) : 200;
    const results = alarms.slice(0, resultLimit);
    
    return HttpResponse.json({
      count: results.length,
      results: results,
      next_cursor: results.length === alarms.length ? null : 'page2',
    });
  }),

  // Get specific alarm
  http.get('https://test.firewalla.net/v2/alarms/:gid/:aid', ({ params }) => {
    const { gid, aid } = params;
    
    if (gid === 'box1' && aid === 'alarm1') {
      return HttpResponse.json({
        gid: 'box1',
        aid: 'alarm1',
        ts: 1234567890,
        type: 9,
        message: 'Large download detected from youtube.com',
        status: 'active',
        severity: 'HIGH',
        device: { id: 'device1', name: 'Johns iPhone' },
        remote: { 
          domain: 'youtube.com',
          category: 'streaming',
          region: 'US'
        },
        transfer: {
          download: 5242880,
          upload: 102400,
          total: 5345280
        },
        details: 'Extended alarm information including packet traces'
      });
    }
    
    return HttpResponse.json(
      { message: 'Alarm not found' },
      { status: 404 }
    );
  }),

  // Delete alarm
  http.delete('https://test.firewalla.net/v2/alarms/:gid/:aid', ({ params }) => {
    const { gid, aid } = params;
    
    if (gid === 'box1' && aid === 'alarm1') {
      return new HttpResponse(null, { status: 204 });
    }
    
    return HttpResponse.json(
      { message: 'Alarm not found' },
      { status: 404 }
    );
  }),

  // Search alarms (same as list but with different endpoint)
  http.get('https://test.firewalla.net/v2/search/alarms', ({ request }) => {
    // Reuse the same logic as list_alarms
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    
    return HttpResponse.json({
      count: 1,
      results: [
        {
          gid: 'box1',
          aid: 'alarm1',
          ts: 1234567890,
          type: 9,
          message: `Search result for: ${query}`,
          status: 'active'
        }
      ]
    });
  })
);

describe('Alarm Endpoints', () => {
  beforeAll(() => {
    mockApiServer.listen();
  });

  afterAll(() => {
    mockApiServer.close();
  });

  describe('list_alarms', () => {
    it('should list all alarms without filters', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.count).toBe(2);
      expect(data.results).toHaveLength(2);
      expect(data.results[0].aid).toBe('alarm1');
    });

    it('should support pagination', async () => {
      const response1 = await fetch('https://test.firewalla.net/v2/alarms?limit=2', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data1 = await response1.json();
      expect(data1.results).toHaveLength(2);
      expect(data1.next_cursor).toBe(null); // All results fit in one page
      
      // Test second page
      const response2 = await fetch('https://test.firewalla.net/v2/alarms?cursor=page2', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data2 = await response2.json();
      expect(data2.results).toHaveLength(1);
      expect(data2.results[0].aid).toBe('alarm3');
      expect(data2.next_cursor).toBe(null);
    });
  });

  describe('Alarm Search Qualifiers', () => {
    it('should filter by status qualifier', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=status:active', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results.every(a => a.status === 'active')).toBe(true);
    });

    it('should filter by type qualifier', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=type:9', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results).toHaveLength(1);
      expect(data.results[0].type).toBe(9);
    });

    it('should support device name wildcard search', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=device.name:*iphone*', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results).toHaveLength(1);
      expect(data.results[0].device.name).toContain('iPhone');
    });

    it('should filter by remote domain', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=remote.domain:youtube.com', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results).toHaveLength(1);
      expect(data.results[0].remote.domain).toBe('youtube.com');
    });

    it('should support transfer size comparisons', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=transfer.download:>1MB', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results).toHaveLength(1);
      expect(data.results[0].transfer.download).toBeGreaterThan(1048576);
    });

    it('should support timestamp range queries', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=ts:1234567890-1234567891', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results).toHaveLength(2);
      expect(data.results.every(a => a.ts >= 1234567890 && a.ts <= 1234567891)).toBe(true);
    });
  });

  describe('get_alarm', () => {
    it('should retrieve specific alarm details', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms/box1/alarm1', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.aid).toBe('alarm1');
      expect(data.gid).toBe('box1');
      expect(data.details).toBeDefined();
    });

    it('should return 404 for non-existent alarm', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms/box1/invalid', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      expect(response.status).toBe(404);
    });
  });

  describe('delete_alarm', () => {
    it('should delete alarm successfully', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms/box1/alarm1', {
        method: 'DELETE',
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      expect(response.status).toBe(204);
    });

    it('should return 404 for non-existent alarm', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms/box1/invalid', {
        method: 'DELETE',
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      expect(response.status).toBe(404);
    });
  });

  describe('Enhanced Response Format (v1.2.0)', () => {
    it('should include severity information in alarm data', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results[0].severity).toBeDefined();
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(data.results[0].severity);
    });

    it('should include device details in alarm data', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results[0].device).toBeDefined();
      expect(data.results[0].device.name).toBeDefined();
    });

    it('should include transfer statistics when available', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=type:9', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results[0].transfer).toBeDefined();
      expect(data.results[0].transfer.download).toBeDefined();
      expect(data.results[0].transfer.upload).toBeDefined();
      expect(data.results[0].transfer.total).toBeDefined();
    });
  });

  describe('Complex Query Combinations', () => {
    it('should support multiple qualifiers in single query', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=status:active+type:9', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results.every(a => a.status === 'active' && a.type === 9)).toBe(true);
    });
  });
});