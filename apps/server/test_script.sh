#!/bin/bash

# Try different selectors for the 조직/관리 menu
echo "Trying to click 조직/관리 menu..."

# Try text selector
curl -X POST http://localhost:4820/internal/pw/7NnKRL1C9ojk-ss_IpE5y \
  -H "Content-Type: application/json" \
  -d '{"action":"click","selector":"text=조직/관리"}'

echo "First attempt done."