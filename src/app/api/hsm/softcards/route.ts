import { NextResponse } from 'next/server';
import { HSMSocketClient } from '../../../../lib/hsm-socket';

export async function GET() {
  try {
    const socketPath = process.env.HSM_SOCKET_PATH || '/opt/nfast/sockets/nserver';
    const kmDataPath = process.env.HSM_KMDATA_PATH || '/opt/nfast/kmdata/local';
    
    const hsmClient = new HSMSocketClient(socketPath, kmDataPath);
    const softcards = await hsmClient.getSoftCards();

    return NextResponse.json({
      success: true,
      softcards: softcards.map(card => ({
        name: card.name,
        path: card.path,
        isValid: card.isValid,
        certificateCount: card.certificates?.length || 0,
        certificates: card.certificates || []
      }))
    });

  } catch (error) {
    console.error('Softcard discovery error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to discover softcards: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}