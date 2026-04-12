import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private app: admin.app.App;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Evitar inicializar múltiples veces
    if (admin.apps.length > 0) {
      this.app = admin.apps[0]!;
      return;
    }

    const serviceAccountJson = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );

    if (serviceAccountJson) {
      // Desde variable de entorno (JSON string)
      const serviceAccount = JSON.parse(serviceAccountJson);
      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Fallback: Google Application Default Credentials
      this.app = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }
  }

  /** Enviar notificación push a un token específico */
  async sendToToken(
    token: string,
    title: string,
    body: string,
  ): Promise<string> {
    const message: admin.messaging.Message = {
      token,
      notification: { title, body },
      webpush: {
        notification: {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        },
      },
    };

    return this.app.messaging().send(message);
  }

  /** Enviar notificación push a múltiples tokens */
  async sendToMultiple(
    tokens: string[],
    title: string,
    body: string,
  ): Promise<{ success: number; failure: number }> {
    if (tokens.length === 0) {
      return { success: 0, failure: 0 };
    }

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      webpush: {
        notification: {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        },
      },
    };

    const response = await this.app.messaging().sendEachForMulticast(message);
    return {
      success: response.successCount,
      failure: response.failureCount,
    };
  }
}
