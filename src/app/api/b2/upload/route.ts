// src/app/api/b2/upload/route.ts

import { NextResponse } from 'next/server';
import B2 from 'backblaze-b2';

// Initialize B2 client
const b2Client = new B2({
  applicationKeyId: process.env.NEXT_PUBLIC_B2_KEY_ID!,
  applicationKey: process.env.NEXT_PUBLIC_B2_APP_KEY!
});

export async function POST(req: Request) {
  try {
    // Authorize with B2
    await b2Client.authorize();

    // Get upload URL
    const { data: { uploadUrl, authorizationToken } } = await b2Client.getUploadUrl({
      bucketId: process.env.NEXT_PUBLIC_B2_BUCKET_ID!
    });

    // Get the file from the request
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const fileName = `${Date.now()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to B2
    const { data } = await b2Client.uploadFile({
      uploadUrl,
      uploadAuthToken: authorizationToken,
      fileName,
      data: buffer,
      contentLength: buffer.length,
      contentType: file.type || 'application/octet-stream'
    });

    // Generate the download URL
    const url = `https://f005.backblazeb2.com/file/${process.env.NEXT_PUBLIC_B2_BUCKET_NAME}/${fileName}`;

    return NextResponse.json({
      success: true,
      fileId: data.fileId,
      fileName: data.fileName,
      url
    });

  } catch (error: any) {
    console.error('B2 upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}