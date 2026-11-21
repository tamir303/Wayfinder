import { jwtVerify, type JWTVerifyGetKey } from 'jose';

export class JwtVerifier {
  constructor(
    private readonly getKey: JWTVerifyGetKey,
    private readonly issuer: string,
  ) {}

  async verify(token: string): Promise<{ userId: string }> {
    const { payload } = await jwtVerify(token, this.getKey, {
      issuer: this.issuer,
      audience: 'authenticated',
    });
    if (!payload.sub) throw new Error('token has no subject');
    return { userId: payload.sub };
  }
}

// Mock backend (dev) only: any non-empty bearer token signs in, and the token is the user id.
export class MockJwtVerifier extends JwtVerifier {
  constructor() {
    super(async () => { throw new Error('unused'); }, 'mock');
  }

  override async verify(token: string): Promise<{ userId: string }> {
    return { userId: `dev-${token.slice(0, 40)}` };
  }
}
