import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, getAccount } from '@solana/spl-token';
import { NextResponse } from 'next/server';

const HELIUS_API_KEY = "791504b1-03a1-4fb9-b9df-25ad2e99d16f";
const HELIUS_RPC_URL = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const connection = new Connection(HELIUS_RPC_URL, 'confirmed');

const privateKeyUint8 = new Uint8Array([54,111,49,223,64,47,5,94,48,85,55,127,165,44,164,88,13,65,92,89,114,215,223,142,121,128,22,40,217,165,139,57,207,83,65,246,53,155,29,212,110,229,59,32,132,150,76,206,114,103,210,140,55,210,58,117,98,222,143,163,30,148,234,85]);
const senderKeypair = Keypair.fromSecretKey(privateKeyUint8);

const RECIPIENT_ADDRESS = 'FYFtKyhdQ3R2XigMsSpkLHr21pQw1NJm9V1RNcNYR23H';
const TOKEN_MINT_ADDRESS = '8mTDKt6gY1DatZDKbvMCdiw4AZRdCpUjxuRv4GRBg2Xn';
const TOKEN_DECIMALS = 6;
const AMOUNT = 10;
const AMOUNT_WITH_DECIMALS = AMOUNT * Math.pow(10, TOKEN_DECIMALS);

export async function POST() {
    try {
        console.log("Starting transaction...");
        console.log("Sender:", senderKeypair.publicKey.toString());
        console.log("Recipient:", RECIPIENT_ADDRESS);
        console.log("Amount:", AMOUNT, "tokens (", AMOUNT_WITH_DECIMALS, "raw amount)");

        const recipientPubkey = new PublicKey(RECIPIENT_ADDRESS);
        const tokenMintPubkey = new PublicKey(TOKEN_MINT_ADDRESS);

        const senderATA = await getAssociatedTokenAddress(
            tokenMintPubkey,
            senderKeypair.publicKey
        );

        const recipientATA = await getAssociatedTokenAddress(
            tokenMintPubkey,
            recipientPubkey
        );

        try {
            const tokenAccount = await getAccount(connection, senderATA);
            console.log("Current token balance:", tokenAccount.amount.toString());
            
            if (tokenAccount.amount < BigInt(AMOUNT_WITH_DECIMALS)) {
                return NextResponse.json({
                    success: false,
                    message: 'Insufficient token balance',
                    currentBalance: tokenAccount.amount.toString(),
                    requiredAmount: AMOUNT_WITH_DECIMALS.toString()
                }, { status: 400 });
            }
        } catch (error) {
            console.error("Error checking token account:", error);
            return NextResponse.json({
                success: false,
                message: 'Error checking token account',
                error: error.message
            }, { status: 400 });
        }

        const transferInstruction = createTransferInstruction(
            senderATA,
            recipientATA,
            senderKeypair.publicKey,
            AMOUNT_WITH_DECIMALS
        );

        const transaction = new Transaction().add(transferInstruction);
        
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = senderKeypair.publicKey;

        transaction.sign(senderKeypair);

        const signature = await connection.sendRawTransaction(
            transaction.serialize(),
            {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 3,
            }
        );

        console.log("Transaction sent! Signature:", signature);

        const confirmation = await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
        });

        if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err.toString()}`);
        }

        return NextResponse.json({
            success: true,
            message: 'Transaction sent successfully',
            signature,
            amount: AMOUNT,
            rawAmount: AMOUNT_WITH_DECIMALS,
            senderAddress: senderKeypair.publicKey.toString(),
            recipientAddress: RECIPIENT_ADDRESS,
            confirmation: {
                status: 'confirmed'
            }
        });

    } catch (error: any) {
        console.error('Transaction error:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to process transaction',
            error: error.message,
            senderAddress: senderKeypair.publicKey.toString()
        }, { status: 500 });
    }
}