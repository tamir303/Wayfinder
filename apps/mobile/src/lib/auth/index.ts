import { config } from '../../config/app-config';
import { createMockAuth } from './mock-auth';
import { createSupabaseAuth } from './supabase-auth';

export const auth = config.useMocks ? createMockAuth() : createSupabaseAuth();
export type { AuthService, AuthSession } from './types';
