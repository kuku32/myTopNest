import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:4200','https://eleceed.web.app','https://topmanga.vercel.app', 'https://topmanga-git-locreader-kuku20.vercel.app'],
    // origin: '*',
    credentials: true,
  });
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0', function () {
    console.log(`Application listening on port ${port}`);
  });
}
bootstrap();
