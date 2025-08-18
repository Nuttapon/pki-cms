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

### Data Flow & Security Model

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant WebCrypto
    participant PKIjs
    
    Note over User,PKIjs: Digital Signing Process
    User->>Browser: Upload Certificate, Private Key, Data
    Browser->>PKIjs: Parse PEM/DER formats
    PKIjs->>WebCrypto: Import cryptographic keys
    WebCrypto->>PKIjs: Return CryptoKey objects
    PKIjs->>WebCrypto: Create detached PKCS#11 signature
    WebCrypto->>PKIjs: Return signature buffer
    PKIjs->>Browser: Combine signature + original data
    Browser->>User: Download .p7s signed file
    
    Note over User,PKIjs: Signature Verification Process
    User->>Browser: Upload .p7s signature file
    Browser->>PKIjs: Parse combined signature format
    PKIjs->>PKIjs: Extract embedded certificate chain
    PKIjs->>WebCrypto: Verify signature against original data
    WebCrypto->>PKIjs: Return verification result
    PKIjs->>Browser: Extract original data if valid
    Browser->>User: Display results + download data
    
    Note over User,PKIjs: All operations remain client-side for security
```

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

## Architecture Overview

```mermaid
graph TB
    subgraph "Client-Side Application"
        A[React/Next.js UI<br/>File Upload Interface]
        B[PKI Utils Library<br/>Cryptographic Operations]
        C[Web Crypto API<br/>Browser Native Crypto]
        D[PKI.js Library<br/>X.509 & PKCS#11]
    end
    
    subgraph "File Processing"
        E[Certificate Files<br/>.crt/.pem/.cer]
        F[Private Key Files<br/>.key/.pem]
        G[Data Files<br/>Any format]
        H[Signature Files<br/>.p7s PKCS#11]
    end
    
    A --> B
    B --> C
    B --> D
    E --> A
    F --> A
    G --> A
    A --> H
    
    style A fill:#e3f2fd
    style B fill:#fff3e0
    style C fill:#e8f5e8
    style D fill:#f3e5f5
```

## How It Works

### Digital Signing Workflow

```mermaid
flowchart TD
    A[Upload Files] --> B{Parse Files}
    B --> C[X.509 Certificate<br/>(.crt/.pem)]
    B --> D[CA Chain<br/>(Optional .pem)]
    B --> E[Private Key<br/>(.key/.pem)]
    B --> F[Data File<br/>(Any format)]
    
    C --> G[Parse Certificate<br/>Extract Public Key]
    D --> H[Parse Certificate Chain<br/>Root CA + Intermediates]
    E --> I[Import Private Key<br/>RSA/ECDSA Support]
    F --> J[Read Data Buffer]
    
    G --> K[Create PKCS#11 Signature]
    H --> K
    I --> K
    J --> K
    
    K --> L[Generate Detached Signature<br/>Embed Certificate Chain]
    L --> M[Combine Signature + Original Data]
    M --> N[Convert to PEM Format]
    N --> O[Download .p7s File]
    
    style A fill:#e1f5fe
    style K fill:#fff3e0
    style O fill:#e8f5e8
```

### Signature Verification Workflow

```mermaid
flowchart TD
    A[Upload .p7s File] --> B[Parse Combined Format]
    B --> C[Extract Signature Length<br/>4-byte header]
    C --> D[Split Signature & Data]
    
    D --> E[Parse PKCS#11 Signature]
    D --> F[Extract Original Data]
    
    E --> G[Auto-Extract Certificate Chain<br/>End-entity + Intermediates + Root CA]
    G --> H[Identify Certificate Roles<br/>Signer, Intermediate CA, Root CA]
    
    E --> I[Verify Detached Signature]
    F --> I
    G --> I
    
    I --> J{Signature Valid?}
    J -->|Yes| K[Display Success ✓<br/>Show Certificate Chain<br/>Download Original Data]
    J -->|No| L[Display Failure ✗<br/>Data Tampering Detected]
    
    style A fill:#e1f5fe
    style G fill:#fff3e0
    style K fill:#e8f5e8
    style L fill:#ffebee
```

### Certificate Chain Structure

```mermaid
graph TD
    A[Root CA Certificate<br/>Self-Signed Authority] --> B[Intermediate CA Certificate<br/>Signed by Root CA]
    B --> C[End-Entity Certificate<br/>User/Server Certificate<br/>Signed by Intermediate CA]
    
    D[Private Key] --> E[Digital Signature]
    C --> E
    
    F[Data File] --> E
    E --> G[PKCS#11 Signature<br/>Contains: Signature + Certificate Chain]
    
    style A fill:#ffcdd2
    style B fill:#f8bbd9
    style C fill:#e1bee7
    style E fill:#fff3e0
    style G fill:#e8f5e8
```

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
