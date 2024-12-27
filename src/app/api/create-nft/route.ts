// src/app/api/create-nft/route.ts

import { NextResponse } from 'next/server';
import { POST as transferTokens } from '../send-transaction/route'; // Adjust path based on your folder structure

const HELIUS_RPC_URL = "https://devnet.helius-rpc.com/?api-key=791504b1-03a1-4fb9-b9df-25ad2e99d16f";

// Map of color to image URLs
const COLOR_TO_IMAGE_MAP: { [key: string]: string } = {
    blue: "https://rim3qi36iu6y55tmt77rm7w3ved7cpdjjrhty2kl3tplkez3drmq.arweave.net/ihm4I35FPY72bJ__Fn7bqQfxPGlMTzxpS9zetRM7HFk",
    yellow: "https://w6hav65sf2mc3do4yxsgex3rfupnngahqfibv7lphwvgisf7cfua.arweave.net/t44K-7IumC2N3MXkYl9xLR7WmAeBUBr9bz2qZEi_EWg",
    orange: "https://z325ctfzpasszfceuep3x4mv33dncyszsb2gcbg67rjljiguchba.arweave.net/zvXRTLl4JSyURKEfu_GV3sbRYlmQdGEE3vxStKDUEcI",
    purple: "https://vcbkxb2o4tbqmi3watpcr7smrk3sviqiibvqbzj443qxh7ltgzbq.arweave.net/qIKrh07kwwYjdgTeKP5MircqoghAawDlPObhc_1zNkM",
    green: "https://imauscty4e4ddllrj32jcna2gei5xpgigjxgplkbugqoceyo2j2q.arweave.net/QwFJCnjhODGtcU70kTQaMRHbvMgybmetQaGg4RMO0nU",
    red: "https://tczw6pw6uivwwld5pas5bfaxcjhd5ssfndhu6eoqynggvehj2aua.arweave.net/mLNvPt6iK2ssfXgl0JQXEk4-ykVoz08R0MNMapDp0Cg"
};

// Default image if no color match is found
const DEFAULT_IMAGE = "https://rim3qi36iu6y55tmt77rm7w3ved7cpdjjrhty2kl3tplkez3drmq.arweave.net/ihm4I35FPY72bJ__Fn7bqQfxPGlMTzxpS9zetRM7HFkk";

async function mintCompressedNftHelius(metadata: any): Promise<string> {
    try {
        console.log("Starting Helius Mint API request...");

        const chosenColor = metadata.source; 

        const rpcRequest = {
            jsonrpc: '2.0',
            id: 'helius-test',
            method: 'mintCompressedNft',
            params: {
                name: metadata.name,
                symbol: metadata.symbol,
                owner: "ExK2ZcWx6tpVe5xfqkHZ62bMQNpStLj98z2WDUWKUKGp",
                description: metadata.description,
                attributes: metadata.attributes,
                imageUrl: COLOR_TO_IMAGE_MAP[chosenColor] || DEFAULT_IMAGE,
                externalUrl: metadata.external_url,
                sellerFeeBasisPoints: 0
            }
        };

        console.log("Sending RPC request:", JSON.stringify(rpcRequest, null, 2));

        const response = await fetch(HELIUS_RPC_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(rpcRequest)
        });

        const responseBody = await response.text();
        console.log("Full response body:", responseBody);

        const parsedResponse = JSON.parse(responseBody);
        const { result, error } = parsedResponse;

        if (result?.assetId) {
            console.log("Minted asset:", result.assetId);
            return result.assetId;
        } else {
            console.error("Helius Mint API failed:", error || parsedResponse);
            throw new Error(error?.message || "Failed to mint compressed NFT.");
        }
    } catch (error) {
        console.error("Error during Helius Mint API request:", error);
        throw error;
    }
}

export async function POST(request: Request) {
    try {
        const { metadata } = await request.json();
        console.log("Received POST data:", metadata);

        // Get the image URL based on the source color, or use default if not found
        const sourceColor = metadata.source?.toLowerCase() || '';
        const imageUrl = COLOR_TO_IMAGE_MAP[sourceColor] || DEFAULT_IMAGE;

        const assetId = await mintCompressedNftHelius({
            name: metadata.name,
            symbol: metadata.symbol,
            description: metadata.fact || "A verified fact on DeFacto",
            attributes: [
                {
                    trait_type: "Source",
                    value: metadata.source || "Unknown"
                },
                {
                    trait_type: "Type",
                    value: "Fact"
                }
            ],
            imageUrl: imageUrl,  // Changed to pass the correct imageUrl
            external_url: metadata.image
        });

        // Step 2: Transfer tokens
        console.log("Initiating token transfer...");
        const transferResponse = await transferTokens();

        return NextResponse.json({
            success: true,
            assetId,
            message: "Fact NFT created successfully via Helius Mint API",
        });
    } catch (error: any) {
        console.error("POST Error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "An error occurred" },
            { status: 500 }
        );
    }
}