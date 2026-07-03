// Supabase database types — Slice 0 (profiles) + Slice 1 (catalog) + Slice 2 (cart)
// + Slice 3 (orders / payments).
//
// ⚠️ PLACEHOLDER — hand-authored, intentional deviation (recorded in 03_verify).
// `_config/data_conventions.md` requires generated types, but typegen needs a live
// Supabase project, which does not exist yet (local-first). This file mirrors
// migration.sql exactly so swapping is seamless. REGENERATE at cloud-wiring time:
//
//   supabase gen types typescript --project-id <PROJECT_ID> --schema public \
//     > store/supabase/types.ts
//
// Until then, treat this as the source of truth for DB row shapes.

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
      categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          brand: string | null;
          status: Database["public"]["Enums"]["product_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          brand?: string | null;
          status?: Database["public"]["Enums"]["product_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          description?: string | null;
          brand?: string | null;
          status?: Database["public"]["Enums"]["product_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          url: string;
          alt: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          url: string;
          alt?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          url?: string;
          alt?: string | null;
          position?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      variants: {
        Row: {
          id: string;
          product_id: string;
          sku: string;
          title: string;
          price_cents: number;
          currency: string;
          inventory_count: number;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          sku: string;
          title: string;
          price_cents: number;
          currency?: string;
          inventory_count?: number;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          sku?: string;
          title?: string;
          price_cents?: number;
          currency?: string;
          inventory_count?: number;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_categories: {
        Row: {
          product_id: string;
          category_id: string;
        };
        Insert: {
          product_id: string;
          category_id: string;
        };
        Update: {
          product_id?: string;
          category_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_categories_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_categories_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      carts: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          variant_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cart_id: string;
          variant_id: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cart_id?: string;
          variant_id?: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "variants";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          user_id: string | null;
          email: string;
          status: Database["public"]["Enums"]["order_status"];
          currency: string;
          amount_subtotal_minor: number;
          amount_shipping_minor: number;
          amount_tax_minor: number;
          amount_total_minor: number;
          stripe_checkout_session_id: string;
          stripe_payment_intent_id: string | null;
          shipping_name: string | null;
          shipping_address: Json | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          email: string;
          status?: Database["public"]["Enums"]["order_status"];
          currency?: string;
          amount_subtotal_minor: number;
          amount_shipping_minor?: number;
          amount_tax_minor?: number;
          amount_total_minor: number;
          stripe_checkout_session_id: string;
          stripe_payment_intent_id?: string | null;
          shipping_name?: string | null;
          shipping_address?: Json | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          email?: string;
          status?: Database["public"]["Enums"]["order_status"];
          currency?: string;
          amount_subtotal_minor?: number;
          amount_shipping_minor?: number;
          amount_tax_minor?: number;
          amount_total_minor?: number;
          stripe_checkout_session_id?: string;
          stripe_payment_intent_id?: string | null;
          shipping_name?: string | null;
          shipping_address?: Json | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          variant_id: string | null;
          product_title: string;
          variant_title: string;
          sku: string | null;
          unit_price_minor: number;
          quantity: number;
          line_total_minor: number;
          currency: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          variant_id?: string | null;
          product_title: string;
          variant_title: string;
          sku?: string | null;
          unit_price_minor: number;
          quantity: number;
          line_total_minor: number;
          currency?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          variant_id?: string | null;
          product_title?: string;
          variant_title?: string;
          sku?: string | null;
          unit_price_minor?: number;
          quantity?: number;
          line_total_minor?: number;
          currency?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "variants";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          id: string;
          type: string;
          processed_at: string;
        };
        Insert: {
          id: string;
          type: string;
          processed_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          processed_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      record_stripe_order: {
        Args: {
          p_event_id: string;
          p_event_type: string;
          p_order: Json;
          p_items: Json;
          p_cart_id?: string | null;
        };
        Returns: string;
      };
      finalize_stripe_order: {
        Args: {
          p_event_id: string;
          p_event_type: string;
          p_session_id: string;
          p_paid: boolean;
          p_payment_intent_id?: string | null;
          p_cart_id?: string | null;
        };
        Returns: string;
      };
      apply_paid_order_effects: {
        Args: {
          p_order_id: string;
          p_cart_id?: string | null;
        };
        Returns: undefined;
      };
    };
    Enums: {
      product_status: "draft" | "active" | "archived";
      order_status: "pending" | "paid" | "fulfilled" | "refunded" | "cancelled";
    };
    CompositeTypes: Record<never, never>;
  };
};

// Convenience row aliases (regeneration keeps these stable).
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductImage = Database["public"]["Tables"]["product_images"]["Row"];
export type Variant = Database["public"]["Tables"]["variants"]["Row"];
export type ProductStatus = Database["public"]["Enums"]["product_status"];

export type Cart = Database["public"]["Tables"]["carts"]["Row"];
export type CartInsert = Database["public"]["Tables"]["carts"]["Insert"];
export type CartItem = Database["public"]["Tables"]["cart_items"]["Row"];
export type CartItemInsert = Database["public"]["Tables"]["cart_items"]["Insert"];
export type CartItemUpdate = Database["public"]["Tables"]["cart_items"]["Update"];

export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type StripeEventRow = Database["public"]["Tables"]["stripe_events"]["Row"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];
