#!/usr/bin/env bash
set -euo pipefail
BASE=http://localhost:8080/api/v1

echo "=== Setup: login ==="
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"t7test@example.com","password":"TestPass123!"}' \
  -c /tmp/c-t8b.txt)
ACCESS=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
echo "Login OK"

echo ""
echo "=== Image-only PDF (< 100 chars extracted) ==="
python3 -c "
content = b'''%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer << /Size 4 /Root 1 0 R >>
startxref
190
%%EOF'''
with open('/tmp/image_only.pdf', 'wb') as f:
    f.write(content)
print('image-only PDF written.')
"

IMG=$(curl -s -X POST "$BASE/resumes/upload" \
  -H "Authorization: Bearer $ACCESS" \
  -F "file=@/tmp/image_only.pdf;type=application/pdf")
echo "Upload response: $IMG"
IMG_ID=$(echo "$IMG" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('resumeId','N/A'))")
echo "Resume ID: $IMG_ID"

sleep 6
echo ""
echo "=== Status after 6s ==="
RESULT=$(curl -s "$BASE/resumes/$IMG_ID" -H "Authorization: Bearer $ACCESS")
echo "$RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{})
print(f'  status={d.get(\"analysisStatus\")}  score={d.get(\"readinessScore\")}  active={d.get(\"active\")}')
"

echo ""
echo "=== Frontend /resume route check ==="
for path in /resume "/resume/$IMG_ID"; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000$path")
  echo "  GET $path -> HTTP $CODE"
done

echo ""
echo "=== All verification complete ==="
