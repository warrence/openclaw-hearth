declare namespace Express {
  interface Request {
    [key: string]: unknown;
  }

  interface Response {
    [key: string]: unknown;
  }

  interface Application {
    [key: string]: unknown;
  }

  namespace Multer {
    interface File {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }
  }
}

declare namespace e {
  export interface Express {
    [key: string]: unknown;
  }

  export interface Request extends Express.Request {}
  export interface Response extends Express.Response {}
}

declare function e(): e.Express;

declare module 'express' {
  export = e;
}

declare module 'multer' {
  export function memoryStorage(): unknown;
}
