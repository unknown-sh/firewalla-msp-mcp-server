import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { mockData } from '../utils/test-helpers';

// Mock environment variables
process.env.FIREWALLA_MSP_API_KEY = 'test-api-key';
process.env.FIREWALLA_MSP_DOMAIN = 'test.firewalla.net';

// Helper function to filter data based on query
function applySearchFilters(data: any[], query: string, entityType: string): any[] {
  let filtered = [...data];
  
  // Parse query into qualifiers
  const qualifiers = query.split(/\s+/).filter(q => q.includes(':'));
  
  qualifiers.forEach(qualifier => {
    const [key, value] = qualifier.split(':');
    
    switch (entityType) {
      case 'alarms':
        switch (key) {
          case 'status':
            filtered = filtered.filter(item => item.status === value);
            break;
          case 'type':
            filtered = filtered.filter(item => item.type === parseInt(value));
            break;
          case 'device.name':
            if (value.includes('*')) {
              const pattern = value.replace(/\*/g, '.*').toLowerCase();
              filtered = filtered.filter(item => 
                item.device?.name?.toLowerCase().match(new RegExp(pattern))
              );
            } else {
              filtered = filtered.filter(item => item.device?.name === value);
            }
            break;
          case 'box.id':
            filtered = filtered.filter(item => item.gid === value);
            break;
          case 'remote.domain':
            filtered = filtered.filter(item => item.remote?.domain === value);
            break;
          case 'remote.category':
            filtered = filtered.filter(item => item.remote?.category === value);
            break;
          case 'transfer.download':
            if (value.startsWith('>')) {
              const size = parseSize(value.substring(1));
              filtered = filtered.filter(item => (item.transfer?.download || 0) > size);
            }
            break;
          case 'ts':
            if (value.includes('-')) {
              const [start, end] = value.split('-').map(v => parseInt(v));
              filtered = filtered.filter(item => item.ts >= start && item.ts <= end);
            } else if (value.startsWith('>')) {
              const ts = parseInt(value.substring(1));
              filtered = filtered.filter(item => item.ts > ts);
            }
            break;
        }
        break;
        
      case 'flows':
        switch (key) {
          case 'status':
            filtered = filtered.filter(item => item.status === value);
            break;
          case 'direction':
            filtered = filtered.filter(item => item.direction === value);
            break;
          case 'protocol':
            filtered = filtered.filter(item => item.protocol === value);
            break;
          case 'domain':
            if (value.includes('*')) {
              const pattern = value.replace(/\*/g, '.*');
              filtered = filtered.filter(item => 
                item.domain?.match(new RegExp(pattern))
              );
            } else {
              filtered = filtered.filter(item => item.domain === value);
            }
            break;
          case 'category':
            filtered = filtered.filter(item => item.category === value);
            break;
          case 'download':
            if (value.startsWith('>')) {
              const size = parseSize(value.substring(1));
              filtered = filtered.filter(item => item.download > size);
            }
            break;
          case 'total':
            if (value.startsWith('>')) {
              const size = parseSize(value.substring(1));
              filtered = filtered.filter(item => item.total > size);
            }
            break;
        }
        break;
        
      case 'devices':
        switch (key) {
          case 'device.name':
            if (value.includes('*')) {
              const pattern = value.replace(/\*/g, '.*').toLowerCase();
              filtered = filtered.filter(item => 
                item.name?.toLowerCase().match(new RegExp(pattern))
              );
            } else {
              filtered = filtered.filter(item => item.name === value);
            }
            break;
          case 'box.id':
            filtered = filtered.filter(item => item.box === value);
            break;
          case 'type':
            filtered = filtered.filter(item => item.type === value);
            break;
        }
        break;
    }
  });
  
  return filtered;
}

// Helper to parse size units
function parseSize(sizeStr: string): number {
  const units: Record<string, number> = {
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024
  };
  
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMG]B)?$/i);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2]?.toUpperCase() || 'B';
  
  return value * (units[unit] || 1);
}

// Create MSW mock server
const mockApiServer = setupServer(
  // Mock alarm search endpoint
  http.get('https://test.firewalla.net/v2/alarms', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    
    const filtered = applySearchFilters(mockData.alarms, query, 'alarms');
    
    return HttpResponse.json({
      count: filtered.length,
      results: filtered
    });
  }),
  
  // Mock flow search endpoint
  http.get('https://test.firewalla.net/v2/flows', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    
    const filtered = applySearchFilters(mockData.flows, query, 'flows');
    
    return HttpResponse.json({
      count: filtered.length,
      results: filtered
    });
  }),
  
  // Mock device search endpoint
  http.get('https://test.firewalla.net/v2/devices', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    
    const filtered = applySearchFilters(mockData.devices, query, 'devices');
    
    return HttpResponse.json({
      count: filtered.length,
      results: filtered
    });
  })
);

describe('Search Qualifiers', () => {
  beforeAll(() => {
    mockApiServer.listen();
  });

  afterAll(() => {
    mockApiServer.close();
  });

  describe('Alarm Qualifiers', () => {
    it('should filter by status qualifier', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=status:active', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results.every(a => a.status === 'active')).toBe(true);
      expect(data.results.length).toBeGreaterThan(0);
    });

    it('should filter by type qualifier', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=type:9', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results.every(a => a.type === 9)).toBe(true);
    });

    it('should support device.name wildcard search', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=device.name:*phone*', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results[0].device.name.toLowerCase()).toContain('phone');
    });

    it('should filter by remote.domain', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=remote.domain:youtube.com', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results[0].remote.domain).toBe('youtube.com');
    });

    it('should filter by remote.category', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=remote.category:streaming', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results[0].remote.category).toBe('streaming');
    });

    it('should support transfer size comparisons', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=transfer.download:>1MB', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results[0].transfer.download).toBeGreaterThan(1048576);
    });

    it('should support timestamp range queries', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=ts:1234567890-1234567892', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results.length).toBe(3);
      data.results.forEach(alarm => {
        expect(alarm.ts).toBeGreaterThanOrEqual(1234567890);
        expect(alarm.ts).toBeLessThanOrEqual(1234567892);
      });
    });

    it('should support timestamp comparison', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=ts:>1234567890', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results.every(a => a.ts > 1234567890)).toBe(true);
    });
  });

  describe('Flow Qualifiers', () => {
    it('should filter by status', async () => {
      const response = await fetch('https://test.firewalla.net/v2/flows?query=status:allowed', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results.every(f => f.status === 'allowed')).toBe(true);
    });

    it('should filter by direction', async () => {
      const response = await fetch('https://test.firewalla.net/v2/flows?query=direction:out', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results[0].direction).toBe('out');
    });

    it('should filter by protocol', async () => {
      const response = await fetch('https://test.firewalla.net/v2/flows?query=protocol:tcp', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results.every(f => f.protocol === 'tcp')).toBe(true);
    });

    it('should support domain wildcard search', async () => {
      const response = await fetch('https://test.firewalla.net/v2/flows?query=domain:*.com', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results.every(f => f.domain?.endsWith('.com'))).toBe(true);
    });

    it('should filter by category', async () => {
      const response = await fetch('https://test.firewalla.net/v2/flows?query=category:streaming', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results[0].category).toBe('streaming');
    });

    it('should support download size comparisons', async () => {
      const response = await fetch('https://test.firewalla.net/v2/flows?query=download:>1MB', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results.every(f => f.download > 1048576)).toBe(true);
    });

    it('should support total transfer comparisons', async () => {
      const response = await fetch('https://test.firewalla.net/v2/flows?query=total:>1MB', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results.every(f => f.total > 1048576)).toBe(true);
    });
  });

  describe('Device Qualifiers', () => {
    it('should filter by device name', async () => {
      const response = await fetch('https://test.firewalla.net/v2/devices?query=device.name:*phone*', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results[0].name.toLowerCase()).toContain('phone');
    });

    it('should filter by device type', async () => {
      const response = await fetch('https://test.firewalla.net/v2/devices?query=type:phone', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results[0].type).toBe('phone');
    });

    it('should filter by box ID', async () => {
      const response = await fetch('https://test.firewalla.net/v2/devices?query=box.id:box1', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results.every(d => d.box === 'box1')).toBe(true);
    });
  });

  describe('Complex Qualifier Combinations', () => {
    it('should support multiple qualifiers in alarms', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=status:active+type:9', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results.every(a => a.status === 'active' && a.type === 9)).toBe(true);
    });

    it('should support multiple qualifiers in flows', async () => {
      const response = await fetch('https://test.firewalla.net/v2/flows?query=protocol:tcp+direction:out', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.results.every(f => f.protocol === 'tcp' && f.direction === 'out')).toBe(true);
    });

    it('should handle empty results gracefully', async () => {
      const response = await fetch('https://test.firewalla.net/v2/alarms?query=type:999', {
        headers: { 'Authorization': 'Token test-api-key' }
      });
      
      const data = await response.json();
      expect(data.count).toBe(0);
      expect(data.results).toEqual([]);
    });
  });
});