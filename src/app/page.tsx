'use client';

import { useState } from 'react';
import { PKIUtils } from '../lib/pki-utils';
import * as pkijs from 'pkijs';

export default function Home() {
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [privateKeyFile, setPrivateKeyFile] = useState<File | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [parsedCertificate, setParsedCertificate] = useState<pkijs.Certificate | null>(null);

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

  const signData = async () => {
    if (!dataFile || !privateKey || !parsedCertificate) {
      setError('Please upload and parse all required files: certificate, private key, and data file.');
      return;
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
      
      const signedData = await PKIUtils.signData(dataBuffer, privateKey, parsedCertificate);
      
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
    if (!dataFile || !parsedCertificate) {
      setError('Please upload a signed data file (.p7s) and certificate for verification.');
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
      const verificationResult = await PKIUtils.verifySignature(signedDataBuffer, parsedCertificate);
      
      if (verificationResult.verified) {
        let resultText = 'Signature verification: SUCCESS ✓\n\nThe signature is valid and the data has not been tampered with.';
        
        if (verificationResult.data) {
          const originalDataText = new TextDecoder().decode(verificationResult.data);
          resultText += `\n\nOriginal data:\n${originalDataText}`;
          
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
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Upload Files
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Certificate (.crt/.pem)
              </label>
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
                For signing: any file | For verification: .p7s signature file
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

          <div className="flex gap-4 justify-center">
            <button
              onClick={signData}
              disabled={isLoading || !parsedCertificate || !privateKey || !dataFile}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Signing...' : 'Sign Data'}
            </button>
            
            <button
              onClick={verifySignature}
              disabled={isLoading || !parsedCertificate || !dataFile}
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
