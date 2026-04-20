export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "USER" | "STAFF" | "ADMIN";
export type EventStatus = "DRAFT" | "ACTIVE" | "ENDED" | "CONFIRMED" | "ARCHIVED";
export type EventType = "FAMILY" | "CORPORATE" | "CLUB" | "SCHOOL" | "ETC";
export type ParticipationType = "INDIVIDUAL" | "TEAM" | "BOTH";
export type MissionRevealMode = "ALL" | "SEQUENTIAL" | "SCHEDULED";
export type ResultPublishMode = "IMMEDIATE" | "AFTER_APPROVAL" | "PRIVATE";
export type TemplateType = "PHOTO" | "VIDEO" | "LOCATION" | "QUIZ" | "MIXED" | "TEAM" | "TIMEATTACK";
export type SubmissionStatus =
  | "PENDING"
  | "APPROVED"
  | "AUTO_APPROVED"
  | "REJECTED"
  | "RESUBMIT_REQUESTED"
  | "EXPIRED";
export type ReviewMethod = "MANUAL" | "BULK" | "AUTO";
export type RewardType = "POINT" | "RANK" | "BADGE" | "LOTTERY" | "INSTANT";
export type ClaimStatus = "EARNED" | "CLAIMED";
export type StampSlotType = "MANUAL" | "AUTO_MISSION" | "AUTO_ENTRY";
export type CongestionStatus = "GREEN" | "YELLOW" | "RED";

export interface StampTierConfig {
  sprout: { label: string; emoji: string; goal_count: number; reward_id: string | null };
  explorer: { label: string; emoji: string; goal_count: number; reward_id: string | null };
  keeper: { label: string; emoji: string; goal_count: number; reward_id: string | null };
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          role: UserRole;
          phone_verified: boolean;
          last_login_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          role?: UserRole;
          phone_verified?: boolean;
          last_login_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          role?: UserRole;
          phone_verified?: boolean;
          last_login_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          type: EventType;
          start_at: string;
          end_at: string;
          location: string;
          location_lat: number | null;
          location_lng: number | null;
          join_code: string;
          status: EventStatus;
          participation_type: ParticipationType;
          max_team_size: number;
          max_team_count: number | null;
          show_leaderboard: boolean;
          show_other_scores: boolean;
          mission_reveal_mode: MissionRevealMode;
          result_publish_mode: ResultPublishMode;
          auto_end: boolean;
          created_by_user_id: string | null;
          created_at: string;
          manager_id: string | null;
          manager_password: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          type?: EventType;
          start_at: string;
          end_at: string;
          location: string;
          location_lat?: number | null;
          location_lng?: number | null;
          join_code: string;
          status?: EventStatus;
          participation_type?: ParticipationType;
          max_team_size?: number;
          max_team_count?: number | null;
          show_leaderboard?: boolean;
          show_other_scores?: boolean;
          mission_reveal_mode?: MissionRevealMode;
          result_publish_mode?: ResultPublishMode;
          auto_end?: boolean;
          created_by_user_id?: string | null;
          manager_id?: string | null;
          manager_password?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          type?: EventType;
          start_at?: string;
          end_at?: string;
          location?: string;
          location_lat?: number | null;
          location_lng?: number | null;
          join_code?: string;
          status?: EventStatus;
          participation_type?: ParticipationType;
          max_team_size?: number;
          max_team_count?: number | null;
          show_leaderboard?: boolean;
          show_other_scores?: boolean;
          mission_reveal_mode?: MissionRevealMode;
          result_publish_mode?: ResultPublishMode;
          auto_end?: boolean;
          created_by_user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_rooms: {
        Row: { id: string; event_id: string; type: string; name: string | null; team_id: string | null; pinned_message_id: string | null; created_by: string | null; created_at: string };
        Insert: { id?: string; event_id: string; type?: string; name?: string | null; team_id?: string | null; pinned_message_id?: string | null; created_by?: string | null; created_at?: string };
        Update: { id?: string; event_id?: string; type?: string; name?: string | null; team_id?: string | null; pinned_message_id?: string | null; created_by?: string | null; created_at?: string };
        Relationships: [];
      };
      chat_members: {
        Row: { id: string; room_id: string; user_id: string | null; participant_name: string | null; participant_phone: string | null; role: string; last_read_at: string; is_muted: boolean; joined_at: string; left_at: string | null };
        Insert: { id?: string; room_id: string; user_id?: string | null; participant_name?: string | null; participant_phone?: string | null; role?: string; last_read_at?: string; is_muted?: boolean; joined_at?: string; left_at?: string | null };
        Update: { id?: string; room_id?: string; user_id?: string | null; participant_name?: string | null; participant_phone?: string | null; role?: string; last_read_at?: string; is_muted?: boolean; joined_at?: string; left_at?: string | null };
        Relationships: [];
      };
      chat_messages: {
        Row: { id: string; room_id: string; sender_id: string | null; sender_name: string; type: string; content: string | null; file_url: string | null; file_name: string | null; reply_to_id: string | null; is_deleted: boolean; edited_at: string | null; created_at: string; metadata: Json | null };
        Insert: { id?: string; room_id: string; sender_id?: string | null; sender_name: string; type?: string; content?: string | null; file_url?: string | null; file_name?: string | null; reply_to_id?: string | null; is_deleted?: boolean; edited_at?: string | null; created_at?: string; metadata?: Json | null };
        Update: { id?: string; room_id?: string; sender_id?: string | null; sender_name?: string; type?: string; content?: string | null; file_url?: string | null; file_name?: string | null; reply_to_id?: string | null; is_deleted?: boolean; edited_at?: string | null; created_at?: string; metadata?: Json | null };
        Relationships: [];
      };
      chat_reactions: {
        Row: { id: string; message_id: string; user_name: string; emoji: string; created_at: string };
        Insert: { id?: string; message_id: string; user_name: string; emoji: string; created_at?: string };
        Update: { id?: string; message_id?: string; user_name?: string; emoji?: string; created_at?: string };
        Relationships: [];
      };
      event_registrations: {
        Row: {
          id: string;
          event_id: string;
          phone: string;
          name: string;
          status: string;
          entered_at: string | null;
          registered_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          phone: string;
          name: string;
          status?: string;
          entered_at?: string | null;
          registered_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          phone?: string;
          name?: string;
          status?: string;
          entered_at?: string | null;
          registered_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      event_staff: {
        Row: { id: string; event_id: string; user_id: string; added_at: string };
        Insert: { id?: string; event_id: string; user_id: string; added_at?: string };
        Update: { id?: string; event_id?: string; user_id?: string; added_at?: string };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          team_code: string;
          leader_id: string;
          total_score: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          team_code: string;
          leader_id: string;
          total_score?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: string;
          team_code?: string;
          leader_id?: string;
          total_score?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      participants: {
        Row: {
          id: string;
          user_id: string | null;
          event_id: string;
          participation_type: ParticipationType;
          team_id: string | null;
          total_score: number;
          joined_at: string;
          phone: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          event_id: string;
          participation_type: ParticipationType;
          team_id?: string | null;
          total_score?: number;
          joined_at?: string;
          phone?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          event_id?: string;
          participation_type?: ParticipationType;
          team_id?: string | null;
          total_score?: number;
          joined_at?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
      missions: {
        Row: {
          id: string;
          event_id: string;
          title: string;
          description: string;
          instruction: string | null;
          template_type: TemplateType;
          points: number;
          order: number;
          is_active: boolean;
          auto_approve: boolean;
          config: Json;
        };
        Insert: {
          id?: string;
          event_id: string;
          title: string;
          description: string;
          instruction?: string | null;
          template_type: TemplateType;
          points: number;
          order?: number;
          is_active?: boolean;
          auto_approve?: boolean;
          config?: Json;
        };
        Update: {
          id?: string;
          event_id?: string;
          title?: string;
          description?: string;
          instruction?: string | null;
          template_type?: TemplateType;
          points?: number;
          order?: number;
          is_active?: boolean;
          auto_approve?: boolean;
          config?: Json;
        };
        Relationships: [];
      };
      submissions: {
        Row: {
          id: string;
          mission_id: string;
          participant_id: string;
          team_id: string | null;
          status: SubmissionStatus;
          photo_urls: string[];
          photo_hashes: string[];
          video_url: string | null;
          text_content: string | null;
          location_lat: number | null;
          location_lng: number | null;
          location_accuracy: number | null;
          started_at: string | null;
          submitted_at: string;
          reviewed_at: string | null;
          reviewed_by_user_id: string | null;
          review_method: ReviewMethod | null;
          reject_reason: string | null;
          earned_points: number | null;
          resubmit_count: number;
        };
        Insert: {
          id?: string;
          mission_id: string;
          participant_id: string;
          team_id?: string | null;
          status?: SubmissionStatus;
          photo_urls?: string[];
          photo_hashes?: string[];
          video_url?: string | null;
          text_content?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          location_accuracy?: number | null;
          started_at?: string | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          reviewed_by_user_id?: string | null;
          review_method?: ReviewMethod | null;
          reject_reason?: string | null;
          earned_points?: number | null;
          resubmit_count?: number;
        };
        Update: {
          id?: string;
          mission_id?: string;
          participant_id?: string;
          team_id?: string | null;
          status?: SubmissionStatus;
          photo_urls?: string[];
          photo_hashes?: string[];
          video_url?: string | null;
          text_content?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          location_accuracy?: number | null;
          started_at?: string | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          reviewed_by_user_id?: string | null;
          review_method?: ReviewMethod | null;
          reject_reason?: string | null;
          earned_points?: number | null;
          resubmit_count?: number;
        };
        Relationships: [];
      };
      rewards: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          reward_type: RewardType;
          config: Json;
          quantity: number | null;
          applies_to: ParticipationType;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          description?: string | null;
          image_url?: string | null;
          reward_type: RewardType;
          config?: Json;
          quantity?: number | null;
          applies_to?: ParticipationType;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          reward_type?: RewardType;
          config?: Json;
          quantity?: number | null;
          applies_to?: ParticipationType;
          is_active?: boolean;
        };
        Relationships: [];
      };
      reward_claims: {
        Row: {
          id: string;
          reward_id: string;
          participant_id: string;
          team_id: string | null;
          status: ClaimStatus;
          earned_at: string;
          claimed_at: string | null;
          claimed_by_user_id: string | null;
        };
        Insert: {
          id?: string;
          reward_id: string;
          participant_id: string;
          team_id?: string | null;
          status?: ClaimStatus;
          earned_at?: string;
          claimed_at?: string | null;
          claimed_by_user_id?: string | null;
        };
        Update: {
          id?: string;
          reward_id?: string;
          participant_id?: string;
          team_id?: string | null;
          status?: ClaimStatus;
          earned_at?: string;
          claimed_at?: string | null;
          claimed_by_user_id?: string | null;
        };
        Relationships: [];
      };
      badges: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          icon_url: string | null;
          description: string;
          condition: Json;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          icon_url?: string | null;
          description: string;
          condition?: Json;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: string;
          icon_url?: string | null;
          description?: string;
          condition?: Json;
        };
        Relationships: [];
      };
      badge_earns: {
        Row: { id: string; badge_id: string; participant_id: string; earned_at: string };
        Insert: { id?: string; badge_id: string; participant_id: string; earned_at?: string };
        Update: { id?: string; badge_id?: string; participant_id?: string; earned_at?: string };
        Relationships: [];
      };
      stamp_boards: {
        Row: { id: string; event_id: string; name: string; description: string | null; total_slots: number; tier_config: Json; icon: string | null; is_active: boolean; created_at: string };
        Insert: { id?: string; event_id: string; name: string; description?: string | null; total_slots: number; tier_config?: Json; icon?: string | null; is_active?: boolean; created_at?: string };
        Update: { id?: string; event_id?: string; name?: string; description?: string | null; total_slots?: number; tier_config?: Json; icon?: string | null; is_active?: boolean; created_at?: string };
        Relationships: [];
      };
      stamp_slots: {
        Row: { id: string; board_id: string; order: number; name: string; icon: string | null; description: string | null; location_hint: string | null; type: string; mission_id: string | null; congestion_status: string; staff_name: string | null; is_active: boolean; created_at: string };
        Insert: { id?: string; board_id: string; order?: number; name: string; icon?: string | null; description?: string | null; location_hint?: string | null; type?: string; mission_id?: string | null; congestion_status?: string; staff_name?: string | null; is_active?: boolean; created_at?: string };
        Update: { id?: string; board_id?: string; order?: number; name?: string; icon?: string | null; description?: string | null; location_hint?: string | null; type?: string; mission_id?: string | null; congestion_status?: string; staff_name?: string | null; is_active?: boolean; created_at?: string };
        Relationships: [];
      };
      stamp_records: {
        Row: { id: string; slot_id: string; participant_id: string; stamped_by: string | null; photo_url: string | null; stamped_at: string };
        Insert: { id?: string; slot_id: string; participant_id: string; stamped_by?: string | null; photo_url?: string | null; stamped_at?: string };
        Update: { id?: string; slot_id?: string; participant_id?: string; stamped_by?: string | null; photo_url?: string | null; stamped_at?: string };
        Relationships: [];
      };
      stamp_albums: {
        Row: { id: string; slot_id: string; participant_id: string; photo_url: string; caption: string | null; created_at: string };
        Insert: { id?: string; slot_id: string; participant_id: string; photo_url: string; caption?: string | null; created_at?: string };
        Update: { id?: string; slot_id?: string; participant_id?: string; photo_url?: string; caption?: string | null; created_at?: string };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          message?: string;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      // ===== Phase C: Toriro v6.0 =====
      partners: {
        Row: {
          id: string;
          name: string;
          business_name: string | null;
          username: string;
          password: string;
          email: string | null;
          phone: string | null;
          tier: "SPROUT" | "EXPLORER" | "TREE" | "FOREST" | "LEGEND";
          commission_rate: number;
          acorn_balance: number;
          total_sales: number;
          total_events: number;
          avg_rating: number | null;
          status: "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED";
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          business_name?: string | null;
          username: string;
          password: string;
          email?: string | null;
          phone?: string | null;
          tier?: "SPROUT" | "EXPLORER" | "TREE" | "FOREST" | "LEGEND";
          commission_rate?: number;
          acorn_balance?: number;
          total_sales?: number;
          total_events?: number;
          avg_rating?: number | null;
          status?: "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED";
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          business_name?: string | null;
          username?: string;
          password?: string;
          email?: string | null;
          phone?: string | null;
          tier?: "SPROUT" | "EXPLORER" | "TREE" | "FOREST" | "LEGEND";
          commission_rate?: number;
          acorn_balance?: number;
          total_sales?: number;
          total_events?: number;
          avg_rating?: number | null;
          status?: "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED";
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          participant_phone: string;
          tier: "SPROUT" | "TREE" | "FOREST";
          monthly_price: number;
          monthly_acorns: number;
          status: "ACTIVE" | "PAUSED" | "CANCELED";
          started_at: string;
          next_billing_at: string;
          canceled_at: string | null;
          auto_renew: boolean;
        };
        Insert: {
          id?: string;
          participant_phone: string;
          tier: "SPROUT" | "TREE" | "FOREST";
          monthly_price: number;
          monthly_acorns: number;
          status?: "ACTIVE" | "PAUSED" | "CANCELED";
          started_at?: string;
          next_billing_at: string;
          canceled_at?: string | null;
          auto_renew?: boolean;
        };
        Update: {
          id?: string;
          participant_phone?: string;
          tier?: "SPROUT" | "TREE" | "FOREST";
          monthly_price?: number;
          monthly_acorns?: number;
          status?: "ACTIVE" | "PAUSED" | "CANCELED";
          started_at?: string;
          next_billing_at?: string;
          canceled_at?: string | null;
          auto_renew?: boolean;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          id: string;
          affiliate_name: string;
          affiliate_phone: string | null;
          title: string;
          description: string | null;
          discount_type: "PERCENT" | "AMOUNT" | "FREE";
          discount_value: number | null;
          min_amount: number | null;
          category: "FOOD" | "CAFE" | "DESSERT" | "ACTIVITY" | "EDU" | "OTHER" | null;
          send_delay_minutes: number;
          location_lat: number | null;
          location_lng: number | null;
          location_radius_km: number | null;
          valid_from: string | null;
          valid_until: string | null;
          max_uses: number | null;
          used_count: number;
          status: "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED";
          created_at: string;
        };
        Insert: {
          id?: string;
          affiliate_name: string;
          affiliate_phone?: string | null;
          title: string;
          description?: string | null;
          discount_type: "PERCENT" | "AMOUNT" | "FREE";
          discount_value?: number | null;
          min_amount?: number | null;
          category?: "FOOD" | "CAFE" | "DESSERT" | "ACTIVITY" | "EDU" | "OTHER" | null;
          send_delay_minutes?: number;
          location_lat?: number | null;
          location_lng?: number | null;
          location_radius_km?: number | null;
          valid_from?: string | null;
          valid_until?: string | null;
          max_uses?: number | null;
          used_count?: number;
          status?: "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED";
          created_at?: string;
        };
        Update: {
          id?: string;
          affiliate_name?: string;
          affiliate_phone?: string | null;
          title?: string;
          description?: string | null;
          discount_type?: "PERCENT" | "AMOUNT" | "FREE";
          discount_value?: number | null;
          min_amount?: number | null;
          category?: "FOOD" | "CAFE" | "DESSERT" | "ACTIVITY" | "EDU" | "OTHER" | null;
          send_delay_minutes?: number;
          location_lat?: number | null;
          location_lng?: number | null;
          location_radius_km?: number | null;
          valid_from?: string | null;
          valid_until?: string | null;
          max_uses?: number | null;
          used_count?: number;
          status?: "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED";
          created_at?: string;
        };
        Relationships: [];
      };
      coupon_deliveries: {
        Row: {
          id: string;
          coupon_id: string;
          participant_phone: string;
          event_id: string | null;
          delivered_at: string;
          used_at: string | null;
          used_amount: number | null;
        };
        Insert: {
          id?: string;
          coupon_id: string;
          participant_phone: string;
          event_id?: string | null;
          delivered_at?: string;
          used_at?: string | null;
          used_amount?: number | null;
        };
        Update: {
          id?: string;
          coupon_id?: string;
          participant_phone?: string;
          event_id?: string | null;
          delivered_at?: string;
          used_at?: string | null;
          used_amount?: number | null;
        };
        Relationships: [];
      };
      ad_campaigns: {
        Row: {
          id: string;
          advertiser_name: string;
          title: string;
          description: string | null;
          creative_url: string | null;
          target_portal: "FAMILY" | "ORG" | "PARTNER" | "TALK";
          target_region: string | null;
          target_age_group: string | null;
          placement: "BANNER" | "CARD" | "INLINE" | "POPUP";
          budget: number;
          spent: number;
          impressions: number;
          clicks: number;
          conversions: number;
          start_date: string | null;
          end_date: string | null;
          status: "DRAFT" | "PENDING" | "ACTIVE" | "PAUSED" | "ENDED";
          created_at: string;
        };
        Insert: {
          id?: string;
          advertiser_name: string;
          title: string;
          description?: string | null;
          creative_url?: string | null;
          target_portal: "FAMILY" | "ORG" | "PARTNER" | "TALK";
          target_region?: string | null;
          target_age_group?: string | null;
          placement: "BANNER" | "CARD" | "INLINE" | "POPUP";
          budget?: number;
          spent?: number;
          impressions?: number;
          clicks?: number;
          conversions?: number;
          start_date?: string | null;
          end_date?: string | null;
          status?: "DRAFT" | "PENDING" | "ACTIVE" | "PAUSED" | "ENDED";
          created_at?: string;
        };
        Update: {
          id?: string;
          advertiser_name?: string;
          title?: string;
          description?: string | null;
          creative_url?: string | null;
          target_portal?: "FAMILY" | "ORG" | "PARTNER" | "TALK";
          target_region?: string | null;
          target_age_group?: string | null;
          placement?: "BANNER" | "CARD" | "INLINE" | "POPUP";
          budget?: number;
          spent?: number;
          impressions?: number;
          clicks?: number;
          conversions?: number;
          start_date?: string | null;
          end_date?: string | null;
          status?: "DRAFT" | "PENDING" | "ACTIVE" | "PAUSED" | "ENDED";
          created_at?: string;
        };
        Relationships: [];
      };
      guilds: {
        Row: {
          id: string;
          event_id: string | null;
          name: string;
          description: string | null;
          icon: string | null;
          leader_phone: string;
          max_members: number;
          total_acorns: number;
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id?: string | null;
          name: string;
          description?: string | null;
          icon?: string | null;
          leader_phone: string;
          max_members?: number;
          total_acorns?: number;
          is_public?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string | null;
          name?: string;
          description?: string | null;
          icon?: string | null;
          leader_phone?: string;
          max_members?: number;
          total_acorns?: number;
          is_public?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      guild_members: {
        Row: {
          id: string;
          guild_id: string;
          participant_phone: string;
          participant_name: string;
          role: "LEADER" | "MEMBER";
          joined_at: string;
        };
        Insert: {
          id?: string;
          guild_id: string;
          participant_phone: string;
          participant_name: string;
          role?: "LEADER" | "MEMBER";
          joined_at?: string;
        };
        Update: {
          id?: string;
          guild_id?: string;
          participant_phone?: string;
          participant_name?: string;
          role?: "LEADER" | "MEMBER";
          joined_at?: string;
        };
        Relationships: [];
      };
      partner_programs: {
        Row: {
          id: string;
          partner_id: string | null;
          title: string;
          description: string | null;
          category: "FOREST" | "CAMPING" | "KIDS" | "FAMILY" | "TEAM" | "ART";
          duration_hours: number | null;
          capacity_min: number | null;
          capacity_max: number | null;
          price_per_person: number;
          b2b_price_per_person: number | null;
          location_region: string | null;
          location_detail: string | null;
          image_url: string | null;
          tags: string[] | null;
          rating_avg: number | null;
          rating_count: number;
          booking_count: number;
          is_published: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          partner_id?: string | null;
          title: string;
          description?: string | null;
          category: "FOREST" | "CAMPING" | "KIDS" | "FAMILY" | "TEAM" | "ART";
          duration_hours?: number | null;
          capacity_min?: number | null;
          capacity_max?: number | null;
          price_per_person: number;
          b2b_price_per_person?: number | null;
          location_region?: string | null;
          location_detail?: string | null;
          image_url?: string | null;
          tags?: string[] | null;
          rating_avg?: number | null;
          rating_count?: number;
          booking_count?: number;
          is_published?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          partner_id?: string | null;
          title?: string;
          description?: string | null;
          category?: "FOREST" | "CAMPING" | "KIDS" | "FAMILY" | "TEAM" | "ART";
          duration_hours?: number | null;
          capacity_min?: number | null;
          capacity_max?: number | null;
          price_per_person?: number;
          b2b_price_per_person?: number | null;
          location_region?: string | null;
          location_detail?: string | null;
          image_url?: string | null;
          tags?: string[] | null;
          rating_avg?: number | null;
          rating_count?: number;
          booking_count?: number;
          is_published?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      challenges: {
        Row: {
          id: string;
          event_id: string | null;
          title: string;
          description: string | null;
          icon: string | null;
          goal_type: "MISSION_COUNT" | "ACORN_COUNT" | "STAMP_COUNT" | "ATTENDANCE";
          goal_value: number;
          reward_acorns: number;
          reward_badge: string | null;
          starts_at: string;
          ends_at: string;
          status: "ACTIVE" | "ENDED" | "ARCHIVED";
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id?: string | null;
          title: string;
          description?: string | null;
          icon?: string | null;
          goal_type: "MISSION_COUNT" | "ACORN_COUNT" | "STAMP_COUNT" | "ATTENDANCE";
          goal_value: number;
          reward_acorns?: number;
          reward_badge?: string | null;
          starts_at?: string;
          ends_at: string;
          status?: "ACTIVE" | "ENDED" | "ARCHIVED";
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string | null;
          title?: string;
          description?: string | null;
          icon?: string | null;
          goal_type?: "MISSION_COUNT" | "ACORN_COUNT" | "STAMP_COUNT" | "ATTENDANCE";
          goal_value?: number;
          reward_acorns?: number;
          reward_badge?: string | null;
          starts_at?: string;
          ends_at?: string;
          status?: "ACTIVE" | "ENDED" | "ARCHIVED";
          created_at?: string;
        };
        Relationships: [];
      };
      event_reviews: {
        Row: {
          id: string;
          event_id: string;
          participant_phone: string;
          participant_name: string | null;
          rating: number;
          comment: string | null;
          mission_highlight: string | null;
          improvement: string | null;
          photo_consent: boolean;
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          participant_phone: string;
          participant_name?: string | null;
          rating: number;
          comment?: string | null;
          mission_highlight?: string | null;
          improvement?: string | null;
          photo_consent?: boolean;
          is_public?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          participant_phone?: string;
          participant_name?: string | null;
          rating?: number;
          comment?: string | null;
          mission_highlight?: string | null;
          improvement?: string | null;
          photo_consent?: boolean;
          is_public?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_home_data: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_event_home: {
        Args: { p_event_id: string };
        Returns: Json;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_event_staff: {
        Args: { event_uuid: string };
        Returns: boolean;
      };
      is_event_participant: {
        Args: { event_uuid: string };
        Returns: boolean;
      };
      event_has_registrations: {
        Args: { p_event_id: string };
        Returns: boolean;
      };
      check_phone_registration: {
        Args: { p_join_code: string; p_phone: string };
        Returns: Json;
      };
      find_user_by_phone: {
        Args: { p_phone: string };
        Returns: Json;
      };
      chat_enter_by_name: {
        Args: { p_event_id: string; p_name: string; p_phone_last4: string | null };
        Returns: Json;
      };
    };
    Enums: {
      user_role: UserRole;
      event_status: EventStatus;
      event_type: EventType;
      participation_type: ParticipationType;
      mission_reveal_mode: MissionRevealMode;
      result_publish_mode: ResultPublishMode;
      template_type: TemplateType;
      submission_status: SubmissionStatus;
      review_method: ReviewMethod;
      reward_type: RewardType;
      claim_status: ClaimStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
