// src/types/index.ts

export interface FormData {
    // Add your form fields
  }
  
  export interface LogEntry {
    // Add log entry fields
  }
  
  export interface FactData {
    // Add fact data fields
  }
  
  export interface MintResult {
    success: boolean;
    tokenId?: string;
    transactionHash?: string;
    error?: string;
    metadata?: any;
  }