#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";

// Environment validation
const API_KEY = process.env.FIREWALLA_MSP_API_KEY;
const MSP_DOMAIN = process.env.FIREWALLA_MSP_DOMAIN;

if (!API_KEY) {
  console.error("Error: FIREWALLA_MSP_API_KEY environment variable is required");
  process.exit(1);
}

if (!MSP_DOMAIN) {
  console.error("Error: FIREWALLA_MSP_DOMAIN environment variable is required");
  process.exit(1);
}

// Create axios instance with authentication
const httpClient: AxiosInstance = axios.create({
  baseURL: `https://${MSP_DOMAIN}/v2`,
  headers: {
    'Authorization': `Token ${API_KEY}`,
    'Content-Type': 'application/json',
  },
});

// Schema definitions for API parameters (kept for future use)
// const PaginationSchema = z.object({
//   cursor: z.string().optional(),
//   limit: z.number().min(1).max(500).default(200),
// });

// const QuerySchema = z.object({
//   query: z.string().optional(),
// });

// Server instance
const server = new Server(
  {
    name: "firewalla-msp-mcp",
    version: "1.2.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// Helper function to format bytes
function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes === 0) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
}

// XML utility functions
function escapeXML(str: string): string {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonToXML(obj: any, indent: number = 2): string {
  const spaces = ' '.repeat(indent);
  
  if (obj === null || obj === undefined) {
    return `${spaces}<value>null</value>`;
  }
  
  if (typeof obj === 'string') {
    return `${spaces}<value>${escapeXML(obj)}</value>`;
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return `${spaces}<value>${obj}</value>`;
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return `${spaces}<array></array>`;
    }
    
    const items = obj.map((item, index) => {
      const itemXML = jsonToXML(item, indent + 2);
      return `${spaces}  <item index="${index}">\n${itemXML}\n${spaces}  </item>`;
    }).join('\n');
    
    return `${spaces}<array>\n${items}\n${spaces}</array>`;
  }
  
  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) {
      return `${spaces}<object></object>`;
    }
    
    const properties = entries.map(([key, value]) => {
      const valueXML = jsonToXML(value, indent + 2);
      return `${spaces}  <${escapeXML(key)}>\n${valueXML}\n${spaces}  </${escapeXML(key)}>`;
    }).join('\n');
    
    return `${spaces}<object>\n${properties}\n${spaces}</object>`;
  }
  
  return `${spaces}<value>${escapeXML(String(obj))}</value>`;
}

function formatAsXML(data: any, responseType: string, metadata?: Record<string, any>): string {
  const timestamp = new Date().toISOString();
  const metadataXML = metadata ? Object.entries(metadata).map(([key, value]) => 
    `    <${escapeXML(key)}>${escapeXML(String(value))}</${escapeXML(key)}>`
  ).join('\n') : '';
  
  const dataXML = jsonToXML(data, 2);
  
  return `<firewalla_response>
  <metadata>
    <response_type>${escapeXML(responseType)}</response_type>
    <timestamp>${timestamp}</timestamp>
${metadataXML}
  </metadata>
  <data>
${dataXML}
  </data>
</firewalla_response>`;
}

// Enhanced formatting with presentation layer
class FirewallaResponseFormatter {
  private static formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  }

  private static formatBytes(bytes: number | undefined): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private static getSeverityEmoji(severity: string): string {
    switch (severity.toUpperCase()) {
      case 'HIGH': return '🔴';
      case 'MEDIUM': return '🟡';
      case 'LOW': return '🟢';
      default: return '⚪';
    }
  }

  private static getDeviceTypeEmoji(type: string): string {
    switch (type) {
      case 'desktop': return '💻';
      case 'phone': return '📱';
      case 'tablet': return '📱';
      case 'tv': return '📺';
      case 'printer': return '🖨️';
      case 'camera': return '📷';
      case 'router': return '🔧';
      case 'ap': return '📡';
      case 'switch': return '🔌';
      case 'nas&server': return '🖥️';
      case 'security': return '🔒';
      case 'automation': return '🏠';
      case 'smart speaker': return '🔊';
      case 'appliance': return '🔌';
      default: return '📟';
    }
  }

  static formatStatistics(data: any, metadata: Record<string, any>): string {
    const results = data.results || data || [];
    const timestamp = new Date().toLocaleString();
    const statsType = metadata.stats_type || 'statistics';
    
    let content = `# Firewalla Analytics Dashboard\n`;
    content += `*Generated: ${timestamp}*\n\n`;
    
    // Overview section
    content += `## 📊 Statistics Report: ${statsType}\n\n`;
    
    if (Array.isArray(results) && results.length > 0) {
      switch (statsType) {
        case 'topBoxesByBlockedFlows':
          content += `### 🚫 Top Boxes by Blocked Flows\n\n`;
          results.forEach((item: any, index: number) => {
            content += `${index + 1}. 📦 **${item.name || item.boxName || 'Unknown Box'}** - ${item.blockedFlows || item.count || 0} blocked flows\n`;
            if (item.topBlockedDomain) {
              content += `   └─ Top blocked: ${item.topBlockedDomain}\n`;
            }
          });
          break;
          
        case 'topBoxesBySecurityAlarms':
          content += `### 🚨 Top Boxes by Security Alarms\n\n`;
          results.forEach((item: any, index: number) => {
            content += `${index + 1}. 📦 **${item.name || item.boxName || 'Unknown Box'}** - ${item.alarmCount || item.count || 0} alarms\n`;
            if (item.topAlarmType) {
              content += `   └─ Most common: ${item.topAlarmType}\n`;
            }
          });
          break;
          
        case 'topRegionsByBlockedFlows':
          content += `### 🌍 Top Regions by Blocked Flows\n\n`;
          results.forEach((item: any, index: number) => {
            content += `${index + 1}. 🌍 **${item.region || item.country || 'Unknown'}** - ${item.blockedFlows || item.count || 0} blocks\n`;
            if (item.topCategory) {
              content += `   └─ Top category: ${item.topCategory}\n`;
            }
          });
          break;
          
        default:
          // Generic formatting for unknown types
          content += `### 📈 Results\n\n`;
          results.forEach((item: any, index: number) => {
            content += `${index + 1}. ${JSON.stringify(item, null, 2)}\n`;
          });
      }
    } else {
      content += `### ℹ️ No data available\n`;
      content += `No statistics data found for the requested type.\n`;
    }
    
    return content;
  }

  static formatSimpleStatistics(data: any, metadata: Record<string, any>): string {
    const timestamp = new Date().toLocaleString();
    
    let content = `# Firewalla System Overview\n`;
    content += `*Generated: ${timestamp}*\n\n`;
    
    content += `## 📊 Summary Statistics\n\n`;
    content += `- **📦 Online Boxes**: ${data.onlineBoxes || 0}\n`;
    content += `- **📦 Offline Boxes**: ${data.offlineBoxes || 0}\n`;
    content += `- **🚨 Active Alarms**: ${data.alarms || 0}\n`;
    content += `- **🛡️ Total Rules**: ${data.rules || 0}\n`;
    
    if (metadata.group) {
      content += `\n*Filtered by group: ${metadata.group}*\n`;
    }
    
    return content;
  }

  static formatTargetLists(data: any, metadata: Record<string, any>): string {
    const lists = data.results || data || [];
    const timestamp = new Date().toLocaleString();
    
    let content = `# Firewalla Target Lists\n`;
    content += `*Generated: ${timestamp}*\n\n`;
    
    content += `## 📋 Overview\n`;
    content += `- **Total Lists**: ${lists.length}\n`;
    
    if (lists.length > 0) {
      // Group by category
      const categoryCount: Record<string, number> = {};
      let totalTargets = 0;
      
      lists.forEach((list: any) => {
        const category = list.category || 'Uncategorized';
        categoryCount[category] = (categoryCount[category] || 0) + 1;
        totalTargets += (list.targets || []).length;
      });
      
      content += `- **Total Targets**: ${totalTargets}\n`;
      content += `- **Categories**: `;
      content += Object.entries(categoryCount)
        .map(([cat, count]) => `${cat} (${count})`)
        .join(', ');
      content += `\n\n`;
      
      // List details
      content += `## 📝 Target Lists\n\n`;
      content += `| Name | Category | Owner | Targets | Notes |\n`;
      content += `|------|----------|-------|---------|-------|\n`;
      
      lists.forEach((list: any) => {
        const name = list.name || 'Unnamed';
        const category = list.category || 'Uncategorized';
        const owner = list.owner || 'System';
        const targetCount = (list.targets || []).length;
        const notes = list.notes ? list.notes.substring(0, 50) + (list.notes.length > 50 ? '...' : '') : '-';
        
        content += `| **${name}** | ${category} | ${owner} | ${targetCount} | ${notes} |\n`;
      });
      
      // Show first few targets for each list
      content += `\n## 🎯 Target Details\n`;
      lists.forEach((list: any) => {
        if (list.targets && list.targets.length > 0) {
          content += `\n### ${list.name}\n`;
          const displayTargets = list.targets.slice(0, 5);
          displayTargets.forEach((target: string) => {
            content += `- \`${target}\`\n`;
          });
          if (list.targets.length > 5) {
            content += `- _...and ${list.targets.length - 5} more_\n`;
          }
        }
      });
    } else {
      content += `\n### ℹ️ No target lists found\n`;
      content += `No target lists have been configured.\n`;
    }
    
    return content;
  }

  static formatGetTrends(data: any, metadata: Record<string, any>): string {
    const trends = data.results || data || [];
    const timestamp = new Date().toLocaleString();
    const trendType = metadata.trends_type || 'trends';
    
    let content = `# Firewalla ${trendType.charAt(0).toUpperCase() + trendType.slice(1)} Trends\n`;
    content += `*Generated: ${timestamp}*\n\n`;
    
    content += `## 📈 Trend Analysis\n`;
    content += `- **Data Points**: ${trends.length}\n`;
    content += `- **Type**: ${trendType}\n`;
    
    if (metadata.group) {
      content += `- **Group Filter**: ${metadata.group}\n`;
    }
    
    if (trends.length > 0) {
      // Calculate time range
      const timestamps = trends.map((t: any) => t.timestamp || t.ts || 0).filter((ts: number) => ts > 0);
      if (timestamps.length > 0) {
        const minTime = Math.min(...timestamps);
        const maxTime = Math.max(...timestamps);
        content += `- **Time Range**: ${this.formatDate(minTime)} - ${this.formatDate(maxTime)}\n`;
      }
      
      content += `\n## 📊 Trend Data\n\n`;
      
      // Format based on trend type
      if (trendType === 'flows') {
        content += `| Time | Total Flows | Blocked | Allowed | Upload | Download |\n`;
        content += `|------|-------------|---------|---------|--------|----------|\n`;
        
        trends.forEach((point: any) => {
          const time = point.timestamp ? this.formatDate(point.timestamp) : 'N/A';
          const total = point.total || 0;
          const blocked = point.blocked || 0;
          const allowed = point.allowed || 0;
          const upload = this.formatBytes(point.upload || 0);
          const download = this.formatBytes(point.download || 0);
          
          content += `| ${time} | ${total} | ${blocked} | ${allowed} | ${upload} | ${download} |\n`;
        });
      } else if (trendType === 'alarms') {
        content += `| Time | Total Alarms | High | Medium | Low |\n`;
        content += `|------|--------------|------|--------|-----|\n`;
        
        trends.forEach((point: any) => {
          const time = point.timestamp ? this.formatDate(point.timestamp) : 'N/A';
          const total = point.total || 0;
          const high = point.high || 0;
          const medium = point.medium || 0;
          const low = point.low || 0;
          
          content += `| ${time} | ${total} | ${high} | ${medium} | ${low} |\n`;
        });
      } else if (trendType === 'rules') {
        content += `| Time | Total Rules | Active | Paused | Block | Allow |\n`;
        content += `|------|-------------|--------|---------|--------|--------|\n`;
        
        trends.forEach((point: any) => {
          const time = point.timestamp ? this.formatDate(point.timestamp) : 'N/A';
          const total = point.total || 0;
          const active = point.active || 0;
          const paused = point.paused || 0;
          const block = point.block || 0;
          const allow = point.allow || 0;
          
          content += `| ${time} | ${total} | ${active} | ${paused} | ${block} | ${allow} |\n`;
        });
      }
      
      // Add insights if available
      content += `\n## 🎯 Key Insights\n`;
      
      // Calculate trends
      if (trends.length >= 2) {
        const firstPoint = trends[0];
        const lastPoint = trends[trends.length - 1];
        
        if (trendType === 'flows' && firstPoint.total && lastPoint.total) {
          const change = ((lastPoint.total - firstPoint.total) / firstPoint.total * 100).toFixed(1);
          content += `- Flow volume ${parseFloat(change) > 0 ? 'increased' : 'decreased'} by ${Math.abs(parseFloat(change))}%\n`;
        } else if (trendType === 'alarms' && firstPoint.total && lastPoint.total) {
          const change = ((lastPoint.total - firstPoint.total) / firstPoint.total * 100).toFixed(1);
          content += `- Alarm count ${parseFloat(change) > 0 ? 'increased' : 'decreased'} by ${Math.abs(parseFloat(change))}%\n`;
        } else if (trendType === 'rules' && firstPoint.total && lastPoint.total) {
          const change = lastPoint.total - firstPoint.total;
          content += `- ${Math.abs(change)} rules ${change > 0 ? 'added' : 'removed'} during this period\n`;
        }
      }
    } else {
      content += `\n### ℹ️ No trend data available\n`;
      content += `No ${trendType} trend data found for the specified parameters.\n`;
    }
    
    return content;
  }

  static formatSearchGlobal(data: any, metadata: Record<string, any>): string {
    const timestamp = new Date().toLocaleString();
    
    let content = `# Firewalla Global Search Results\n`;
    content += `*Generated: ${timestamp}*\n\n`;
    
    content += `## 🔍 Search Summary\n`;
    content += `- **Query**: "${metadata.query || 'All'}"\n`;
    
    let totalResults = 0;
    const resultCounts: Record<string, number> = {};
    
    // Count results by type
    Object.entries(data).forEach(([type, results]: [string, any]) => {
      if (Array.isArray(results)) {
        resultCounts[type] = results.length;
        totalResults += results.length;
      }
    });
    
    content += `- **Total Results**: ${totalResults}\n`;
    content += `- **Result Types**: `;
    content += Object.entries(resultCounts)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => `${type} (${count})`)
      .join(', ');
    content += `\n\n`;
    
    // Show results by type
    if (data.devices && data.devices.length > 0) {
      content += `## 💻 Devices (${data.devices.length})\n\n`;
      content += `| Name | IP | MAC | Type | Status |\n`;
      content += `|------|-----|-----|------|--------|\n`;
      
      data.devices.slice(0, 10).forEach((device: any) => {
        const name = device.name || 'Unknown';
        const ip = device.ip || device.ipAddress || 'N/A';
        const mac = device.mac || 'N/A';
        const type = device.type || device.deviceType || 'unknown';
        const status = device.online ? '🟢 Online' : '🔴 Offline';
        
        content += `| **${name}** | \`${ip}\` | \`${mac}\` | ${type} | ${status} |\n`;
      });
      
      if (data.devices.length > 10) {
        content += `\n_...and ${data.devices.length - 10} more devices_\n`;
      }
      content += `\n`;
    }
    
    if (data.alarms && data.alarms.length > 0) {
      content += `## 🚨 Alarms (${data.alarms.length})\n\n`;
      content += `| Time | Type | Device | Severity |\n`;
      content += `|------|------|--------|----------|\n`;
      
      data.alarms.slice(0, 10).forEach((alarm: any) => {
        const time = alarm.ts ? this.formatDate(alarm.ts) : 'N/A';
        const type = alarm.alarmType || `Type ${alarm.type}`;
        const device = alarm.device?.name || 'Unknown';
        const severity = alarm.severity || 'MEDIUM';
        
        content += `| ${time} | ${type} | ${device} | ${this.getSeverityEmoji(severity)} ${severity} |\n`;
      });
      
      if (data.alarms.length > 10) {
        content += `\n_...and ${data.alarms.length - 10} more alarms_\n`;
      }
      content += `\n`;
    }
    
    if (data.flows && data.flows.length > 0) {
      content += `## 🌐 Flows (${data.flows.length})\n\n`;
      content += `| Time | Device | Direction | Domain/IP | Transfer |\n`;
      content += `|------|--------|-----------|-----------|----------|\n`;
      
      data.flows.slice(0, 10).forEach((flow: any) => {
        const time = flow.ts ? new Date(flow.ts * 1000).toLocaleTimeString() : 'N/A';
        const device = flow.device?.name || 'Unknown';
        const direction = flow.direction === 'in' ? '⬇️' : flow.direction === 'out' ? '⬆️' : '↔️';
        const destination = flow.domain || flow.ip || 'Unknown';
        const transfer = this.formatBytes((flow.upload || 0) + (flow.download || 0));
        
        content += `| ${time} | ${device} | ${direction} | ${destination} | ${transfer} |\n`;
      });
      
      if (data.flows.length > 10) {
        content += `\n_...and ${data.flows.length - 10} more flows_\n`;
      }
      content += `\n`;
    }
    
    if (data.boxes && data.boxes.length > 0) {
      content += `## 📦 Boxes (${data.boxes.length})\n\n`;
      content += `| Name | Model | Version | Status |\n`;
      content += `|------|-------|---------|--------|\n`;
      
      data.boxes.forEach((box: any) => {
        const name = box.name || 'Unknown';
        const model = box.model || 'N/A';
        const version = box.version || 'N/A';
        const status = box.online ? '🟢 Online' : '🔴 Offline';
        
        content += `| **${name}** | ${model} | ${version} | ${status} |\n`;
      });
      content += `\n`;
    }
    
    if (totalResults === 0) {
      content += `### ℹ️ No results found\n`;
      content += `No items match your search query.\n`;
    }
    
    return content;
  }

  static formatListFlows(data: any, metadata: Record<string, any>): string {
    const flows = data.results || [];
    const timestamp = new Date().toLocaleString();
    
    let content = `# Network Traffic Flows\n`;
    content += `*Generated: ${timestamp}*\n\n`;
    
    // Overview section
    content += `## 📊 Traffic Summary\n`;
    content += `- **Total Flows**: ${flows.length}\n`;
    
    if (flows.length > 0) {
      // Calculate time range
      const timestamps = flows.map((f: any) => f.ts || 0).filter((ts: number) => ts > 0);
      if (timestamps.length > 0) {
        const minTime = Math.min(...timestamps);
        const maxTime = Math.max(...timestamps);
        content += `- **Time Period**: ${this.formatDate(minTime)} - ${this.formatDate(maxTime)}\n`;
      }
      
      // Protocol breakdown
      const protocolCount: Record<string, number> = {};
      const directionCount = { inbound: 0, outbound: 0, bidirectional: 0 };
      let totalUpload = 0;
      let totalDownload = 0;
      
      flows.forEach((flow: any) => {
        const protocol = flow.protocol || 'unknown';
        protocolCount[protocol] = (protocolCount[protocol] || 0) + 1;
        
        const direction = flow.direction || 'unknown';
        if (direction === 'in') directionCount.inbound++;
        else if (direction === 'out') directionCount.outbound++;
        else if (direction === 'bi') directionCount.bidirectional++;
        
        totalUpload += flow.upload || 0;
        totalDownload += flow.download || 0;
      });
      
      // Top protocols
      const sortedProtocols = Object.entries(protocolCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      if (sortedProtocols.length > 0) {
        content += `- **Top Protocols**: `;
        const totalFlows = flows.length;
        content += sortedProtocols
          .map(([proto, count]) => `${proto.toUpperCase()} (${Math.round(count / totalFlows * 100)}%)`)
          .join(', ');
        content += `\n`;
      }
      
      // Direction breakdown
      const totalDirectional = directionCount.inbound + directionCount.outbound + directionCount.bidirectional;
      if (totalDirectional > 0) {
        content += `- **Direction**: `;
        content += `Inbound (${Math.round(directionCount.inbound / totalDirectional * 100)}%), `;
        content += `Outbound (${Math.round(directionCount.outbound / totalDirectional * 100)}%), `;
        content += `Bidirectional (${Math.round(directionCount.bidirectional / totalDirectional * 100)}%)\n`;
      }
      
      content += `- **Total Transfer**: Upload ${this.formatBytes(totalUpload)}, Download ${this.formatBytes(totalDownload)}\n\n`;
      
      // Top destinations by volume
      const destinationVolume: Record<string, { domain: string, country: string, volume: number, count: number }> = {};
      
      flows.forEach((flow: any) => {
        const key = flow.domain || flow.ip || 'unknown';
        if (!destinationVolume[key]) {
          destinationVolume[key] = {
            domain: flow.domain || flow.ip || 'unknown',
            country: flow.country || 'Unknown',
            volume: 0,
            count: 0
          };
        }
        destinationVolume[key].volume += (flow.upload || 0) + (flow.download || 0);
        destinationVolume[key].count++;
      });
      
      const topDestinations = Object.values(destinationVolume)
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10);
      
      if (topDestinations.length > 0) {
        content += `## 🌍 Top Destinations by Volume\n\n`;
        content += `| Domain/IP | Country | Transfer Volume | Flow Count |\n`;
        content += `|-----------|---------|-----------------|------------|\n`;
        
        topDestinations.forEach(dest => {
          const countryFlag = dest.country && dest.country !== 'Unknown' ? `🌐 ${dest.country}` : '🌐 Unknown';
          content += `| **${dest.domain}** | ${countryFlag} | ${this.formatBytes(dest.volume)} | ${dest.count} |\n`;
        });
        content += `\n`;
      }
      
      // Top source devices
      const deviceVolume: Record<string, { name: string, upload: number, download: number, count: number }> = {};
      
      flows.forEach((flow: any) => {
        const deviceId = flow.device?.id || flow.deviceMAC || 'unknown';
        const deviceName = flow.device?.name || flow.deviceName || deviceId;
        
        if (!deviceVolume[deviceId]) {
          deviceVolume[deviceId] = {
            name: deviceName,
            upload: 0,
            download: 0,
            count: 0
          };
        }
        deviceVolume[deviceId].upload += flow.upload || 0;
        deviceVolume[deviceId].download += flow.download || 0;
        deviceVolume[deviceId].count++;
      });
      
      const topDevices = Object.values(deviceVolume)
        .sort((a, b) => (b.upload + b.download) - (a.upload + a.download))
        .slice(0, 10);
      
      if (topDevices.length > 0) {
        content += `## 📱 Top Devices by Traffic\n\n`;
        content += `| Device | Upload | Download | Total Flows |\n`;
        content += `|--------|--------|----------|-------------|\n`;
        
        topDevices.forEach(device => {
          content += `| **${device.name}** | ${this.formatBytes(device.upload)} | ${this.formatBytes(device.download)} | ${device.count} |\n`;
        });
        content += `\n`;
      }
      
      // Recent flows sample
      const recentFlows = flows.slice(0, 10);
      if (recentFlows.length > 0) {
        content += `## 📈 Recent Traffic Flows\n\n`;
        content += `| Time | Device | Direction | Domain/IP | Protocol | Transfer |\n`;
        content += `|------|--------|-----------|-----------|----------|----------|\n`;
        
        recentFlows.forEach((flow: any) => {
          const time = flow.ts ? new Date(flow.ts * 1000).toLocaleTimeString() : 'N/A';
          const device = flow.device?.name || flow.deviceName || 'Unknown';
          const direction = flow.direction === 'in' ? '⬇️ In' : flow.direction === 'out' ? '⬆️ Out' : '↔️ Bi';
          const destination = flow.domain || flow.ip || 'Unknown';
          const protocol = (flow.protocol || 'unknown').toUpperCase();
          const transfer = this.formatBytes((flow.upload || 0) + (flow.download || 0));
          
          content += `| ${time} | ${device} | ${direction} | ${destination} | ${protocol} | ${transfer} |\n`;
        });
      }
    } else {
      content += `\n### ℹ️ No flows found\n`;
      content += `No network flows match your search criteria.\n`;
    }
    
    if (data.next_cursor) {
      content += `\n## 📄 Additional Results\n`;
      content += `More results are available. Use cursor: \`${data.next_cursor}\` to fetch the next page.\n`;
    }
    
    return content;
  }

  static formatListRules(data: any, metadata: Record<string, any>): string {
    const rules = data.results || data || [];
    const timestamp = new Date().toLocaleString();
    
    let content = `# Firewall Rules Configuration\n`;
    content += `*Generated: ${timestamp}*\n\n`;
    
    // Overview section
    content += `## 📊 Rules Overview\n`;
    content += `- **Total Rules**: ${rules.length}\n`;
    
    if (rules.length > 0) {
      // Calculate rule statistics
      const activeCount = rules.filter((r: any) => r.status === 'active').length;
      const pausedCount = rules.length - activeCount;
      
      const actionCount: Record<string, number> = {};
      rules.forEach((rule: any) => {
        const action = rule.action || 'unknown';
        actionCount[action] = (actionCount[action] || 0) + 1;
      });
      
      content += `- **Active**: ${activeCount} | **Paused**: ${pausedCount}\n`;
      content += `- **Rule Types**: `;
      content += Object.entries(actionCount)
        .map(([action, count]) => `${action.charAt(0).toUpperCase() + action.slice(1)} (${count})`)
        .join(', ');
      content += `\n\n`;
      
      // Block rules
      const blockRules = rules.filter((r: any) => r.action === 'block');
      if (blockRules.length > 0) {
        content += `## 🛡️ Block Rules\n\n`;
        content += `| Name | Target | Scope | Direction | Status |\n`;
        content += `|------|--------|-------|-----------|--------|\n`;
        
        blockRules.forEach((rule: any) => {
          const name = rule.name || 'Unnamed Rule';
          const target = rule.target ? `${rule.target.type}: ${rule.target.value}` : 'Any';
          const scope = rule.scope ? `${rule.scope.type}: ${rule.scope.value}` : 'All devices';
          const direction = rule.direction || 'both';
          const status = rule.status === 'active' ? '✅ Active' : '⏸️ Paused';
          
          content += `| **${name}** | ${target} | ${scope} | ${direction} | ${status} |\n`;
        });
        content += `\n`;
      }
      
      // Allow rules
      const allowRules = rules.filter((r: any) => r.action === 'allow');
      if (allowRules.length > 0) {
        content += `## ✅ Allow Rules\n\n`;
        content += `| Name | Target | Scope | Direction | Status |\n`;
        content += `|------|--------|-------|-----------|--------|\n`;
        
        allowRules.forEach((rule: any) => {
          const name = rule.name || 'Unnamed Rule';
          const target = rule.target ? `${rule.target.type}: ${rule.target.value}` : 'Any';
          const scope = rule.scope ? `${rule.scope.type}: ${rule.scope.value}` : 'All devices';
          const direction = rule.direction || 'both';
          const status = rule.status === 'active' ? '✅ Active' : '⏸️ Paused';
          
          content += `| **${name}** | ${target} | ${scope} | ${direction} | ${status} |\n`;
        });
        content += `\n`;
      }
      
      // Time-limited rules
      const timeLimitRules = rules.filter((r: any) => r.action === 'time_limit');
      if (timeLimitRules.length > 0) {
        content += `## ⏰ Time-Limited Rules\n\n`;
        content += `| Name | Target | Schedule | Status |\n`;
        content += `|------|--------|----------|--------|\n`;
        
        timeLimitRules.forEach((rule: any) => {
          const name = rule.name || 'Unnamed Rule';
          const target = rule.target ? `${rule.target.type}: ${rule.target.value}` : 'Any';
          const schedule = rule.schedule ? rule.schedule.type : 'No schedule';
          const status = rule.status === 'active' ? '✅ Active' : '⏸️ Paused';
          
          content += `| **${name}** | ${target} | ${schedule} | ${status} |\n`;
        });
      }
    } else {
      content += `\n### ℹ️ No rules found\n`;
      content += `No security rules are configured.\n`;
    }
    
    return content;
  }

  static formatListDevices(data: any, metadata: Record<string, any>): string {
    const devices = data.results || data || [];
    const timestamp = new Date().toLocaleString();
    
    let content = `# Network Device Inventory\n`;
    content += `*Generated: ${timestamp}*\n\n`;
    
    // Overview section
    content += `## 📊 Device Summary\n`;
    content += `- **Total Devices**: ${devices.length}\n`;
    
    if (devices.length > 0) {
      // Calculate device statistics
      const onlineCount = devices.filter((d: any) => d.online).length;
      const offlineCount = devices.length - onlineCount;
      
      const typeCount: Record<string, number> = {};
      const networkCount: Record<string, number> = {};
      
      devices.forEach((device: any) => {
        const type = device.type || device.deviceType || 'unknown';
        typeCount[type] = (typeCount[type] || 0) + 1;
        
        const network = device.network?.name || 'Unknown Network';
        networkCount[network] = (networkCount[network] || 0) + 1;
      });
      
      content += `- **Online**: ${onlineCount} | **Offline**: ${offlineCount}\n`;
      
      // Device types breakdown
      const sortedTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]);
      content += `- **Device Types**: `;
      content += sortedTypes.map(([type, count]) => `${type} (${count})`).join(', ');
      content += `\n\n`;
      
      // Network distribution
      content += `## 🏠 Network Distribution\n`;
      Object.entries(networkCount)
        .sort((a, b) => b[1] - a[1])
        .forEach(([network, count]) => {
          content += `- **${network}**: ${count} devices\n`;
        });
      content += `\n`;
      
      // Active devices
      const activeDevices = devices.filter((d: any) => d.online);
      if (activeDevices.length > 0) {
        content += `## 💻 Active Devices\n\n`;
        content += `| Name | IP Address | MAC Address | Type | Network | Last Active |\n`;
        content += `|------|------------|-------------|------|---------|-------------|\n`;
        
        activeDevices.forEach((device: any) => {
          const name = device.name || 'Unknown';
          const ip = device.ip || device.ipAddress || 'N/A';
          const mac = device.mac || 'N/A';
          const type = device.type || device.deviceType || 'unknown';
          const typeEmoji = this.getDeviceTypeEmoji(type);
          const network = device.network?.name || 'Unknown';
          const lastSeen = device.lastActiveTime || device.lastSeen ? 
            this.formatDate(device.lastActiveTime || device.lastSeen) : 'Active';
          
          content += `| ${typeEmoji} **${name}** | \`${ip}\` | \`${mac}\` | ${type} | ${network} | ${lastSeen} |\n`;
        });
        content += `\n`;
      }
      
      // Offline devices
      const offlineDevices = devices.filter((d: any) => !d.online);
      if (offlineDevices.length > 0) {
        content += `## 📴 Offline Devices\n\n`;
        content += `| Name | IP Address | MAC Address | Type | Last Seen |\n`;
        content += `|------|------------|-------------|------|------------|\n`;
        
        offlineDevices.forEach((device: any) => {
          const name = device.name || 'Unknown';
          const ip = device.ip || device.ipAddress || 'N/A';
          const mac = device.mac || 'N/A';
          const type = device.type || device.deviceType || 'unknown';
          const typeEmoji = this.getDeviceTypeEmoji(type);
          const lastSeen = device.lastActiveTime || device.lastSeen ? 
            this.formatDate(device.lastActiveTime || device.lastSeen) : 'N/A';
          
          content += `| ${typeEmoji} **${name}** | \`${ip}\` | \`${mac}\` | ${type} | ${lastSeen} |\n`;
        });
      }
    } else {
      content += `\n### ℹ️ No devices found\n`;
      content += `No devices match your search criteria.\n`;
    }
    
    if (data.next_cursor) {
      content += `\n## 📄 Additional Results\n`;
      content += `More results are available. Use cursor: \`${data.next_cursor}\` to fetch the next page.\n`;
    }
    
    return content;
  }

  static formatListAlarms(data: any, metadata: Record<string, any>): string {
    const alarms = data.results || [];
    const timestamp = new Date().toLocaleString();
    
    let content = `# Firewalla Security Alarms Report\n`;
    content += `*Generated: ${timestamp}*\n\n`;
    
    // Overview section
    content += `## 📊 Overview\n`;
    content += `- **Total Alarms**: ${alarms.length}\n`;
    content += `- **Query**: ${metadata.query || 'All alarms'}\n`;
    
    if (alarms.length > 0) {
      // Calculate severity breakdown
      const severityCount = { HIGH: 0, MEDIUM: 0, LOW: 0 };
      const statusCount = { active: 0, acknowledged: 0, resolved: 0 };
      const typeCount: Record<string, number> = {};
      
      alarms.forEach((alarm: any) => {
        const severity = alarm.severity || (alarm.type <= 2 ? 'HIGH' : alarm.type <= 5 ? 'MEDIUM' : 'LOW');
        severityCount[severity as keyof typeof severityCount]++;
        
        const status = alarm.status || 'active';
        statusCount[status as keyof typeof statusCount]++;
        
        const alarmType = alarm.alarmType || `Type ${alarm.type}`;
        typeCount[alarmType] = (typeCount[alarmType] || 0) + 1;
      });
      
      content += `- **Severity Breakdown**: High (${severityCount.HIGH}), Medium (${severityCount.MEDIUM}), Low (${severityCount.LOW})\n`;
      content += `- **Status**: Active (${statusCount.active}), Acknowledged (${statusCount.acknowledged}), Resolved (${statusCount.resolved})\n\n`;
      
      // Alarms by type
      content += `## 🚨 Alarms by Type\n`;
      Object.entries(typeCount).forEach(([type, count]) => {
        content += `- **${type}**: ${count} alarms\n`;
      });
      content += `\n`;
      
      // Detailed alarms
      content += `## 📋 Detailed Alarms\n\n`;
      
      alarms.forEach((alarm: any, index: number) => {
        const severity = alarm.severity || (alarm.type <= 2 ? 'HIGH' : alarm.type <= 5 ? 'MEDIUM' : 'LOW');
        const alarmTime = alarm.ts ? this.formatDate(alarm.ts) : 'N/A';
        const deviceName = alarm.device?.name || 'Unknown Device';
        const deviceIp = alarm.device?.ip || alarm.device?.ipAddress || 'N/A';
        const remoteDomain = alarm.remote?.domain || alarm.remote?.ip || 'N/A';
        const remoteCountry = alarm.remote?.country || 'Unknown';
        const download = this.formatBytes(alarm.transfer?.download);
        const upload = this.formatBytes(alarm.transfer?.upload);
        const total = this.formatBytes(alarm.transfer?.total);
        const status = alarm.status || 'active';
        
        content += `### ${this.getSeverityEmoji(severity)} Alarm #${index + 1} - ${alarm.alarmType || `Type ${alarm.type}`}\n`;
        content += `- **Time**: ${alarmTime}\n`;
        content += `- **Severity**: ${severity}\n`;
        content += `- **Status**: ${status}\n`;
        content += `- **Device**: ${deviceName} (IP: ${deviceIp})\n`;
        content += `- **Remote**: ${remoteDomain} (${remoteCountry})\n`;
        content += `- **Transfer**: ↓ ${download} | ↑ ${upload} | Total: ${total}\n`;
        content += `\n`;
      });
    } else {
      content += `\n### ℹ️ No alarms found\n`;
      content += `No security alarms match your search criteria.\n`;
    }
    
    if (data.next_cursor) {
      content += `\n## 📄 Additional Results\n`;
      content += `More results are available. Use cursor: \`${data.next_cursor}\` to fetch the next page.\n`;
    }
    
    return content;
  }

  static formatEnhancedResponse(data: any, responseType: string, metadata?: Record<string, any>): string {
    const enhancedMetadata = metadata || {};
    let presentationContent = '';
    let summary = '';
    let title = '';
    
    switch (responseType) {
      case 'list_alarms':
      case 'search_alarms':
        presentationContent = this.formatListAlarms(data, enhancedMetadata);
        title = enhancedMetadata.query ? 
          `Firewalla Alarms Report - ${enhancedMetadata.query}` : 
          'Firewalla Security Alarms Report';
        summary = `Found ${(data.results || []).length} alarms${enhancedMetadata.query ? ` matching "${enhancedMetadata.query}"` : ''}.`;
        break;
        
      case 'list_devices':
      case 'search_devices':
        presentationContent = this.formatListDevices(data, enhancedMetadata);
        title = enhancedMetadata.query ? 
          `Network Device Inventory - ${enhancedMetadata.query}` : 
          'Network Device Inventory';
        const deviceData = data.results || data || [];
        const onlineCount = deviceData.filter((d: any) => d.online).length;
        summary = `Found ${deviceData.length} devices (${onlineCount} online, ${deviceData.length - onlineCount} offline)${enhancedMetadata.query ? ` matching "${enhancedMetadata.query}"` : ''}.`;
        break;
        
      case 'list_rules':
        presentationContent = this.formatListRules(data, enhancedMetadata);
        title = 'Firewall Rules Configuration';
        const ruleData = data.results || data || [];
        const activeRules = ruleData.filter((r: any) => r.status === 'active').length;
        summary = `Found ${ruleData.length} rules (${activeRules} active, ${ruleData.length - activeRules} paused).`;
        break;
        
      case 'get_statistics':
        presentationContent = this.formatStatistics(data, enhancedMetadata);
        title = `Firewalla Analytics - ${enhancedMetadata.stats_type || 'Statistics'}`;
        const statsData = data.results || data || [];
        summary = `Showing top ${statsData.length} results for ${enhancedMetadata.stats_type}.`;
        break;
        
      case 'get_simple_statistics':
        presentationContent = this.formatSimpleStatistics(data, enhancedMetadata);
        title = 'Firewalla System Overview';
        summary = `System has ${data.onlineBoxes || 0} online boxes, ${data.alarms || 0} alarms, and ${data.rules || 0} rules.`;
        break;
        
      case 'list_flows':
      case 'search_flows':
        presentationContent = this.formatListFlows(data, enhancedMetadata);
        title = enhancedMetadata.query ? 
          `Network Traffic Flows - ${enhancedMetadata.query}` : 
          'Network Traffic Flows Report';
        const flowData = data.results || [];
        const totalTransfer = flowData.reduce((sum: number, flow: any) => 
          sum + (flow.upload || 0) + (flow.download || 0), 0);
        summary = `Found ${flowData.length} flows with total transfer of ${FirewallaResponseFormatter.formatBytes(totalTransfer)}${enhancedMetadata.query ? ` matching "${enhancedMetadata.query}"` : ''}.`;
        break;
        
      case 'list_target_lists':
      case 'get_target_list':
        presentationContent = this.formatTargetLists(data, enhancedMetadata);
        title = 'Firewalla Target Lists Configuration';
        const listData = data.results || data || [];
        const totalTargets = Array.isArray(listData) ? 
          listData.reduce((sum: number, list: any) => sum + (list.targets || []).length, 0) :
          (listData.targets || []).length;
        summary = `Found ${Array.isArray(listData) ? listData.length : 1} target lists with ${totalTargets} total targets.`;
        break;
        
      case 'get_trends':
        presentationContent = this.formatGetTrends(data, enhancedMetadata);
        const trendType = enhancedMetadata.trends_type || 'trends';
        title = `Firewalla ${trendType.charAt(0).toUpperCase() + trendType.slice(1)} Trends Analysis`;
        const trendData = data.results || data || [];
        summary = `Showing ${trendData.length} data points for ${trendType} trends.`;
        break;
        
      case 'search_global':
        presentationContent = this.formatSearchGlobal(data, enhancedMetadata);
        title = `Firewalla Global Search - "${enhancedMetadata.query || 'All'}"`;
        let globalTotalResults = 0;
        Object.entries(data).forEach(([_, results]: [string, any]) => {
          if (Array.isArray(results)) globalTotalResults += results.length;
        });
        summary = `Found ${globalTotalResults} total results across all entity types.`;
        break;
        
      // Add more endpoint formatters here
      default:
        // Fallback to basic formatting
        return formatAsXML(data, responseType, metadata);
    }
    
    const timestamp = new Date().toISOString();
    const metadataXML = metadata ? Object.entries(metadata).map(([key, value]) => 
      `    <${escapeXML(key)}>${escapeXML(String(value))}</${escapeXML(key)}>`
    ).join('\n') : '';
    
    const dataXML = jsonToXML(data, 2);
    
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
${dataXML}
  </data>
</firewalla_response>`;
  }
}

// Utility function for paginated requests (kept for future use)
// async function fetchAllPaginated(endpoint: string, params: any = {}) {
//   const allResults = [];
//   let cursor: string | null = null;
//   
//   while (true) {
//     const response = await httpClient.get(endpoint, {
//       params: { ...params, cursor, limit: params.limit || 200 },
//     });
//     
//     const data = response.data as { results: any[]; next_cursor?: string | null };
//     const { results, next_cursor } = data;
//     allResults.push(...results);
//     
//     if (!next_cursor) break;
//     cursor = next_cursor;
//   }
//   
//   return allResults;
// }

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Boxes API
      {
        name: "list_boxes",
        description: "Get all Firewalla boxes in the MSP",
        inputSchema: {
          type: "object",
          properties: {
            group: {
              type: "string",
              description: "Filter by group ID",
            },
          },
        },
      },
      
      // Devices API
      {
        name: "list_devices",
        description: "Get all devices across boxes (returns device name, MAC, IP, type, status, and more)",
        inputSchema: {
          type: "object",
          properties: {
            box: {
              type: "string",
              description: "Filter by specific box ID",
            },
            group: {
              type: "string",
              description: "Filter by specific box group ID",
            },
          },
        },
      },
      
      // Alarms API
      {
        name: "list_alarms",
        description: "Get alarms with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (e.g., 'status:active box:boxId type:9')",
            },
            groupBy: {
              type: "string",
              description: "Group results (comma-separated)",
            },
            sortBy: {
              type: "string",
              description: "Sort results (e.g., 'ts:desc,total:asc')",
            },
            limit: {
              type: "number",
              description: "Max results per page (≤500, default 200)",
            },
            cursor: {
              type: "string",
              description: "Pagination cursor",
            },
          },
        },
      },
      {
        name: "get_alarm",
        description: "Get a specific alarm by GID and AID",
        inputSchema: {
          type: "object",
          properties: {
            gid: {
              type: "string",
              description: "Box GID",
            },
            aid: {
              type: "string",
              description: "Alarm ID",
            },
          },
          required: ["gid", "aid"],
        },
      },
      {
        name: "delete_alarm",
        description: "Delete a specific alarm",
        inputSchema: {
          type: "object",
          properties: {
            gid: {
              type: "string",
              description: "Box GID",
            },
            aid: {
              type: "string",
              description: "Alarm ID",
            },
          },
          required: ["gid", "aid"],
        },
      },
      
      // Rules API
      {
        name: "list_rules",
        description: "Get all rules (requires MSP 2.7.0+)",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (e.g., 'status:active box.id:boxId')",
            },
          },
        },
      },
      {
        name: "pause_rule",
        description: "Pause a specific rule",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Rule ID",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "resume_rule",
        description: "Resume a paused rule",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Rule ID",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "create_rule",
        description: "Create a new security rule",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Rule name (optional, will be generated if not provided)",
            },
            action: {
              type: "string",
              enum: ["allow", "block", "time_limit"],
              description: "Rule action: allow, block, or time_limit",
            },
            direction: {
              type: "string",
              enum: ["inbound", "outbound", "bidirection"],
              description: "Traffic direction",
            },
            protocol: {
              type: "string",
              enum: ["tcp", "udp", "icmp", "any"],
              description: "Protocol type",
            },
            target: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["ip", "domain", "category", "device", "network"],
                  description: "Target type",
                },
                value: {
                  type: "string",
                  description: "Target value (IP, domain, etc.)",
                },
              },
              required: ["type", "value"],
              description: "Rule target specification",
            },
            scope: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["device", "network", "group"],
                  description: "Scope type",
                },
                value: {
                  type: "string",
                  description: "Scope value (device ID, network ID, etc.)",
                },
                port: {
                  type: "string",
                  description: "Port or port range",
                },
              },
              description: "Rule scope specification (optional)",
            },
            schedule: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["daily", "weekly", "custom"],
                  description: "Schedule type",
                },
                times: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "Time periods",
                },
              },
              description: "Rule schedule (optional, for time_limit rules)",
            },
          },
          required: ["action", "direction", "protocol", "target"],
        },
      },
      {
        name: "update_rule",
        description: "Update an existing rule",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Rule ID",
            },
            name: {
              type: "string",
              description: "Rule name",
            },
            action: {
              type: "string",
              enum: ["allow", "block", "time_limit"],
              description: "Rule action",
            },
            direction: {
              type: "string",
              enum: ["inbound", "outbound", "bidirection"],
              description: "Traffic direction",
            },
            protocol: {
              type: "string",
              enum: ["tcp", "udp", "icmp", "any"],
              description: "Protocol type",
            },
            target: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["ip", "domain", "category", "device", "network"],
                },
                value: {
                  type: "string",
                },
              },
              description: "Rule target specification",
            },
            scope: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["device", "network", "group"],
                },
                value: {
                  type: "string",
                },
                port: {
                  type: "string",
                },
              },
              description: "Rule scope specification",
            },
            status: {
              type: "string",
              enum: ["active", "paused"],
              description: "Rule status",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "delete_rule",
        description: "Delete a security rule",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Rule ID",
            },
          },
          required: ["id"],
        },
      },
      
      // Flows API
      {
        name: "list_flows",
        description: "Get network flows with filtering",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (e.g., 'ts:1234567890-1234567899 box.id:boxId')",
            },
            groupBy: {
              type: "string",
              description: "Group results",
            },
            sortBy: {
              type: "string",
              description: "Sort results (default: 'ts:desc')",
            },
            limit: {
              type: "number",
              description: "Max results per page (≤500, default 200)",
            },
            cursor: {
              type: "string",
              description: "Pagination cursor",
            },
          },
        },
      },
      
      // Target Lists API
      {
        name: "list_target_lists",
        description: "Get all target lists",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_target_list",
        description: "Get a specific target list",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Target list ID",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "create_target_list",
        description: "Create a new target list",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the target list",
            },
            targets: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Array of IP addresses or domains",
            },
            owner: {
              type: "string",
              description: "Owner of the target list",
            },
            category: {
              type: "string",
              description: "Category of the target list",
            },
            notes: {
              type: "string",
              description: "Notes about the target list",
            },
          },
          required: ["name", "targets"],
        },
      },
      {
        name: "update_target_list",
        description: "Update an existing target list",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Target list ID",
            },
            name: {
              type: "string",
              description: "Name of the target list",
            },
            targets: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Array of IP addresses or domains",
            },
            owner: {
              type: "string",
              description: "Owner of the target list",
            },
            category: {
              type: "string",
              description: "Category of the target list",
            },
            notes: {
              type: "string",
              description: "Notes about the target list",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "delete_target_list",
        description: "Delete a target list",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Target list ID",
            },
          },
          required: ["id"],
        },
      },

      // Statistics API
      {
        name: "get_statistics",
        description: "Get detailed statistics by type",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["topBoxesByBlockedFlows", "topBoxesBySecurityAlarms", "topRegionsByBlockedFlows"],
              description: "Type of statistics to retrieve",
            },
            group: {
              type: "string",
              description: "Filter by specific box group ID (optional)",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 5, max: 50)",
              minimum: 1,
              maximum: 50,
            },
          },
          required: ["type"],
        },
      },
      {
        name: "get_simple_statistics",
        description: "Get simple overview statistics (boxes, alarms, rules counts)",
        inputSchema: {
          type: "object",
          properties: {
            group: {
              type: "string",
              description: "Filter by specific box group ID (optional)",
            },
          },
        },
      },

      // Trends API
      {
        name: "get_trends",
        description: "Get trend data for flows, alarms, or rules over time",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["flows", "alarms", "rules"],
              description: "Type of trend data to retrieve",
            },
            group: {
              type: "string",
              description: "Filter by specific box group ID (optional)",
            },
          },
          required: ["type"],
        },
      },

      // Search API - Based on comprehensive API testing
      {
        name: "search_global",
        description: "Search across searchable entity types (devices, alarms, flows, boxes) using Firewalla query syntax",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query using Firewalla syntax. Supports: text search, key:value pairs, wildcards (*), quotes, exclusions (-), numeric comparisons (><=), ranges (start-end), units (KB/MB/GB). Examples: 'iPhone', 'status:active', 'device.name:*iphone*', 'ts:>1720000000', 'download:>1MB'",
            },
            types: {
              type: "array",
              items: {
                type: "string",
                enum: ["devices", "alarms", "flows", "boxes"],
              },
              description: "Entity types to search (default: all searchable types). Note: target-lists, stats, trends do not support search",
            },
            limit: {
              type: "number",
              description: "Maximum results per type (default: 10, max: 500)",
              minimum: 1,
              maximum: 500,
            },
            cursor: {
              type: "string",
              description: "Pagination cursor for continuing search results",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_devices",
        description: "Search devices using Firewalla query syntax with device-specific qualifiers (returns device name, MAC, IP, type, status, and more)",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query with device qualifiers: device.name, device.id, box.id, box.name, box.group.id. Supports text search, wildcards, quotes. Examples: 'iPhone', 'device.name:*iphone*', 'box.id:uuid'",
            },
            limit: {
              type: "number",
              description: "Maximum results (default: 50, max: 500)",
              minimum: 1,
              maximum: 500,
            },
            cursor: {
              type: "string",
              description: "Pagination cursor from previous response",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_alarms",
        description: "Search alarms using Firewalla query syntax with alarm-specific qualifiers",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query with alarm qualifiers: ts, type, status, box.id, box.name, box.group.id, device.id, device.name, remote.category, remote.domain, remote.region, transfer.download, transfer.upload, transfer.total. Supports ranges, comparisons, units. Examples: 'status:active', 'type:1', 'ts:>1720000000', 'transfer.total:>1MB'",
            },
            limit: {
              type: "number",
              description: "Maximum results (default: 50, max: 500)",
              minimum: 1,
              maximum: 500,
            },
            cursor: {
              type: "string",
              description: "Pagination cursor from previous response",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_flows",
        description: "Search network flows using Firewalla query syntax with flow-specific qualifiers",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query with flow qualifiers: ts, status, direction, box.id, box.name, box.group.id, device.id, device.name, category, domain, region, sport, dport, download, upload, total. Supports wildcards, ranges, comparisons, units. Examples: 'direction:outbound', 'domain:*google*', 'download:>1MB', 'ts:>1720000000'",
            },
            limit: {
              type: "number",
              description: "Maximum results (default: 50, max: 500)",
              minimum: 1,
              maximum: 500,
            },
            cursor: {
              type: "string",
              description: "Pagination cursor from previous response",
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      // Boxes API
      case "list_boxes": {
        const params = args.group ? { group: args.group } : {};
        const response = await httpClient.get("/boxes", { params });
        // Handle both array and object responses
        const data = Array.isArray(response.data) 
          ? { count: response.data.length, results: response.data }
          : response.data;
        return { content: [{ type: "text", text: formatAsXML(data, "list_boxes", { count: data.count || data.results?.length || 0 }) }] };
      }

      // Devices API
      case "list_devices": {
        const params: any = {};
        if (args.box) params.box = args.box;
        if (args.group) params.group = args.group;
        const response = await httpClient.get("/devices", { params });
        // Handle both array and object responses
        const data = Array.isArray(response.data) 
          ? { count: response.data.length, results: response.data }
          : response.data;
        
        return { content: [{ type: "text", text: FirewallaResponseFormatter.formatEnhancedResponse(data, "list_devices", { 
          box: args.box || null,
          group: args.group || null
        }) }] };
      }

      // Alarms API
      case "list_alarms": {
        const params: any = {};
        if (args.query) params.query = args.query;
        if (args.groupBy) params.groupBy = args.groupBy;
        if (args.sortBy) params.sortBy = args.sortBy;
        if (args.limit) params.limit = args.limit;
        if (args.cursor) params.cursor = args.cursor;
        
        const response = await httpClient.get("/alarms", { params });
        const data = response.data;
        
        return { content: [{ type: "text", text: FirewallaResponseFormatter.formatEnhancedResponse(data, "list_alarms", { 
          query: args.query || null,
          group_by: args.groupBy || null,
          sort_by: args.sortBy || null,
          limit: args.limit || null,
          cursor: args.cursor || null
        }) }] };
      }

      case "get_alarm": {
        const response = await httpClient.get(`/alarms/${args.gid}/${args.aid}`);
        return { content: [{ type: "text", text: formatAsXML(response.data, "get_alarm", { 
          gid: args.gid, 
          aid: args.aid 
        }) }] };
      }

      case "delete_alarm": {
        await httpClient.delete(`/alarms/${args.gid}/${args.aid}`);
        return { content: [{ type: "text", text: "Alarm deleted successfully" }] };
      }

      // Rules API
      case "list_rules": {
        const params = args.query ? { query: args.query } : {};
        const response = await httpClient.get("/rules", { params });
        // Handle both array and object responses
        let data = Array.isArray(response.data) 
          ? { count: response.data.length, results: response.data }
          : response.data;
        
        // Add rule names based on target/scope if missing
        if (data.results) {
          data.results = data.results.map((rule: any) => {
            if (!rule.name) {
              // Generate a descriptive name based on rule properties
              const action = rule.action || 'unknown';
              const direction = rule.direction || '';
              const target = rule.target?.value || 'any';
              const protocol = rule.protocol || 'any';
              rule.name = `${action} ${direction} ${protocol} ${target}`.trim();
            }
            return rule;
          });
        }
        
        return { content: [{ type: "text", text: FirewallaResponseFormatter.formatEnhancedResponse(data, "list_rules", { 
          query: args.query || null 
        }) }] };
      }

      case "pause_rule": {
        await httpClient.post(`/rules/${args.id}/pause`);
        return { content: [{ type: "text", text: "Rule paused successfully" }] };
      }

      case "resume_rule": {
        await httpClient.post(`/rules/${args.id}/resume`);
        return { content: [{ type: "text", text: "Rule resumed successfully" }] };
      }

      case "create_rule": {
        const body: any = {
          action: args.action,
          direction: args.direction,
          protocol: args.protocol,
          target: args.target,
        };
        
        // Add optional fields
        if (args.name) body.name = args.name;
        if (args.scope) body.scope = args.scope;
        if (args.schedule) body.schedule = args.schedule;
        
        const response = await httpClient.post("/rules", body);
        return { content: [{ type: "text", text: formatAsXML(response.data, "create_rule", { 
          action: args.action,
          direction: args.direction,
          protocol: args.protocol,
          target_type: (args.target as any)?.type,
          target_value: (args.target as any)?.value 
        }) }] };
      }

      case "update_rule": {
        const body: any = {};
        
        // Add fields that are provided
        if (args.name) body.name = args.name;
        if (args.action) body.action = args.action;
        if (args.direction) body.direction = args.direction;
        if (args.protocol) body.protocol = args.protocol;
        if (args.target) body.target = args.target;
        if (args.scope) body.scope = args.scope;
        if (args.status) body.status = args.status;
        
        const response = await httpClient.put(`/rules/${args.id}`, body);
        return { content: [{ type: "text", text: formatAsXML(response.data, "update_rule", { 
          rule_id: args.id,
          updated_fields: Object.keys(body),
          field_count: Object.keys(body).length 
        }) }] };
      }

      case "delete_rule": {
        await httpClient.delete(`/rules/${args.id}`);
        return { content: [{ type: "text", text: "Rule deleted successfully" }] };
      }

      // Flows API
      case "list_flows": {
        const params: any = {};
        if (args.query) params.query = args.query;
        if (args.groupBy) params.groupBy = args.groupBy;
        if (args.sortBy) params.sortBy = args.sortBy;
        if (args.limit) params.limit = args.limit;
        if (args.cursor) params.cursor = args.cursor;
        
        const response = await httpClient.get("/flows", { params });
        return { content: [{ type: "text", text: FirewallaResponseFormatter.formatEnhancedResponse(response.data, "list_flows", { 
          query: args.query || null,
          group_by: args.groupBy || null,
          sort_by: args.sortBy || null,
          limit: args.limit || null,
          cursor: args.cursor || null 
        }) }] };
      }

      // Target Lists API
      case "list_target_lists": {
        const response = await httpClient.get("/target-lists");
        // Handle both array and object responses
        const data = Array.isArray(response.data) 
          ? { count: response.data.length, results: response.data }
          : response.data;
        return { content: [{ type: "text", text: FirewallaResponseFormatter.formatEnhancedResponse(data, "list_target_lists", { 
          count: data.count || data.results?.length || 0 
        }) }] };
      }

      case "get_target_list": {
        const response = await httpClient.get(`/target-lists/${args.id}`);
        return { content: [{ type: "text", text: FirewallaResponseFormatter.formatEnhancedResponse(response.data, "get_target_list", { 
          target_list_id: args.id 
        }) }] };
      }

      case "create_target_list": {
        const body: any = {
          name: args.name,
          targets: args.targets,
        };
        if (args.owner) body.owner = args.owner;
        if (args.category) body.category = args.category;
        if (args.notes) body.notes = args.notes;
        
        const response = await httpClient.post("/target-lists", body);
        return { content: [{ type: "text", text: FirewallaResponseFormatter.formatEnhancedResponse(response.data, "list_target_lists", { 
          name: args.name,
          target_count: (args.targets as any[])?.length || 0,
          owner: args.owner || null,
          category: args.category || null 
        }) }] };
      }

      case "update_target_list": {
        const body: any = {};
        if (args.name) body.name = args.name;
        if (args.targets) body.targets = args.targets;
        if (args.owner) body.owner = args.owner;
        if (args.category) body.category = args.category;
        if (args.notes) body.notes = args.notes;
        
        const response = await httpClient.patch(`/target-lists/${args.id}`, body);
        return { content: [{ type: "text", text: formatAsXML(response.data, "update_target_list", { 
          target_list_id: args.id,
          updated_fields: Object.keys(body),
          field_count: Object.keys(body).length 
        }) }] };
      }

      case "delete_target_list": {
        await httpClient.delete(`/target-lists/${args.id}`);
        return { content: [{ type: "text", text: "Target list deleted successfully" }] };
      }

      // Statistics API
      case "get_statistics": {
        const params: any = {};
        if (args.group) params.group = args.group;
        if (args.limit) params.limit = args.limit;
        
        const response = await httpClient.get(`/stats/${args.type}`, { params });
        // Handle both array and object responses
        const data = Array.isArray(response.data) 
          ? { count: response.data.length, results: response.data }
          : response.data;
        return { content: [{ type: "text", text: FirewallaResponseFormatter.formatEnhancedResponse(data, "get_statistics", { 
          stats_type: args.type,
          group: args.group || null,
          limit: args.limit || null
        }) }] };
      }

      case "get_simple_statistics": {
        const params: any = {};
        if (args.group) params.group = args.group;
        
        const response = await httpClient.get("/stats/simple", { params });
        return { content: [{ type: "text", text: FirewallaResponseFormatter.formatEnhancedResponse(response.data, "get_simple_statistics", { 
          group: args.group || null 
        }) }] };
      }

      // Trends API
      case "get_trends": {
        const params: any = {};
        if (args.group) params.group = args.group;
        
        const response = await httpClient.get(`/trends/${args.type}`, { params });
        // Handle both array and object responses
        const data = Array.isArray(response.data) 
          ? { count: response.data.length, results: response.data }
          : response.data;
        return { content: [{ type: "text", text: FirewallaResponseFormatter.formatEnhancedResponse(data, "get_trends", { 
          trends_type: args.type,
          group: args.group || null,
          count: data.count || data.results?.length || 0 
        }) }] };
      }

      // Search API
      case "search_global": {
        const searchTypes: string[] = (args.types as string[]) || ["devices", "alarms", "flows", "boxes"];
        const limit = args.limit || 10;
        const results: any = {};
        let totalCount = 0;

        // Search across all specified entity types (only searchable ones)
        for (const entityType of searchTypes) {
          try {
            const params: any = {
              query: args.query,
              limit: limit
            };
            if (args.cursor) params.cursor = args.cursor;

            let endpoint = "";
            switch (entityType) {
              case "devices":
                endpoint = "/devices";
                break;
              case "alarms":
                endpoint = "/alarms";
                break;
              case "flows":
                endpoint = "/flows";
                break;
              case "boxes":
                endpoint = "/boxes";
                break;
              default:
                continue;
            }

            const response = await httpClient.get(endpoint, { params });
            const data = response.data;
            
            // Handle API response format properly
            if (data.results) {
              results[entityType] = data.results;
              totalCount += data.results.length;
            } else if (Array.isArray(data)) {
              results[entityType] = data;
              totalCount += data.length;
            } else {
              results[entityType] = [data];
              totalCount += 1;
            }
          } catch (error) {
            // Continue with other entity types if one fails
            results[entityType] = [];
          }
        }

        return { content: [{ type: "text", text: FirewallaResponseFormatter.formatEnhancedResponse(results, "search_global", { 
          query: args.query,
          search_types: searchTypes,
          limit: limit,
          total_count: totalCount 
        }) }] };
      }

      case "search_devices": {
        const params: any = {
          query: args.query,
          limit: args.limit || 50
        };
        if (args.cursor) params.cursor = args.cursor;

        const response = await httpClient.get("/devices", { params });
        const data = response.data;
        
        return { content: [{ type: "text", text: FirewallaResponseFormatter.formatEnhancedResponse(data, "search_devices", { 
          query: args.query,
          limit: args.limit || 50,
          cursor: args.cursor || null
        }) }] };
      }

      case "search_alarms": {
        const params: any = {
          query: args.query,
          limit: args.limit || 50
        };
        if (args.cursor) params.cursor = args.cursor;

        const response = await httpClient.get("/alarms", { params });
        const data = response.data;
        
        return { content: [{ type: "text", text: FirewallaResponseFormatter.formatEnhancedResponse(data, "search_alarms", { 
          query: args.query,
          limit: args.limit || 50,
          cursor: args.cursor || null
        }) }] };
      }

      case "search_flows": {
        const params: any = {
          query: args.query,
          limit: args.limit || 50
        };
        if (args.cursor) params.cursor = args.cursor;

        const response = await httpClient.get("/flows", { params });
        const data = response.data;
        const flows = data.results || [];
        
        return { content: [{ type: "text", text: formatAsXML(data, "search_flows", { 
          query: args.query,
          limit: args.limit || 50,
          count: flows.length,
          has_more: !!data.next_cursor,
          next_cursor: data.next_cursor || null
        }) }] };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      if (status === 401) {
        throw new McpError(ErrorCode.InvalidRequest, "Authentication failed. Check your API key.");
      } else if (status === 404) {
        throw new McpError(ErrorCode.InvalidRequest, "Resource not found.");
      } else if (status === 400) {
        throw new McpError(ErrorCode.InvalidRequest, `Bad request: ${message}`);
      }
      
      throw new McpError(
        ErrorCode.InternalError,
        `API request failed: ${message}`
      );
    }
    
    throw error;
  }
});

// Define prompts for formatting guidance
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "format_devices",
        description: "Formatting guide for presenting device information",
      },
      {
        name: "format_alarms",
        description: "Formatting guide for presenting alarm information",
      },
      {
        name: "format_flows",
        description: "Formatting guide for presenting network flow information",
      },
      {
        name: "format_rules",
        description: "Formatting guide for presenting security rules",
      },
      {
        name: "format_boxes",
        description: "Formatting guide for presenting Firewalla box information",
      },
      {
        name: "format_statistics",
        description: "Formatting guide for presenting statistics and trends",
      },
      {
        name: "format_target_lists",
        description: "Formatting guide for presenting target lists",
      },
      {
        name: "format_search_results",
        description: "Formatting guide for presenting search results across multiple types",
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name } = request.params;
  
  const formatGuides: Record<string, { description: string; prompt: string }> = {
    format_devices: {
      description: "How to format device information",
      prompt: `When displaying Firewalla device information, use this format:

📱 **Device Name** | IP: \`{ipAddress}\` | MAC: \`{mac}\`
   ├─ Type: {type}
   ├─ Status: {online/offline}
   ├─ Box: {box.name}
   └─ Last Seen: {lastActiveTime}

Include these key fields:
- Device name (bold)
- IP address (in code blocks)
- MAC address (in code blocks)
- Device type
- Online/offline status
- Associated box name
- Last active time

For lists, separate each device with a blank line.
Group by network/box if more than 10 devices.`,
    },
    
    format_alarms: {
      description: "How to format alarm information",
      prompt: `When displaying Firewalla alarm information, use this format:

🚨 **{severity} Alert** | {timestamp}
   ├─ Type: {alarmType}
   ├─ Device: {device.name} (\`{device.ip}\`)
   ├─ Remote: {remote.domain || remote.ip} ({remote.country})
   ├─ Transfer: ↓{download} ↑{upload} Total: {total}
   └─ Status: {status}

Include these key fields:
- Severity level (with appropriate emoji)
- Timestamp (human-readable)
- Alarm type description
- Device name and IP
- Remote destination (domain/IP and country)
- Data transfer amounts (formatted with units)
- Current status

Group alarms by severity or time period if many results.`,
    },
    
    format_flows: {
      description: "How to format network flow information",
      prompt: `When displaying Firewalla network flow information, use this format:

🌐 **{device.name}** → {remote.domain || remote.ip}
   ├─ Direction: {inbound/outbound}
   ├─ Protocol: {protocol} | Ports: {sport}→{dport}
   ├─ Transfer: ↓{download} ↑{upload} Total: {total}
   ├─ Category: {category}
   └─ Time: {timestamp} | Duration: {duration}

Include these key fields:
- Source device name
- Destination (domain preferred over IP)
- Direction and protocol
- Port information
- Data transfer (with proper units)
- Category classification
- Timestamp and duration

Sort by transfer amount or recency by default.`,
    },
    
    format_rules: {
      description: "How to format security rules",
      prompt: `When displaying Firewalla security rules, use this format:

🛡️ **{rule.name}** | Status: {active/paused}
   ├─ Action: {allow/block} {direction} {protocol}
   ├─ Target: {target.type}: {target.value}
   ├─ Scope: {scope.type}: {scope.value} Port: {port}
   └─ Schedule: {schedule info if applicable}

Include these key fields:
- Rule name (bold)
- Current status
- Action, direction, and protocol
- Target specification
- Scope details
- Schedule (if time-limited)

Group by action type (allow/block) if many rules.`,
    },
    
    format_boxes: {
      description: "How to format Firewalla box information",
      prompt: `When displaying Firewalla box information, use this format:

📦 **{box.name}** | Model: {model}
   ├─ Status: {online/offline} | Version: {version}
   ├─ Group: {group.name}
   ├─ Devices: {deviceCount} active
   ├─ Network: {network.name} ({network.subnet})
   └─ Last Sync: {lastSync}

Include these key fields:
- Box name (bold)
- Model type
- Online status and firmware version
- Group membership
- Active device count
- Network configuration
- Last sync time

List boxes in a table format if more than 5.`,
    },
    
    format_statistics: {
      description: "How to format statistics information",
      prompt: `When displaying Firewalla statistics, use this format:

📊 **Statistics Report** | Period: {timeRange}
════════════════════════════════════════

Top Boxes by Security Alarms:
1. 📦 {box.name} - {alarmCount} alarms
   └─ Most common: {topAlarmType}

Top Boxes by Blocked Flows:
1. 🚫 {box.name} - {blockedCount} blocked
   └─ Top blocked: {topBlockedDomain}

Top Regions by Blocked Flows:
1. 🌍 {region} - {blockedCount} blocks
   └─ Top category: {topCategory}

Summary:
- Total Boxes: {boxCount}
- Active Alarms: {activeAlarmCount}
- Total Rules: {ruleCount}
- Blocked Today: {blockedToday}`,
    },
    
    format_target_lists: {
      description: "How to format target lists",
      prompt: `When displaying Firewalla target lists, use this format:

📋 **{list.name}** | Owner: {owner}
   ├─ Category: {category}
   ├─ Entries: {targetCount} items
   ├─ Notes: {notes}
   └─ Targets:
      • {target1}
      • {target2}
      • {target3}
      {... show first 5, then "and X more"}

For multiple lists, show in a summary table:
┌─────────────────┬──────────┬─────────┬────────┐
│ List Name       │ Category │ Entries │ Owner  │
├─────────────────┼──────────┼─────────┼────────┤
│ {name}          │ {cat}    │ {count} │ {owner}│
└─────────────────┴──────────┴─────────┴────────┘`,
    },
    
    format_search_results: {
      description: "How to format global search results",
      prompt: `When displaying search results across multiple types, use this format:

🔍 **Search Results for: "{query}"**
════════════════════════════════════════

📱 Devices ({deviceCount} found):
{format first 3 devices using device format}
{... and X more}

🚨 Alarms ({alarmCount} found):
{format first 3 alarms using alarm format}
{... and X more}

🌐 Flows ({flowCount} found):
{format first 3 flows using flow format}
{... and X more}

📦 Boxes ({boxCount} found):
{format matching boxes}

Summary: {totalCount} total results across {typeCount} categories`,
    },
  };
  
  const guide = formatGuides[name];
  if (!guide) {
    throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
  }
  
  return {
    description: guide.description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: guide.prompt,
        },
      },
    ],
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Firewalla MSP MCP server running");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});