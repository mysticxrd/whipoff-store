// Supabase database types — Slice 0 (profiles).
//
// ⚠️ PLACEHOLDER — hand-authored, intentional deviation (recorded in 03_verify).
// _config/data_conventions.md requires GENERATED types, but typegen needs a live
// Supabase project, which does not exist yet (local-first). This mirrors the migration
// exactly so swapping is seamless. REGENERATE at cloud-wiring time:
//
//   supabase gen types typescript --project-id <PROJECT_ID> --schema public \
//     > supabase/types.ts
//
// Mirrors stages/01_data/output/types.ts.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
