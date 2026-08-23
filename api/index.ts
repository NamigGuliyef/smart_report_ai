import { NestFactory } from '@nestjs/core';
import { AppModule } from '../backend/src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

const server = express();
let cachedApp: any;

async function bootstrapServer() {
  if (!cachedApp) {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(server),
      { cors: true },
    );
    app.setGlobalPrefix('api');
    await app.init();
    cachedApp = server;
  }
  return cachedApp;
}

export default async function handler(req: any, res: any) {
  try {
    const app = await bootstrapServer();

    if (req.url && !req.url.startsWith('/api')) {
      req.url = `/api${req.url}`;
    }

    return app(req, res);
  } catch (error: any) {
    console.error('Vercel Serverless Function Error:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error',
      error: error?.message || String(error),
    });
  }
}
