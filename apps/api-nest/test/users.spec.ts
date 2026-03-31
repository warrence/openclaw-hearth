import { AuthRepository, UserAuthRecord } from '../src/auth/auth.repository';
import { UsersController } from '../src/auth/users.controller';
import { DatabaseService } from '../src/database/database.service';

const baseUser: UserAuthRecord = {
  id: 7,
  name: 'Tester',
  slug: 'tester',
  avatar: null,
  memory_namespace: 'person:tester',
  default_agent_id: null,
  is_active: true,
  role: 'member',
  pin_hash: 'hash:1234',
  pin_set_at: '2026-03-23T00:00:00.000Z',
  last_login_at: null,
  requires_pin: true,
  created_at: '2026-03-20T00:00:00.000Z',
  updated_at: '2026-03-20T00:00:00.000Z',
  has_pin: true,
};

describe('Public users chooser route', () => {
  let usersController: UsersController;
  let authRepository: AuthRepository;
  let databaseService: { query: jest.Mock };

  beforeEach(() => {
    databaseService = {
      query: jest.fn(),
    };
    authRepository = new AuthRepository(databaseService as unknown as DatabaseService);
    usersController = new UsersController(authRepository);
  });

  it('returns active users only, ordered by id, with has_pin and no pin_hash', async () => {
    databaseService.query.mockResolvedValue({
      rows: [
        {
          ...baseUser,
          id: 2,
          pin_hash: null,
          has_pin: false,
        },
        {
          ...baseUser,
          id: 9,
        },
      ],
    });

    const users = await usersController.listUsers();

    expect(databaseService.query).toHaveBeenCalledTimes(1);
    const [queryText] = databaseService.query.mock.calls[0];

    expect(queryText).toContain('WHERE is_active = TRUE');
    expect(queryText).toContain('ORDER BY id ASC');
    expect(users).toHaveLength(2);
    expect(users.map((user) => user.id)).toEqual([2, 9]);
    expect(users).toEqual([
      expect.objectContaining({ id: 2, is_active: true, has_pin: false }),
      expect.objectContaining({ id: 9, is_active: true, has_pin: true }),
    ]);
    expect(users[0]).not.toHaveProperty('pin_hash');
    expect(users[1]).not.toHaveProperty('pin_hash');
  });
});
