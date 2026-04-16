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
          created_by_user_id: string;
          created_at: string;
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
          created_by_user_id: string;
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
          user_id: string;
          event_id: string;
          participation_type: ParticipationType;
          team_id: string | null;
          total_score: number;
          joined_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          participation_type: ParticipationType;
          team_id?: string | null;
          total_score?: number;
          joined_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          participation_type?: ParticipationType;
          team_id?: string | null;
          total_score?: number;
          joined_at?: string;
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
