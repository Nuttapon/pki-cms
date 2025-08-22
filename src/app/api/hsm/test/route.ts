import { NextResponse } from 'next/server';
import { HSMSocketClient } from '../../../../lib/hsm-socket';

export async function GET() {
  try {
    const hsmHost = process.env.HSM_HOST || 'localhost';
    const hsmPort = parseInt(process.env.HSM_PORT || '9004');
    
    const hsmClient = new HSMSocketClient(hsmHost, hsmPort);
    const response = await hsmClient.testConnection();

    if (!response.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: `HSM connection test failed: ${response.error}`,
          host: hsmHost,
          port: hsmPort
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'HSM connection successful',
      host: hsmHost,
      port: hsmPort,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('HSM test connection error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `HSM connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}