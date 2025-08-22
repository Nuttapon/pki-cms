# PKI Digital Signature Tool

A web-based application for signing and verifying digital signatures using X.509 certificates, PKI.js library, and HSM (Hardware Security Module) integration.

## Features

### Core PKI Operations
- **Certificate Management**: Upload and parse X.509 certificates (.crt, .pem, .cer)
- **CA Chain Support**: Include complete certificate chains (Root CA + Intermediate CAs) in signatures
- **Private Key Support**: Load private keys (.key, .pem) for signing operations
- **Digital Signing**: Sign any data file using CMS SignedData format with encapsulated content
- **Signature Verification**: Verify digital signatures with automatic certificate chain extraction
- **Certificate Chain Auto-Extraction**: No need to upload certificates for verification - extracted from .p7s files

### HSM Integration
- **nFast HSM Support**: Unix socket integration with Thales nFast Hardware Security Modules
- **Unix Socket Communication**: Direct connection to nFast hardserver via Unix domain socket
- **Softcard Support**: Automatic discovery and management of nFast softcards from filesystem
- **Remote Signing**: Secure signing using HSM-stored private keys via socket protocol
- **Filesystem-based Card Authentication**: Softcard discovery from `/opt/nfast/kmdata/local`
- **Certificate Discovery**: Automatic retrieval of certificates from softcard directories
- **High Security**: Private keys never leave the HSM environment
- **Real-time Communication**: Direct Unix socket for optimal performance

### User Interface
- **Dual Mode Operation**: Toggle between client-side signing and HSM signing
- **Modern UI**: Clean, responsive interface with dark mode support
- **Real-time Feedback**: Live status updates during signing operations
- **Download Support**: Automatic download of signed files and extracted data

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

3. Configure environment variables (copy `.env.example` to `.env.local`):

```bash
# For HSM Integration (optional)
HSM_SOCKET_PATH=/opt/nfast/sockets/nserver
HSM_KMDATA_PATH=/opt/nfast/kmdata/local
HSM_TIMEOUT=30000
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Generate Test Files (Optional)

For testing purposes, you can generate a complete PKI certificate chain and sample data:

```bash
# Make the script executable
chmod +x generate-test-files.sh

# Generate test certificates and data
./generate-test-files.sh
```

This will create a `test-files/` directory with:
- **Root CA Certificate** (`ca-certificate.pem`) - Self-signed authority
- **Intermediate CA Certificate** (`intermediate-ca-certificate.pem`) - Signed by Root CA  
- **End-Entity Certificate** (`certificate.crt`) - User/server certificate signed by Intermediate CA
- **Complete CA Chain** (`ca-chain.pem`) - Intermediate + Root CA for validation
- **Private Key** (`private-key-pkcs8.pem`) - PKCS#8 format (recommended)
- **Sample Data** (`sample-data.txt`) - ~100KB test document

### Quick Test

After generating test files:

1. **For Signing**:
   - Certificate: `test-files/certificate.crt`
   - CA Chain: `test-files/ca-chain.pem` (optional, enables full chain validation)
   - Private Key: `test-files/private-key-pkcs8.pem`
   - Data File: `test-files/sample-data.txt`

2. **For Verification**:
   - Upload the downloaded `.p7s` signature file (certificate chain auto-extracted)

### Data Flow & Security Model

```mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant W as WebCrypto
    participant P as PKI.js
    
    Note over U,P: Digital Signing Process
    U->>B: Upload Certificate, Private Key, Data
    B->>P: Parse PEM/DER formats
    P->>W: Import cryptographic keys
    W->>P: Return CryptoKey objects
    P->>W: Create detached PKCS#11 signature
    W->>P: Return signature buffer
    P->>B: Combine signature + original data
    B->>U: Download .p7s signed file
    
    Note over U,P: Signature Verification Process
    U->>B: Upload .p7s signature file
    B->>P: Parse combined signature format
    P->>P: Extract embedded certificate chain
    P->>W: Verify signature against original data
    W->>P: Return verification result
    P->>B: Extract original data if valid
    B->>U: Display results + download data
    
    Note over U,P: All operations remain client-side for security
```

## Usage

### Client-Side Digital Signing

1. **Upload Certificate**: Choose your X.509 certificate file (.crt, .pem, .cer)
2. **Upload CA Chain** (Optional): Select CA certificate chain file (.pem) containing Root CA + Intermediate CAs
3. **Upload Private Key**: Select the corresponding private key file (.key, .pem)
4. **Upload Data File**: Choose any file you want to sign
5. **Click "Sign Data"**: Creates CMS SignedData with encapsulated content and downloads .p7s file

### HSM-Based Digital Signing

1. **Enable HSM Mode**: Check "Use HSM nFast" toggle
2. **Load HSM Certificates**: Click "Refresh" to discover available certificates
3. **Select Certificate**: Choose from HSM certificate dropdown
4. **Authentication**: Enter HSM card name and passphrase
5. **Upload Data File**: Choose any file you want to sign
6. **Click "Sign with HSM"**: Securely signs using HSM and downloads .p7s file

### Signature Verification

1. **Upload Signed Data**: Select the .p7s signature file (certificate chain is auto-extracted)
2. **Click "Verify Signature"**: Verifies signature, displays certificate chain hierarchy, and extracts original data

**Note**: Certificate upload is optional for verification as certificates are automatically extracted from the .p7s signature file.

## Testing Guide

### Automated Test File Generation

The project includes a comprehensive test script that generates a complete PKI infrastructure:

```bash
./generate-test-files.sh
```

**What it creates:**
- **3-tier Certificate Chain**: Root CA → Intermediate CA → End-Entity Certificate
- **RSA-2048 Key Pairs**: Industry-standard key length for testing
- **PKCS#8 Private Keys**: Compatible format for Web Crypto API
- **Large Sample Data**: ~100KB document for performance testing
- **Complete CA Chain**: Ready-to-use certificate chain file

### Testing Scenarios

#### 1. **Basic Digital Signing**
```
Certificate: test-files/certificate.crt
Private Key: test-files/private-key-pkcs8.pem
Data File: test-files/sample-data.txt
```

#### 2. **Full Chain Validation**
```
Certificate: test-files/certificate.crt
CA Chain: test-files/ca-chain.pem
Private Key: test-files/private-key-pkcs8.pem
Data File: test-files/sample-data.txt
```

#### 3. **Signature Verification**
```
Signed File: [Downloaded .p7s file from signing process]
Note: Certificate chain is automatically extracted from signature
```

### Expected Results

✅ **Successful Signing**:
- Creates `.p7s` file with embedded certificate chain
- File size: Original data + signature overhead (~2-4KB)
- Downloads automatically with `.p7s` extension

✅ **Successful Verification**:
- Displays certificate chain hierarchy (Root CA, Intermediate CA, Signer)
- Shows signature validation status
- Extracts and downloads original data
- Verifies data integrity

### Certificate Chain Details

The generated test certificates follow this hierarchy:

```
Root CA: "Test Root CA" (Self-signed, 3 years validity)
    ↓
Intermediate CA: "Test Intermediate CA" (Signed by Root, 2 years validity)  
    ↓
End-Entity: "test.example.com" (Signed by Intermediate, 1 year validity)
```

### Performance Testing

The sample data file (~100KB) is designed to test:
- Large file signing performance
- Memory usage with detached signatures
- Certificate chain processing
- Browser compatibility with substantial data

## Architecture Overview

### Client-Side + HSM Hybrid Architecture

```mermaid
graph TB
    subgraph Browser["Browser Application"]
        UI["React/Next.js UI<br/>Dual Mode Interface"]
        PKI["PKI Utils Library<br/>Crypto Operations"]
        HSM["HSM Utils Library<br/>Remote Signing"]
        WEB["Web Crypto API<br/>Browser Native Crypto"]
        PKIJS["PKI.js Library<br/>X.509 & CMS"]
    end
    
    subgraph Server["Next.js API Routes"]
        CERT_API["/api/hsm/certificates<br/>Certificate Discovery"]
        SIGN_API["/api/hsm/sign<br/>Remote Signing"]
        TEST_API["/api/hsm/test<br/>Connection Test"]
    end
    
    subgraph HSM_Socket["HSM Socket Layer"]
        SOCKET_CLIENT["HSMSocketClient<br/>TCP Socket Communication"]
    end
    
    subgraph HSM_Infrastructure["HSM Infrastructure"]
        HARDSERVER["nFast Hardserver<br/>Socket Server (Port 9004)"]
        NFAST["nFast HSM<br/>Hardware Security Module"]
        CARDS["Security Cards<br/>Authentication"]
    end
    
    UI --> PKI
    UI --> HSM
    PKI --> WEB
    PKI --> PKIJS
    HSM --> CERT_API
    HSM --> SIGN_API
    HSM --> TEST_API
    CERT_API --> SOCKET_CLIENT
    SIGN_API --> SOCKET_CLIENT
    TEST_API --> SOCKET_CLIENT
    SOCKET_CLIENT -.->|TCP Socket| HARDSERVER
    HARDSERVER --> NFAST
    NFAST --> CARDS
    
    style UI fill:#e3f2fd
    style PKI fill:#fff3e0
    style HSM fill:#ffebee
    style NFAST fill:#e8f5e8
```

## How It Works

### Digital Signing Workflow

```mermaid
flowchart TD
    A["Upload Files"] --> B{"Parse Files"}
    B --> C["X.509 Certificate<br/>(.crt/.pem)"]
    B --> D["CA Chain<br/>(Optional .pem)"]
    B --> E["Private Key<br/>(.key/.pem)"]
    B --> F["Data File<br/>(Any format)"]
    
    C --> G["Parse Certificate<br/>Extract Public Key"]
    D --> H["Parse Certificate Chain<br/>Root CA + Intermediates"]
    E --> I["Import Private Key<br/>RSA/ECDSA Support"]
    F --> J["Read Data Buffer"]
    
    G --> K["Create PKCS#11 Signature"]
    H --> K
    I --> K
    J --> K
    
    K --> L["Generate Detached Signature<br/>Embed Certificate Chain"]
    L --> M["Combine Signature + Original Data"]
    M --> N["Convert to PEM Format"]
    N --> O["Download .p7s File"]
    
    style A fill:#e1f5fe
    style K fill:#fff3e0
    style O fill:#e8f5e8
```

### Signature Verification Workflow

```mermaid
flowchart TD
    A["Upload .p7s File"] --> B["Parse Combined Format"]
    B --> C["Extract Signature Length<br/>4-byte header"]
    C --> D["Split Signature & Data"]
    
    D --> E["Parse PKCS#11 Signature"]
    D --> F["Extract Original Data"]
    
    E --> G["Auto-Extract Certificate Chain<br/>End-entity + Intermediates + Root CA"]
    G --> H["Identify Certificate Roles<br/>Signer, Intermediate CA, Root CA"]
    
    E --> I["Verify Detached Signature"]
    F --> I
    G --> I
    
    I --> J{"Signature Valid?"}
    J -->|Yes| K["Display Success ✓<br/>Show Certificate Chain<br/>Download Original Data"]
    J -->|No| L["Display Failure ✗<br/>Data Tampering Detected"]
    
    style A fill:#e1f5fe
    style G fill:#fff3e0
    style K fill:#e8f5e8
    style L fill:#ffebee
```

### Certificate Chain Structure

```mermaid
graph TD
    A["Root CA Certificate<br/>Self-Signed Authority"] --> B["Intermediate CA Certificate<br/>Signed by Root CA"]
    B --> C["End-Entity Certificate<br/>User/Server Certificate<br/>Signed by Intermediate CA"]
    
    D["Private Key"] --> E["Digital Signature"]
    C --> E
    
    F["Data File"] --> E
    E --> G["PKCS#11 Signature<br/>Contains: Signature + Certificate Chain"]
    
    style A fill:#ffcdd2
    style B fill:#f8bbd9
    style C fill:#e1bee7
    style E fill:#fff3e0
    style G fill:#e8f5e8
```

## Technical Details

### Core Technologies
- **Framework**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Cryptography**: PKI.js for X.509 and CMS operations
- **Browser Crypto**: Web Crypto API for client-side operations
- **HSM Integration**: Thales nFast HSM support via hardserver API

### Security Architecture
- **Client-Side Crypto**: All client operations use Web Crypto API
- **HSM Security**: Private keys never leave HSM environment
- **CMS SignedData**: Full compliance with RFC 5652 standard
- **Certificate Chains**: Complete PKI chain embedding and validation

### API Endpoints
- `GET /api/hsm/certificates` - Retrieve available HSM certificates via socket
- `POST /api/hsm/sign` - Remote signing via HSM socket with card authentication  
- `GET /api/hsm/test` - Test HSM socket connection and availability

### Socket Communication
- **Protocol**: TCP Socket connection to nFast hardserver
- **Default Port**: 9004 (configurable via HSM_PORT)
- **Commands**: JSON-based command protocol
- **Authentication**: Card-based authentication for signing operations

## File Formats Supported

- **Certificates**: .crt, .pem, .cer (X.509 format)
- **CA Chain**: .pem (Multiple certificates in single file)
- **Private Keys**: .key, .pem (PKCS#8 format) - Client-side only
- **HSM Certificates**: Retrieved automatically from HSM
- **Signatures**: CMS SignedData format (.p7s files) with encapsulated content and embedded certificate chains

## HSM Configuration

### Environment Variables
```bash
# Required for HSM integration
HSM_HOST=localhost              # nFast hardserver host
HSM_PORT=9004                  # nFast hardserver socket port

# Optional HSM settings
HSM_TIMEOUT=30000              # Socket timeout in milliseconds
HSM_MODULE_TYPE=accelerator-user
HSM_WORLD_NAME=HSMWORLD
```

### HSM Socket Protocol

**Available Commands:**
- `LIST_CERTIFICATES` - Retrieve available certificates
- `AUTHENTICATE` - Authenticate with card and passphrase
- `SIGN_HASH` - Sign data hash with specified key
- `GET_CERTIFICATE` - Get certificate details by key ID
- `PING` - Test connection

**Message Format:**
```json
{
  "command": "SIGN_HASH",
  "keyId": "key-identifier",
  "dataHash": "base64-encoded-hash",
  "cardName": "card1",
  "passphrase": "your-passphrase",
  "hashAlgorithm": "SHA-256"
}
```

### HSM Requirements
- Thales nFast HSM with hardserver running on socket port 9004
- Security cards with valid passphrase authentication
- Network connectivity to hardserver socket
- Valid certificates and private keys stored in HSM

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## License

This project is open source and available under the MIT License.
