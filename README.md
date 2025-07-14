# Firewalla MSP MCP Server

A Model Context Protocol (MCP) server that provides access to the Firewalla Managed Service Provider (MSP) API. This server enables AI assistants and other MCP clients to interact with Firewalla MSP resources including boxes, devices, alarms, rules, flows, and target lists.

## Features

- **Complete API Coverage**: Full CRUD operations for all Firewalla MSP API endpoints
- **Advanced Search**: Global search across devices, alarms, rules, flows, and boxes
- **Analytics & Insights**: Network statistics, historical trends, and performance metrics
- **Security Management**: Create, modify, and monitor security rules and alarms
- **Network Monitoring**: Real-time flow analysis and device tracking
- **Target Lists**: Manage IP/domain allow/block lists
- **Secure Authentication**: API token-based authentication
- **Smart Pagination**: Cursor-based pagination for large datasets
- **Comprehensive Testing**: Extensive test suite with safe read-only validation
- **Type Safety**: Full TypeScript support with complete type definitions
- **Error Handling**: Robust error handling and recovery mechanisms

## Installation

```bash
npm install -g @unknown-sh/firewalla-msp-mcp-server
```

Or install locally in your project:

```bash
npm install @unknown-sh/firewalla-msp-mcp-server
```

## Configuration

### Environment Variables

The server requires two environment variables to be set:

- `FIREWALLA_MSP_API_KEY`: Your Firewalla MSP personal access token
- `FIREWALLA_MSP_DOMAIN`: Your MSP domain (e.g., `your-company.firewalla.net`)

### Getting Your API Credentials

1. Log in to your Firewalla MSP portal
2. Navigate to Account Settings
3. Create a new personal access token
4. Note your MSP domain from the URL

### MCP Client Configuration

#### 1. Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "firewalla-msp": {
      "command": "npx",
      "args": ["@unknown-sh/firewalla-msp-mcp-server"],
      "env": {
        "FIREWALLA_MSP_API_KEY": "your-api-key-here",
        "FIREWALLA_MSP_DOMAIN": "your-domain.firewalla.net"
      }
    }
  }
}
```

#### 2. Claude Code

Add the MCP server using the Claude Code CLI:

```bash
claude mcp add firewalla-msp -e FIREWALLA_MSP_API_KEY=your-api-key-here -e FIREWALLA_MSP_DOMAIN=your-domain.firewalla.net -- npx @unknown-sh/firewalla-msp-mcp-server
```

Or if you have the server installed globally:

```bash
claude mcp add firewalla-msp -e FIREWALLA_MSP_API_KEY=your-api-key-here -e FIREWALLA_MSP_DOMAIN=your-domain.firewalla.net -- firewalla-msp-mcp-server
```

#### 3. Gemini-CLI

Add to `~/.config/gemini-cli/config.json`:

```json
{
  "mcpServers": {
    "firewalla-msp": {
      "command": "npx",
      "args": ["@unknown-sh/firewalla-msp-mcp-server"],
      "env": {
        "FIREWALLA_MSP_API_KEY": "your-api-key-here",
        "FIREWALLA_MSP_DOMAIN": "your-domain.firewalla.net"
      }
    }
  }
}
```

#### 4. Cursor

Add to your Cursor settings file:

**macOS**: `~/Library/Application Support/Cursor/User/globalStorage/cursor-ai.cursor-chat/config/mcp.json`  
**Windows**: `%APPDATA%\Cursor\User\globalStorage\cursor-ai.cursor-chat\config\mcp.json`

```json
{
  "mcpServers": {
    "firewalla-msp": {
      "command": "npx",
      "args": ["@unknown-sh/firewalla-msp-mcp-server"],
      "env": {
        "FIREWALLA_MSP_API_KEY": "your-api-key-here",
        "FIREWALLA_MSP_DOMAIN": "your-domain.firewalla.net"
      }
    }
  }
}
```

#### 5. Windsurf (Codeium)

Add to Windsurf's MCP configuration:

**macOS**: `~/Library/Application Support/Windsurf/mcp.json`  
**Windows**: `%APPDATA%\Windsurf\mcp.json`

```json
{
  "mcpServers": {
    "firewalla-msp": {
      "command": "npx",
      "args": ["@unknown-sh/firewalla-msp-mcp-server"],
      "env": {
        "FIREWALLA_MSP_API_KEY": "your-api-key-here",
        "FIREWALLA_MSP_DOMAIN": "your-domain.firewalla.net"
      }
    }
  }
}
```

#### 6. VS Code (via Continue or other MCP extensions)

For Continue extension, add to `~/.continue/config.json`:

```json
{
  "models": [
    // Your existing models
  ],
  "mcpServers": {
    "firewalla-msp": {
      "command": "npx",
      "args": ["@unknown-sh/firewalla-msp-mcp-server"],
      "env": {
        "FIREWALLA_MSP_API_KEY": "your-api-key-here",
        "FIREWALLA_MSP_DOMAIN": "your-domain.firewalla.net"
      }
    }
  }
}
```

#### Local Installation Alternative

If you prefer to install the server locally instead of using npx:

```bash
npm install -g @unknown-sh/firewalla-msp-mcp-server
```

Then use this configuration (same for all clients):

```json
{
  "mcpServers": {
    "firewalla-msp": {
      "command": "firewalla-msp-mcp-server",
      "args": [],
      "env": {
        "FIREWALLA_MSP_API_KEY": "your-api-key-here",
        "FIREWALLA_MSP_DOMAIN": "your-domain.firewalla.net"
      }
    }
  }
}
```

#### Development Installation

For development or local testing, use absolute paths:

```json
{
  "mcpServers": {
    "firewalla-msp": {
      "command": "node",
      "args": ["/absolute/path/to/firewalla-msp-mcp-server/dist/index.js"],
      "env": {
        "FIREWALLA_MSP_API_KEY": "your-api-key-here",
        "FIREWALLA_MSP_DOMAIN": "your-domain.firewalla.net"
      }
    }
  }
}
```

**Note**: After adding the configuration, restart the respective application for changes to take effect.

## Available Tools

The server provides **26 tools** across **8 API categories** for comprehensive Firewalla MSP management:

### Boxes API

- **list_boxes** - Get all Firewalla boxes in the MSP
  - Optional: `group` - Filter by group ID

### Devices API

- **list_devices** - Get all devices across boxes
  - Optional: `box` - Filter by specific box ID
  - Optional: `group` - Filter by specific box group ID

### Alarms API

- **list_alarms** - Get alarms with optional filtering
  - Optional: `query` - Search query (e.g., 'status:active box:boxId type:9')
  - Optional: `groupBy` - Group results (comma-separated)
  - Optional: `sortBy` - Sort results (e.g., 'ts:desc,total:asc')
  - Optional: `limit` - Max results per page (≤500, default 200)
  - Optional: `cursor` - Pagination cursor

- **get_alarm** - Get a specific alarm
  - Required: `gid` - Box GID
  - Required: `aid` - Alarm ID

- **delete_alarm** - Delete a specific alarm
  - Required: `gid` - Box GID
  - Required: `aid` - Alarm ID

### Rules API

- **list_rules** - Get all rules (requires MSP 2.7.0+)
  - Optional: `query` - Search query (e.g., 'status:active box.id:boxId')

- **create_rule** - Create a new security rule
  - Required: `action` - Rule action: `allow`, `block`, `time_limit`
  - Required: `direction` - Traffic direction: `inbound`, `outbound`, `bidirection`
  - Required: `protocol` - Protocol type: `tcp`, `udp`, `icmp`, `any`
  - Required: `target` - Rule target specification:
    - `type` - Target type: `ip`, `domain`, `category`, `device`, `network`
    - `value` - Target value (IP, domain, etc.)
  - Optional: `name` - Rule name (auto-generated if not provided)
  - Optional: `scope` - Rule scope specification
  - Optional: `schedule` - Rule schedule (for time_limit rules)

- **update_rule** - Update an existing rule
  - Required: `id` - Rule ID
  - Optional: All fields from create_rule
  - Optional: `status` - Rule status: `active`, `paused`

- **delete_rule** - Delete a security rule
  - Required: `id` - Rule ID

- **pause_rule** - Pause a specific rule
  - Required: `id` - Rule ID

- **resume_rule** - Resume a paused rule
  - Required: `id` - Rule ID

### Flows API

- **list_flows** - Get network flows with filtering
  - Optional: `query` - Search query (e.g., 'ts:1234567890-1234567899 box.id:boxId')
  - Optional: `groupBy` - Group results
  - Optional: `sortBy` - Sort results (default: 'ts:desc')
  - Optional: `limit` - Max results per page (≤500, default 200)
  - Optional: `cursor` - Pagination cursor

### Target Lists API

- **list_target_lists** - Get all target lists

- **get_target_list** - Get a specific target list
  - Required: `id` - Target list ID

- **create_target_list** - Create a new target list
  - Required: `name` - Name of the target list
  - Required: `targets` - Array of IP addresses or domains
  - Optional: `owner` - Owner of the target list
  - Optional: `category` - Category of the target list
  - Optional: `notes` - Notes about the target list

- **update_target_list** - Update an existing target list
  - Required: `id` - Target list ID
  - Optional: `name` - Name of the target list
  - Optional: `targets` - Array of IP addresses or domains
  - Optional: `owner` - Owner of the target list
  - Optional: `category` - Category of the target list
  - Optional: `notes` - Notes about the target list

- **delete_target_list** - Delete a target list
  - Required: `id` - Target list ID

### Statistics API

- **get_simple_statistics** - Get overview statistics (boxes, alarms, rules counts)
  - Optional: `group` - Filter by specific box group ID

- **get_statistics** - Get detailed statistics by type
  - Required: `type` - Statistics type:
    - `topBoxesByBlockedFlows` - Top boxes by blocked flows
    - `topBoxesBySecurityAlarms` - Top boxes by security alarms  
    - `topRegionsByBlockedFlows` - Top regions by blocked flows
  - Optional: `group` - Filter by specific box group ID
  - Optional: `limit` - Maximum results (1-50, default: 5)

### Trends API

- **get_trends** - Get historical trend data over time
  - Required: `type` - Trend data type:
    - `flows` - Daily blocked flows trends
    - `alarms` - Daily security alarms trends
    - `rules` - Daily rule creation trends
  - Optional: `group` - Filter by specific box group ID

### Search API

Based on comprehensive API testing, search is supported on 4 out of 8 data model types using Firewalla's advanced query syntax.

#### Supported Search Types
- **Devices** - Full text search and device-specific qualifiers
- **Alarms** - Advanced filtering with alarm-specific qualifiers  
- **Flows** - Comprehensive search with flow-specific qualifiers
- **Boxes** - Basic query support

#### Search Tools

- **search_global** - Search across all searchable entity types
  - Required: `query` - Search query using Firewalla syntax
  - Optional: `types` - Array of entity types: `["devices", "alarms", "flows", "boxes"]`
  - Optional: `limit` - Max results per type (1-500, default: 10)
  - Optional: `cursor` - Pagination cursor for continuing results

- **search_devices** - Search devices with device-specific qualifiers
  - Required: `query` - Search query with qualifiers: `device.name`, `device.id`, `box.id`, `box.name`, `box.group.id`
  - Optional: `limit` - Maximum results (1-500, default: 50)
  - Optional: `cursor` - Pagination cursor

- **search_alarms** - Search alarms with alarm-specific qualifiers
  - Required: `query` - Search query with qualifiers: `ts`, `type`, `status`, `box.id`, `box.name`, `box.group.id`, `device.id`, `device.name`, `remote.category`, `remote.domain`, `remote.region`, `transfer.download`, `transfer.upload`, `transfer.total`
  - Optional: `limit` - Maximum results (1-500, default: 50)
  - Optional: `cursor` - Pagination cursor

- **search_flows** - Search flows with flow-specific qualifiers
  - Required: `query` - Search query with qualifiers: `ts`, `status`, `direction`, `box.id`, `box.name`, `box.group.id`, `device.id`, `device.name`, `category`, `domain`, `region`, `sport`, `dport`, `download`, `upload`, `total`
  - Optional: `limit` - Maximum results (1-500, default: 50)
  - Optional: `cursor` - Pagination cursor

#### Query Syntax

Firewalla search supports advanced query syntax:

**Basic Text Search:**
```
"iPhone"
"MacBook Pro"
apple
```

**Qualified Search:**
```
status:active
device.name:iPhone
box.name:"Gold Plus"
```

**Wildcard Search:**
```
device.name:*iphone*
domain:*.google.com
```

**Numeric Comparisons:**
```
ts:>1720000000
download:>1MB
total:>=500KB
transfer.total:<100MB
```

**Range Search:**
```
ts:1720000000-1720086400
download:100KB-1MB
```

**Combined Queries:**
```
status:active type:1
direction:outbound domain:*google*
device.name:*iphone* ts:>1720000000
```

**Exclusion Search:**
```
-status:resolved
-type:1
```

#### Supported Units
- B (Byte)
- KB (1000 B)  
- MB (1000 KB)
- GB (1000 MB)
- TB (1000 GB)

#### Timestamp Format
Use Unix timestamps (seconds since epoch):
```
ts:>1720000000          # After specific time
ts:1720000000-1720086400 # Time range
```

#### Non-Searchable Types
These endpoints do not support search queries:
- Target Lists (`list_target_lists`)
- Statistics (`get_statistics`, `get_simple_statistics`)
- Trends (`get_trends`)

## Query Syntax

Many endpoints support advanced querying using specific qualifiers:

### Alarm Query Qualifiers
- `ts` - Timestamp
- `type` - Alarm type
- `status` - Alarm status (active/archived)
- `box.id` - Box ID
- `box.name` - Box name
- `device.id` - Device ID
- `device.name` - Device name
- `remote.category` - Remote category
- `remote.domain` - Remote domain
- `transfer.download` - Download amount
- `transfer.upload` - Upload amount
- `transfer.total` - Total transfer

### Flow Query Qualifiers
- `ts` - Timestamp
- `status` - Flow status
- `direction` - Traffic direction
- `box.id` - Box ID
- `box.name` - Box name
- `device.id` - Device ID
- `device.name` - Device name
- `category` - Flow category
- `domain` - Domain
- `region` - Geographic region
- `sport` - Source port
- `dport` - Destination port
- `download` - Download amount
- `upload` - Upload amount
- `total` - Total traffic

### Rule Query Qualifiers
- `status` - Rule status
- `action` - Rule action
- `box.id` - Box ID
- `box.group.id` - Box group ID
- `device.id` - Device ID

## Examples

### Using with Claude Desktop

Once configured, you can ask Claude to interact with your Firewalla MSP:

```
"List all active alarms from the last 24 hours"
"Show me all devices that are currently offline"
"Create a new target list with suspicious IP addresses"
"Pause all rules on box xyz123"
```

### Programmatic Usage

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["@unknown-sh/firewalla-msp-mcp-server"],
  env: {
    FIREWALLA_MSP_API_KEY: "your-api-key",
    FIREWALLA_MSP_DOMAIN: "your-domain.firewalla.net"
  }
});

const client = new Client({
  name: "firewalla-client",
  version: "1.0.0"
}, {
  capabilities: {}
});

await client.connect(transport);

// List all boxes
const result = await client.callTool({
  name: "list_boxes",
  arguments: {}
});

console.log(result);
```

## Testing

The server includes comprehensive test scripts to validate all API functionality:

### Available Test Scripts

All test scripts are located in the `tests/` directory and can be run individually:

```bash
cd tests

# Safe read-only test (recommended first test)
node test-readonly.js

# Search API functionality 
node test-search.js

# Statistics API tests
node test-statistics.js

# Trends API tests  
node test-trends.js

# Rules CRUD operations (modifies your Firewalla)
node test-rules-crud.js

# Basic server connectivity
node test-server.js
```

### Test Descriptions

- **`test-readonly.js`** - Safe read-only operations across all APIs (boxes, devices, alarms, rules, target lists)
- **`test-search.js`** - Global search functionality across all entity types with filtering
- **`test-statistics.js`** - Network statistics including top boxes, regions, and overview data
- **`test-trends.js`** - Historical trend analysis for flows, alarms, and rules
- **`test-rules-crud.js`** - Complete CRUD operations for security rules (use with caution)
- **`test-server.js`** - Basic MCP server connectivity and tool listing

### Test Runner

For convenience, run all safe tests at once:

```bash
cd tests
./run-all-tests.sh
```

This runs all read-only tests in sequence and provides a comprehensive validation of the MCP server functionality.

### Safety Notes

⚠️ **Important**: 
- Start with `test-readonly.js` to verify your setup safely
- `test-rules-crud.js` modifies your Firewalla configuration - use carefully
- All other tests are read-only and safe to run
- The test runner (`run-all-tests.sh`) excludes write operations for safety

## Development

To run the server in development mode:

```bash
# Clone the repository
git clone https://github.com/your-username/firewalla-msp-mcp-server.git
cd firewalla-msp-mcp-server

# Install dependencies
npm install

# Set environment variables
export FIREWALLA_MSP_API_KEY="your-api-key"
export FIREWALLA_MSP_DOMAIN="your-domain.firewalla.net"

# Run in development mode
npm run dev

# Build the project
npm run build

# Run tests
npm test
```

## Security Considerations

- Never commit your API key to version control
- Use environment variables or secure credential management
- The API key provides full access to your MSP account - keep it secure
- Consider using read-only tokens if you only need to query data

## Error Handling

The server provides detailed error messages for common issues:

- `401 Unauthorized` - Check your API key
- `404 Not Found` - Resource doesn't exist
- `400 Bad Request` - Invalid parameters or query syntax

## License

GNU General Public License v3.0

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See the [LICENSE](LICENSE) file for the full license text.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

When contributing:
1. Ensure all tests pass (`cd tests && ./run-all-tests.sh`)
2. Add tests for new functionality
3. Update documentation
4. Follow existing code style

## Support

For issues related to:
- **This MCP server**: Open an issue on [GitHub](https://github.com/unknown-sh/firewalla-msp-mcp-server)
- **Firewalla MSP API**: Contact help@firewalla.com
- **MCP protocol**: See the [MCP documentation](https://modelcontextprotocol.io)

## Disclaimer

This is an **independent, open-source** MCP server implementation for the Firewalla MSP API. 

**Important**: This project is:
- ✅ **Independent**: Created and maintained by the open-source community
- ✅ **Unofficial**: Not affiliated with, endorsed by, or developed by Firewalla Inc.
- ✅ **Open Source**: Licensed under GNU GPL v3.0
- ✅ **Community-Driven**: Contributions and feedback welcome

**Firewalla®** is a trademark of Firewalla Inc. The use of this trademark in this project is purely for descriptive purposes to indicate compatibility and does not imply any official relationship or endorsement.