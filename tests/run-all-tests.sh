#!/bin/bash

# Firewalla MSP MCP Server Test Runner
# Runs all available tests in order of safety (read-only first)

echo "🧪 Firewalla MSP MCP Server Test Suite"
echo "======================================"
echo ""

# Check for .env file
if [ ! -f "../.env" ]; then
    echo "❌ Missing .env file in parent directory"
    echo "Please copy .env.example to .env and add your credentials"
    exit 1
fi

echo "🔧 Environment check passed"
echo ""

# Test 1: Basic connectivity
echo "1️⃣  Testing basic server connectivity..."
node test-server.js
if [ $? -ne 0 ]; then
    echo "❌ Server connectivity test failed"
    exit 1
fi
echo ""

# Test 2: Safe read-only operations
echo "2️⃣  Testing read-only operations (SAFE)..."
node test-readonly.js
if [ $? -ne 0 ]; then
    echo "❌ Read-only test failed"
    exit 1
fi
echo ""

# Test 3: Search functionality
echo "3️⃣  Testing search functionality..."
node test-search.js
if [ $? -ne 0 ]; then
    echo "❌ Search test failed"
    exit 1
fi
echo ""

# Test 4: Statistics API
echo "4️⃣  Testing statistics API..."
node test-statistics.js
if [ $? -ne 0 ]; then
    echo "❌ Statistics test failed"
    exit 1
fi
echo ""

# Test 5: Trends API
echo "5️⃣  Testing trends API..."
node test-trends.js
if [ $? -ne 0 ]; then
    echo "❌ Trends test failed"
    exit 1
fi
echo ""

echo "✅ All read-only tests completed successfully!"
echo ""
echo "⚠️  To test write operations (Rules CRUD), run:"
echo "   node test-rules-crud.js"
echo ""
echo "   WARNING: This will modify your Firewalla configuration!"
echo ""
echo "🎉 Test suite completed successfully!"