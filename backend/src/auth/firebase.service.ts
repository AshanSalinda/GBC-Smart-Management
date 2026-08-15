import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  initializeApp,
  cert,
  getApps,
  getApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type DecodedIdToken, type UserRecord } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const serviceAccount = this.configService.get<ServiceAccount>('firebase.serviceAccount')!;

    if (getApps().length === 0) {
      this.app = initializeApp({
        credential: cert(serviceAccount),
      });
      this.logger.log('Firebase Admin SDK initialized.');
    } else {
      this.app = getApp();
    }
  }

  /**
   * Verifies a Firebase JWT ID token.
   * Returns the decoded token payload on success.
   */
  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    return getAuth().verifyIdToken(idToken);
  }

  /**
   * Lists Firebase Auth users with pagination support.
   */
  async listUsers(maxResults: number = 100, pageToken?: string) {
    return getAuth().listUsers(maxResults, pageToken);
  }

  /**
   * Sets custom claims (role) on a Firebase user.
   */
  async setCustomClaims(uid: string, claims: { role: string }): Promise<void> {
    await getAuth().setCustomUserClaims(uid, claims);
    this.logger.log(`Custom claims set for user ${uid}: ${JSON.stringify(claims)}`);
  }

  /**
   * Deletes a Firebase Auth user.
   */
  async deleteUser(uid: string): Promise<void> {
    await getAuth().deleteUser(uid);
    this.logger.log(`User ${uid} deleted from Firebase Auth.`);
  }

  /**
   * Gets a single user by UID.
   */
  async getUser(uid: string): Promise<UserRecord> {
    return getAuth().getUser(uid);
  }
}
