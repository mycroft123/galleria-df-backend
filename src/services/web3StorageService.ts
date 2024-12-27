Start new chat

Projects

Starred
Star projects and chats you use often
Recents

Migrate to Backblaze B2 Storage
Finding your web3.storage API token
Troubleshooting Web3.Storage Authentication Issue
Troubleshooting Web3.Storage DID and Space Issues
Troubleshooting Web3 CLI Command Error
Implementing Web3.Storage Service for Next.js
Troubleshooting Web3.Storage client initialization

💬 can you help me parse this dat...

View all
Professional plan
Help & support
MH

i want to convert this to backblaze b2

I'll help you create a similar service using Backblaze B2 instead of Web3.Storage. I'll create two files - a service for handling B2 operations and a modified page component.

To use this implementation, you'll need to:

Install the Backblaze B2 SDK:

bash

npm install backblaze-b2

Set up these environment variables in your .env.local:

NEXT_PUBLIC_B2_KEY_ID=your_key_id
NEXT_PUBLIC_B2_APP_KEY=your_application_key
NEXT_PUBLIC_B2_BUCKET_ID=your_bucket_id
NEXT_PUBLIC_B2_BUCKET_NAME=your_bucket_name

The main differences from the Web3.Storage implementation are:

Using the Backblaze B2 SDK instead of Web3.Storage
Different authentication mechanism using application key ID and key
Files are stored in a B2 bucket instead of IPFS
URLs are generated using the B2 file path format
Additional metadata like fileId and fileName are returned
Direct file uploads instead of IPFS-specific methods

The UI remains largely the same, just with updated text to reflect B2 instead of Web3.Storage. The service maintains similar logging and error handling patterns for consistency.

Would you like me to explain any part of the implementation in more detail?
MH

where do i get the keys?

Let me walk you through how to get the Backblaze B2 keys:

First, create a Backblaze account:
    Go to https://www.backblaze.com/b2/sign-up.html
    Sign up for a free account (you get 10GB free storage)
Create a bucket:
    After logging in, go to the B2 Cloud Storage section
    Click "Create a Bucket"
    Choose a unique bucket name
    Set the bucket to "Public" if you want the files to be publicly accessible
    Note down the "Bucket ID" and "Bucket Name" - you'll need these for your env variables
Create application keys:
    In the B2 dashboard, click on "App Keys" in the left sidebar
    Click "Add a New Application Key"
    In the form:

- Name: Give it a descriptive name (e.g., "Upload Service")
- Allow access to Bucket: Select your bucket
- Type of Access: Select "Read and Write"

    Click "Create New Key"
IMPORTANT: After creating the key, you'll see:
    "applicationKeyId" (this is your NEXT_PUBLIC_B2_KEY_ID)
    "applicationKey" (this is your NEXT_PUBLIC_B2_APP_KEY)
    ⚠️ Save these immediately! The application key will only be shown once
Add these to your .env.local:

NEXT_PUBLIC_B2_KEY_ID=your_application_key_id
NEXT_PUBLIC_B2_APP_KEY=your_application_key
NEXT_PUBLIC_B2_BUCKET_ID=your_bucket_id
NEXT_PUBLIC_B2_BUCKET_NAME=your_bucket_name

Remember that since we're using these in the browser (with NEXT_PUBLIC prefix), you should set appropriate CORS settings in your B2 bucket and implement proper access controls in your application to prevent unauthorized uploads.

Would you like me to explain how to set up CORS for your bucket as well?
Claude can make mistakes. Please double-check responses.


Backblaze B2 Storage Service
import { B2 } from 'backblaze-b2';

let clientInstance: B2 | null = null;

const log = {
info: (message: string, data?: any) => {
console.log(`[B2Storage][${new Date().toISOString()}] ℹ️ ${message}`, data || '')
},
error: (message: string, error: any) => {
console.error(`[B2Storage][${new Date().toISOString()}] ❌ ${message}`, {
  message: error.message,
  stack: error.stack,
  name: error.name
})
},
success: (message: string, data?: any) => {
console.log(`[B2Storage][${new Date().toISOString()}] ✅ ${message}`, data || '')
}
}

export const b2StorageService = {
initializeClient: async () => {
try {
  if (clientInstance) {
    return clientInstance;
  }

  log.info('Creating Backblaze B2 client...');
  
  const b2 = new B2({
    applicationKeyId: process.env.NEXT_PUBLIC_B2_KEY_ID!,
    applicationKey: process.env.NEXT_PUBLIC_B2_APP_KEY!
  });

  await b2.authorize();
  
  log.success('Client setup completed successfully');
  
  clientInstance = b2;
  return b2;
} catch (error) {
  log.error('Failed to initialize client', error);
  throw error;
}
},

uploadFile: async (file: File) => {
try {
  log.info('Starting upload process...');
  const client = await b2StorageService.initializeClient();

  // Get upload URL and authorization token
  const { data: { uploadUrl, authorizationToken } } = await client.getUploadUrl({
    bucketId: process.env.NEXT_PUBLIC_B2_BUCKET_ID!
  });

  // Create a unique filename
  const timestamp = new Date().getTime();
  const fileName = `${timestamp}-${file.name}`;

  // Upload the file
  log.info('Uploading to B2...');
  const { data } = await client.uploadFile({
    uploadUrl,
    uploadAuthToken: authorizationToken,
    fileName,
    data: file,
    contentLength: file.size,
    contentType: file.type || 'application/octet-stream'
  });

  // Generate the public URL
  const url = `https://f002.backblazeb2.com/file/${process.env.NEXT_PUBLIC_B2_BUCKET_NAME}/${fileName}`;

  log.success('Upload successful!', { fileId: data.fileId, url });
  return { 
    success: true, 
    fileId: data.fileId, 
    fileName: data.fileName,
    url 
  };
} catch (error) {
  log.error('Error during B2 upload', error);
  return { success: false, error: error.message };
}
},

uploadData: async (data: any) => {
try {
  log.info('Starting upload process...');
  const client = await b2StorageService.initializeClient();

  // Create a blob with the data
  const blob = new Blob([JSON.stringify(data)], {
    type: 'application/json'
  });

  // Get upload URL and authorization token
  const { data: { uploadUrl, authorizationToken } } = await client.getUploadUrl({
    bucketId: process.env.NEXT_PUBLIC_B2_BUCKET_ID!
  });

  // Create a unique filename
  const timestamp = new Date().getTime();
  const fileName = `${timestamp}.json`;

  // Upload the blob
  log.info('Uploading to B2...');
  const { data: uploadData } = await client.uploadFile({
    uploadUrl,
    uploadAuthToken: authorizationToken,
    fileName,
    data: blob,
    contentLength: blob.size,
    contentType: 'application/json'
  });

  // Generate the public URL
  const url = `https://f002.backblazeb2.com/file/${process.env.NEXT_PUBLIC_B2_BUCKET_NAME}/${fileName}`;

  log.success('Upload successful!', { fileId: uploadData.fileId, url });
  return { 
    success: true, 
    fileId: uploadData.fileId, 
    fileName: uploadData.fileName,
    url 
  };
} catch (error) {
  log.error('Error during B2 upload', error);
  return { success: false, error: error.message };
}
},

resetClient: () => {
clientInstance = null;
log.info('Client instance reset');
}
};

export type UploadResult = {
success: boolean;
fileId?: string;
fileName?: string;
url?: string;
error?: string;
};

export default b2StorageService;
Last edited 14 minutes ago
