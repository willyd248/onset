/**
 * AuthManager — wraps Supabase Auth with a simple API.
 * Handles sign-in, sign-up, Google OAuth, session persistence, and logout.
 */
import { supabase } from './supabase.js';

export class AuthManager {
  constructor() {
    /** @type {import('@supabase/supabase-js').User | null} */
    this._user = null;
    /** @type {import('@supabase/supabase-js').Session | null} */
    this._session = null;
  }

  /** @returns {import('@supabase/supabase-js').User | null} */
  get user() { return this._user; }

  /** @returns {string | null} */
  get userId() { return this._user?.id || null; }

  /** @returns {string | null} */
  get email() { return this._user?.email || null; }

  /** Whether Supabase is configured and available. */
  get isAvailable() { return !!supabase; }

  /**
   * Restore an existing session (call on app load).
   * @returns {Promise<import('@supabase/supabase-js').Session | null>}
   */
  async getSession() {
    if (!supabase) return null;
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('[auth] getSession error:', error.message);
      return null;
    }
    if (session) {
      this._session = session;
      this._user = session.user;
    }
    return session;
  }

  /**
   * Sign up with email + password.
   * @param {string} email
   * @param {string} password
   */
  async signUpWithEmail(email, password) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    this._user = data.user;
    this._session = data.session;
    return data;
  }

  /**
   * Sign in with email + password.
   * @param {string} email
   * @param {string} password
   */
  async signInWithEmail(email, password) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this._user = data.user;
    this._session = data.session;
    return data;
  }

  /**
   * Kick off Google OAuth flow (redirects to Google, then back to app).
   */
  async signInWithGoogle() {
    if (!supabase) throw new Error('Supabase not configured');
    // NOTE: Configure this redirect URL in Supabase dashboard → Auth → URL Configuration
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }

  /**
   * Sign out and clear session.
   */
  async signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) console.warn('[auth] signOut error:', error.message);
    this._user = null;
    this._session = null;
  }

  /**
   * Subscribe to auth state changes (sign-in, sign-out, token refresh).
   * @param {(event: string, session: import('@supabase/supabase-js').Session | null) => void} callback
   * @returns {() => void} unsubscribe function
   */
  onAuthStateChange(callback) {
    if (!supabase) return () => {};
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      this._session = session;
      this._user = session?.user || null;
      callback(event, session);
    });
    return () => subscription.unsubscribe();
  }
}
