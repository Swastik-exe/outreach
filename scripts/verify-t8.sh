#!/usr/bin/env bash
set -euo pipefail
BASE=http://localhost:8080/api/v1

psql_cmd() {
  docker exec outreach-postgres psql -U outreach -d outreach -t -A -c "$1" 2>/dev/null
}

echo "=== Setup: login as t7test user ==="
psql_cmd "UPDATE users SET is_email_verified=true WHERE email='t7test@example.com';" || true
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"t7test@example.com","password":"TestPass123!"}' \
  -c /tmp/cookies-t8.txt)
ACCESS=$(echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])")
echo "Login OK — token obtained."
echo

echo "=== Reset quota for fresh testing ==="
psql_cmd "DELETE FROM usage_quotas WHERE user_id=(SELECT id FROM users WHERE email='t7test@example.com') AND metric='resume_analyses';" || true
echo "Quota reset."
echo

echo "=== TEST 1: Upload a text PDF (rule-based path) ==="
python3 << 'PYEOF'
content = b"""%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 700 >>
stream
BT /F1 12 Tf 50 750 Td (Jane Doe - Software Engineer) Tj
0 -20 Td (jane@example.com | github.com/janedoe | linkedin.com/in/janedoe) Tj
0 -30 Td (EXPERIENCE) Tj
0 -20 Td (Senior Software Engineer, Acme Corp, 2021-2024) Tj
0 -15 Td (- Built REST API microservices with Java Spring Boot handling 500000 requests daily) Tj
0 -15 Td (- Reduced database query time by 60 percent through SQL indexing) Tj
0 -15 Td (- Led team of 6 engineers, delivering 4 product features on schedule) Tj
0 -15 Td (- Deployed CI/CD pipelines using Docker and Kubernetes on AWS) Tj
0 -30 Td (SKILLS) Tj
0 -15 Td (Java Python SQL Docker Kubernetes AWS Spring Boot REST API Git Agile Microservices) Tj
0 -30 Td (EDUCATION) Tj
0 -15 Td (B.Tech Computer Science, National University, 2021, CGPA 9.0) Tj
0 -30 Td (PROJECTS) Tj
0 -15 Td (Open source contributions - 150 GitHub commits - Java Spring Boot) Tj
ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000001016 00000 n
trailer << /Size 6 /Root 1 0 R >>
startxref
1100
%%EOF"""
with open('/tmp/jane_resume.pdf', 'wb') as f:
    f.write(content)
print("PDF written.")
PYEOF

UPLOAD=$(curl -s -X POST "$BASE/resumes/upload" \
  -H "Authorization: Bearer $ACCESS" \
  -F "file=@/tmp/jane_resume.pdf;type=application/pdf")
echo "UPLOAD: $UPLOAD"
RESUME_ID=$(echo "$UPLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['resumeId'])")
echo "Resume ID: $RESUME_ID"
echo

echo "=== Wait for async analysis (10s) ==="
sleep 10

echo "=== TEST 1 result: GET /resumes/{id} ==="
RESULT=$(curl -s "$BASE/resumes/$RESUME_ID" -H "Authorization: Bearer $ACCESS")
echo "$RESULT" | python3 -c "
import sys,json
d = json.load(sys.stdin).get('data', {})
print(f'  status={d.get(\"analysisStatus\")} source={d.get(\"analysisSource\")}')
print(f'  readiness={d.get(\"readinessScore\")} keyword={d.get(\"keywordScore\")} impact={d.get(\"impactScore\")} formatting={d.get(\"formattingScore\")}')
print(f'  keywordGaps={d.get(\"keywordGaps\",[])}')
import json as j
fixes = j.loads(d.get(\"aiFixes\") or \"[]\")
print(f'  aiFixes={fixes[:3]}...')
"
echo

echo "=== TEST 2: List page shows resume ==="
LIST=$(curl -s "$BASE/resumes" -H "Authorization: Bearer $ACCESS")
COUNT=$(echo "$LIST" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',[])))")
echo "  Resume count in list: $COUNT"
echo

echo "=== TEST 3: Non-PDF rejection ==="
echo "not a pdf" > /tmp/fake.txt
REJECT=$(curl -s -X POST "$BASE/resumes/upload" \
  -H "Authorization: Bearer $ACCESS" \
  -F "file=@/tmp/fake.txt;type=text/plain")
echo "  NON-PDF: $REJECT"
echo

echo "=== TEST 4: Quota enforcement (already used 1 from upload; trigger 2 more, 4th should 429) ==="
for i in 2 3; do
  R=$(curl -s -X POST "$BASE/resumes/$RESUME_ID/analyze" -H "Authorization: Bearer $ACCESS")
  STATUS=$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('success') else 'FAIL: '+str(d.get('error','')))")
  echo "  Attempt $i: $STATUS"
  sleep 1
done
echo "  4th attempt (should be 429):"
QUOTA=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/resumes/$RESUME_ID/analyze" -H "Authorization: Bearer $ACCESS")
echo "  HTTP status: $QUOTA"
echo

echo "=== TEST 5: Frontend pages reachable ==="
for path in "/resume"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$path")
  echo "  GET $path → HTTP $CODE"
done
echo

echo "=== DONE ==="
