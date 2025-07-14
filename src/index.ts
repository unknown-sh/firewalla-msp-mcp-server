#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
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
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

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
        description: "Get all devices across boxes",
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
        description: "Search devices using Firewalla query syntax with device-specific qualifiers",
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
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
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
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
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
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      }

      case "get_alarm": {
        const response = await httpClient.get(`/alarms/${args.gid}/${args.aid}`);
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
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
        
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
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
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
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
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
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
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      }

      // Target Lists API
      case "list_target_lists": {
        const response = await httpClient.get("/target-lists");
        // Handle both array and object responses
        const data = Array.isArray(response.data) 
          ? { count: response.data.length, results: response.data }
          : response.data;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_target_list": {
        const response = await httpClient.get(`/target-lists/${args.id}`);
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
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
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      }

      case "update_target_list": {
        const body: any = {};
        if (args.name) body.name = args.name;
        if (args.targets) body.targets = args.targets;
        if (args.owner) body.owner = args.owner;
        if (args.category) body.category = args.category;
        if (args.notes) body.notes = args.notes;
        
        const response = await httpClient.patch(`/target-lists/${args.id}`, body);
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
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
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_simple_statistics": {
        const params: any = {};
        if (args.group) params.group = args.group;
        
        const response = await httpClient.get("/stats/simple", { params });
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
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
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
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

        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }

      case "search_devices": {
        const params: any = {
          query: args.query,
          limit: args.limit || 50
        };
        if (args.cursor) params.cursor = args.cursor;

        const response = await httpClient.get("/devices", { params });
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      }

      case "search_alarms": {
        const params: any = {
          query: args.query,
          limit: args.limit || 50
        };
        if (args.cursor) params.cursor = args.cursor;

        const response = await httpClient.get("/alarms", { params });
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      }

      case "search_flows": {
        const params: any = {
          query: args.query,
          limit: args.limit || 50
        };
        if (args.cursor) params.cursor = args.cursor;

        const response = await httpClient.get("/flows", { params });
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
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