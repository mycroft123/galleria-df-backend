import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { burn } from '@metaplex-foundation/mpl-token-metadata';
import { getAsset, getAssetsByOwner, burnAsset } from '@metaplex-foundation/mpl-bubblegum';

// Configure your connection
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const WALLET_ADDRESS = "ExK2ZcWx6tpVe5xfqkHZ62bMQNpStLj98z2WDUWKUKGp"; // Your wallet address

async function burnAllNFTs() {
    try {
        // Get all compressed NFTs
        console.log("Fetching compressed NFTs...");
        const compressedAssets = await getAssetsByOwner(connection, new PublicKey(WALLET_ADDRESS));
        
        // Burn each compressed NFT
        for (const asset of compressedAssets) {
            try {
                console.log(`Burning compressed NFT with assetId: ${asset.id}`);
                await burnAsset(connection, {
                    assetId: asset.id,
                    owner: new PublicKey(WALLET_ADDRESS),
                });
                console.log(`Successfully burned compressed NFT: ${asset.id}`);
            } catch (error) {
                console.error(`Error burning compressed NFT ${asset.id}:`, error);
            }
        }

        // Get all regular NFTs
        console.log("Fetching regular NFTs...");
        const nfts = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(WALLET_ADDRESS),
            { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
        );

        // Filter for NFTs (amount === 1)
        const actualNFTs = nfts.value.filter(token => {
            const amount = token.account.data.parsed.info.tokenAmount;
            return amount.amount === "1" && amount.decimals === 0;
        });

        // Burn each regular NFT
        for (const nft of actualNFTs) {
            try {
                console.log(`Burning regular NFT: ${nft.account.data.parsed.info.mint}`);
                await burn(connection, {
                    mint: new PublicKey(nft.account.data.parsed.info.mint),
                    owner: new PublicKey(WALLET_ADDRESS),
                });
                console.log(`Successfully burned NFT: ${nft.account.data.parsed.info.mint}`);
            } catch (error) {
                console.error(`Error burning NFT ${nft.account.data.parsed.info.mint}:`, error);
            }
        }

        console.log("Completed burning process");
        
    } catch (error) {
        console.error("Error in burn process:", error);
        throw error;
    }
}

// Execute the burning
burnAllNFTs().catch(console.error);