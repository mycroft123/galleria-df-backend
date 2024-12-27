// api/nftService.ts
import { FormData, LogEntry, FactData } from '@/types';

class APIError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'APIError';
    }
}

export const nftService = {
    async getLogs(): Promise<LogEntry[]> {
        try {
            const response = await fetch('/api/get-logs');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            throw new APIError('Failed to fetch logs: ' + (error instanceof Error ? error.message : String(error)));
        }
    },

    async submitLog(formData: FormData) {
        try {
            const response = await fetch('/api/submit-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            throw new APIError('Failed to submit log: ' + (error instanceof Error ? error.message : String(error)));
        }
    },

// api/nftService.ts
import { FormData, LogEntry, FactData } from '@/types';

class APIError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'APIError';
    }
}

export const nftService = {
    // ... other existing methods ...

    async createNFT(metadata: Record<string, any>) {
        try {
            // First create the NFT
            const response = await fetch('/api/create-nft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(metadata),
            });
    
            const rawResponse = await response.text();
            console.log('Raw server response:', rawResponse);
    
            if (!response.ok) {
                const errorData = JSON.parse(rawResponse);
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            // After successful NFT creation, execute the transfer
            const transferResponse = await fetch('/api/transfer-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromAddress: 'ExK2ZcWx6tpVe5xfqkHZ62bMQNpStLj98z2WDUWKUKGp',
                    toAddress: 'FYFtKyhdQ3R2XigMsSpkLHr21pQw1NJm9V1RNcNYR23H',
                    amount: 10,
                    tokenAddress: '8mTDKt6gY1DatZDKbvMCdiw4AZRdCpUjxuRv4GRBg2Xn'
                })
            });

            if (!transferResponse.ok) {
                throw new Error(`Transfer failed! status: ${transferResponse.status}`);
            }

            // Return both the NFT creation result and transfer result
            const nftResult = JSON.parse(rawResponse);
            const transferResult = await transferResponse.json();
            
            return {
                nft: nftResult,
                transfer: transferResult
            };
        } catch (error) {
            throw new APIError(
                'Failed to create NFT or execute transfer: ' + 
                (error instanceof Error ? error.message : String(error))
            );
        }
    },


    
    

    async getUserFacts(): Promise<FactData[]> {
        try {
            const response = await fetch('/api/get-user-facts');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            throw new APIError('Failed to fetch user facts: ' + (error instanceof Error ? error.message : String(error)));
        }
    },

    async verifyFact(address: string) {
        try {
            const response = await fetch(`/api/verify-fact/${address}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            throw new APIError('Failed to verify fact: ' + (error instanceof Error ? error.message : String(error)));
        }
    },

    async transferFact(address: string, newOwner: string) {
        try {
            const response = await fetch('/api/transfer-fact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, newOwner })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            throw new APIError('Failed to transfer fact: ' + (error instanceof Error ? error.message : String(error)));
        }
    },

    async deleteFact(address: string) {
        try {
            const response = await fetch(`/api/delete-fact/${address}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            throw new APIError('Failed to delete fact: ' + (error instanceof Error ? error.message : String(error)));
        }
    },

    async getTreeLeaves(treeAddress: string) {
        try {
            const response = await fetch(`/api/get-tree-leaves/${treeAddress}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            throw new APIError('Failed to fetch tree leaves: ' + (error instanceof Error ? error.message : String(error)));
        }
    },

    async getAllTrees() {
        try {
            const response = await fetch('/api/get-all-trees');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            throw new APIError('Failed to fetch trees: ' + (error instanceof Error ? error.message : String(error)));
        }
    }
};