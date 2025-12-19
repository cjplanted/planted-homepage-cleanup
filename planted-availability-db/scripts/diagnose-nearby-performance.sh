#!/bin/bash
# T028 - Locator Performance Diagnostic Script
# Tests the /nearby API performance with and without slim mode

API_URL="https://europe-west6-get-planted-db.cloudfunctions.net/nearby"
LAT="47.3769"
LNG="8.5417"

echo "=============================================="
echo "T028: Locator /nearby API Performance Test"
echo "=============================================="
echo ""
echo "Test Location: Zurich ($LAT, $LNG)"
echo "Date: $(date)"
echo ""

# Function to run performance test
run_test() {
  local name=$1
  local url=$2
  local runs=3

  echo "--- $name ---"

  local total_time=0
  local total_size=0

  for i in $(seq 1 $runs); do
    result=$(curl -s -w "\n%{time_total}|%{size_download}" "$url" -o /tmp/nearby_test.json 2>/dev/null)
    time=$(echo "$result" | tail -1 | cut -d'|' -f1)
    size=$(echo "$result" | tail -1 | cut -d'|' -f2)

    # Extract X-Cache header if present
    cache=$(curl -sI "$url" 2>/dev/null | grep -i "X-Cache" | tr -d '\r')

    echo "  Run $i: ${time}s, ${size} bytes $cache"

    total_time=$(echo "$total_time + $time" | bc)
    total_size=$size
  done

  avg_time=$(echo "scale=3; $total_time / $runs" | bc)
  echo "  Average: ${avg_time}s, Payload: ${total_size} bytes"
  echo ""
}

echo "1. WARM UP CALL (ignore timing - may include cold start)"
echo "----------------------------------------"
curl -s -o /dev/null "$API_URL?lat=$LAT&lng=$LNG&radius_km=10&limit=20"
echo "  Warmup complete"
echo ""

echo "2. FULL RESPONSE (slim=false, backwards compatible)"
echo "----------------------------------------"
run_test "Full Response" "$API_URL?lat=$LAT&lng=$LNG&radius_km=10&type=restaurant&limit=20"

echo "3. SLIM RESPONSE (slim=true, optimized for locator)"
echo "----------------------------------------"
run_test "Slim Response" "$API_URL?lat=$LAT&lng=$LNG&radius_km=10&type=restaurant&limit=20&slim=true"

echo "4. CACHE TEST (same request twice)"
echo "----------------------------------------"
echo "  First request (should be MISS):"
curl -w "  Time: %{time_total}s\n" -s -o /dev/null "$API_URL?lat=$LAT&lng=$LNG&radius_km=10&type=restaurant&limit=5&slim=true"

echo "  Second request (should be HIT):"
curl -w "  Time: %{time_total}s\n" -s -o /dev/null "$API_URL?lat=$LAT&lng=$LNG&radius_km=10&type=restaurant&limit=5&slim=true"
echo ""

echo "5. RESPONSE STRUCTURE COMPARISON"
echo "----------------------------------------"
echo "  Full response fields:"
curl -s "$API_URL?lat=$LAT&lng=$LNG&radius_km=10&type=restaurant&limit=1" | node -e "
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const d = JSON.parse(Buffer.concat(chunks).toString());
  if (d.results[0]) {
    console.log('    Venue fields:', Object.keys(d.results[0].venue).length);
    console.log('    Dish fields:', d.results[0].dishes[0] ? Object.keys(d.results[0].dishes[0]).length : 0);
  }
});
"

echo "  Slim response fields:"
curl -s "$API_URL?lat=$LAT&lng=$LNG&radius_km=10&type=restaurant&limit=1&slim=true" | node -e "
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const d = JSON.parse(Buffer.concat(chunks).toString());
  if (d.results[0]) {
    console.log('    Venue fields:', Object.keys(d.results[0].venue).length);
    console.log('    Dish fields:', d.results[0].dishes[0] ? Object.keys(d.results[0].dishes[0]).length : 0);
  }
});
"

echo ""
echo "=============================================="
echo "Test Complete"
echo "=============================================="
