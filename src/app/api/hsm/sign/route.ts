import { NextRequest, NextResponse } from 'next/server';
import { HSMSocketClient } from '../../../../lib/hsm-socket';

export async function POST(request: NextRequest) {
  try {
    const { dataHash, keyId, hashAlgorithm = 'SHA-256', cardName, passphrase } = await request.json();

    if (!dataHash || !keyId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: dataHash and keyId' },
        { status: 400 }
      );
    }

    if (!cardName || !passphrase) {
      return NextResponse.json(
        { success: false, error: 'Missing required HSM authentication: cardName and passphrase' },
        { status: 400 }
      );
    }

    const hsmHost = process.env.HSM_HOST || 'localhost';
    const hsmPort = parseInt(process.env.HSM_PORT || '9004');
    
    const hsmClient = new HSMSocketClient(hsmHost, hsmPort);
    const response = await hsmClient.signData(
      keyId,
      dataHash,
      cardName, 
      passphrase,
      hashAlgorithm
    );

    if (!response.success) {
      throw new Error(response.error || 'HSM signing operation failed');
    }

    return NextResponse.json({
      success: true,
      signature: response.signature, // Base64 encoded signature from HSM
      keyId: keyId,
      hashAlgorithm: hashAlgorithm,
      signatureAlgorithm: 'RSA-PSS', // Default, should come from HSM response
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('HSM signing error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `HSM signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}