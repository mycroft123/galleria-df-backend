import { B2 } from 'backblaze-b2';

let clientInstance: B2 | null = null;

const log = {
  info: (message: string, data?: any) => {
    console.log(`[B2Storage][${new Date().toISOString()}] ℹ️ ${message}`, data || '');
  },
  error: (message: string, error: any) => {
    console.error(`[B2Storage][${new Date().toISOString()}] ❌ ${message}`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  },
  success: (message: string, data?: any) => {
    console.log(`[B2Storage][${new Date().toISOString()}] ✅ ${message}`, data || '');
  }
};

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

      const { data: { uploadUrl, authorizationToken } } = await client.getUploadUrl({
        bucketId: process.env.NEXT_PUBLIC_B2_BUCKET_ID!
      });

      const timestamp = new Date().getTime();
      const fileName = `${timestamp}-${file.name}`;

      log.info('Uploading to B2...');
      const { data } = await client.uploadFile({
        uploadUrl,
        uploadAuthToken: authorizationToken,
        fileName,
        data: file,
        contentLength: file.size,
        contentType: file.type || 'application/octet-stream'
      });

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

      const blob = new Blob([JSON.stringify(data)], {
        type: 'application/json'
      });

      const { data: { uploadUrl, authorizationToken } } = await client.getUploadUrl({
        bucketId: process.env.NEXT_PUBLIC_B2_BUCKET_ID!
      });

      const timestamp = new Date().getTime();
      const fileName = `${timestamp}.json`;

      log.info('Uploading to B2...');
      const { data: uploadData } = await client.uploadFile({
        uploadUrl,
        uploadAuthToken: authorizationToken,
        fileName,
        data: blob,
        contentLength: blob.size,
        contentType: 'application/json'
      });

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