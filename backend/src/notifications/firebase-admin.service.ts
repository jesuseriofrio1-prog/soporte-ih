import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private app: admin.app.App | null = null;
  private readonly logger = new Logger(FirebaseAdminService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    if (admin.apps.length > 0) {
      this.app = admin.apps[0]!;
      return;
    }

    const serviceAccountJson = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );

    if (!serviceAccountJson) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON no configurado — push notifications deshabilitadas');
      return;
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      this.logger.log('Firebase Admin inicializado correctamente');
    } catch (error) {
      this.logger.error('Error al inicializar Firebase Admin:', error);
    }
  }

  private isReady(): boolean {
    return this.app !== null;
  }

  async sendToToken(token: string, title: string, body: string): Promise<string | null> {
    if (!this.isReady()) return null;

    const message: admin.messaging.Message = {
      token,
      notification: { title, body },
      webpush: {
        notification: { icon: '/favicon.ico', badge: '/favicon.ico' },
      },
    };

    return this.app!.messaging().send(message);
  }

  async sendToMultiple(
    tokens: string[],
    title: string,
    body: string,
  ): Promise<{ success: number; failure: number }> {
    if (!this.isReady() || tokens.length === 0) {
      return { success: 0, failure: 0 };
    }

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      webpush: {
        notification: { icon: '/favicon.ico', badge: '/favicon.ico' },
      },
    };

    const response = await this.app!.messaging().sendEachForMulticast(message);
    return {
      success: response.successCount,
      failure: response.failureCount,
    };
  }
}
