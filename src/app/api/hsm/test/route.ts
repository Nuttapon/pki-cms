import { NextResponse } from 'next/server';
import { HSMSocketClient } from '../../../../lib/hsm-socket';

export async function GET() {
  try {
    const socketPath = process.env.HSM_SOCKET_PATH || '/opt/nfast/sockets/nserver';
    const kmDataPath = process.env.HSM_KMDATA_PATH || '/opt/nfast/kmdata/local';
    
    const hsmClient = new HSMSocketClient(socketPath, kmDataPath);
    const response = await hsmClient.testConnection();

    if (!response.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: `HSM connection test failed: ${response.error}`,
          socketPath: socketPath,
          kmDataPath: kmDataPath
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'nFast HSM connection successful',
      socketPath: socketPath,
      kmDataPath: kmDataPath,
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