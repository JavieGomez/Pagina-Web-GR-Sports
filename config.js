// Public client settings. The publishable/anon key is designed for browser use;
// database security must come from the RLS policies in supabase/setup.sql.
export const CONFIG = Object.freeze({
  supabaseUrl: 'https://njtabnkmbnnqerdknshw.supabase.co',
  supabasePublishableKey: 'sb_publishable_-RFI7bqAGb3WpDhJBxM88A_jgbJcLjf',
  whatsappNumber: '',
  prices: Object.freeze({
    groupClassHourly: 45,
    groupClassPerAttendee: 2,
    substitutionHourly: 25,
    personalTrainingHourly: 30,
    personalTrainingDuoHourly: 40,
    campusPerAttendee: 20,
    eventBase: 120,
    eventHourly: 20
  })
});
