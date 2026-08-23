import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

const server = express();
let cachedServer: any;

async function bootstrapServer() {
  if (!cachedServer) {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(server),
      { cors: true },
    );
    app.setGlobalPrefix('api');
    await app.init();
    cachedServer = server;
  }
  return cachedServer;
}

export default async function handler(req: any, res: any) {
  try {
    const appServer = await bootstrapServer();

    if (req.url && !req.url.startsWith('/api')) {
      req.url = `/api${req.url}`;
    }

    return appServer(req, res);
  } catch (error: any) {
    console.error('Backend Serverless Error:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error',
      error: error?.message || String(error),
    });
  }
}
