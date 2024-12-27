"use client";

import { useState } from 'react';

export default function BurnNFTsButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleBurn = async () => {
    if (!confirm('Are you sure you want to burn all NFTs? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/burn-nfts', {
        method: 'POST',
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ success: false, message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4">
      <button
        onClick={handleBurn}
        disabled={isLoading}
        className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
      >
        {isLoading ? 'Burning...' : 'Burn All NFTs'}
      </button>

      {result && (
        <div className="mt-4">
          <h3 className="font-bold">Results:</h3>
          <pre className="mt-2 p-4 bg-gray-100 rounded">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}