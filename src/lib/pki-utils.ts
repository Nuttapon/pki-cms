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
  static async parseCertificateChain(pemData: string): Promise<pkijs.Certificate[]> {
    try {
      const certificates: pkijs.Certificate[] = [];
      
      // Split PEM data into individual certificates
      const certBlocks = pemData.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
      
      if (!certBlocks || certBlocks.length === 0) {
        throw new Error('No certificates found in the provided file');
      }
      
      for (const certBlock of certBlocks) {
        const buffer = this.pemToArrayBuffer(certBlock);
        const asn1 = asn1js.fromBER(buffer);
        if (asn1.offset === -1) {
          throw new Error('Cannot parse certificate - invalid ASN.1 structure');
        }
        
        const certificate = new pkijs.Certificate({ schema: asn1.result });
        certificates.push(certificate);
      }
      
      return certificates;
    } catch (error) {
      throw new Error(`Certificate chain parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

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
    certificate: pkijs.Certificate,
    caChain: pkijs.Certificate[] = []
  ): Promise<ArrayBuffer> {
    try {
      // Create CMS SignedData with encapsulated content as per diagram
      // Content Type = SIGNED-DATA with embedded original data
      const cmsSignedData = new pkijs.SignedData({
        version: 1,
        encapContentInfo: new pkijs.EncapsulatedContentInfo({
          eContentType: '1.2.840.113549.1.7.1' // id-data
          // eContent will be set after signing
        }),
        // Certificate chain: End-entity (signer) + Intermediates + Root CA
        // Order matters for proper chain validation as per diagram
        certificates: [certificate, ...caChain],
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

      // First set the eContent with the data
      cmsSignedData.encapContentInfo.eContent = new asn1js.OctetString({ valueHex: data });
      
      // Sign the data (it will use the encapsulated data for signing)
      await cmsSignedData.sign(privateKey, 0, 'SHA-256');
      
      // Create the complete CMS ContentInfo structure
      const cmsContentInfo = new pkijs.ContentInfo({
        contentType: '1.2.840.113549.1.7.2', // id-signedData
        content: cmsSignedData.toSchema()
      });

      // Return the complete CMS SignedData structure with embedded content
      return cmsContentInfo.toSchema().toBER();

    } catch (error) {
      throw new Error(`Data signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async verifySignature(
    signedDataBuffer: ArrayBuffer,
    certificate?: pkijs.Certificate
  ): Promise<{ verified: boolean; data?: ArrayBuffer; certificate?: pkijs.Certificate; certificateChain?: pkijs.Certificate[] }> {
    try {
      // Parse the CMS SignedData structure with encapsulated content
      const asn1 = asn1js.fromBER(signedDataBuffer);
      if (asn1.offset === -1) {
        throw new Error('Cannot parse signed data - invalid ASN.1 structure');
      }

      const cmsContentInfo = new pkijs.ContentInfo({ schema: asn1.result });
      
      // Verify this is a SignedData ContentInfo
      if (cmsContentInfo.contentType !== '1.2.840.113549.1.7.2') {
        throw new Error('Invalid content type - not a CMS SignedData');
      }
      
      const cmsSignedData = new pkijs.SignedData({ schema: cmsContentInfo.content });

      // Extract signer certificate from the embedded certificate chain
      let verificationCert = certificate;
      if (!verificationCert && cmsSignedData.certificates && cmsSignedData.certificates.length > 0) {
        // First certificate should be the signer (end-entity)
        const certItem = cmsSignedData.certificates[0];
        if (certItem instanceof pkijs.Certificate) {
          verificationCert = certItem;
        }
      }

      if (!verificationCert) {
        throw new Error('No certificate found in signature and none provided');
      }

      // Verify the CMS SignedData with encapsulated content
      const verificationResult = await cmsSignedData.verify({
        signer: 0,
        trustedCerts: [verificationCert]
        // No external data needed - content is encapsulated
      });

      // Extract the original data from encapsulated content
      let originalData: ArrayBuffer | undefined;
      
      // Check if we have encapsulated content
      if (cmsSignedData.encapContentInfo && cmsSignedData.encapContentInfo.eContent) {
        const eContent = cmsSignedData.encapContentInfo.eContent;
        
        // Try to extract data from the OctetString
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((eContent as any).valueBlock && (eContent as any).valueBlock.valueHex) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          originalData = (eContent as any).valueBlock.valueHex;
        } else if (eContent instanceof asn1js.OctetString) {
          originalData = eContent.valueBlock.valueHex;
        }
      }

      // Extract complete certificate chain for display
      const allCertificates: pkijs.Certificate[] = [];
      if (cmsSignedData.certificates && cmsSignedData.certificates.length > 0) {
        for (const certItem of cmsSignedData.certificates) {
          if (certItem instanceof pkijs.Certificate) {
            allCertificates.push(certItem);
          }
        }
      }

      return {
        verified: verificationResult,
        data: originalData,
        certificate: verificationCert,
        certificateChain: allCertificates.length > 0 ? allCertificates : undefined
      };
      
    } catch (error) {
      throw new Error(`Signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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