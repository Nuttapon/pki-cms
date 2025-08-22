import net from 'net';
import fs from 'fs/promises';
import path from 'path';

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

export interface SoftCard {
  name: string;
  path: string;
  isValid: boolean;
  certificates?: string[];
}

export class HSMSocketClient {
  private socket: net.Socket | null = null;
  private socketPath: string;
  private timeout: number;
  private kmDataPath: string;

  constructor(
    socketPath: string = '/opt/nfast/sockets/nserver',
    kmDataPath: string = '/opt/nfast/kmdata/local', 
    timeout: number = 30000
  ) {
    this.socketPath = socketPath;
    this.kmDataPath = kmDataPath;
    this.timeout = timeout;
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      
      const timeoutId = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error('HSM Unix socket connection timeout'));
      }, this.timeout);

      // Connect to Unix domain socket
      this.socket.connect(this.socketPath, () => {
        clearTimeout(timeoutId);
        console.log(`Connected to nFast HSM socket: ${this.socketPath}`);
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
        
        // Check if we have a complete response (nFast typically ends with newline)
        if (responseData.includes('\n')) {
          try {
            const response = JSON.parse(responseData.trim());
            clearTimeout(timeoutId);
            resolve(response);
          } catch {
            // Try parsing as raw response if not JSON
            clearTimeout(timeoutId);
            resolve({
              success: true,
              data: responseData.trim()
            });
          }
        }
      });

      this.socket.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(new Error(`HSM socket error: ${err.message}`));
      });

      // Send command to nFast (format may vary based on nFast protocol)
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

  // Discover softcards from filesystem
  async getSoftCards(): Promise<SoftCard[]> {
    try {
      const cards: SoftCard[] = [];
      
      // Check if kmdata directory exists
      try {
        await fs.access(this.kmDataPath);
      } catch {
        throw new Error(`nFast kmdata path not found: ${this.kmDataPath}`);
      }

      // Read directory contents
      const entries = await fs.readdir(this.kmDataPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const cardPath = path.join(this.kmDataPath, entry.name);
          
          // Check if it's a valid softcard directory
          try {
            const cardFiles = await fs.readdir(cardPath);
            const hasKeyFiles = cardFiles.some(file => 
              file.endsWith('.key') || file.endsWith('.crt') || file.includes('key_')
            );
            
            if (hasKeyFiles) {
              cards.push({
                name: entry.name,
                path: cardPath,
                isValid: true,
                certificates: cardFiles.filter(f => f.endsWith('.crt'))
              });
            }
          } catch {
            // Skip invalid card directories
            cards.push({
              name: entry.name,
              path: cardPath,
              isValid: false
            });
          }
        }
      }
      
      return cards;
    } catch (error) {
      throw new Error(`Failed to discover softcards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // List certificates from softcards
  async getCertificates(): Promise<HSMSocketResponse> {
    try {
      const softcards = await this.getSoftCards();
      const certificates = [];
      
      for (const card of softcards.filter(c => c.isValid)) {
        if (card.certificates) {
          for (const certFile of card.certificates) {
            try {
              const certPath = path.join(card.path, certFile);
              const certData = await fs.readFile(certPath, 'utf8');
              
              certificates.push({
                id: `${card.name}:${certFile}`,
                cardName: card.name,
                keyId: certFile.replace('.crt', ''),
                pemData: certData,
                subject: this.extractSubjectFromPEM(certData),
                issuer: this.extractIssuerFromPEM(certData),
                // Basic validation - in real implementation, parse the certificate
                validFrom: new Date().toISOString(),
                validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
              });
            } catch (err) {
              console.warn(`Failed to read certificate ${certFile} from card ${card.name}:`, err);
            }
          }
        }
      }

      return {
        success: true,
        certificates
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Extract subject from PEM certificate (basic parsing)
  private extractSubjectFromPEM(pemData: string): string {
    // This is a simplified extraction - in production use proper certificate parsing
    const lines = pemData.split('\n');
    for (const line of lines) {
      if (line.includes('Subject:')) {
        return line.replace('Subject:', '').trim();
      }
    }
    return 'Unknown Subject';
  }

  // Extract issuer from PEM certificate (basic parsing)
  private extractIssuerFromPEM(pemData: string): string {
    // This is a simplified extraction - in production use proper certificate parsing
    const lines = pemData.split('\n');
    for (const line of lines) {
      if (line.includes('Issuer:')) {
        return line.replace('Issuer:', '').trim();
      }
    }
    return 'Unknown Issuer';
  }

  // Sign data using nFast HSM with softcard
  async signData(
    keyId: string,
    dataHash: string,
    cardName: string,
    passphrase: string,
    hashAlgorithm: string = 'SHA-256'
  ): Promise<HSMSocketResponse> {
    try {
      // Verify softcard exists
      const softcards = await this.getSoftCards();
      const targetCard = softcards.find(c => c.name === cardName && c.isValid);
      
      if (!targetCard) {
        return {
          success: false,
          error: `Softcard '${cardName}' not found or invalid`
        };
      }

      // Connect to nFast socket
      await this.connect();

      // nFast specific signing command (this depends on actual nFast protocol)
      const signResponse = await this.sendCommand({
        command: 'SIGN_DATA',
        cardName: cardName,
        keyId: keyId,
        dataHash: dataHash,
        hashAlgorithm: hashAlgorithm,
        passphrase: passphrase
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

  // Test connection to nFast socket
  async testConnection(): Promise<HSMSocketResponse> {
    try {
      // Check socket file exists
      try {
        await fs.access(this.socketPath);
      } catch {
        return {
          success: false,
          error: `nFast socket file not found: ${this.socketPath}`
        };
      }

      // Test connection
      await this.connect();
      
      const response = await this.sendCommand({
        command: 'STATUS'
      });

      return {
        success: true,
        data: response.data || 'nFast HSM connection successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.disconnect();
    }
  }

  // Get softcard details
  async getSoftCardDetails(cardName: string): Promise<HSMSocketResponse> {
    try {
      const softcards = await this.getSoftCards();
      const card = softcards.find(c => c.name === cardName);
      
      if (!card) {
        return {
          success: false,
          error: `Softcard '${cardName}' not found`
        };
      }

      return {
        success: true,
        data: {
          name: card.name,
          path: card.path,
          isValid: card.isValid,
          certificates: card.certificates || []
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}