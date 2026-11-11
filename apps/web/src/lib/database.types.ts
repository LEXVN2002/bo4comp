
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "camos": {
                  Row: {
                    "id": string,"kind": string,"name": string,"requirement_text": string,"requirement_type": string,"requirement_value": number | null,"tier": number,"verified": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"kind": string,"name": string,"requirement_text": string,"requirement_type": string,"requirement_value"?: number | null,"tier": number,"verified"?: boolean
                  }
                  Update: {
                    "id"?: string,"kind"?: string,"name"?: string,"requirement_text"?: string,"requirement_type"?: string,"requirement_value"?: number | null,"tier"?: number,"verified"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"challenge_progress": {
                  Row: {
                    "challenge_id": string,"completed_at": string | null,"current_count": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_id": string,"completed_at"?: string | null,"current_count"?: number,"user_id"?: string
                  }
                  Update: {
                    "challenge_id"?: string,"completed_at"?: string | null,"current_count"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "challenge_progress_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    }
                  ]
                },"challenges": {
                  Row: {
                    "description": string,"id": string,"map_id": string | null,"name": string,"target": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"id": string,"map_id"?: string | null,"name": string,"target"?: number
                  }
                  Update: {
                    "description"?: string,"id"?: string,"map_id"?: string | null,"name"?: string,"target"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "challenges_map_id_fkey"
      columns: ["map_id"]
isOneToOne: false
      referencedRelation: "maps"
      referencedColumns: ["id"]
    }
                  ]
                },"easter_egg_completions": {
                  Row: {
                    "completed_at": string,"easter_egg_id": string,"id": string,"notes": string | null,"players": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string,"easter_egg_id": string,"id"?: string,"notes"?: string | null,"players"?: number | null,"user_id"?: string
                  }
                  Update: {
                    "completed_at"?: string,"easter_egg_id"?: string,"id"?: string,"notes"?: string | null,"players"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "easter_egg_completions_easter_egg_id_fkey"
      columns: ["easter_egg_id"]
isOneToOne: false
      referencedRelation: "easter_eggs"
      referencedColumns: ["id"]
    }
                  ]
                },"easter_egg_step_progress": {
                  Row: {
                    "done_at": string,"step_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "done_at"?: string,"step_id": string,"user_id"?: string
                  }
                  Update: {
                    "done_at"?: string,"step_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "easter_egg_step_progress_step_id_fkey"
      columns: ["step_id"]
isOneToOne: false
      referencedRelation: "easter_egg_steps"
      referencedColumns: ["id"]
    }
                  ]
                },"easter_egg_steps": {
                  Row: {
                    "details": string | null,"easter_egg_id": string,"id": string,"step_order": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "details"?: string | null,"easter_egg_id": string,"id": string,"step_order": number,"title": string
                  }
                  Update: {
                    "details"?: string | null,"easter_egg_id"?: string,"id"?: string,"step_order"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "easter_egg_steps_easter_egg_id_fkey"
      columns: ["easter_egg_id"]
isOneToOne: false
      referencedRelation: "easter_eggs"
      referencedColumns: ["id"]
    }
                  ]
                },"easter_eggs": {
                  Row: {
                    "id": string,"map_id": string,"max_players": number | null,"min_players": number | null,"name": string,"type": string,"verified": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"map_id": string,"max_players"?: number | null,"min_players"?: number | null,"name": string,"type": string,"verified"?: boolean
                  }
                  Update: {
                    "id"?: string,"map_id"?: string,"max_players"?: number | null,"min_players"?: number | null,"name"?: string,"type"?: string,"verified"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "easter_eggs_map_id_fkey"
      columns: ["map_id"]
isOneToOne: false
      referencedRelation: "maps"
      referencedColumns: ["id"]
    }
                  ]
                },"maps": {
                  Row: {
                    "id": string,"is_dlc": boolean,"name": string,"release_order": number,"storyline": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"is_dlc"?: boolean,"name": string,"release_order": number,"storyline": string
                  }
                  Update: {
                    "id"?: string,"is_dlc"?: boolean,"name"?: string,"release_order"?: number,"storyline"?: string
                  }
                  Relationships: [
                    
                  ]
                },"session_weapon_stats": {
                  Row: {
                    "headshots": number,"kills": number,"session_id": string,"weapon_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "headshots"?: number,"kills"?: number,"session_id": string,"weapon_id": string
                  }
                  Update: {
                    "headshots"?: number,"kills"?: number,"session_id"?: string,"weapon_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_weapon_stats_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_weapon_stats_weapon_id_fkey"
      columns: ["weapon_id"]
isOneToOne: false
      referencedRelation: "weapons"
      referencedColumns: ["id"]
    }
                  ]
                },"sessions": {
                  Row: {
                    "id": string,"map_id": string,"mode": string,"notes": string | null,"played_at": string,"players": number,"round_reached": number,"source": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"map_id": string,"mode"?: string,"notes"?: string | null,"played_at"?: string,"players"?: number,"round_reached": number,"source"?: string,"user_id"?: string
                  }
                  Update: {
                    "id"?: string,"map_id"?: string,"mode"?: string,"notes"?: string | null,"played_at"?: string,"players"?: number,"round_reached"?: number,"source"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_map_id_fkey"
      columns: ["map_id"]
isOneToOne: false
      referencedRelation: "maps"
      referencedColumns: ["id"]
    }
                  ]
                },"weapon_camo_progress": {
                  Row: {
                    "camo_id": string,"current_count": number,"unlocked_at": string | null,"user_id": string,"weapon_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "camo_id": string,"current_count"?: number,"unlocked_at"?: string | null,"user_id"?: string,"weapon_id": string
                  }
                  Update: {
                    "camo_id"?: string,"current_count"?: number,"unlocked_at"?: string | null,"user_id"?: string,"weapon_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "weapon_camo_progress_camo_id_fkey"
      columns: ["camo_id"]
isOneToOne: false
      referencedRelation: "camos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "weapon_camo_progress_weapon_id_fkey"
      columns: ["weapon_id"]
isOneToOne: false
      referencedRelation: "weapons"
      referencedColumns: ["id"]
    }
                  ]
                },"weapons": {
                  Row: {
                    "id": string,"name": string,"source": string,"weapon_class": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"name": string,"source"?: string,"weapon_class": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"source"?: string,"weapon_class"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "record_session":
{ Args: { "p_map_id": string,"p_mode"?: string,"p_notes"?: string,"p_played_at"?: string,"p_players"?: number,"p_round_reached": number,"p_weapon_stats"?: Json }; Returns: string
                           },
"unlock_mastery_camos":
{ Args: { "p_weapon_ids": (string)[] }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
