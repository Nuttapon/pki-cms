# PKI Digital Signature Tool

A web-based application for signing and verifying digital signatures using X.509 certificates and PKI.js library.

## Features

- **Certificate Management**: Upload and parse X.509 certificates (.crt, .pem, .cer)
- **CA Chain Support**: Include complete certificate chains (Root CA + Intermediate CAs) in signatures
- **Private Key Support**: Load private keys (.key, .pem) for signing operations
- **Digital Signing**: Sign any data file using PKCS#11 format with embedded certificate chains
- **Signature Verification**: Verify digital signatures with automatic certificate chain extraction
- **Certificate Chain Auto-Extraction**: No need to upload certificates for verification - extracted from .p7s files
- **Download Support**: Automatic download of signed files and extracted data
- **Modern UI**: Clean, responsive interface with dark mode support

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Digital Signing

1. **Upload Certificate**: Choose your X.509 certificate file (.crt, .pem, .cer)
2. **Upload CA Chain** (Optional): Select CA certificate chain file (.pem) containing Root CA + Intermediate CAs
3. **Upload Private Key**: Select the corresponding private key file (.key, .pem)
4. **Upload Data File**: Choose any file you want to sign
5. **Click "Sign Data"**: The application will create a PKCS#11 signature with embedded certificate chain and download it automatically

### Signature Verification

1. **Upload Signed Data**: Select the .p7s signature file (certificate chain is auto-extracted)
2. **Click "Verify Signature"**: The application will verify the signature, display the certificate chain hierarchy, and extract the original data if valid

**Note**: Certificate upload is optional for verification as certificates are automatically extracted from the .p7s signature file.

## Technical Details

- **Built with**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Crypto Library**: PKI.js for X.509 and PKCS#11 operations
- **Browser Support**: Modern browsers with Web Crypto API support
- **Security**: All cryptographic operations happen client-side using Web Crypto API

## File Formats Supported

- **Certificates**: .crt, .pem, .cer (X.509 format)
- **CA Chain**: .pem (Multiple certificates in single file)
- **Private Keys**: .key, .pem (PKCS#8 format)
- **Signatures**: PKCS#11 format (.p7s files) with embedded certificate chains

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## License

This project is open source and available under the MIT License.
