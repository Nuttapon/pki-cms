import * as pkijs from 'pkijs';
import * as asn1js from 'asn1js';
import { getCrypto } from 'pkijs';

export interface CertificateInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  publicKey: CryptoKey;
}

export interface PrivateKeyInfo {
  algorithm: string;
  extractable: boolean;
  type: string;
  usages: string[];
}

export class PKIUtils {
  static async parseCertificate(certificateData: ArrayBuffer): Promise<CertificateInfo> {
    try {
      const asn1 = asn1js.fromBER(certificateData);
      if (asn1.offset === -1) {
        throw new Error('Cannot parse certificate - invalid ASN.1 structure');
      }

      const certificate = new pkijs.Certificate({ schema: asn1.result });
      
      const publicKey = await certificate.getPublicKey();
      if (!publicKey) {
        throw new Error('Cannot extract public key from certificate');
      }

      return {
        subject: certificate.subject.typesAndValues.map(attr => 
          `${attr.type}=${attr.value.valueBlock.value}`
        ).join(', '),
        issuer: certificate.issuer.typesAndValues.map(attr => 
          `${attr.type}=${attr.value.valueBlock.value}`
        ).join(', '),
        serialNumber: certificate.serialNumber.valueBlock.toString(),
        validFrom: certificate.notBefore.value,
        validTo: certificate.notAfter.value,
        publicKey
      };
    } catch (error) {
      throw new Error(`Certificate parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async parsePrivateKey(privateKeyData: ArrayBuffer, format: 'pkcs8' | 'pkcs1' = 'pkcs8'): Promise<CryptoKey> {
    try {
      const crypto = getCrypto(true);
      
      let keyData: ArrayBuffer;
      
      if (format === 'pkcs8') {
        keyData = privateKeyData;
      } else {
        const asn1 = asn1js.fromBER(privateKeyData);
        if (asn1.offset === -1) {
          throw new Error('Cannot parse private key - invalid ASN.1 structure');
        }
        keyData = privateKeyData;
      }

      const privateKey = await crypto.importKey(
        'pkcs8',
        keyData,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
        },
        true,
        ['sign']
      );

      return privateKey;
    } catch (error) {
      try {
        const crypto = getCrypto(true);
        const privateKey = await crypto.importKey(
          'pkcs8',
          privateKeyData,
          {
            name: 'ECDSA',
            namedCurve: 'P-256',
          },
          true,
          ['sign']
        );
        return privateKey;
      } catch {
        throw new Error(`Private key parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  static async signData(
    data: ArrayBuffer,
    privateKey: CryptoKey,
    certificate: pkijs.Certificate
  ): Promise<ArrayBuffer> {
    try {
      // For large files, create a detached signature to avoid stack overflow
      const cmsSignedData = new pkijs.SignedData({
        version: 1,
        encapContentInfo: new pkijs.EncapsulatedContentInfo({
          eContentType: '1.2.840.113549.1.7.1'
          // No eContent - this creates a detached signature
        }),
        certificates: [certificate],
        signerInfos: [
          new pkijs.SignerInfo({
            version: 1,
            sid: new pkijs.IssuerAndSerialNumber({
              issuer: certificate.issuer,
              serialNumber: certificate.serialNumber
            })
          })
        ]
      });

      // Sign with external data (detached signature)
      await cmsSignedData.sign(privateKey, 0, 'SHA-256', data);
      
      const cmsContentInfo = new pkijs.ContentInfo({
        contentType: '1.2.840.113549.1.7.2',
        content: cmsSignedData.toSchema()
      });

      // Create a combined structure with both signature and data
      const signatureBuffer = cmsContentInfo.toSchema().toBER();
      const combinedSize = signatureBuffer.byteLength + data.byteLength + 1024; // extra space for headers
      const combinedBuffer = new ArrayBuffer(combinedSize);
      const combinedView = new Uint8Array(combinedBuffer);
      
      // Add signature length header (4 bytes)
      const sigLengthView = new DataView(combinedBuffer, 0, 4);
      sigLengthView.setUint32(0, signatureBuffer.byteLength, false);
      
      // Add signature
      combinedView.set(new Uint8Array(signatureBuffer), 4);
      
      // Add original data
      combinedView.set(new Uint8Array(data), 4 + signatureBuffer.byteLength);
      
      // Return only the used portion
      return combinedBuffer.slice(0, 4 + signatureBuffer.byteLength + data.byteLength);

    } catch (error) {
      throw new Error(`Data signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async verifySignature(
    combinedData: ArrayBuffer,
    certificate: pkijs.Certificate
  ): Promise<{ verified: boolean; data?: ArrayBuffer }> {
    try {
      // Extract signature and data from combined format
      const dataView = new DataView(combinedData);
      const signatureLength = dataView.getUint32(0, false);
      
      if (signatureLength <= 0 || signatureLength > combinedData.byteLength - 4) {
        throw new Error('Invalid combined signature format');
      }
      
      const signatureData = combinedData.slice(4, 4 + signatureLength);
      const originalData = combinedData.slice(4 + signatureLength);
      
      // Parse the detached signature
      const asn1 = asn1js.fromBER(signatureData);
      if (asn1.offset === -1) {
        throw new Error('Cannot parse signature - invalid ASN.1 structure');
      }

      const cmsContentInfo = new pkijs.ContentInfo({ schema: asn1.result });
      const cmsSignedData = new pkijs.SignedData({ schema: cmsContentInfo.content });

      // Verify the detached signature with the original data
      const verificationResult = await cmsSignedData.verify({
        signer: 0,
        trustedCerts: [certificate],
        data: originalData // provide external data for detached signature
      });

      return {
        verified: verificationResult,
        data: originalData
      };
    } catch (error) {
      // Fallback: try legacy embedded signature format
      try {
        const asn1 = asn1js.fromBER(combinedData);
        if (asn1.offset === -1) {
          throw new Error('Cannot parse signed data - invalid ASN.1 structure');
        }

        const cmsContentInfo = new pkijs.ContentInfo({ schema: asn1.result });
        const cmsSignedData = new pkijs.SignedData({ schema: cmsContentInfo.content });

        const verificationResult = await cmsSignedData.verify({
          signer: 0,
          trustedCerts: [certificate]
        });

        let originalData: ArrayBuffer | undefined;
        if (cmsSignedData.encapContentInfo.eContent) {
          originalData = cmsSignedData.encapContentInfo.eContent.valueBlock.valueHex;
        }

        return {
          verified: verificationResult,
          data: originalData
        };
      } catch {
        throw new Error(`Signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  static pemToArrayBuffer(pem: string): ArrayBuffer {
    try {
      // Remove PEM headers and footers, and all whitespace
      const base64 = pem
        .replace(/-----BEGIN[^-]*-----/, '')
        .replace(/-----END[^-]*-----/, '')
        .replace(/\s/g, '');
      
      // Validate base64 string
      if (!base64 || base64.length === 0) {
        throw new Error('Invalid PEM format: no content found');
      }
      
      // Check if base64 is properly formatted
      if (base64.length % 4 !== 0) {
        throw new Error('Invalid base64 encoding: incorrect padding');
      }
      
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return bytes.buffer;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'InvalidCharacterError') {
        throw new Error('Invalid base64 encoding in PEM file');
      }
      throw error;
    }
  }

  static arrayBufferToPem(buffer: ArrayBuffer, type: 'CERTIFICATE' | 'PRIVATE KEY' | 'PKCS11'): string {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const formatted = base64.match(/.{1,64}/g)?.join('\n') || '';
    return `-----BEGIN ${type}-----\n${formatted}\n-----END ${type}-----`;
  }
}