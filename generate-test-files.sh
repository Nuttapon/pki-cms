#!/bin/bash

# Generate test PKI files for the digital signature application
echo "🔐 Generating test PKI files..."

# Create test-files directory
mkdir -p test-files
cd test-files

# Clean up any existing files
rm -f *.key *.crt *.pem *.txt

echo "📋 Step 1: Generating CA private key..."
# Generate CA private key
openssl genrsa -out ca-private-key.pem 2048

echo "🏢 Step 2: Creating CA certificate..."
# Create self-signed CA certificate
openssl req -new -x509 -key ca-private-key.pem -out ca-certificate.pem -days 1095 -subj "/C=TH/ST=Bangkok/L=Bangkok/O=Test Root CA Organization/OU=Certificate Authority/CN=Test Root CA/emailAddress=ca@example.com"

echo "📋 Step 3: Generating intermediate CA private key..."
# Generate intermediate CA private key
openssl genrsa -out intermediate-ca-private-key.pem 2048

echo "🏢 Step 4: Creating intermediate CA certificate signing request..."
# Create intermediate CA certificate signing request
openssl req -new -key intermediate-ca-private-key.pem -out intermediate-ca-request.csr -subj "/C=TH/ST=Bangkok/L=Bangkok/O=Test Intermediate CA Organization/OU=Intermediate Certificate Authority/CN=Test Intermediate CA/emailAddress=intermediate-ca@example.com"

echo "🏆 Step 5: Signing intermediate CA certificate with root CA..."
# Sign intermediate CA certificate with root CA
openssl x509 -req -days 730 -in intermediate-ca-request.csr -CA ca-certificate.pem -CAkey ca-private-key.pem -CAcreateserial -out intermediate-ca-certificate.pem

echo "📋 Step 6: Generating end-entity private key..."
# Generate RSA private key (2048 bits) for end-entity certificate
openssl genrsa -out private-key.pem 2048

echo "📜 Step 7: Creating end-entity certificate signing request..."
# Create certificate signing request with subject information
openssl req -new -key private-key.pem -out cert-request.csr -subj "/C=TH/ST=Bangkok/L=Bangkok/O=Test Organization/OU=IT Department/CN=test.example.com/emailAddress=test@example.com"

echo "🏆 Step 8: Signing end-entity certificate with intermediate CA..."
# Generate certificate signed by intermediate CA
openssl x509 -req -days 365 -in cert-request.csr -CA intermediate-ca-certificate.pem -CAkey intermediate-ca-private-key.pem -CAcreateserial -out certificate.crt

echo "📄 Step 4: Creating sample data file (~100KB)..."
# Create a sample text file to sign (approximately 100KB for better performance)
cat > sample-data.txt << 'EOF'
========================================
PKI DIGITAL SIGNATURE TESTING DOCUMENT
========================================

Document Information:
- Document ID: TEST-2024-001  
- Created: $(date)
- Purpose: PKI Digital Signature Testing (Large File)
- Organization: Test Organization
- File Size: ~1MB for performance testing
- Classification: Testing Use Only

========================================
EXECUTIVE SUMMARY
========================================

This document serves as a comprehensive test file for digital signature operations
using PKI (Public Key Infrastructure) technology. The document has been designed
to be approximately 1 megabyte in size to test the performance and reliability
of digital signature algorithms when processing larger data sets.

Digital signatures provide authentication, non-repudiation, and integrity 
verification for electronic documents. This test document contains various 
sections of content to simulate real-world document structures that might 
be encountered in production environments.

========================================
TECHNICAL SPECIFICATIONS
========================================

Cryptographic Standards:
- X.509 Certificate Format
- PKCS#11 Digital Signature Standard
- RSA-2048 Public Key Cryptography
- SHA-256 Hash Algorithm
- ASN.1 Data Structure Encoding
- PEM (Privacy-Enhanced Mail) Format

Test Environment:
- Browser: Modern Web Browsers with Web Crypto API
- Platform: Cross-platform (Windows, macOS, Linux)
- Technology: Next.js 15, React 19, TypeScript
- Library: PKI.js for cryptographic operations

========================================
PERFORMANCE TESTING DATA
========================================

EOF

# Replace $(date) with actual date
sed -i '' "s/\$(date)/$(date)/" sample-data.txt 2>/dev/null || sed -i "s/\$(date)/$(date)/" sample-data.txt

# Add repeating content to reach ~1MB
echo "Generating large content sections..." >&2
for i in {1..40}; do
    cat >> sample-data.txt << EOF

Section $i: Performance Test Data Block
----------------------------------------
This section contains test data for performance evaluation of digital signature
operations. Each block contains structured information designed to simulate
real-world document content that might require digital signing.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis 
nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore
eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt
in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium 
doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore
veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim
ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia
consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

Technical Data Block $i:
- Block ID: TB-$(printf "%04d" $i)
- Timestamp: $(date)
- Data Type: Performance Testing
- Content Size: Variable length text block
- Encoding: UTF-8
- Line Endings: Unix (LF)

Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur,
adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et
dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis
nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid
ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea
voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem
eum fugiat quo voluptas nulla pariatur?

Crypto Testing Parameters Block $i:
- Hash Function: SHA-256
- Key Length: 2048 bits
- Signature Algorithm: RSA-PKCS1-v1_5
- Certificate Format: X.509 v3
- Encoding: ASN.1 DER, Base64 PEM
- Validation: Certificate chain verification

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis
praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias
excepturi sint occaecati cupiditate non provident, similique sunt in culpa
qui officia deserunt mollitia animi, id est laborum et dolorum fuga.

End of Section $i
----------------------------------------

EOF
done

# Add final summary section
cat >> sample-data.txt << 'EOF'

========================================
DOCUMENT CONCLUSION
========================================

This large test document has been successfully generated for PKI digital 
signature testing purposes. The document contains multiple sections with
varying content types to provide comprehensive testing coverage for:

1. Small text blocks (headers, metadata)
2. Medium text sections (technical specifications)
3. Large repetitive content (performance data blocks)
4. Special characters and formatting
5. Timestamps and dynamic content

The total file size should be approximately 1 megabyte, making it suitable
for testing the performance characteristics of digital signature operations
on larger data sets while remaining manageable for development testing.

Digital signature verification should confirm:
✓ Document integrity (no tampering)
✓ Authenticity (signed by expected certificate)
✓ Non-repudiation (signature cannot be denied)
✓ Timestamp validation (signature creation time)

========================================
END OF DOCUMENT
========================================

Generated by: PKI Digital Signature Test Script
Total sections: 40 performance test blocks
Estimated size: ~100KB
Purpose: Large file digital signature testing
Status: Ready for signing and verification

Important: This is for testing purposes only.
EOF

echo "🔧 Step 9: Converting formats for compatibility..."
# Convert certificate to PEM format (explicit)
openssl x509 -in certificate.crt -out certificate.pem -outform PEM

# Convert private key to PKCS#8 format for better compatibility
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private-key.pem -out private-key-pkcs8.pem

# Create CA chain file (intermediate + root)
echo "🔗 Step 10: Creating CA chain file..."
cat intermediate-ca-certificate.pem ca-certificate.pem > ca-chain.pem

echo "✅ Test files generated successfully!"
echo ""
echo "📁 Generated files in test-files/ directory:"
echo "   📜 certificate.crt           - End-entity X.509 certificate"
echo "   📜 certificate.pem           - Same certificate in PEM format"
echo "   🏢 ca-certificate.pem        - Root CA certificate"
echo "   🏢 intermediate-ca-certificate.pem - Intermediate CA certificate"
echo "   🔗 ca-chain.pem             - Complete CA chain (Intermediate + Root)"
echo "   🔑 private-key.pem          - End-entity RSA private key"
echo "   🔑 private-key-pkcs8.pem    - Private key in PKCS#8 format (recommended)"
echo "   📄 sample-data.txt          - Sample data file (~100KB) to sign"
echo ""
echo "🧪 Testing Instructions:"
echo "1. Start the application: npm run dev"
echo "2. Open http://localhost:3000"
echo "3. Upload these files:"
echo "   - Certificate: test-files/certificate.crt"
echo "   - CA Chain: test-files/ca-chain.pem (optional, for full chain validation)"
echo "   - Private Key: test-files/private-key-pkcs8.pem"
echo "   - Data File: test-files/sample-data.txt"
echo "4. Click 'Sign Data' to create a digital signature with CA chain"
echo "5. Use the downloaded .p7s file to verify (certificate chain auto-extracted)"
echo ""
echo "📋 Certificate Chain Details:"
echo "Root CA:"
openssl x509 -in ca-certificate.pem -text -noout | grep -A 3 "Subject:"
echo ""
echo "Intermediate CA:"
openssl x509 -in intermediate-ca-certificate.pem -text -noout | grep -A 3 "Subject:"
echo ""
echo "End-entity Certificate:"
openssl x509 -in certificate.crt -text -noout | grep -A 3 "Subject:"
echo ""
openssl x509 -in certificate.crt -text -noout | grep -A 2 "Validity"

# Clean up temporary files
rm -f cert-request.csr intermediate-ca-request.csr *.srl

cd ..
echo ""
echo "🎉 Ready for testing! Run the script and follow the instructions above."