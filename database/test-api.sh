#!/bin/bash

API_URL="http://localhost:4000/api"
echo "🧪 Testing Tool Schema API Endpoints"
echo "===================================="

# Test 1: Create a tool
echo -e "\n📝 Test 1: POST /api/tools (Create)"
RESPONSE=$(curl -s -X POST "$API_URL/tools" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "api_test_tool",
    "description": "A test tool created via API",
    "schema": {
      "type": "object",
      "properties": {
        "input": {"type": "string"}
      }
    }
  }')
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
TOOL_ID=$(echo "$RESPONSE" | grep -o '"_id":"[^"]*' | cut -d'"' -f4)
echo "Tool ID: $TOOL_ID"

# Test 2: Get all tools
echo -e "\n📋 Test 2: GET /api/tools (List all)"
curl -s "$API_URL/tools" | python3 -m json.tool 2>/dev/null || curl -s "$API_URL/tools"

# Test 3: Get specific tool
echo -e "\n🔍 Test 3: GET /api/tools/:id (Get by ID)"
curl -s "$API_URL/tools/$TOOL_ID" | python3 -m json.tool 2>/dev/null || curl -s "$API_URL/tools/$TOOL_ID"

# Test 4: Update tool
echo -e "\n✏️  Test 4: PUT /api/tools/:id (Update)"
curl -s -X PUT "$API_URL/tools/$TOOL_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "api_test_tool",
    "description": "Updated description via API",
    "schema": {
      "type": "object",
      "properties": {
        "input": {"type": "string"},
        "output": {"type": "string"}
      }
    }
  }' | python3 -m json.tool 2>/dev/null

# Test 5: Delete tool
echo -e "\n🗑️  Test 5: DELETE /api/tools/:id (Delete)"
curl -s -X DELETE "$API_URL/tools/$TOOL_ID" | python3 -m json.tool 2>/dev/null

echo -e "\n✨ API tests complete!"
