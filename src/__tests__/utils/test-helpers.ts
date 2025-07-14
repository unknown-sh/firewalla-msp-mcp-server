import { parseStringPromise } from 'xml2js';

/**
 * Parse XML response and extract the enhanced v1.2.0 structure
 */
export async function parseEnhancedResponse(xmlResponse: string) {
  const parsed = await parseStringPromise(xmlResponse);
  const root = parsed.firewalla_response;
  
  return {
    metadata: root.metadata?.[0] || {},
    presentation: root.presentation?.[0]?.artifact_content?.[0] || {},
    summary: root.summary?.[0] || '',
    data: root.data?.[0] || {},
    raw: parsed
  };
}

/**
 * Common mock data for tests
 */
export const mockData = {
  boxes: [
    {
      gid: 'box1',
      model: 'Gold Plus',
      name: 'Office Firewalla',
      mode: 'router',
      online: true,
      version: '2.45.0',
      group: 'office'
    },
    {
      gid: 'box2',
      model: 'Purple',
      name: 'Home Firewalla',
      mode: 'simple',
      online: false,
      version: '2.44.0',
      group: 'home'
    }
  ],
  
  devices: [
    {
      mac: '00:11:22:33:44:55',
      ip: '192.168.1.100',
      name: 'Johns iPhone',
      type: 'phone',
      online: true,
      box: 'box1',
      network: { id: 'net1', name: 'Main Network' },
      lastActiveTime: 1234567890
    },
    {
      mac: '00:11:22:33:44:66',
      ip: '192.168.1.101',
      name: 'Office Laptop',
      type: 'desktop',
      online: true,
      box: 'box1',
      network: { id: 'net1', name: 'Main Network' },
      lastActiveTime: 1234567891
    },
    {
      mac: '00:11:22:33:44:77',
      ip: '192.168.1.102',
      name: 'Smart TV',
      type: 'tv',
      online: false,
      box: 'box2',
      network: { id: 'net2', name: 'Guest Network' },
      lastActiveTime: 1234567800
    }
  ],
  
  alarms: [
    {
      gid: 'box1',
      aid: 'alarm1',
      ts: 1234567890,
      type: 9,
      alarmType: 'Large Download',
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
      alarmType: 'Port Scan',
      message: 'Port scan detected from 192.168.1.100',
      status: 'active',
      severity: 'MEDIUM',
      device: { id: 'device2', name: 'Unknown Device' },
      remote: {
        ip: '192.168.1.100',
        region: 'Local'
      }
    },
    {
      gid: 'box1',
      aid: 'alarm3',
      ts: 1234567892,
      type: 1,
      alarmType: 'New Device',
      message: 'New device detected on network',
      status: 'resolved',
      severity: 'LOW',
      device: { id: 'device3', name: 'Smart Speaker' }
    }
  ],
  
  rules: [
    {
      id: 'rule1',
      name: 'Block Malware Sites',
      status: 'active',
      action: 'block',
      direction: 'outbound',
      protocol: 'any',
      target: { type: 'category', value: 'malware' },
      scope: { type: 'network', value: 'all' },
      box: { id: 'box1', name: 'Office Firewalla' }
    },
    {
      id: 'rule2',
      name: 'Allow Work VPN',
      status: 'active',
      action: 'allow',
      direction: 'bidirection',
      protocol: 'tcp',
      target: { type: 'domain', value: 'vpn.company.com' },
      scope: { type: 'device', value: 'device2' },
      box: { id: 'box1', name: 'Office Firewalla' }
    },
    {
      id: 'rule3',
      name: 'Time Limit Gaming',
      status: 'paused',
      action: 'time_limit',
      direction: 'outbound',
      protocol: 'any',
      target: { type: 'category', value: 'gaming' },
      scope: { type: 'device', value: 'device3' },
      schedule: { type: 'daily', times: ['18:00-20:00'] },
      box: { id: 'box2', name: 'Home Firewalla' }
    }
  ],
  
  flows: [
    {
      ts: 1234567890,
      box: { id: 'box1', name: 'Office Firewalla' },
      device: { id: 'device1', name: 'Johns iPhone' },
      direction: 'out',
      protocol: 'tcp',
      domain: 'youtube.com',
      category: 'streaming',
      country: 'US',
      region: 'North America',
      sport: 54321,
      dport: 443,
      download: 5242880,
      upload: 102400,
      total: 5345280,
      status: 'allowed'
    },
    {
      ts: 1234567891,
      box: { id: 'box1', name: 'Office Firewalla' },
      device: { id: 'device2', name: 'Office Laptop' },
      direction: 'bi',
      protocol: 'tcp',
      domain: 'github.com',
      category: 'development',
      country: 'US',
      region: 'North America',
      sport: 54322,
      dport: 443,
      download: 2097152,
      upload: 1048576,
      total: 3145728,
      status: 'allowed'
    },
    {
      ts: 1234567892,
      box: { id: 'box2', name: 'Home Firewalla' },
      device: { id: 'device3', name: 'Smart TV' },
      direction: 'in',
      protocol: 'udp',
      ip: '192.168.1.1',
      sport: 53,
      dport: 54323,
      download: 1024,
      upload: 512,
      total: 1536,
      status: 'allowed'
    }
  ],
  
  targetLists: [
    {
      id: 'list1',
      name: 'Blocked IPs',
      targets: ['1.2.3.4', '5.6.7.8', '10.0.0.1'],
      owner: 'admin',
      category: 'security',
      notes: 'Known malicious IP addresses'
    },
    {
      id: 'list2',
      name: 'Allowed Domains',
      targets: ['safe.com', 'trusted.org', 'work.company.com'],
      owner: 'admin',
      category: 'whitelist',
      notes: 'Trusted domains for business use'
    },
    {
      id: 'list3',
      name: 'Ad Servers',
      targets: ['ad1.example.com', 'ad2.example.com'],
      owner: 'user',
      category: 'ads',
      notes: 'Common ad server domains'
    }
  ],
  
  statistics: {
    topBoxesByBlockedFlows: [
      { box: 'Office Firewalla', count: 1523, percentage: 67.5 },
      { box: 'Home Firewalla', count: 732, percentage: 32.5 }
    ],
    topBoxesBySecurityAlarms: [
      { box: 'Office Firewalla', count: 45, percentage: 75 },
      { box: 'Home Firewalla', count: 15, percentage: 25 }
    ],
    topRegionsByBlockedFlows: [
      { region: 'China', count: 892, percentage: 39.5 },
      { region: 'Russia', count: 567, percentage: 25.1 },
      { region: 'Unknown', count: 432, percentage: 19.1 },
      { region: 'India', count: 234, percentage: 10.4 },
      { region: 'Brazil', count: 130, percentage: 5.8 }
    ]
  },
  
  simpleStatistics: {
    onlineBoxes: 5,
    offlineBoxes: 1,
    alarms: 234,
    rules: 89
  },
  
  trends: {
    flows: [
      { timestamp: 1234567800, total: 1000, blocked: 100, allowed: 900, upload: 10485760, download: 52428800 },
      { timestamp: 1234567900, total: 1200, blocked: 150, allowed: 1050, upload: 15728640, download: 62914560 },
      { timestamp: 1234568000, total: 800, blocked: 80, allowed: 720, upload: 8388608, download: 41943040 }
    ],
    alarms: [
      { timestamp: 1234567800, total: 50, high: 10, medium: 25, low: 15 },
      { timestamp: 1234567900, total: 45, high: 8, medium: 22, low: 15 },
      { timestamp: 1234568000, total: 60, high: 15, medium: 30, low: 15 }
    ],
    rules: [
      { timestamp: 1234567800, total: 85, active: 70, paused: 15, block: 50, allow: 35 },
      { timestamp: 1234567900, total: 87, active: 72, paused: 15, block: 52, allow: 35 },
      { timestamp: 1234568000, total: 89, active: 74, paused: 15, block: 54, allow: 35 }
    ]
  }
};

/**
 * Generate a mock enhanced response for testing
 */
export function createMockEnhancedResponse(
  data: any,
  responseType: string,
  metadata?: Record<string, any>
): string {
  const timestamp = new Date().toISOString();
  const escapeXML = (str: string) => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const title = `Test ${responseType} Response`;
  const summary = `Test summary for ${responseType}`;
  const presentationContent = `# ${title}\n*Generated: ${timestamp}*\n\n## Test Content`;

  const metadataXML = metadata ? 
    Object.entries(metadata).map(([key, value]) => 
      `    <${escapeXML(key)}>${escapeXML(String(value))}</${escapeXML(key)}>`
    ).join('\n') : '';

  return `<firewalla_response>
  <metadata>
    <response_type>${escapeXML(responseType)}</response_type>
    <timestamp>${timestamp}</timestamp>
${metadataXML}
  </metadata>
  <presentation>
    <artifact_content type="markdown" title="${escapeXML(title)}">
${escapeXML(presentationContent)}
    </artifact_content>
  </presentation>
  <summary>${escapeXML(summary)}</summary>
  <data>
    ${JSON.stringify(data)}
  </data>
</firewalla_response>`;
}

/**
 * Validate that a response matches the v1.2.0 enhanced format
 */
export function validateEnhancedFormat(response: string): boolean {
  try {
    // Check for required XML structure
    const requiredElements = [
      '<firewalla_response>',
      '<metadata>',
      '<presentation>',
      '<artifact_content',
      'type="markdown"',
      '<summary>',
      '<data>'
    ];
    
    return requiredElements.every(element => response.includes(element));
  } catch {
    return false;
  }
}

/**
 * Extract markdown content from enhanced response
 */
export async function extractMarkdownContent(xmlResponse: string): Promise<string> {
  const parsed = await parseEnhancedResponse(xmlResponse);
  return parsed.presentation._ || parsed.presentation;
}

/**
 * Mock API error responses
 */
export const mockErrors = {
  unauthorized: { message: 'Unauthorized', code: 401 },
  notFound: { message: 'Resource not found', code: 404 },
  badRequest: { message: 'Bad Request: Invalid parameters', code: 400 },
  serverError: { message: 'Internal Server Error', code: 500 },
  rateLimit: { message: 'Rate limit exceeded', code: 429 }
};