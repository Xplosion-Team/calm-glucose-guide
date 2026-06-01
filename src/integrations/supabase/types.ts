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
    PostgrestVersion: "14.1"
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
          carbs_grams: number | null
          created_at: string
          id: string
          label: string
          logged_at: string
          portion_size: string | null
          source: string
          type: string
          user_id: string
        }
        Insert: {
          carbs_grams?: number | null
          created_at?: string
          id?: string
          label: string
          logged_at?: string
          portion_size?: string | null
          source?: string
          type: string
          user_id: string
        }
        Update: {
          carbs_grams?: number | null
          created_at?: string
          id?: string
          label?: string
          logged_at?: string
          portion_size?: string | null
          source?: string
          type?: string
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
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      t1pal_connections: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          id: string
          last_error: string | null
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
          latency_ms: number | null
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
          latency_ms?: number | null
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
          latency_ms?: number | null
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
      [_ in never]: never
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
