// src/services/b2StorageService.ts

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
  };
  
  export const b2StorageService = {
    uploadFile: async (file: File) => {
      try {
        log.info('Starting upload process...');
  
        const formData = new FormData();
        formData.append('file', file);
  
        const response = await fetch('/api/b2/upload', {
          method: 'POST',
          body: formData,
        });
  
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          throw new Error(errorData.error || 'Upload failed');
        }
  
        const result = await response.json();
        log.success('Upload successful!', result);
        return result;
      } catch (error) {
        log.error('Error during B2 upload', error);
        return { success: false, error: error.message };
      }
    },
  
    uploadData: async (data: any) => {
      try {
        log.info('Starting upload process...');
        
        // Convert data to blob
        const blob = new Blob([JSON.stringify(data)], {
          type: 'application/json'
        });
  
        // Create a File object from the blob
        const file = new File([blob], `${Date.now()}.json`, { type: 'application/json' });
  
        return await b2StorageService.uploadFile(file);
      } catch (error) {
        log.error('Error during B2 upload', error);
        return { success: false, error: error.message };
      }
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