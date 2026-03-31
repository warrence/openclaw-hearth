import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { AppController } from '../src/app.controller';
import { DatabaseService } from '../src/database/database.service';
import { HealthController } from '../src/health/health.controller';

describe('App controllers', () => {
  let appController: AppController;
  let healthController: HealthController;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({
        check: jest.fn().mockResolvedValue('down'),
      })
      .compile();

    appController = moduleRef.get(AppController);
    healthController = moduleRef.get(HealthController);
  });

  it('returns app info for GET / and GET /api/info handlers', () => {
    expect(appController.getInfo()).toMatchObject({
      status: 'ok',
    });
    expect(appController.getApiInfo()).toMatchObject({
      status: 'ok',
    });
  });

  it('returns health details for GET /health and GET /api/health handlers', async () => {
    await expect(healthController.getHealth()).resolves.toMatchObject({
      status: 'degraded',
      database: {
        status: 'down',
      },
    });
    await expect(healthController.getApiHealth()).resolves.toMatchObject({
      status: 'degraded',
      database: {
        status: 'down',
      },
    });
  });
});
