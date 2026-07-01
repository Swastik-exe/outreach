#!/usr/bin/env bash
set -euo pipefail
BASE=http://localhost:8080/api/v1

psql_cmd() {
  docker exec outreach-postgres psql -U outreach -d outreach -t -A -c "$1" 2>/dev/null
}

echo "=== 1. Register test user ==="
curl -s -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"name":"T7 Tester","email":"t7test@example.com","password":"TestPass123!"}' || true
echo

echo "=== 2. Force-verify email via DB ==="
psql_cmd "UPDATE users SET is_email_verified=true WHERE email='t7test@example.com';"

echo "=== 3. Login ==="
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"t7test@example.com","password":"TestPass123!"}' \
  -c /tmp/cookies.txt)
echo "$LOGIN"
ACCESS=$(echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])")
echo "AccessToken obtained."
echo

echo "=== 4. Create minimal text PDF ==="
python3 << 'PYEOF'
content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 600 >>
stream
BT /F1 12 Tf 50 750 Td (John Smith - Software Engineer) Tj
0 -20 Td (john@example.com | linkedin.com/in/jsmith | github.com/jsmith) Tj
0 -30 Td (EXPERIENCE) Tj
0 -20 Td (Senior Software Engineer at Tech Corp 2020-2024) Tj
0 -15 Td (- Developed microservices using Java and Spring Boot reducing latency by 40%) Tj
0 -15 Td (- Led team of 5 engineers delivering 3 product launches serving 100000 users) Tj
0 -15 Td (- Built CI/CD pipelines with Docker and Kubernetes) Tj
0 -30 Td (SKILLS) Tj
0 -15 Td (Java Python SQL Docker Kubernetes Spring Boot REST API Git Agile Microservices) Tj
0 -30 Td (EDUCATION) Tj
0 -15 Td (B.Tech Computer Science State University 2020 CGPA 8.5) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000916 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
1000
%%EOF"""
with open('/tmp/test_resume.pdf', 'wb') as f:
    f.write(content)
print("PDF created at /tmp/test_resume.pdf")
PYEOF

echo "=== 5. Upload PDF ==="
UPLOAD=$(curl -s -X POST "$BASE/resumes/upload" \
  -H "Authorization: Bearer $ACCESS" \
  -F "file=@/tmp/test_resume.pdf;type=application/pdf")
echo "UPLOAD: $UPLOAD"
RESUME_ID=$(echo "$UPLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['resumeId'])")
echo "Resume ID: $RESUME_ID"
echo

echo "=== 6. Wait for async analysis (8s) then check status ==="
sleep 8
STATUS=$(curl -s "$BASE/resumes/$RESUME_ID/status" -H "Authorization: Bearer $ACCESS")
echo "STATUS: $STATUS"
echo

echo "=== 7. Full resume details (should have scores) ==="
curl -s "$BASE/resumes/$RESUME_ID" -H "Authorization: Bearer $ACCESS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d.get('data', {})
print(f'  readiness={r.get(\"readinessScore\")} keyword={r.get(\"keywordScore\")} impact={r.get(\"impactScore\")} formatting={r.get(\"formattingScore\")}')
print(f'  source={r.get(\"analysisSource\")} status={r.get(\"analysisStatus\")}')
print(f'  keywordGaps={r.get(\"keywordGaps\", [])}')
"
echo

echo "=== 8. Reject non-PDF ==="
echo "not a pdf" > /tmp/notapdf.txt
REJECT=$(curl -s -X POST "$BASE/resumes/upload" \
  -H "Authorization: Bearer $ACCESS" \
  -F "file=@/tmp/notapdf.txt;type=text/plain")
echo "NON-PDF: $REJECT"
echo

echo "=== 9. Quota rejection test (upload 1 consumed 1 of 3 quota) ==="
echo "=== Triggering 2 more on-demand analyses (total will be 3, at limit) ==="
for i in 2 3; do
  echo "  -> Analyze $i/3:"
  curl -s -X POST "$BASE/resumes/$RESUME_ID/analyze" -H "Authorization: Bearer $ACCESS" | python3 -c "
import sys,json; d=json.load(sys.stdin)
print('    success=' + str(d.get('success')) + ' status=' + str(d.get('data',{}).get('analysisStatus','')) + ' error=' + str(d.get('error','')))"
  sleep 1
done

echo "  -> 4th attempt (should be 429):"
curl -s -X POST "$BASE/resumes/$RESUME_ID/analyze" -H "Authorization: Bearer $ACCESS"
echo

echo "=== DONE ==="
