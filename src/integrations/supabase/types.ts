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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_pin: {
        Row: {
          fails: number
          id: number
          locked_until: string | null
          pin_hash: string
          salt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          fails?: number
          id?: number
          locked_until?: string | null
          pin_hash: string
          salt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          fails?: number
          id?: number
          locked_until?: string | null
          pin_hash?: string
          salt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          api_keys: Json
          id: string
          qr_image_url: string
          updated_at: string
          upi_id: string
        }
        Insert: {
          api_keys?: Json
          id?: string
          qr_image_url?: string
          updated_at?: string
          upi_id?: string
        }
        Update: {
          api_keys?: Json
          id?: string
          qr_image_url?: string
          updated_at?: string
          upi_id?: string
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          name: string
          updated_at: string
          value: string
        }
        Insert: {
          name: string
          updated_at?: string
          value?: string
        }
        Update: {
          name?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image: string
          link_type: string
          link_value: string
          sort: number
          subtitle: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image?: string
          link_type?: string
          link_value?: string
          sort?: number
          subtitle?: string
          title?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image?: string
          link_type?: string
          link_value?: string
          sort?: number
          subtitle?: string
          title?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          label: string
          slug: string
          sort: number
        }
        Insert: {
          created_at?: string
          id: string
          image_url?: string
          is_active?: boolean
          label: string
          slug: string
          sort?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          label?: string
          slug?: string
          sort?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          customer_name: string
          id: string
          sender: string
          session_id: string
        }
        Insert: {
          body: string
          created_at?: string
          customer_name?: string
          id?: string
          sender?: string
          session_id: string
        }
        Update: {
          body?: string
          created_at?: string
          customer_name?: string
          id?: string
          sender?: string
          session_id?: string
        }
        Relationships: []
      }
      import_channels: {
        Row: {
          autopilot: boolean
          category: string
          created_at: string
          dry_scans: number
          id: string
          imported_count: number
          label: string
          last_error: string | null
          last_run: string | null
          last_scanned_page: number
          last_sync_timestamp: string | null
          pending_urls: string[]
          url: string
        }
        Insert: {
          autopilot?: boolean
          category?: string
          created_at?: string
          dry_scans?: number
          id?: string
          imported_count?: number
          label: string
          last_error?: string | null
          last_run?: string | null
          last_scanned_page?: number
          last_sync_timestamp?: string | null
          pending_urls?: string[]
          url: string
        }
        Update: {
          autopilot?: boolean
          category?: string
          created_at?: string
          dry_scans?: number
          id?: string
          imported_count?: number
          label?: string
          last_error?: string | null
          last_run?: string | null
          last_scanned_page?: number
          last_sync_timestamp?: string | null
          pending_urls?: string[]
          url?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string
          created_at: string
          customer_name: string
          id: string
          items: Json
          phone: string
          pincode: string
          status: string
          total: number
          tracking_no: string
        }
        Insert: {
          address: string
          created_at?: string
          customer_name: string
          id?: string
          items?: Json
          phone: string
          pincode: string
          status?: string
          total?: number
          tracking_no?: string
        }
        Update: {
          address?: string
          created_at?: string
          customer_name?: string
          id?: string
          items?: Json
          phone?: string
          pincode?: string
          status?: string
          total?: number
          tracking_no?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          available_sizes: string[]
          color_hex: string
          color_name: string
          created_at: string
          id: string
          model_photos: string[]
          product_id: string
          sort: number
        }
        Insert: {
          available_sizes?: string[]
          color_hex?: string
          color_name: string
          created_at?: string
          id?: string
          model_photos?: string[]
          product_id: string
          sort?: number
        }
        Update: {
          available_sizes?: string[]
          color_hex?: string
          color_name?: string
          created_at?: string
          id?: string
          model_photos?: string[]
          product_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          badge: string
          brand: string
          category: string
          colors: Json
          created_at: string
          description: string
          discount_percent: number | null
          fabric_details: string
          featured: boolean
          highlights: string[]
          id: string
          images: string[]
          is_active: boolean
          is_bestseller: boolean
          name: string
          old_price: number
          pinned: boolean
          price: number
          sizes: string[]
          slug: string | null
          source_url: string
          specs: Json
        }
        Insert: {
          badge?: string
          brand?: string
          category?: string
          colors?: Json
          created_at?: string
          description?: string
          discount_percent?: number | null
          fabric_details?: string
          featured?: boolean
          highlights?: string[]
          id?: string
          images?: string[]
          is_active?: boolean
          is_bestseller?: boolean
          name: string
          old_price?: number
          pinned?: boolean
          price?: number
          sizes?: string[]
          slug?: string | null
          source_url?: string
          specs?: Json
        }
        Update: {
          badge?: string
          brand?: string
          category?: string
          colors?: Json
          created_at?: string
          description?: string
          discount_percent?: number | null
          fabric_details?: string
          featured?: boolean
          highlights?: string[]
          id?: string
          images?: string[]
          is_active?: boolean
          is_bestseller?: boolean
          name?: string
          old_price?: number
          pinned?: boolean
          price?: number
          sizes?: string[]
          slug?: string | null
          source_url?: string
          specs?: Json
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string
          city: string
          created_at: string
          customer_name: string
          id: string
          is_sample: boolean
          photos: string[]
          product_id: string
          rating: number
          status: string
          verified: boolean
        }
        Insert: {
          body: string
          city?: string
          created_at?: string
          customer_name: string
          id?: string
          is_sample?: boolean
          photos?: string[]
          product_id: string
          rating: number
          status?: string
          verified?: boolean
        }
        Update: {
          body?: string
          city?: string
          created_at?: string
          customer_name?: string
          id?: string
          is_sample?: boolean
          photos?: string[]
          product_id?: string
          rating?: number
          status?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          announcement_bar: boolean
          announcement_text: string
          bg_image: string
          bg_opacity: number
          brand_name: string
          buy_now: boolean
          id: number
          landing_layout: string
          live_chat: boolean
          offers_banner: boolean
          review_approval: boolean
          reviews_enabled: boolean
          show_bg: boolean
          show_colors: boolean
          show_sizes: boolean
          social_proof_enabled: boolean
          tagline: string
          theme: string
          updated_at: string
          upi_id: string
          upi_name: string
        }
        Insert: {
          announcement_bar?: boolean
          announcement_text?: string
          bg_image?: string
          bg_opacity?: number
          brand_name?: string
          buy_now?: boolean
          id?: number
          landing_layout?: string
          live_chat?: boolean
          offers_banner?: boolean
          review_approval?: boolean
          reviews_enabled?: boolean
          show_bg?: boolean
          show_colors?: boolean
          show_sizes?: boolean
          social_proof_enabled?: boolean
          tagline?: string
          theme?: string
          updated_at?: string
          upi_id?: string
          upi_name?: string
        }
        Update: {
          announcement_bar?: boolean
          announcement_text?: string
          bg_image?: string
          bg_opacity?: number
          brand_name?: string
          buy_now?: boolean
          id?: number
          landing_layout?: string
          live_chat?: boolean
          offers_banner?: boolean
          review_approval?: boolean
          reviews_enabled?: boolean
          show_bg?: boolean
          show_colors?: boolean
          show_sizes?: boolean
          social_proof_enabled?: boolean
          tagline?: string
          theme?: string
          updated_at?: string
          upi_id?: string
          upi_name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_bulk_discount: { Args: { _percent: number }; Returns: number }
      clear_catalog: { Args: never; Returns: number }
      clear_model_seed: { Args: never; Returns: number }
      create_order: {
        Args: {
          _address: string
          _items: Json
          _name: string
          _phone: string
          _pincode: string
        }
        Returns: {
          id: string
          total: number
        }[]
      }
      get_chat_thread: {
        Args: { _session: string }
        Returns: {
          body: string
          created_at: string
          customer_name: string
          id: string
          sender: string
          session_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "chat_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_recent_activity: {
        Args: never
        Returns: {
          at: string
          first_name: string
          kind: string
          product_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      seed_catalog_category: {
        Args: { _cat: string; _n: number }
        Returns: number
      }
      seed_categories: { Args: never; Returns: number }
      seed_model_catalog:
        | { Args: { _cat: string; _n: number }; Returns: number }
        | { Args: { _cat: string; _n: number; _photos: Json }; Returns: number }
      track_orders: {
        Args: { _code: string; _phone: string }
        Returns: {
          created_at: string
          id: string
          items: Json
          status: string
          total: number
          tracking_no: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
