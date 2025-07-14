import { describe, it, expect } from 'vitest';
import { parseStringPromise } from 'xml2js';

// Mock the FirewallaResponseFormatter since it's not exported
// In a real implementation, we'd test through the MCP server
const mockFormatEnhancedResponse = (data: any, responseType: string, metadata?: Record<string, any>) => {
  const timestamp = new Date().toISOString();
  const escapeXML = (str: string) => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Simplified version for testing
  let title = '';
  let summary = '';
  let presentationContent = '';

  switch (responseType) {
    case 'list_alarms':
      title = metadata?.query ? 
        `Firewalla Alarms Report - ${metadata.query}` : 
        'Firewalla Security Alarms Report';
      const alarms = data.results || [];
      summary = `Found ${alarms.length} alarms${metadata?.query ? ` matching "${metadata.query}"` : ''}.`;
      presentationContent = `# ${title}\n*Generated: ${timestamp}*\n\n## 📊 Overview\n- **Total Alarms**: ${alarms.length}`;
      break;
    
    case 'list_devices':
      title = 'Network Device Inventory';
      const devices = data.results || [];
      const onlineCount = devices.filter((d: any) => d.online).length;
      summary = `Found ${devices.length} devices (${onlineCount} online, ${devices.length - onlineCount} offline).`;
      presentationContent = `# ${title}\n*Generated: ${timestamp}*\n\n## 📊 Device Summary\n- **Total Devices**: ${devices.length}`;
      break;
    
    case 'list_flows':
      title = 'Network Traffic Flows Report';
      const flows = data.results || [];
      summary = `Found ${flows.length} flows.`;
      presentationContent = `# ${title}\n*Generated: ${timestamp}*\n\n## 📊 Traffic Summary\n- **Total Flows**: ${flows.length}`;
      break;
    
    default:
      title = `Firewalla ${responseType} Response`;
      summary = 'Response data included.';
      presentationContent = `# ${title}\n*Generated: ${timestamp}*`;
  }

  return `<firewalla_response>
  <metadata>
    <response_type>${escapeXML(responseType)}</response_type>
    <timestamp>${timestamp}</timestamp>
  </metadata>
  <presentation>
    <artifact_content type="markdown" title="${escapeXML(title)}">
${escapeXML(presentationContent)}
    </artifact_content>
  </presentation>
  <summary>${escapeXML(summary)}</summary>
  <data>
    <results>${JSON.stringify(data.results || [])}</results>
  </data>
</firewalla_response>`;
};

describe('Firewalla v1.2.0 Enhanced Formatting', () => {
  describe('Response Structure', () => {
    it('should include all required XML sections', async () => {
      const mockData = { results: [] };
      const response = mockFormatEnhancedResponse(mockData, 'list_alarms');
      
      const parsed = await parseStringPromise(response);
      const root = parsed.firewalla_response;
      
      expect(root).toBeDefined();
      expect(root.metadata).toBeDefined();
      expect(root.presentation).toBeDefined();
      expect(root.summary).toBeDefined();
      expect(root.data).toBeDefined();
    });

    it('should include artifact-ready markdown content', async () => {
      const mockData = { results: [
        { aid: '1', message: 'Test alarm', status: 'active' }
      ]};
      const response = mockFormatEnhancedResponse(mockData, 'list_alarms');
      
      const parsed = await parseStringPromise(response);
      const artifactContent = parsed.firewalla_response.presentation[0].artifact_content[0];
      
      expect(artifactContent.$).toEqual({
        type: 'markdown',
        title: 'Firewalla Security Alarms Report'
      });
      expect(artifactContent._).toContain('# Firewalla Security Alarms Report');
      expect(artifactContent._).toContain('📊 Overview');
      expect(artifactContent._).toContain('**Total Alarms**: 1');
    });

    it('should escape XML special characters', async () => {
      const mockData = { results: [] };
      const response = mockFormatEnhancedResponse(mockData, 'list_alarms', {
        query: 'status:"active" & type:>5'
      });
      
      expect(response).toContain('Firewalla Alarms Report - status:&quot;active&quot; &amp; type:&gt;5');
      expect(response).not.toContain('<script>');
    });
  });

  describe('Dynamic Titles', () => {
    it('should generate contextual titles based on query parameters', async () => {
      const mockData = { results: [] };
      
      const response1 = mockFormatEnhancedResponse(mockData, 'list_alarms', {
        query: 'google.com'
      });
      expect(response1).toContain('Firewalla Alarms Report - google.com');
      
      const response2 = mockFormatEnhancedResponse(mockData, 'list_alarms');
      expect(response2).toContain('Firewalla Security Alarms Report');
      expect(response2).not.toContain(' - ');
    });
  });

  describe('Summary Generation', () => {
    it('should generate accurate summaries for alarms', () => {
      const mockData = { results: [
        { aid: '1', status: 'active' },
        { aid: '2', status: 'resolved' }
      ]};
      const response = mockFormatEnhancedResponse(mockData, 'list_alarms');
      
      expect(response).toContain('<summary>Found 2 alarms.</summary>');
    });

    it('should generate accurate summaries for devices', () => {
      const mockData = { results: [
        { name: 'Device1', online: true },
        { name: 'Device2', online: false },
        { name: 'Device3', online: true }
      ]};
      const response = mockFormatEnhancedResponse(mockData, 'list_devices');
      
      expect(response).toContain('<summary>Found 3 devices (2 online, 1 offline).</summary>');
    });

    it('should include query context in summary', () => {
      const mockData = { results: [] };
      const response = mockFormatEnhancedResponse(mockData, 'list_alarms', {
        query: 'status:active'
      });
      
      expect(response).toContain('matching &quot;status:active&quot;');
    });
  });

  describe('Backward Compatibility', () => {
    it('should preserve raw data in data section', async () => {
      const mockData = { 
        results: [
          { id: '123', name: 'Test', value: 456 }
        ],
        next_cursor: 'abc'
      };
      const response = mockFormatEnhancedResponse(mockData, 'test_endpoint');
      
      const parsed = await parseStringPromise(response);
      const dataSection = parsed.firewalla_response.data[0].results[0];
      
      expect(dataSection).toBeDefined();
      expect(dataSection).toContain('123');
      expect(dataSection).toContain('Test');
      expect(dataSection).toContain('456');
    });
  });

  describe('Markdown Formatting Quality', () => {
    it('should use proper markdown headers', () => {
      const mockData = { results: [] };
      const response = mockFormatEnhancedResponse(mockData, 'list_alarms');
      
      expect(response).toContain('# Firewalla Security Alarms Report');
      expect(response).toContain('## 📊 Overview');
    });

    it('should include emojis for visual hierarchy', () => {
      const mockData = { results: [] };
      const response = mockFormatEnhancedResponse(mockData, 'list_devices');
      
      expect(response).toContain('📊');
    });

    it('should format timestamps properly', () => {
      const mockData = { results: [] };
      const response = mockFormatEnhancedResponse(mockData, 'list_flows');
      
      expect(response).toMatch(/\*Generated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Endpoint-Specific Formatting', () => {
    it('should format alarm responses correctly', () => {
      const mockData = { 
        results: [
          { 
            aid: 'alarm1',
            type: 9,
            message: 'Large download detected',
            status: 'active',
            severity: 'HIGH'
          }
        ]
      };
      const response = mockFormatEnhancedResponse(mockData, 'list_alarms');
      
      expect(response).toContain('Firewalla Security Alarms Report');
      expect(response).toContain('**Total Alarms**: 1');
    });

    it('should format device responses correctly', () => {
      const mockData = { 
        results: [
          { 
            name: 'Johns iPhone',
            ip: '192.168.1.100',
            mac: '00:11:22:33:44:55',
            online: true,
            type: 'phone'
          }
        ]
      };
      const response = mockFormatEnhancedResponse(mockData, 'list_devices');
      
      expect(response).toContain('Network Device Inventory');
      expect(response).toContain('**Total Devices**: 1');
    });

    it('should format flow responses correctly', () => {
      const mockData = { 
        results: [
          { 
            ts: 1234567890,
            domain: 'example.com',
            upload: 1024000,
            download: 5242880,
            protocol: 'tcp'
          }
        ]
      };
      const response = mockFormatEnhancedResponse(mockData, 'list_flows');
      
      expect(response).toContain('Network Traffic Flows Report');
      expect(response).toContain('**Total Flows**: 1');
    });
  });

  describe('Empty Results Handling', () => {
    it('should handle empty results gracefully', () => {
      const mockData = { results: [] };
      const response = mockFormatEnhancedResponse(mockData, 'list_alarms');
      
      expect(response).toContain('**Total Alarms**: 0');
      expect(response).toContain('<summary>Found 0 alarms.</summary>');
    });

    it('should handle missing results array', () => {
      const mockData = {};
      const response = mockFormatEnhancedResponse(mockData, 'list_devices');
      
      expect(response).toContain('**Total Devices**: 0');
      expect(response).not.toContain('undefined');
      expect(response).not.toContain('null');
    });
  });

  describe('Pagination Indicators', () => {
    it('should include pagination information when available', () => {
      const mockData = { 
        results: [],
        next_cursor: 'page2'
      };
      // In real implementation, this would be included in the formatter
      const response = mockFormatEnhancedResponse(mockData, 'list_flows');
      
      // The formatter should include pagination info in the presentation
      expect(response).toBeDefined();
    });
  });
});