'use client';

import { useState, useEffect } from 'react';
import { PKIUtils } from '../lib/pki-utils';
import { HSMUtils, HSMCertificate } from '../lib/hsm-utils';
import * as pkijs from 'pkijs';

export default function Home() {
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [caChainFile, setCaChainFile] = useState<File | null>(null);
  const [privateKeyFile, setPrivateKeyFile] = useState<File | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [parsedCertificate, setParsedCertificate] = useState<pkijs.Certificate | null>(null);
  const [caChainCertificates, setCaChainCertificates] = useState<pkijs.Certificate[]>([]);
  
  // HSM state
  const [useHSM, setUseHSM] = useState(false);
  const [hsmCertificates, setHsmCertificates] = useState<HSMCertificate[]>([]);
  const [selectedHSMCert, setSelectedHSMCert] = useState<HSMCertificate | null>(null);
  const [hsmLoading, setHsmLoading] = useState(false);
  const [hsmCardName, setHsmCardName] = useState<string>('');
  const [hsmPassphrase, setHsmPassphrase] = useState<string>('');

  const handleCertificateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCertificateFile(file);
      setError('');
      setIsLoading(true);
      
      try {
        const text = await file.text();
        const buffer = PKIUtils.pemToArrayBuffer(text);
        const certInfo = await PKIUtils.parseCertificate(buffer);
        
        const asn1 = await import('asn1js');
        const asn1Data = asn1.fromBER(buffer);
        const certificate = new pkijs.Certificate({ schema: asn1Data.result });
        setParsedCertificate(certificate);
        
        setResult(`Certificate loaded successfully!\nSubject: ${certInfo.subject}\nValid from: ${certInfo.validFrom.toLocaleDateString()} to ${certInfo.validTo.toLocaleDateString()}`);
      } catch (err) {
        setError(`Certificate parsing failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCaChainUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCaChainFile(file);
      setError('');
      setIsLoading(true);
      
      try {
        const text = await file.text();
        const certificates = await PKIUtils.parseCertificateChain(text);
        setCaChainCertificates(certificates);
        setResult(`CA chain loaded successfully! Found ${certificates.length} certificate(s) in chain.`);
      } catch (err) {
        setError(`CA chain parsing failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handlePrivateKeyUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPrivateKeyFile(file);
      setError('');
      setIsLoading(true);
      
      try {
        const text = await file.text();
        const buffer = PKIUtils.pemToArrayBuffer(text);
        const key = await PKIUtils.parsePrivateKey(buffer);
        setPrivateKey(key);
        setResult('Private key loaded successfully!');
      } catch (err) {
        setError(`Private key parsing failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDataFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setDataFile(file);
      setError('');
    }
  };

  // Load HSM certificates on component mount
  useEffect(() => {
    if (useHSM) {
      loadHSMCertificates();
    }
  }, [useHSM]);

  const loadHSMCertificates = async () => {
    setHsmLoading(true);
    setError('');
    
    try {
      const certs = await HSMUtils.getAvailableCertificates();
      setHsmCertificates(certs);
      setResult(`Found ${certs.length} certificates in HSM`);
    } catch (err) {
      setError(`Failed to load HSM certificates: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setHsmLoading(false);
    }
  };

  const signData = async () => {
    if (!dataFile) {
      setError('Please upload a data file to sign.');
      return;
    }

    // Check requirements based on signing method
    if (useHSM) {
      if (!selectedHSMCert) {
        setError('Please select an HSM certificate for signing.');
        return;
      }
      if (!hsmCardName.trim()) {
        setError('Please enter HSM card name.');
        return;
      }
      if (!hsmPassphrase.trim()) {
        setError('Please enter HSM passphrase.');
        return;
      }
    } else {
      if (!privateKey || !parsedCertificate) {
        setError('Please upload and parse certificate and private key files.');
        return;
      }
    }

    setIsLoading(true);
    setError('');
    setResult('');

    try {
      // Show file size information
      const fileSizeMB = (dataFile.size / (1024 * 1024)).toFixed(2);
      setResult(`Processing ${fileSizeMB}MB file for signing...`);
      
      // Add small delay to allow UI update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataBuffer = await dataFile.arrayBuffer();
      setResult(`File loaded, creating digital signature...`);
      
      // Add another delay before intensive crypto operation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let signedData: ArrayBuffer;
      
      if (useHSM && selectedHSMCert) {
        // HSM signing
        setResult(`Signing with HSM certificate: ${selectedHSMCert.subject}...`);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Parse HSM certificate
        const hsmCertificate = await HSMUtils.parseCertificateFromPEM(selectedHSMCert.pemData);
        
        signedData = await PKIUtils.signDataWithHSM(
          dataBuffer, 
          selectedHSMCert.keyId, 
          hsmCertificate, 
          caChainCertificates,
          hsmCardName,
          hsmPassphrase
        );
      } else {
        // Client-side signing (original method)
        signedData = await PKIUtils.signData(dataBuffer, privateKey!, parsedCertificate!, caChainCertificates);
      }
      
      const signedPem = PKIUtils.arrayBufferToPem(signedData, 'PKCS11');
      setResult(`Data signed successfully! (${fileSizeMB}MB file)\n\nFile size: ${dataFile.size.toLocaleString()} bytes\nSignature size: ${signedData.byteLength.toLocaleString()} bytes\n\nDownloading signed file...`);
      
      const blob = new Blob([signedPem], { type: 'application/pkcs7-signature' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataFile.name}.p7s`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Signing failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const verifySignature = async () => {
    if (!dataFile) {
      setError('Please upload a signed data file (.p7s) for verification.');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult('');

    try {
      const signedDataText = await dataFile.text();
      
      // Check if the file looks like a PEM signature file
      if (!signedDataText.includes('-----BEGIN') || !signedDataText.includes('-----END')) {
        setError('Please upload a .p7s signature file (PEM format), not the original data file. The signature file was downloaded when you clicked "Sign Data".');
        setIsLoading(false);
        return;
      }
      
      const signedDataBuffer = PKIUtils.pemToArrayBuffer(signedDataText);
      const verificationResult = await PKIUtils.verifySignature(signedDataBuffer, parsedCertificate || undefined);
      
      if (verificationResult.verified) {
        let resultText = 'Signature verification: SUCCESS ✓\n\nThe signature is valid and the data has not been tampered with.';
        
        // Show certificate information if it was extracted from the signature
        if (verificationResult.certificate && !parsedCertificate) {
          const cert = verificationResult.certificate;
          const subject = cert.subject.typesAndValues.map(attr => 
            `${attr.type}=${attr.value.valueBlock.value}`
          ).join(', ');
          resultText += `\n\nCertificate (extracted from signature):\nSubject: ${subject}`;
        }
        
        // Show certificate chain information
        if (verificationResult.certificateChain && verificationResult.certificateChain.length > 1) {
          resultText += `\n\nCertificate Chain (${verificationResult.certificateChain.length} certificates):`;
          verificationResult.certificateChain.forEach((cert, index) => {
            const subject = cert.subject.typesAndValues.map(attr => 
              `${attr.type}=${attr.value.valueBlock.value}`
            ).join(', ');
            const role = index === 0 ? 'Signer' : index === verificationResult.certificateChain!.length - 1 ? 'Root CA' : 'Intermediate CA';
            resultText += `\n  ${index + 1}. ${role}: ${subject}`;
          });
        }
        
        if (verificationResult.data) {
          const originalDataText = new TextDecoder().decode(verificationResult.data);
          const truncatedData = originalDataText.length > 500 
            ? originalDataText.substring(0, 500) + '...' 
            : originalDataText;
          resultText += `\n\nOriginal data (${verificationResult.data.byteLength.toLocaleString()} bytes):\n${truncatedData}`;
          
          const blob = new Blob([verificationResult.data], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'extracted_data.txt';
          a.click();
          URL.revokeObjectURL(url);
        }
        
        setResult(resultText);
      } else {
        setResult('Signature verification: FAILED ✗\n\nThe signature is invalid or the data has been tampered with.');
      }
    } catch (err) {
      setError(`Verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          PKI Digital Signature Tool
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              {useHSM ? 'HSM Certificate Signing' : 'Upload Files'}
            </h2>
            <div className="flex items-center space-x-2">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={useHSM}
                  onChange={(e) => setUseHSM(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:ring-blue-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Use HSM nFast
                </span>
              </label>
            </div>
          </div>
          
          {useHSM ? (
            // HSM Certificate Selection
            <div className="space-y-4 mb-6">
              <div className="border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    HSM Certificates
                  </label>
                  <button
                    onClick={loadHSMCertificates}
                    disabled={hsmLoading}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {hsmLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Select certificate from HSM for signing
                </p>
                
                {hsmCertificates.length > 0 ? (
                  <select
                    value={selectedHSMCert?.id || ''}
                    onChange={(e) => {
                      const cert = hsmCertificates.find(c => c.id === e.target.value);
                      setSelectedHSMCert(cert || null);
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Select HSM Certificate...</option>
                    {hsmCertificates.map((cert) => (
                      <option key={cert.id} value={cert.id}>
                        {cert.subject} (Valid until: {new Date(cert.validTo).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-500">No HSM certificates found. Click Refresh to load.</p>
                )}
                
                {selectedHSMCert && (
                  <div className="mt-2 p-2 bg-green-50 rounded text-xs">
                    <p><strong>Selected:</strong> {selectedHSMCert.subject}</p>
                    <p><strong>Key ID:</strong> {selectedHSMCert.keyId}</p>
                  </div>
                )}
              </div>
              
              {/* HSM Card Name และ Passphrase */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border-2 border-dashed border-yellow-300 dark:border-yellow-600 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    HSM Card Name
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    nFast security card name (e.g., &quot;card1&quot;, &quot;smartcard&quot;)
                  </p>
                  <input
                    type="text"
                    value={hsmCardName}
                    onChange={(e) => setHsmCardName(e.target.value)}
                    placeholder="Enter card name..."
                    className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="border-2 border-dashed border-red-300 dark:border-red-600 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    HSM Passphrase
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Security passphrase for HSM card authentication
                  </p>
                  <input
                    type="password"
                    value={hsmPassphrase}
                    onChange={(e) => setHsmPassphrase(e.target.value)}
                    placeholder="Enter passphrase..."
                    className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              {/* Data File Upload for HSM */}
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data File
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  File to be signed using HSM
                </p>
                <input
                  type="file"
                  onChange={handleDataFileUpload}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {dataFile && (
                  <p className="text-xs text-green-600 mt-1">✓ {dataFile.name}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Certificate (.crt/.pem)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Required for signing | Optional for verification (auto-extracted from .p7s)
              </p>
              <input
                type="file"
                accept=".crt,.pem,.cer"
                onChange={handleCertificateUpload}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {certificateFile && (
                <p className="text-xs text-green-600 mt-1">✓ {certificateFile.name}</p>
              )}
            </div>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                CA Chain (.crt/.pem)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Optional: Root CA + Intermediate certificates for full chain validation
              </p>
              <input
                type="file"
                accept=".crt,.pem,.cer"
                onChange={handleCaChainUpload}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
              {caChainFile && (
                <p className="text-xs text-green-600 mt-1">✓ {caChainFile.name} ({caChainCertificates.length} certs)</p>
              )}
            </div>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Private Key (.key/.pem)
              </label>
              <input
                type="file"
                accept=".key,.pem"
                onChange={handlePrivateKeyUpload}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {privateKeyFile && (
                <p className="text-xs text-green-600 mt-1">✓ {privateKeyFile.name}</p>
              )}
            </div>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Data File
              </label>
              <p className="text-xs text-gray-500 mb-2">
                For signing: any file | For verification: .p7s signature file (certificate auto-extracted)
              </p>
              <input
                type="file"
                onChange={handleDataFileUpload}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {dataFile && (
                <p className="text-xs text-green-600 mt-1">✓ {dataFile.name}</p>
              )}
            </div>
          </div>
          )}

          <div className="flex gap-4 justify-center">
            <button
              onClick={signData}
              disabled={isLoading || !dataFile || (useHSM ? !selectedHSMCert : (!parsedCertificate || !privateKey))}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Signing...' : useHSM ? 'Sign with HSM' : 'Sign Data'}
            </button>
            
            <button
              onClick={verifySignature}
              disabled={isLoading || !dataFile}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Verifying...' : 'Verify Signature'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Result
            </h3>
            <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-sm overflow-x-auto">
              {result}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
