"use client";

import React, { useState, ChangeEvent, FormEvent } from 'react';
import b2StorageService from '../services/b2StorageService';
import { nftService } from '../services/nftService';

interface FormData {
  fact: string;
  source: string;
  isPublic: boolean;
}

interface Status {
  isSubmitting: boolean;
  error: string | null;
  success: string | null;
}

const Header = () => (
  <div className="bg-gradient-to-r from-teal-600 to-blue-600 p-6 mb-8 shadow-lg">
    <div className="container mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="bg-white p-2 rounded-full">
            <svg 
              className="w-8 h-8 text-teal-600" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" 
              />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Submit Fact
            </h1>
            <p className="text-teal-100 mt-1">
              Add a New Verified Fact to the Platform
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function FactForm() {
  const [formData, setFormData] = useState<FormData>({
    fact: '',
    source: '',
    isPublic: true
  });

  const [status, setStatus] = useState<Status>({
    isSubmitting: false,
    error: null,
    success: null
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' 
      ? (e.target as HTMLInputElement).checked 
      : e.target.value;
    
    setFormData(prev => ({
      ...prev,
      [e.target.name]: value
    }));
  };

// Relevant part of FactForm.tsx - handleSubmit function

// Relevant part of your form component's handleSubmit function

const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setStatus({ isSubmitting: true, error: null, success: null });

  try {
      // Upload the fact data to B2
      const factData = {
          fact: formData.fact,
          source: formData.source,
          isPublic: formData.isPublic,
          timestamp: new Date().toISOString()
      };

      const uploadResult = await b2StorageService.uploadData(factData);

      if (uploadResult.success) {
          // Prepare the payload for NFT creation
          const payload = {
              action: "mint-nft",
              metadata: {
                  name: "OFACT",
                  symbol: "OFACT",
                  fact: formData.fact,
                  source: formData.source,
                  image: uploadResult.url,
                  external_url: uploadResult.url
              }
          };

          console.log("Submitting payload to /api/create-nft:", payload);

          const response = await fetch('/api/create-nft', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
          });

          const responseBody = await response.json();
          console.log("Response from /api/create-nft:", responseBody);

          if (response.ok && responseBody.success) {
              setStatus({
                  isSubmitting: false,
                  error: null,
                  success: `Successfully created NFT! Asset ID: ${responseBody.assetId}`,
              });
              setFormData({ fact: '', source: '', isPublic: true });
          } else {
              throw new Error(responseBody.message || "Failed to create NFT");
          }
      } else {
          throw new Error(uploadResult.error || "Upload to B2 failed");
      }
  } catch (error: any) {
      console.error("Error in handleSubmit:", error);
      setStatus({
          isSubmitting: false,
          error: error.message || 'An unknown error occurred',
          success: null,
      });
  }
};

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fact</label>
              <textarea
                name="fact"
                value={formData.fact}
                onChange={handleChange}
                className="w-full p-2 border rounded h-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your fact here..."
                required
                maxLength={500}
                disabled={status.isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <input
                type="text"
                name="source"
                value={formData.source}
                onChange={handleChange}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Source of the fact"
                required
                maxLength={200}
                disabled={status.isSubmitting}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="isPublic"
                checked={formData.isPublic}
                onChange={handleChange}
                className="h-4 w-4 mr-2 text-blue-500 focus:ring-2 focus:ring-blue-500"
                disabled={status.isSubmitting}
              />
              <label className="text-sm font-medium text-gray-700">Make this fact public</label>
            </div>

            {status.error && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                <div className="font-medium">Error</div>
                <div className="text-sm">{status.error}</div>
                {status.error.includes('authenticate') && (
                  <div className="mt-2 text-sm">
                    Please make sure your wallet is connected and try again.
                  </div>
                )}
              </div>
            )}

            {status.success && (
              <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded">
                <div className="font-medium">Success!</div>
                <div className="text-sm">{status.success}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={status.isSubmitting}
              className={`w-full py-2 px-4 rounded transition-colors
                ${status.isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'}
                text-white font-medium`}
            >
              {status.isSubmitting ? 'Uploading to B2...' : 'Upload Fact'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}