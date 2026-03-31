import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

@Injectable()
export class PinHashService {
  async hash(pin: string): Promise<string> {
    return bcrypt.hash(pin, SALT_ROUNDS);
  }
}
