import { WORKER_ROLES } from './config/env.validation.js';
import { KeeperModule } from './modules/keeper/keeper.module.js';
import { SweeperModule } from './modules/sweeper/sweeper.module.js';
import { ROLE_MODULES, roleModules } from './worker.module.js';

describe('WorkerModule roles', () => {
  it('has a module for every declared role', () => {
    for (const role of WORKER_ROLES) {
      expect(ROLE_MODULES[role]).toBeDefined();
    }
  });

  it('maps only the requested roles to modules', () => {
    expect(roleModules(['keeper', 'sweeper'])).toEqual([KeeperModule, SweeperModule]);
  });
});
