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

      // Search API
      {
        name: "search_global",
        description: "Perform global search across all entities (devices, alarms, rules, flows)",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query string",
            },
            types: {
              type: "array",
              items: {
                type: "string",
                enum: ["devices", "alarms", "rules", "flows", "boxes"],
              },
              description: "Entity types to search in (optional, searches all if not specified)",
            },
            limit: {
              type: "number",
              description: "Maximum number of results per entity type (default: 10, max: 100)",
              minimum: 1,
              maximum: 100,
            },
            group: {
              type: "string",
              description: "Filter by specific box group ID (optional)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_devices",
        description: "Search for devices by name, MAC address, or IP",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (device name, MAC, IP, etc.)",
            },
            box: {
              type: "string",
              description: "Filter by specific box ID (optional)",
            },
            group: {
              type: "string",
              description: "Filter by specific box group ID (optional)",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 50, max: 200)",
              minimum: 1,
              maximum: 200,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_alarms",
        description: "Search for alarms by type, message, or properties",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (alarm message, type, etc.)",
            },
            status: {
              type: "string",
              enum: ["active", "resolved", "all"],
              description: "Filter by alarm status (default: all)",
            },
            type: {
              type: "string",
              description: "Filter by specific alarm type",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 50, max: 200)",
              minimum: 1,
              maximum: 200,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_flows",
        description: "Search for network flows by destination, port, or protocol",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (destination, port, protocol, etc.)",
            },
            protocol: {
              type: "string",
              enum: ["tcp", "udp", "icmp", "any"],
              description: "Filter by protocol type (optional)",
            },
            direction: {
              type: "string",
              enum: ["inbound", "outbound", "bidirection"],
              description: "Filter by flow direction (optional)",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 50, max: 200)",
              minimum: 1,
              maximum: 200,
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
        const searchTypes: string[] = (args.types as string[]) || ["devices", "alarms", "rules", "flows", "boxes"];
        const limit = args.limit || 10;
        const results: any = {
          query: args.query,
          results: {},
          total_count: 0
        };

        // Search across all specified entity types
        for (const entityType of searchTypes) {
          try {
            const params: any = {
              query: args.query,
              limit: limit
            };
            if (args.group) params.group = args.group;

            let endpoint = "";
            switch (entityType) {
              case "devices":
                endpoint = "/devices";
                break;
              case "alarms":
                endpoint = "/alarms";
                break;
              case "rules":
                endpoint = "/rules";
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
            const data = Array.isArray(response.data) 
              ? { count: response.data.length, results: response.data }
              : response.data;
            
            results.results[entityType] = data.results || data;
            results.total_count += (data.count || (Array.isArray(data.results) ? data.results.length : 0));
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
        if (args.box) params.box = args.box;
        if (args.group) params.group = args.group;

        const response = await httpClient.get("/devices", { params });
        // Handle both array and object responses
        const data = Array.isArray(response.data) 
          ? { count: response.data.length, results: response.data }
          : response.data;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "search_alarms": {
        const params: any = {
          query: args.query,
          limit: args.limit || 50
        };
        if (args.status && args.status !== "all") {
          params.query += ` status:${args.status}`;
        }
        if (args.type) {
          params.query += ` type:${args.type}`;
        }

        const response = await httpClient.get("/alarms", { params });
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      }

      case "search_flows": {
        const params: any = {
          query: args.query,
          limit: args.limit || 50
        };
        if (args.protocol && args.protocol !== "any") {
          params.query += ` protocol:${args.protocol}`;
        }
        if (args.direction) {
          params.query += ` direction:${args.direction}`;
        }

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