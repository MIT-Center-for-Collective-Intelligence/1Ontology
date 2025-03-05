import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firestoreServer/admin';
import { ApiKey, ApiKeyCreateParams } from ' @components/types/api';
import { API_KEYS } from '../firestoreClient/collections';


class ApiKeyManager {
  private static instance: ApiKeyManager;
  private readonly hashAlgorithm = 'sha256';
  private readonly encryptionAlgorithm = 'aes-256-cbc';
  private readonly encryptionSecret: Buffer;
  
  private constructor() {
    // temporary secret for testing
    const fixedSecret = 'ontologydevelopmentapisecret';
    this.encryptionSecret = createHash('sha256').update(fixedSecret).digest();
  }
  
  public static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager();
    }
    return ApiKeyManager.instance;
  }
  
  public async generateKey(params: ApiKeyCreateParams): Promise<{ apiKey: string; keyData: Omit<ApiKey, 'key'> }> {
    try {
      const apiKey = this.generateSecureKey();
      const hashedKey = this.hashKey(apiKey);
      
      // Encrypt the original API key for storage
      const iv = randomBytes(16);
      const encrypted = this.encryptApiKey(apiKey, iv);
      
      const keyData: ApiKey & { encryptedKey?: string, iv?: string } = {
        key: hashedKey,
        userId: params.userId,
        uname: params.uname,
        clientId: params.clientId,
        createdAt: new Date(),
        lastUsed: new Date(),
        isActive: true,
        description: params.description,
        allowedEndpoints: params.allowedEndpoints || [],
        encryptedKey: encrypted,
        iv: iv.toString('hex')
      };
      
      await db.collection(API_KEYS).doc(hashedKey).set(keyData);
      
      // Remove the encrypted key and IV from the return value
      const { encryptedKey, iv: ivHex, key, ...returnData } = keyData;
      return { apiKey, keyData: returnData };
    } catch (error) {
      console.error('Error generating API key:', error);
      throw new Error('Failed to generate API key');
    }
  }

  public async validateKey(apiKey: string, endpoint?: string): Promise<ApiKey | null> {
    try {
      const hashedKey = this.hashKey(apiKey);
      const keyRef = db.collection(API_KEYS).doc(hashedKey);
      const keyDoc = await keyRef.get();

      if (!keyDoc.exists) {
        return null;
      }

      const keyData = keyDoc.data() as ApiKey;

      if (!keyData.isActive) {
        return null;
      }

      if (endpoint && keyData.allowedEndpoints?.length) {
        if (!keyData.allowedEndpoints.includes(endpoint)) {
          return null;
        }
      }

      await keyRef.update({
        lastUsed: FieldValue.serverTimestamp()
      });

      return keyData;
    } catch (error) {
      console.error('Error validating API key:', error);
      return null;
    }
  }

  public async deactivateKey(clientId: string, userId: string): Promise<boolean> {
    try {
      const snapshot = await db
        .collection(API_KEYS)
        .where('clientId', '==', clientId)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return false;
      }

      const keyDoc = snapshot.docs[0];
      const keyData = keyDoc.data() as ApiKey;

      // Update the key to inactive
      await keyDoc.ref.update({
        isActive: false
      });

      const keySecretRef = db.collection('apiKeySecrets').doc(clientId);
      await keySecretRef.delete();

      return true;
    } catch (error) {
      console.error('Error deactivating API key:', error);
      return false;
    }
  }

  public async getKeyByClientId(clientId: string, userId: string): Promise<string | null> {
    try {
      // Find the API key by clientId
      const snapshot = await db
        .collection(API_KEYS)
        .where('clientId', '==', clientId)
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }
      
      const keyDoc = snapshot.docs[0];
      const keyData = keyDoc.data() as ApiKey & { encryptedKey?: string, iv?: string };
      
      if (!keyData.encryptedKey || !keyData.iv) {
        return null;
      }
      
      // Decrypt the original API key
      const iv = Buffer.from(keyData.iv, 'hex');
      const originalKey = this.decryptApiKey(keyData.encryptedKey, iv);
      
      // Update the last used timestamp
      await keyDoc.ref.update({
        lastUsed: FieldValue.serverTimestamp()
      });
      
      return originalKey;
    } catch (error) {
      console.error('Error retrieving API key by client ID:', error);
      return null;
    }
  }

  public async listKeys(userId: string): Promise<Omit<ApiKey, 'key'>[]> {
    try {
      const snapshot = await db
        .collection(API_KEYS)
        .where('userId', '==', userId)
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data() as ApiKey;
        const { key, ...rest } = data;
        return rest;
      });
    } catch (error) {
      console.error('Error listing API keys:', error);
      return [];
    }
  }

  private generateSecureKey(): string {
    return randomBytes(32).toString('hex');
  }

  private hashKey(apiKey: string): string {
    return createHash(this.hashAlgorithm)
      .update(apiKey)
      .digest('hex');
  }

  private encryptApiKey(apiKey: string, iv: any): string {
    const algorithm: any = this.encryptionAlgorithm;
    const key: any = this.encryptionSecret;
    
    const cipher = createCipheriv(
      algorithm, 
      key, 
      iv
    );
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }
  
  private decryptApiKey(encryptedKey: string, iv: any): string {
    const algorithm: any = this.encryptionAlgorithm;
    const key: any = this.encryptionSecret;
    
    const decipher = createDecipheriv(
      algorithm, 
      key, 
      iv
    );
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

export const apiKeyManager = ApiKeyManager.getInstance();