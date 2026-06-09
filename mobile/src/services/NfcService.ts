import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { NfcCardData } from '../types';

export async function initNfc(): Promise<boolean> {
  try {
    await NfcManager.start();
    return true;
  } catch {
    return false;
  }
}

export async function isNfcSupported(): Promise<boolean> {
  try {
    const supported = await NfcManager.isSupported();
    return supported;
  } catch {
    return false;
  }
}

export async function isNfcEnabled(): Promise<boolean> {
  try {
    const enabled = await NfcManager.isEnabled();
    return enabled;
  } catch {
    // iOS does not support isEnabled — treat as enabled if supported
    return true;
  }
}

export async function readNfcTag(): Promise<NfcCardData> {
  return new Promise<NfcCardData>((resolve, reject) => {
    async function doRead() {
      try {
        await NfcManager.requestTechnology(NfcTech.Ndef);
        const tag = await NfcManager.getTag();

        if (!tag?.ndefMessage || tag.ndefMessage.length === 0) {
          throw new Error('No NDEF message found on tag');
        }

        const allText: string[] = [];

        for (const record of tag.ndefMessage) {
          try {
            const decodedText = Ndef.text.decodePayload(record.payload as Uint8Array);
            if (decodedText) {
              allText.push(decodedText);
            }
          } catch {
            // Not a text record — skip
          }
        }

        const fullText = allText.join(' ');

        // Extract Ghana card number pattern: GHA-XXXXXXXXX-X
        const cardPattern = /GHA-\d{9}-\d/;
        const cardMatch = fullText.match(cardPattern);

        if (!cardMatch) {
          throw new Error('No Ghana Card number found on tag');
        }

        const cardNumber = cardMatch[0];

        // Try to extract additional fields using common patterns
        const surnameMatch = fullText.match(/SURNAME[:\s]+([A-Z\s]+?)(?:\n|FORE|$)/i);
        const forenamesMatch = fullText.match(/FORE(?:NAMES?)?[:\s]+([A-Z\s]+?)(?:\n|DOB|DATE|$)/i);
        const dobMatch = fullText.match(/(?:DOB|DATE OF BIRTH)[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})/i);
        const genderMatch = fullText.match(/(?:SEX|GENDER)[:\s]+(MALE|FEMALE|M|F)/i);

        const result: NfcCardData = {
          cardNumber,
          rawText: fullText,
          surname: surnameMatch ? surnameMatch[1].trim() : undefined,
          forenames: forenamesMatch ? forenamesMatch[1].trim() : undefined,
          dateOfBirth: dobMatch ? dobMatch[1] : undefined,
          gender: genderMatch ? genderMatch[1] : undefined,
        };

        resolve(result);
      } catch (err: any) {
        reject(err);
      } finally {
        NfcManager.cancelTechnologyRequest().catch(() => {});
      }
    }

    doRead();
  });
}

export async function cleanupNfc(): Promise<void> {
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch {
    // Ignore cleanup errors
  }
}
