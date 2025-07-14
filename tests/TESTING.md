# Testing Guide for Firewalla MSP MCP Server

This document explains how to test the Firewalla MSP MCP Server functionality and validate your setup.

## Test Structure

All test scripts are located in the `tests/` directory and can be run individually or as a suite.

## Available Test Scripts

### 1. Read-Only Tests (Safe)

#### `test-readonly.js` ⭐ **Start Here**
**Purpose**: Comprehensive read-only validation of all core APIs
**Safety**: ✅ Completely safe - no modifications to your Firewalla

**What it tests**:
- Firewalla boxes listing
- Connected devices inventory
- Active alarms checking
- Security rules listing
- Target lists enumeration

```bash
cd tests
node test-readonly.js
```

#### `test-server.js`
**Purpose**: Basic MCP server connectivity and tool discovery
**Safety**: ✅ Safe - only tests server startup and tool listing

**What it tests**:
- Server startup process
- MCP protocol compliance
- Tool availability via JSON-RPC

```bash
cd tests
node test-server.js
```

### 2. Search Functionality Tests

#### `test-search.js`
**Purpose**: Comprehensive search API validation
**Safety**: ✅ Safe - read-only search operations

**What it tests**:
- Global search across all entity types
- Device-specific search (by name, MAC, IP)
- Alarm search with status filtering
- Flow search with protocol filtering
- Targeted search by entity type

```bash
cd tests
node test-search.js
```

### 3. Analytics and Statistics Tests

#### `test-statistics.js`
**Purpose**: Network statistics and analytics APIs
**Safety**: ✅ Safe - read-only statistics

**What it tests**:
- Simple overview statistics (boxes, alarms, rules counts)
- Top boxes by blocked flows
- Top boxes by security alarms
- Top regions by blocked flows
- Statistical filtering and limiting

```bash
cd tests
node test-statistics.js
```

#### `test-trends.js`
**Purpose**: Historical trend analysis capabilities
**Safety**: ✅ Safe - read-only trend data

**What it tests**:
- Daily blocked flows trends
- Security alarms trends over time
- Rule creation trends
- Trend analysis and peak detection
- Time-series data visualization

```bash
cd tests
node test-trends.js
```

### 4. Write Operations (Use with Caution)

#### `test-rules-crud.js` ⚠️
**Purpose**: Complete CRUD operations for security rules
**Safety**: ⚠️ **CAUTION** - Modifies your Firewalla configuration

**What it tests**:
- Rule creation with various configurations
- Rule modification and updates
- Rule pause/resume operations
- Rule deletion
- Safe test cleanup

```bash
cd tests
node test-rules-crud.js
```

**Important**: This test creates and deletes test rules. Only run this when you understand the implications.

## Test Runner

### Automated Test Suite

Run all safe tests at once:

```bash
cd tests
./run-all-tests.sh
```

**What the test runner does**:
1. ✅ Checks for .env file
2. ✅ Tests basic server connectivity
3. ✅ Runs comprehensive read-only validation
4. ✅ Tests search functionality
5. ✅ Validates statistics APIs
6. ✅ Tests trends analysis
7. ✅ Provides summary and next steps

**Note**: The test runner excludes write operations for safety.

## Prerequisites

### Environment Setup

1. **Create .env file** (in project root, not tests/ directory):
```bash
FIREWALLA_MSP_API_KEY=your-api-key-here
FIREWALLA_MSP_DOMAIN=your-domain.firewalla.net
```

2. **Build the server**:
```bash
npm run build
```

3. **Verify setup**:
```bash
cd tests
node test-server.js
```

### API Requirements

- Firewalla MSP account with API access
- Valid API key and domain
- MSP version 2.7.0+ (for full Rules API support)

## Test Output Examples

### Successful Read-Only Test
```
🔒 SAFE READ-ONLY TEST - No modifications will be made to your Firewalla

✅ Connected to Firewalla MSP MCP Server

📦 TEST 1: Listing Firewalla Boxes (READ ONLY)
Found 1 Firewalla box(es):
  • Firewalla (goldpro)
    Status: 🟢 Online
    Mode: router
    Version: 1.98
```

### Search Test Results
```
🔍 Search API Test - Global search functionality

🌐 TEST 1: Global Search - All Entity Types
Search query: "apple"
Total matches: 97

Results by entity type:
  devices: ✅ 86 matches
  alarms: ✅ 5 matches
  flows: ✅ 5 matches
```

## Troubleshooting

### Common Issues

#### 1. "Missing .env file"
**Solution**: Create .env file in project root (not tests/ directory)
```bash
cd ..  # Go back to project root
cp .env.example .env
# Edit .env with your credentials
```

#### 2. "Authentication failed"
**Solution**: Verify your API key and domain in .env
- Check API key is correct
- Ensure domain includes full address: `yourname.firewalla.net`

#### 3. "Cannot find module '../dist/index.js'"
**Solution**: Build the project first
```bash
cd ..  # Go back to project root
npm run build
cd tests
```

#### 4. "No devices found" or empty results
This is normal if:
- Your Firewalla network is quiet
- Search terms don't match your devices
- All devices are offline

## Integration Testing

### Claude Desktop Integration
1. Configure MCP server in Claude Desktop
2. Verify tools appear in Claude's interface
3. Test actual queries through Claude

### Other MCP Clients
- Cline/VS Code
- Cursor
- Gemini-CLI

## Test Coverage

### API Coverage
- ✅ **Boxes API** - Full read operations
- ✅ **Devices API** - Full read operations  
- ✅ **Alarms API** - Read and delete operations
- ✅ **Rules API** - Full CRUD operations
- ✅ **Flows API** - Read operations with filtering
- ✅ **Target Lists API** - Full CRUD operations
- ✅ **Statistics API** - All statistics types
- ✅ **Trends API** - All trend types
- ✅ **Search API** - All search types

### Safety Coverage
- ✅ Read-only operations thoroughly tested
- ✅ Write operations available but separated
- ✅ Clear safety warnings and documentation
- ✅ Test cleanup procedures

## Development Testing

When adding new features:

1. **Add test file**: Create `test-newfeature.js`
2. **Update test runner**: Add to `run-all-tests.sh` if safe
3. **Update documentation**: Add description here
4. **Verify safety**: Mark clearly if write operations

## Success Criteria

Tests are successful when:
- ✅ Read-only tests show your actual Firewalla data
- ✅ Search returns relevant results
- ✅ Statistics show real network data
- ✅ No authentication errors
- ✅ All tool calls return properly formatted responses

The testing framework ensures the MCP server correctly integrates with your Firewalla MSP environment while maintaining safety through clear separation of read and write operations.