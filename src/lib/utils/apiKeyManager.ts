import { randomBytes, createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firestoreServer/admin';
import { ApiKey, ApiKeyCreateParams } from ' @components/types/api';
import { API_KEYS } from '../firestoreClient/collections';


class ApiKeyManager {
  private static instance: ApiKeyManager;
  private readonly hashAlgorithm = 'sha256';

  private constructor() {}

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

      const keyData: ApiKey = {
        key: hashedKey,
        userId: params.userId,
        uname: params.uname,
        clientId: params.clientId,
        createdAt: new Date(),
        lastUsed: new Date(),
        isActive: true,
        description: params.description,
        allowedEndpoints: params.allowedEndpoints || [],
      };

      await db.collection(API_KEYS).doc(hashedKey).set(keyData);

      const { key, ...returnData } = keyData;
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

  public async deactivateKey(apiKey: string, userId: string): Promise<boolean> {
    try {
      const hashedKey = this.hashKey(apiKey);
      const keyRef = db.collection(API_KEYS).doc(hashedKey);
      const keyDoc = await keyRef.get();

      if (!keyDoc.exists || (keyDoc.data() as ApiKey).userId !== userId) {
        return false;
      }

      await keyRef.update({
        isActive: false
      });

      return true;
    } catch (error) {
      console.error('Error deactivating API key:', error);
      return false;
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
}

export const apiKeyManager = ApiKeyManager.getInstance();