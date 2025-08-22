import * as pkijs from 'pkijs';
import * as asn1js from 'asn1js';
import { getCrypto } from 'pkijs';

export interface HSMCertificate {
  id: string;
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  pemData: string;
  keyId: string;
}

export interface HSMSignResponse {
  success: boolean;
  signature?: string;
  keyId?: string;
  hashAlgorithm?: string;
  signatureAlgorithm?: string;
  timestamp?: string;
  error?: string;
}

export class HSMUtils {
  
  // ดึง certificates ทั้งหมดจาก HSM ผ่าน socket connection
  static async getAvailableCertificates(): Promise<HSMCertificate[]> {
    try {
      const response = await fetch('/api/hsm/certificates');
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to retrieve HSM certificates');
      }
      
      return result.certificates;
    } catch (error) {
      throw new Error(`HSM certificate retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ทดสอบการเชื่อมต่อ HSM socket
  static async testHSMConnection(): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const response = await fetch('/api/hsm/test');
      const result = await response.json();
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: `HSM connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // สร้าง hash ของข้อมูลที่จะส่งไป HSM sign
  static async createDataHash(data: ArrayBuffer, algorithm: string = 'SHA-256'): Promise<string> {
    const crypto = getCrypto(true);
    const hashBuffer = await crypto.digest(algorithm, data);
    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  }

  // ส่งข้อมูลไป HSM เพื่อ sign
  static async signWithHSM(
    dataHash: string, 
    keyId: string, 
    hashAlgorithm: string = 'SHA-256',
    cardName?: string,
    passphrase?: string
  ): Promise<HSMSignResponse> {
    try {
      const response = await fetch('/api/hsm/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataHash,
          keyId,
          hashAlgorithm,
          cardName,
          passphrase
        })
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        error: `HSM signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // แปลง HSM certificate จาก PEM เป็น pkijs Certificate object
  static async parseCertificateFromPEM(pemData: string): Promise<pkijs.Certificate> {
    try {
      // Remove PEM headers and decode
      const base64 = pemData
        .replace(/-----BEGIN[^-]*-----/, '')
        .replace(/-----END[^-]*-----/, '')
        .replace(/\s/g, '');
      
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const asn1 = asn1js.fromBER(bytes.buffer);
      if (asn1.offset === -1) {
        throw new Error('Cannot parse certificate - invalid ASN.1 structure');
      }

      return new pkijs.Certificate({ schema: asn1.result });
    } catch (error) {
      throw new Error(`Certificate parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // สร้าง SignerInfo สำหรับ CMS SignedData โดยใช้ HSM signature
  static createSignerInfoWithHSMSignature(
    certificate: pkijs.Certificate,
    hsmSignature: string,
    hashAlgorithm: string = 'SHA-256'
  ): pkijs.SignerInfo {
    
    // แปลง Base64 signature กลับเป็น ArrayBuffer
    const signatureBytes = atob(hsmSignature);
    const signatureArray = new Uint8Array(signatureBytes.length);
    for (let i = 0; i < signatureBytes.length; i++) {
      signatureArray[i] = signatureBytes.charCodeAt(i);
    }

    const signerInfo = new pkijs.SignerInfo({
      version: 1,
      sid: new pkijs.IssuerAndSerialNumber({
        issuer: certificate.issuer,
        serialNumber: certificate.serialNumber
      }),
      digestAlgorithm: new pkijs.AlgorithmIdentifier({
        algorithmId: hashAlgorithm === 'SHA-256' ? '2.16.840.1.101.3.4.2.1' : '2.16.840.1.101.3.4.2.1'
      }),
      signatureAlgorithm: new pkijs.AlgorithmIdentifier({
        algorithmId: '1.2.840.113549.1.1.11' // RSA with SHA-256
      }),
      signature: new asn1js.OctetString({ valueHex: signatureArray.buffer })
    });

    return signerInfo;
  }
}