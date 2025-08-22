import { NextResponse } from 'next/server';
import { HSMSocketClient } from '../../../../lib/hsm-socket';

export async function GET() {
  try {
    const hsmHost = process.env.HSM_HOST || 'localhost';
    const hsmPort = parseInt(process.env.HSM_PORT || '9004');
    
    const hsmClient = new HSMSocketClient(hsmHost, hsmPort);
    const response = await hsmClient.getCertificates();

    if (!response.success) {
      throw new Error(response.error || 'Failed to retrieve certificates from HSM');
    }

    const certificates = response.certificates || [];

    return NextResponse.json({
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      certificates: certificates.map((cert: any) => ({
        id: cert.id || cert.keyId,
        subject: cert.subject,
        issuer: cert.issuer,
        serialNumber: cert.serialNumber,
        validFrom: cert.validFrom,
        validTo: cert.validTo,
        pemData: cert.pemData || cert.certificate,
        keyId: cert.keyId // HSM key identifier
      }))
    });

  } catch (error) {
    console.error('HSM certificate retrieval error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to retrieve certificates from HSM: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}