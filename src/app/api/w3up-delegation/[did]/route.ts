// app/api/w3up-delegation/[did]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import * as Client from '@web3-storage/w3up-client'
import { StoreMemory } from '@web3-storage/w3up-client/stores/memory'
import * as Proof from '@web3-storage/w3up-client/proof'
import { Signer } from '@web3-storage/w3up-client/principal/ed25519'
import * as DID from '@ipld/dag-ucan/did'

export async function GET(
  request: NextRequest,
  context: { params: { did: string } }
): Promise<NextResponse> {
  try {
    const { params } = context;

    // Load client with specific private key from environment
    if (!process.env.W3UP_KEY || !process.env.W3UP_PROOF) {
      throw new Error('Missing required environment variables: W3UP_KEY or W3UP_PROOF');
    }

    const principal = Signer.parse(process.env.W3UP_KEY);
    const store = new StoreMemory();
    const client = await Client.create({ principal, store });

    // Add proof that this agent has been delegated capabilities on the space
    const proof = await Proof.parse(process.env.W3UP_PROOF);
    const space = await client.addSpace(proof);
    await client.setCurrentSpace(space.did());

    // Create a delegation for the requesting DID
    const audience = DID.parse(params.did);
    const abilities = ['space/blob/add', 'space/index/add', 'filecoin/offer', 'upload/add'];
    const expiration = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24 hours

    const delegation = await client.createDelegation(audience, abilities, { expiration });
    const archive = await delegation.archive();

    if (!archive.ok) {
      throw new Error('Failed to create delegation archive');
    }

    return new NextResponse(archive.ok, {
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });
  } catch (error: any) {
    return new NextResponse(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
