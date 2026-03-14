// Backend-Lovegifts/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplicationContext, ValidationPipe } from '@nestjs/common';
import compression from 'compression';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';

// Tạo Class Adapter Redis tùy chỉnh
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(private app: INestApplicationContext) {
    super(app);
  }

  // async connectToRedis(): Promise<void> {
  //   const isLocal = process.env.REDIS_HOST === 'localhost' || process.env.REDIS_HOST === '127.0.0.1';
  //   const socketOptions = isLocal
  //     ? { 
  //         tls: false, 
  //         connectTimeout: 10000 
  //       }
  //     : { 
  //         tls: true, 
  //         rejectUnauthorized: false, 
  //         connectTimeout: 10000 
  //       };
  //   const pubClient = createClient({
  //     // URL kết nối cơ bản
  //     url: `redis://${process.env.REDIS_PASSWORD ? ':' + process.env.REDIS_PASSWORD + '@' : ''}${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  //     socket: socketOptions as any,
  //   });
    
  //   const subClient = pubClient.duplicate();

  //   // Thêm log lỗi để dễ debug nếu kết nối thất bại
  //   pubClient.on('error', (err) => console.error('Redis Pub Error:', err));
  //   subClient.on('error', (err) => console.error('Redis Sub Error:', err));

  //   await Promise.all([pubClient.connect(), subClient.connect()]);

  //   this.adapterConstructor = createAdapter(pubClient, subClient);
  // }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(cookieParser());

  // 1. Cấu hình CORS (Đã mở rộng để nhận diện IP thiết bị)
  app.enableCors({
    origin: true, 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, x-device-id, user-agent, Cache-Control, Pragma, Expires',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // 2. Tối ưu & Validate
  app.use(compression());
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true, 
    transformOptions: { enableImplicitConversion: true } 
  }));
  app.use(json({ limit: '50mb' })); 
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // 4. Chạy server - QUAN TRỌNG NHẤT Ở ĐÂY
  const port = process.env.PORT ?? 3001;
  
  // Sửa từ app.listen(port) thành bản dưới đây để lắng nghe trên mọi địa chỉ IP
  await app.listen(port, '0.0.0.0'); 
  
  console.log(`✅ Server is listening on all network interfaces (0.0.0.0:${port})`);
  console.log(`🚀 For iPhone, use URL: http://<YOUR_COMPUTER_IP>:${port}`);
}
bootstrap();