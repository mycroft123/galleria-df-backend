'use client';

import React, { useState } from 'react';
import b2StorageService from '@/services/b2StorageService';

export default function TestUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [jsonData, setJsonData] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const uploadResult = await b2StorageService.uploadFile(file);
      setResult(uploadResult);
    } catch (error) {
      console.error('File upload failed:', error);
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleJsonUpload = async () => {
    if (!jsonData) return;

    setLoading(true);
    try {
      const parsedData = JSON.parse(jsonData);
      const uploadResult = await b2StorageService.uploadData(parsedData);
      setResult(uploadResult);
    } catch (error) {
      console.error('JSON upload failed:', error);
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Backblaze B2 Upload Test</h1>
      <div className="space-y-8">
        {/* File Upload Section */}
        <div className="border rounded-lg p-6 bg-white">
          <h2 className="text-xl font-semibold mb-4">File Upload</h2>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mb-4 block w-full"
          />
          <button
            onClick={handleFileUpload}
            disabled={!file || loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>

        {/* JSON Upload Section */}
        <div className="border rounded-lg p-6 bg-white">
          <h2 className="text-xl font-semibold mb-4">JSON Upload</h2>
          <textarea
            value={jsonData}
            onChange={(e) => setJsonData(e.target.value)}
            placeholder="Enter JSON data here..."
            className="w-full h-32 p-2 border rounded mb-4"
          />
          <button
            onClick={handleJsonUpload}
            disabled={!jsonData || loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? 'Uploading...' : 'Upload JSON'}
          </button>
        </div>

        {/* Result Display */}
        {result && (
          <div className="border rounded-lg p-6 bg-white">
            <h2 className="text-xl font-semibold mb-4">Upload Result</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
            {result.success && result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline mt-4 block"
              >
                View Uploaded Content
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}