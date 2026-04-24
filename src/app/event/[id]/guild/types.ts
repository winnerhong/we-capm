export type Guild = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  leader_phone: string;
  max_members: number;
  total_acorns: number;
  is_public: boolean;
};

export type GuildMember = {
  id: string;
  guild_id: string;
  participant_phone: string;
  participant_name: string;
  role: "LEADER" | "MEMBER";
};
