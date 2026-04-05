declare namespace Express {
  interface Request {
    user?: {
      id: string;
      displayName?: string;
    };
  }
}
