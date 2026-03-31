import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PinHashVerifierService {
  async verify(pin: string, hash: string): Promise<boolean> {
    // Support legacy PHP password_hash format ($2y$) by converting to bcrypt ($2b$)
    const normalizedHash = hash.startsWith('$2y$')
      ? '$2b$' + hash.slice(4)
      : hash;

    return bcrypt.compare(pin, normalizedHash);
  }
}
