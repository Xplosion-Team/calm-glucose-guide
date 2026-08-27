export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      cgm_readings: {
        Row: {
          created_at: string
          id: string
          mg_dl: number
          source: string
          trend: string | null
          ts: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mg_dl: number
          source?: string
          trend?: string | null
          ts: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mg_dl?: number
          source?: string
          trend?: string | null
          ts?: string
          user_id?: string
        }
        Relationships: []
      }
      circle_people: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_greens_health: boolean
          notes: string | null
          organization: string | null
          phone: string | null
          relationship: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_greens_health?: boolean
          notes?: string | null
          organization?: string | null
          phone?: string | null
          relationship?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_greens_health?: boolean
          notes?: string | null
          organization?: string | null
          phone?: string | null
          relationship?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      circle_share_links: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          last_viewed_at: string | null
          person_id: string
          revoked_at: string | null
          scope: string
          status: string
          token: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          person_id: string
          revoked_at?: string | null
          scope?: string
          status?: string
          token: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          person_id?: string
          revoked_at?: string | null
          scope?: string
          status?: string
          token?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "circle_share_links_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "circle_people"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          id: string
          pdf_url: string | null
          signature_hash: string
          signed_at: string
          user_id: string
          version: string
        }
        Insert: {
          id?: string
          pdf_url?: string | null
          signature_hash: string
          signed_at?: string
          user_id: string
          version: string
        }
        Update: {
          id?: string
          pdf_url?: string | null
          signature_hash?: string
          signed_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      daily_insights: {
        Row: {
          created_at: string
          data_sufficiency: string
          factors_used: Json
          id: string
          insight_date: string
          metrics: Json
          missed_events: Json
          model_version: string | null
          narrative: string | null
          recommendations: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          data_sufficiency?: string
          factors_used?: Json
          id?: string
          insight_date: string
          metrics?: Json
          missed_events?: Json
          model_version?: string | null
          narrative?: string | null
          recommendations?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          data_sufficiency?: string
          factors_used?: Json
          id?: string
          insight_date?: string
          metrics?: Json
          missed_events?: Json
          model_version?: string | null
          narrative?: string | null
          recommendations?: Json
          user_id?: string
        }
        Relationships: []
      }
      dexcom_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      food_logs: {
        Row: {
          calories: number | null
          carbs_grams: number | null
          created_at: string
          fat_g: number | null
          fiber_g: number | null
          id: string
          image_url: string | null
          is_favorite: boolean
          label: string
          logged_at: string
          notes: string | null
          portion_size: string | null
          protein_g: number | null
          source: string
          sugar_g: number | null
          type: string
          user_id: string
        }
        Insert: {
          calories?: number | null
          carbs_grams?: number | null
          created_at?: string
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean
          label: string
          logged_at?: string
          notes?: string | null
          portion_size?: string | null
          protein_g?: number | null
          source?: string
          sugar_g?: number | null
          type: string
          user_id: string
        }
        Update: {
          calories?: number | null
          carbs_grams?: number | null
          created_at?: string
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean
          label?: string
          logged_at?: string
          notes?: string | null
          portion_size?: string | null
          protein_g?: number | null
          source?: string
          sugar_g?: number | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      insulin_events: {
        Row: {
          created_at: string
          event_type: string | null
          id: string
          insulin_type: string | null
          insulin_units: number
          raw_payload: Json | null
          source: string
          ts: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type?: string | null
          id?: string
          insulin_type?: string | null
          insulin_units: number
          raw_payload?: Json | null
          source?: string
          ts: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string | null
          id?: string
          insulin_type?: string | null
          insulin_units?: number
          raw_payload?: Json | null
          source?: string
          ts?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_events: {
        Row: {
          carbohydrates: number
          created_at: string
          event_type: string | null
          id: string
          raw_payload: Json | null
          source: string
          ts: string
          user_id: string
        }
        Insert: {
          carbohydrates: number
          created_at?: string
          event_type?: string | null
          id?: string
          raw_payload?: Json | null
          source?: string
          ts: string
          user_id: string
        }
        Update: {
          carbohydrates?: number
          created_at?: string
          event_type?: string | null
          id?: string
          raw_payload?: Json | null
          source?: string
          ts?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_logs: {
        Row: {
          carbs_g: number | null
          created_at: string
          fat_g: number | null
          fiber_g: number | null
          id: string
          image_url: string | null
          label: string
          logged_at: string
          portion_size: string | null
          protein_g: number | null
          raw_ai: Json | null
          source: string
          user_id: string
        }
        Insert: {
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          image_url?: string | null
          label: string
          logged_at?: string
          portion_size?: string | null
          protein_g?: number | null
          raw_ai?: Json | null
          source?: string
          user_id: string
        }
        Update: {
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          image_url?: string | null
          label?: string
          logged_at?: string
          portion_size?: string | null
          protein_g?: number | null
          raw_ai?: Json | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_reminders: {
        Row: {
          created_at: string
          due_at: string
          food_log_id: string
          id: string
          meal_label: string
          responded_at: string | null
          seen_at: string | null
          sms_provider: string | null
          sms_sent_at: string | null
          status: string
          trigger_reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          due_at: string
          food_log_id: string
          id?: string
          meal_label: string
          responded_at?: string | null
          seen_at?: string | null
          sms_provider?: string | null
          sms_sent_at?: string | null
          status?: string
          trigger_reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          due_at?: string
          food_log_id?: string
          id?: string
          meal_label?: string
          responded_at?: string | null
          seen_at?: string | null
          sms_provider?: string | null
          sms_sent_at?: string | null
          status?: string
          trigger_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_reminders_food_log_id_fkey"
            columns: ["food_log_id"]
            isOneToOne: false
            referencedRelation: "food_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_responses: {
        Row: {
          auc: number | null
          avg_mg_dl: number | null
          baseline_mg_dl: number | null
          computed_at: string
          created_at: string
          food_log_id: string
          glucose_rise: number | null
          id: string
          meal_score: number | null
          peak_mg_dl: number | null
          readings_count: number | null
          recovery_time_min: number | null
          status: string
          time_above_range_min: number | null
          time_to_peak_min: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auc?: number | null
          avg_mg_dl?: number | null
          baseline_mg_dl?: number | null
          computed_at?: string
          created_at?: string
          food_log_id: string
          glucose_rise?: number | null
          id?: string
          meal_score?: number | null
          peak_mg_dl?: number | null
          readings_count?: number | null
          recovery_time_min?: number | null
          status?: string
          time_above_range_min?: number | null
          time_to_peak_min?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auc?: number | null
          avg_mg_dl?: number | null
          baseline_mg_dl?: number | null
          computed_at?: string
          created_at?: string
          food_log_id?: string
          glucose_rise?: number | null
          id?: string
          meal_score?: number | null
          peak_mg_dl?: number | null
          readings_count?: number | null
          recovery_time_min?: number | null
          status?: string
          time_above_range_min?: number | null
          time_to_peak_min?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_responses_food_log_id_fkey"
            columns: ["food_log_id"]
            isOneToOne: true
            referencedRelation: "food_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_events: {
        Row: {
          dose: number | null
          id: string
          medication_id: string
          source: string
          taken_at: string
          user_id: string
        }
        Insert: {
          dose?: number | null
          id?: string
          medication_id: string
          source?: string
          taken_at?: string
          user_id: string
        }
        Update: {
          dose?: number | null
          id?: string
          medication_id?: string
          source?: string
          taken_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_events_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          dose: number | null
          id: string
          med_class: string
          name: string
          schedule_cron: string | null
          started_at: string
          stopped_at: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dose?: number | null
          id?: string
          med_class: string
          name: string
          schedule_cron?: string | null
          started_at?: string
          stopped_at?: string | null
          unit?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dose?: number | null
          id?: string
          med_class?: string
          name?: string
          schedule_cron?: string | null
          started_at?: string
          stopped_at?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      nightscout_connections: {
        Row: {
          access_token: string | null
          api_secret_hash: string | null
          base_url: string
          created_at: string
          enabled: boolean
          id: string
          last_error: string | null
          last_sync_at: string | null
          last_sync_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          api_secret_hash?: string | null
          base_url: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          last_sync_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          api_secret_hash?: string | null
          base_url?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          last_sync_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nightscout_sync_log: {
        Row: {
          entries_fetched: number
          entries_inserted: number
          error_message: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          entries_fetched?: number
          entries_inserted?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          entries_fetched?: number
          entries_inserted?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          daily_insight_enabled: boolean
          daily_insight_hour: number
          post_meal_delay_min: number
          post_meal_enabled: boolean
          post_meal_sms_enabled: boolean
          post_meal_trigger: string
          quiet_end_hour: number | null
          quiet_start_hour: number | null
          sms_provider: string
          spike_enabled: boolean
          spike_sensitivity: string
          updated_at: string
          user_id: string
        }
        Insert: {
          daily_insight_enabled?: boolean
          daily_insight_hour?: number
          post_meal_delay_min?: number
          post_meal_enabled?: boolean
          post_meal_sms_enabled?: boolean
          post_meal_trigger?: string
          quiet_end_hour?: number | null
          quiet_start_hour?: number | null
          sms_provider?: string
          spike_enabled?: boolean
          spike_sensitivity?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          daily_insight_enabled?: boolean
          daily_insight_hour?: number
          post_meal_delay_min?: number
          post_meal_enabled?: boolean
          post_meal_sms_enabled?: boolean
          post_meal_trigger?: string
          quiet_end_hour?: number | null
          quiet_start_hour?: number | null
          sms_provider?: string
          spike_enabled?: boolean
          spike_sensitivity?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_otps: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
      prediction_outcomes: {
        Row: {
          computed_at: string
          id: string
          mae: number | null
          mard: number | null
          observed_curve: Json
          prediction_id: string
          user_id: string
        }
        Insert: {
          computed_at?: string
          id?: string
          mae?: number | null
          mard?: number | null
          observed_curve: Json
          prediction_id: string
          user_id: string
        }
        Update: {
          computed_at?: string
          id?: string
          mae?: number | null
          mard?: number | null
          observed_curve?: Json
          prediction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_outcomes_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          confidence: number | null
          curve: Json
          horizon_min: number
          id: string
          inputs_hash: string
          inputs_snapshot: Json
          insight_text: string | null
          meal_log_id: string
          model_version: string
          peak_mg_dl: number | null
          requested_at: string
          time_to_peak_min: number | null
          tir_delta_pct: number | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          curve: Json
          horizon_min?: number
          id?: string
          inputs_hash: string
          inputs_snapshot: Json
          insight_text?: string | null
          meal_log_id: string
          model_version: string
          peak_mg_dl?: number | null
          requested_at?: string
          time_to_peak_min?: number | null
          tir_delta_pct?: number | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          curve?: Json
          horizon_min?: number
          id?: string
          inputs_hash?: string
          inputs_snapshot?: Json
          insight_text?: string | null
          meal_log_id?: string
          model_version?: string
          peak_mg_dl?: number | null
          requested_at?: string
          time_to_peak_min?: number | null
          tir_delta_pct?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_meal_log_id_fkey"
            columns: ["meal_log_id"]
            isOneToOne: false
            referencedRelation: "meal_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          onboarding_hidden: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_hidden?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_hidden?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          csv_url: string | null
          generated_at: string
          generated_by: string
          id: string
          pdf_url: string | null
          report_end_date: string
          report_start_date: string
          report_type: string
          stats: Json | null
          summary: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          csv_url?: string | null
          generated_at?: string
          generated_by?: string
          id?: string
          pdf_url?: string | null
          report_end_date: string
          report_start_date: string
          report_type: string
          stats?: Json | null
          summary?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          csv_url?: string | null
          generated_at?: string
          generated_by?: string
          id?: string
          pdf_url?: string | null
          report_end_date?: string
          report_start_date?: string
          report_type?: string
          stats?: Json | null
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sms_pending_logs: {
        Row: {
          carbs_grams: number | null
          confirmed_at: string | null
          created_at: string
          id: string
          label: string
          original_text: string
          portion_size: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          carbs_grams?: number | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          label: string
          original_text: string
          portion_size?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          carbs_grams?: number | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          label?: string
          original_text?: string
          portion_size?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      spike_events: {
        Row: {
          associated_food_log_id: string | null
          baseline_mg_dl: number
          created_at: string
          detected_at: string
          id: string
          peak_mg_dl: number
          responded_at: string | null
          rise_mg_dl: number
          sensitivity: string
          user_id: string
          user_response: string
          window_min: number
        }
        Insert: {
          associated_food_log_id?: string | null
          baseline_mg_dl: number
          created_at?: string
          detected_at?: string
          id?: string
          peak_mg_dl: number
          responded_at?: string | null
          rise_mg_dl: number
          sensitivity: string
          user_id: string
          user_response?: string
          window_min: number
        }
        Update: {
          associated_food_log_id?: string | null
          baseline_mg_dl?: number
          created_at?: string
          detected_at?: string
          id?: string
          peak_mg_dl?: number
          responded_at?: string | null
          rise_mg_dl?: number
          sensitivity?: string
          user_id?: string
          user_response?: string
          window_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "spike_events_associated_food_log_id_fkey"
            columns: ["associated_food_log_id"]
            isOneToOne: false
            referencedRelation: "food_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      t1pal_connections: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          id: string
          last_error: string | null
          last_insulin_sync_at: string | null
          last_meal_sync_at: string | null
          last_successful_reading_at: string | null
          last_sync_at: string | null
          status: string
          t1pal_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_insulin_sync_at?: string | null
          last_meal_sync_at?: string | null
          last_successful_reading_at?: string | null
          last_sync_at?: string | null
          status?: string
          t1pal_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_insulin_sync_at?: string | null
          last_meal_sync_at?: string | null
          last_successful_reading_at?: string | null
          last_sync_at?: string | null
          status?: string
          t1pal_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      t1pal_ingestion_logs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: string
          insulin_fetched: number | null
          insulin_inserted: number | null
          latency_ms: number | null
          meals_fetched: number | null
          meals_inserted: number | null
          readings_fetched: number
          readings_inserted: number
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          insulin_fetched?: number | null
          insulin_inserted?: number | null
          latency_ms?: number | null
          meals_fetched?: number | null
          meals_inserted?: number | null
          readings_fetched?: number
          readings_inserted?: number
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          insulin_fetched?: number | null
          insulin_inserted?: number | null
          latency_ms?: number | null
          meals_fetched?: number | null
          meals_inserted?: number | null
          readings_fetched?: number
          readings_inserted?: number
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      trial_enrollments: {
        Row: {
          arm: string | null
          consented_at: string | null
          created_at: string
          id: string
          status: string
          trial_id: string
          user_id: string
          withdrawn_at: string | null
        }
        Insert: {
          arm?: string | null
          consented_at?: string | null
          created_at?: string
          id?: string
          status?: string
          trial_id?: string
          user_id: string
          withdrawn_at?: string | null
        }
        Update: {
          arm?: string | null
          consented_at?: string | null
          created_at?: string
          id?: string
          status?: string
          trial_id?: string
          user_id?: string
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      twin_states: {
        Row: {
          calibrated_at: string
          fit_metrics: Json | null
          id: string
          model_version: string
          n_samples: number | null
          params: Json
          user_id: string
        }
        Insert: {
          calibrated_at?: string
          fit_metrics?: Json | null
          id?: string
          model_version: string
          n_samples?: number | null
          params: Json
          user_id: string
        }
        Update: {
          calibrated_at?: string
          fit_metrics?: Json | null
          id?: string
          model_version?: string
          n_samples?: number | null
          params?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_engagement: {
        Row: {
          created_at: string
          id: string
          last_checkin_sent_at: string | null
          last_log_at: string | null
          phone: string | null
          timezone: string | null
          total_meals_logged: number
          trial_start: string
          trial_tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_checkin_sent_at?: string | null
          last_log_at?: string | null
          phone?: string | null
          timezone?: string | null
          total_meals_logged?: number
          trial_start?: string
          trial_tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_checkin_sent_at?: string | null
          last_log_at?: string | null
          phone?: string | null
          timezone?: string | null
          total_meals_logged?: number
          trial_start?: string
          trial_tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      dexcom_connection_status: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string | null
          scope: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      find_user_by_phone: { Args: { _variants: string[] }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
