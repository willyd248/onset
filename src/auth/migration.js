/**
 * migration.js — one-time migration of localStorage data to Supabase cloud.
 * Called on first sign-in. Skips if cloud data already exists.
 */

/**
 * Migrate any existing localStorage progress/cues/SR data to Supabase.
 * Silently no-ops if cloud data already exists or localStorage is empty.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function migrateLocalStorageToCloud(supabase, userId) {
  try {
    await Promise.all([
      _migrateProgress(supabase, userId),
      _migrateHotCues(supabase, userId),
      _migrateSpacedRepetition(supabase, userId),
    ]);
  } catch (err) {
    // Migration failure is non-fatal — cloud sync will work going forward
    console.warn('[migration] Could not migrate localStorage data:', err.message);
  }
}

async function _migrateProgress(supabase, userId) {
  const raw = localStorage.getItem('onset:progress');
  if (!raw) return;

  let local;
  try { local = JSON.parse(raw); } catch { return; }
  if (!local.totalXP && !local.lessonsCompleted) return;

  // Only migrate if cloud row is empty / doesn't exist
  const { data: existing } = await supabase
    .from('progress')
    .select('total_xp')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.total_xp > 0) return; // Cloud has real data — don't overwrite

  const { error } = await supabase.from('progress').upsert({
    user_id:              userId,
    total_xp:             local.totalXP             || 0,
    lessons_completed:    local.lessonsCompleted     || 0,
    current_streak:       local.currentStreak        || 0,
    best_streak:          local.bestStreak           || 0,
    last_practice_date:   local.lastPracticeDate     || null,
    total_practice_ms:    local.totalPracticeMs      || 0,
    completed_lesson_ids: local.completedLessonIds   || [],
    category_scores:      local.categoryScores       || {},
    updated_at:           new Date().toISOString(),
  });

  if (error) throw error;
  console.log('[migration] progress migrated to cloud');
}

async function _migrateHotCues(supabase, userId) {
  const raw = localStorage.getItem('onset:hotcues');
  if (!raw) return;

  let local;
  try { local = JSON.parse(raw); } catch { return; }

  const entries = Object.entries(local);
  if (!entries.length) return;

  const rows = entries.map(([trackName, cuePoints]) => ({
    user_id:    userId,
    track_name: trackName,
    cue_points: cuePoints,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('hot_cues')
    .upsert(rows, { onConflict: 'user_id,track_name', ignoreDuplicates: true });

  if (error) throw error;
  console.log(`[migration] ${rows.length} hot cue track(s) migrated to cloud`);
}

async function _migrateSpacedRepetition(supabase, userId) {
  const raw = localStorage.getItem('onset:spaced-repetition');
  if (!raw) return;

  let local;
  try { local = JSON.parse(raw); } catch { return; }
  if (!Object.keys(local).length) return;

  // Only migrate if cloud row doesn't exist yet
  const { data: existing } = await supabase
    .from('spaced_repetition')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from('spaced_repetition').upsert({
    user_id:    userId,
    records:    local,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
  console.log('[migration] spaced repetition data migrated to cloud');
}
