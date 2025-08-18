# Testing the PKI Digital Signature Tool

## 🔧 Fixed Issues
- **Signing Error**: Fixed "SignerInfo index is out of range" by properly initializing the SignerInfo array
- **Verification Error**: Improved base64 decoding and added validation for PEM format
- **UI Clarity**: Added instructions to clarify which files to upload for verification

## 🧪 Step-by-Step Testing

### 1. Generate Test Files
```bash
npm run generate-test-files
```

### 2. Start the Application
```bash
npm run dev
```
Open: http://localhost:3000

### 3. Test Digital Signing

**Upload Files**:
- **Certificate**: `test-files/certificate.crt`
- **Private Key**: `test-files/private-key-pkcs8.pem`
- **Data File**: `test-files/sample-data.txt`

**Expected Result**:
- Certificate should parse and show Thai organization details
- Private key should load successfully
- Clicking "Sign Data" should download a `.p7s` file (~949KB large file performance test)

### 4. Test Signature Verification

**Upload Files**:
- **Certificate**: `test-files/certificate.crt` (same as before)
- **Data File**: Upload the downloaded `.p7s` file (NOT the original sample-data.txt)

**Expected Result**:
- Signature verification should show "SUCCESS ✓"
- Original data should be extracted and displayed
- Extracted data should match the original sample-data.txt content

## ⚠️ Common Mistakes

1. **For Verification**: Upload the `.p7s` signature file, not the original data file
2. **File Format**: Ensure certificate and key files are in PEM format
3. **Browser Console**: Check for additional error details if issues persist

## 🔍 Troubleshooting

- **"Invalid base64 encoding"**: Check that .p7s file is properly formatted
- **"Please upload .p7s signature file"**: You're uploading the original data instead of the signature
- **Certificate parsing errors**: Verify the certificate is in PEM format with proper headers

## ✅ Success Indicators

- Certificate details display correctly
- Private key loads without errors
- Signing creates and downloads .p7s file
- Verification shows green checkmark with extracted data