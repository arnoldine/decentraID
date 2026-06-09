export interface VerificationResponse {
  success: boolean;
  code: string;
  timestamp: string;
  message?: string;
  data: {
    transactionGuid?: string;
    verified?: 'TRUE' | 'FALSE';
    person?: Record<string, any>;
    image?: string;
    reason?: string;
  } | null;
}

export interface ServerSettings {
  apiBaseUrl: string;
  merchantCode: string;
  defaultVerificationType: string;
}

export interface NfcCardData {
  cardNumber: string;
  surname?: string;
  forenames?: string;
  dateOfBirth?: string;
  gender?: string;
  rawText?: string;
}

export type RootStackParamList = {
  ServerSettings: undefined;
  Login: undefined;
  Verification: undefined;
};
