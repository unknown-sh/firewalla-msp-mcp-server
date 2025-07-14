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
    version: "1.1.0",
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
        
        // Format the response with rich information
        let formattedOutput = "# Firewalla Devices\n\n";
        
        const devices = data.results || data;
        
        if (devices.length === 0) {
          formattedOutput += "No devices found.\n";
        } else {
          // Create a markdown table for better formatting
          formattedOutput += "| 📱 Device Name | IP Address | MAC Address | Type | Status | Box | Last Seen |\n";
          formattedOutput += "|----------------|------------|-------------|------|--------|-----|------------|\n";
          
          devices.forEach((device: any) => {
            const deviceName = device.name || 'Unknown Device';
            const deviceIp = device.ipAddress || device.ip || 'N/A';
            const deviceMac = device.mac || 'N/A';
            const deviceType = device.type || 'Unknown';
            const deviceStatus = device.online ? '🟢 Online' : '🔴 Offline';
            const boxName = device.box?.name || device.boxName || 'N/A';
            const lastSeen = device.lastActiveTime ? new Date(device.lastActiveTime * 1000).toLocaleString() : 'N/A';
            
            formattedOutput += `| **${deviceName}** | \`${deviceIp}\` | \`${deviceMac}\` | ${deviceType} | ${deviceStatus} | ${boxName} | ${lastSeen} |\n`;
          });
        }
        
        formattedOutput += `\n---\n**Total Devices**: ${devices.length}\n`;
        
        return { content: [{ type: "text", text: formatAsXML(data, "list_devices", { 
          count: devices.length,
          formatted_summary: formattedOutput 
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
        
        // Format the response with rich information
        let formattedOutput = "# Firewalla Alarms\n\n";
        
        const alarms = data.results || [];
        
        if (alarms.length === 0) {
          formattedOutput += "No alarms found.\n";
        } else {
          // Create a markdown table for better formatting
          formattedOutput += "| 🚨 Severity | Time | Type | Device | Remote | Transfer | Status |\n";
          formattedOutput += "|-------------|------|------|---------|---------|----------|--------|\n";
          
          alarms.forEach((alarm: any) => {
            const severity = alarm.severity || (alarm.type <= 2 ? 'High' : alarm.type <= 5 ? 'Medium' : 'Low');
            const timestamp = alarm.ts ? new Date(alarm.ts * 1000).toLocaleString() : 'N/A';
            const deviceName = alarm.device?.name || 'Unknown';
            const deviceIp = alarm.device?.ip || alarm.device?.ipAddress || 'N/A';
            const remoteDomain = alarm.remote?.domain || alarm.remote?.ip || 'N/A';
            const remoteCountry = alarm.remote?.country || 'Unknown';
            const download = formatBytes(alarm.transfer?.download);
            const upload = formatBytes(alarm.transfer?.upload);
            const total = formatBytes(alarm.transfer?.total);
            const status = alarm.status || 'active';
            
            formattedOutput += `| **${severity}** | ${timestamp} | ${alarm.alarmType || `Type ${alarm.type}`} | ${deviceName}<br>\`${deviceIp}\` | ${remoteDomain}<br>${remoteCountry} | ↓${download}<br>↑${upload}<br>Total: ${total} | ${status} |\n`;
          });
        }
        
        formattedOutput += `\n---\n**Total Alarms**: ${alarms.length}\n`;
        if (data.next_cursor) {
          formattedOutput += `**More results available** - cursor: ${data.next_cursor}\n`;
        }
        
        return { content: [{ type: "text", text: formatAsXML(data, "list_alarms", { 
          count: alarms.length,
          has_more: !!data.next_cursor,
          next_cursor: data.next_cursor || null,
          formatted_summary: formattedOutput 
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
        
        return { content: [{ type: "text", text: formatAsXML(data, "list_rules", { 
          count: data.count || data.results?.length || 0,
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
        return { content: [{ type: "text", text: formatAsXML(response.data, "list_flows", { 
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
        return { content: [{ type: "text", text: formatAsXML(data, "list_target_lists", { 
          count: data.count || data.results?.length || 0 
        }) }] };
      }

      case "get_target_list": {
        const response = await httpClient.get(`/target-lists/${args.id}`);
        return { content: [{ type: "text", text: formatAsXML(response.data, "get_target_list", { 
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
        return { content: [{ type: "text", text: formatAsXML(response.data, "create_target_list", { 
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
        return { content: [{ type: "text", text: formatAsXML(data, "get_statistics", { 
          stats_type: args.type,
          group: args.group || null,
          limit: args.limit || null,
          count: data.count || data.results?.length || 0 
        }) }] };
      }

      case "get_simple_statistics": {
        const params: any = {};
        if (args.group) params.group = args.group;
        
        const response = await httpClient.get("/stats/simple", { params });
        return { content: [{ type: "text", text: formatAsXML(response.data, "get_simple_statistics", { 
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
        return { content: [{ type: "text", text: formatAsXML(data, "get_trends", { 
          trend_type: args.type,
          group: args.group || null,
          count: data.count || data.results?.length || 0 
        }) }] };
      }

      // Search API
      case "search_global": {
        const searchTypes: string[] = (args.types as string[]) || ["devices", "alarms", "flows", "boxes"];
        const limit = args.limit || 10;
        const results: any = {
          query: args.query,
          results: {},
          total_count: 0
        };

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
              results.results[entityType] = {
                results: data.results,
                count: data.count || data.results.length,
                next_cursor: data.next_cursor
              };
            } else if (Array.isArray(data)) {
              results.results[entityType] = {
                results: data,
                count: data.length
              };
            } else {
              results.results[entityType] = {
                results: [data],
                count: 1
              };
            }
            
            results.total_count += results.results[entityType].count;
          } catch (error) {
            // Continue with other entity types if one fails
            results.results[entityType] = { error: `Failed to search ${entityType}` };
          }
        }

        return { content: [{ type: "text", text: formatAsXML(results, "search_global", { 
          query: args.query,
          search_types: searchTypes,
          limit: limit,
          total_count: results.total_count 
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
        
        // Format the response with rich information
        let formattedOutput = `# Device Search Results for: "${args.query}"\n\n`;
        formattedOutput += "**IMPORTANT**: When displaying these devices to the user, use this EXACT format:\n\n";
        
        const devices = data.results || [];
        devices.forEach((device: any, index: number) => {
          const deviceName = device.name || 'Unknown Device';
          const deviceIp = device.ipAddress || device.ip || 'N/A';
          const deviceMac = device.mac || 'N/A';
          const deviceType = device.type || 'Unknown';
          const deviceStatus = device.online ? 'Online' : 'Offline';
          const boxName = device.box?.name || device.boxName || 'N/A';
          const lastSeen = device.lastActiveTime ? new Date(device.lastActiveTime * 1000).toLocaleString() : 'N/A';
          
          formattedOutput += `\n📱 **${deviceName}**\n`;
          formattedOutput += `**IP Address:** \`${deviceIp}\`\n`;
          formattedOutput += `**MAC Address:** \`${deviceMac}\`\n`;
          formattedOutput += `**Type:** ${deviceType}\n`;
          formattedOutput += `**Status:** ${deviceStatus}\n`;
          formattedOutput += `**Box:** ${boxName}\n`;
          formattedOutput += `**Last Seen:** ${lastSeen}\n`;
          formattedOutput += `${'─'.repeat(60)}\n`;
        });
        
        formattedOutput += `\n---\n**Found**: ${devices.length} devices\n`;
        if (data.next_cursor) {
          formattedOutput += `**More results available** - cursor: ${data.next_cursor}\n`;
        }
        
        return { content: [{ type: "text", text: formatAsXML(data, "search_devices", { 
          query: args.query,
          limit: args.limit || 50,
          count: devices.length,
          has_more: !!data.next_cursor,
          next_cursor: data.next_cursor || null,
          formatted_summary: formattedOutput 
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
        const alarms = data.results || [];
        
        return { content: [{ type: "text", text: formatAsXML(data, "search_alarms", { 
          query: args.query,
          limit: args.limit || 50,
          count: alarms.length,
          has_more: !!data.next_cursor,
          next_cursor: data.next_cursor || null
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