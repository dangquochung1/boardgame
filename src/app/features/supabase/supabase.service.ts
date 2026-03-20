import { Injectable } from '@angular/core';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase-client';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private get client(): SupabaseClient {
    return getSupabaseClient();
  }

  async ensureSignedIn(): Promise<Session> {
    const { data: sessionData, error: sessionError } = await this.client.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData.session) return sessionData.session;

    const { data, error } = await this.client.auth.signInAnonymously();
    if (error) throw error;
    if (!data.session) throw new Error('Anonymous sign-in did not return a session.');
    return data.session;
  }

  async getUserId(): Promise<string> {
    const session = await this.ensureSignedIn();
    return session.user.id;
  }
}

