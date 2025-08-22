import net from 'net';

export interface HSMSocketMessage {
  command: string;
  keyId?: string;
  cardName?: string;
  passphrase?: string;
  dataHash?: string;
  hashAlgorithm?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export interface HSMSocketResponse {
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  certificates?: any[];
  signature?: string;
}

export class HSMSocketClient {
  private socket: net.Socket | null = null;
  private host: string;
  private port: number;
  private timeout: number;

  constructor(host: string = 'localhost', port: number = 9004, timeout: number = 30000) {
    this.host = host;
    this.port = port;
    this.timeout = timeout;
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      
      const timeoutId = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error('HSM socket connection timeout'));
      }, this.timeout);

      this.socket.connect(this.port, this.host, () => {
        clearTimeout(timeoutId);
        console.log(`Connected to nFast HSM at ${this.host}:${this.port}`);
        resolve();
      });

      this.socket.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(new Error(`HSM socket connection failed: ${err.message}`));
      });
    });
  }

  private async sendCommand(message: HSMSocketMessage): Promise<HSMSocketResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      let responseData = '';

      const timeoutId = setTimeout(() => {
        reject(new Error('HSM command timeout'));
      }, this.timeout);

      this.socket.on('data', (data) => {
        responseData += data.toString();
        
        // Check if we have a complete JSON response
        try {
          const response = JSON.parse(responseData);
          clearTimeout(timeoutId);
          resolve(response);
        } catch {
          // Continue receiving data if JSON is incomplete
        }
      });

      this.socket.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(new Error(`HSM socket error: ${err.message}`));
      });

      // Send command as JSON
      const command = JSON.stringify(message) + '\n';
      this.socket.write(command);
    });
  }

  private disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  // ดึง certificates จาก HSM
  async getCertificates(): Promise<HSMSocketResponse> {
    try {
      await this.connect();
      
      const response = await this.sendCommand({
        command: 'LIST_CERTIFICATES'
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.disconnect();
    }
  }

  // Sign data ด้วย HSM
  async signData(
    keyId: string, 
    dataHash: string, 
    cardName: string, 
    passphrase: string, 
    hashAlgorithm: string = 'SHA-256'
  ): Promise<HSMSocketResponse> {
    try {
      await this.connect();

      // Authenticate with card first
      const authResponse = await this.sendCommand({
        command: 'AUTHENTICATE',
        cardName: cardName,
        passphrase: passphrase
      });

      if (!authResponse.success) {
        return {
          success: false,
          error: `HSM authentication failed: ${authResponse.error}`
        };
      }

      // Perform signing operation
      const signResponse = await this.sendCommand({
        command: 'SIGN_HASH',
        keyId: keyId,
        dataHash: dataHash,
        hashAlgorithm: hashAlgorithm
      });

      return signResponse;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.disconnect();
    }
  }

  // Get certificate details from HSM
  async getCertificateDetails(keyId: string): Promise<HSMSocketResponse> {
    try {
      await this.connect();
      
      const response = await this.sendCommand({
        command: 'GET_CERTIFICATE',
        keyId: keyId
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.disconnect();
    }
  }

  // Test HSM connection
  async testConnection(): Promise<HSMSocketResponse> {
    try {
      await this.connect();
      
      const response = await this.sendCommand({
        command: 'PING'
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.disconnect();
    }
  }
}