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
      _prisma_migrations: {
        Row: {
          applied_steps_count: number;
          checksum: string;
          finished_at: string | null;
          id: string;
          logs: string | null;
          migration_name: string;
          rolled_back_at: string | null;
          started_at: string;
        };
        Insert: {
          applied_steps_count?: number;
          checksum: string;
          finished_at?: string | null;
          id: string;
          logs?: string | null;
          migration_name: string;
          rolled_back_at?: string | null;
          started_at?: string;
        };
        Update: {
          applied_steps_count?: number;
          checksum?: string;
          finished_at?: string | null;
          id?: string;
          logs?: string | null;
          migration_name?: string;
          rolled_back_at?: string | null;
          started_at?: string;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          created_at: string;
          created_by: string | null;
          file_name: string;
          file_size: number;
          id: string;
          mime_type: string;
          status: Database['public']['Enums']['RecordStatus'];
          storage_path: string;
          updated_at: string;
          updated_by: string | null;
          uploader_id: string;
          work_item_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          file_name: string;
          file_size: number;
          id?: string;
          mime_type: string;
          status?: Database['public']['Enums']['RecordStatus'];
          storage_path: string;
          updated_at?: string;
          updated_by?: string | null;
          uploader_id: string;
          work_item_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          file_name?: string;
          file_size?: number;
          id?: string;
          mime_type?: string;
          status?: Database['public']['Enums']['RecordStatus'];
          storage_path?: string;
          updated_at?: string;
          updated_by?: string | null;
          uploader_id?: string;
          work_item_id?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          author_id: string;
          content: string;
          created_at: string;
          created_by: string | null;
          edited: boolean;
          id: string;
          parent_id: string | null;
          status: Database['public']['Enums']['RecordStatus'];
          updated_at: string;
          updated_by: string | null;
          work_item_id: string;
        };
        Insert: {
          author_id: string;
          content: string;
          created_at?: string;
          created_by?: string | null;
          edited?: boolean;
          id?: string;
          parent_id?: string | null;
          status?: Database['public']['Enums']['RecordStatus'];
          updated_at?: string;
          updated_by?: string | null;
          work_item_id: string;
        };
        Update: {
          author_id?: string;
          content?: string;
          created_at?: string;
          created_by?: string | null;
          edited?: boolean;
          id?: string;
          parent_id?: string | null;
          status?: Database['public']['Enums']['RecordStatus'];
          updated_at?: string;
          updated_by?: string | null;
          work_item_id?: string;
        };
        Relationships: [];
      };
      instruments: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: number;
          name: string;
          status: Database['public']['Enums']['RecordStatus'];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: never;
          name: string;
          status?: Database['public']['Enums']['RecordStatus'];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: never;
          name?: string;
          status?: Database['public']['Enums']['RecordStatus'];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          message: string;
          read_status: boolean;
          related_item_id: string | null;
          status: Database['public']['Enums']['RecordStatus'];
          type: Database['public']['Enums']['NotificationType'];
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          message: string;
          read_status?: boolean;
          related_item_id?: string | null;
          status?: Database['public']['Enums']['RecordStatus'];
          type: Database['public']['Enums']['NotificationType'];
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          message?: string;
          read_status?: boolean;
          related_item_id?: string | null;
          status?: Database['public']['Enums']['RecordStatus'];
          type?: Database['public']['Enums']['NotificationType'];
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          created_at: string;
          created_by: string | null;
          project_id: string;
          status: Database['public']['Enums']['RecordStatus'];
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          project_id: string;
          status?: Database['public']['Enums']['RecordStatus'];
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          project_id?: string;
          status?: Database['public']['Enums']['RecordStatus'];
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          end_date: string | null;
          id: string;
          key: string;
          name: string;
          owner_id: string;
          start_date: string | null;
          status: Database['public']['Enums']['ProjectStatus'];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          key: string;
          name: string;
          owner_id: string;
          start_date?: string | null;
          status?: Database['public']['Enums']['ProjectStatus'];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          key?: string;
          name?: string;
          owner_id?: string;
          start_date?: string | null;
          status?: Database['public']['Enums']['ProjectStatus'];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      sprints: {
        Row: {
          created_at: string;
          created_by: string | null;
          end_date: string;
          goal: string | null;
          id: string;
          name: string;
          project_id: string;
          start_date: string;
          status: Database['public']['Enums']['SprintStatus'];
          summary_report: Json | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          end_date: string;
          goal?: string | null;
          id?: string;
          name: string;
          project_id: string;
          start_date: string;
          status?: Database['public']['Enums']['SprintStatus'];
          summary_report?: Json | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          end_date?: string;
          goal?: string | null;
          id?: string;
          name?: string;
          project_id?: string;
          start_date?: string;
          status?: Database['public']['Enums']['SprintStatus'];
          summary_report?: Json | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          allocation: number | null;
          capacity: number | null;
          created_at: string;
          created_by: string | null;
          reporting_line: string | null;
          role: string | null;
          seniority: string | null;
          status: Database['public']['Enums']['RecordStatus'];
          team_id: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          allocation?: number | null;
          capacity?: number | null;
          created_at?: string;
          created_by?: string | null;
          reporting_line?: string | null;
          role?: string | null;
          seniority?: string | null;
          status?: Database['public']['Enums']['RecordStatus'];
          team_id: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          allocation?: number | null;
          capacity?: number | null;
          created_at?: string;
          created_by?: string | null;
          reporting_line?: string | null;
          role?: string | null;
          seniority?: string | null;
          status?: Database['public']['Enums']['RecordStatus'];
          team_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          manager_id: string;
          name: string;
          status: Database['public']['Enums']['RecordStatus'];
          tech_stack: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          manager_id: string;
          name: string;
          status?: Database['public']['Enums']['RecordStatus'];
          tech_stack?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          manager_id?: string;
          name?: string;
          status?: Database['public']['Enums']['RecordStatus'];
          tech_stack?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      users: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          email: string;
          id: string;
          name: string;
          profile_picture: string | null;
          role: Database['public']['Enums']['UserRole'];
          status: Database['public']['Enums']['RecordStatus'];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          email: string;
          id: string;
          name: string;
          profile_picture?: string | null;
          role?: Database['public']['Enums']['UserRole'];
          status?: Database['public']['Enums']['RecordStatus'];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          email?: string;
          id?: string;
          name?: string;
          profile_picture?: string | null;
          role?: Database['public']['Enums']['UserRole'];
          status?: Database['public']['Enums']['RecordStatus'];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      work_items: {
        Row: {
          assignee_id: string | null;
          created_at: string;
          created_by: string | null;
          description: Json | null;
          due_date: string | null;
          id: string;
          parent_id: string | null;
          priority: Database['public']['Enums']['WorkItemPriority'];
          project_id: string;
          reporter_id: string | null;
          sprint_id: string | null;
          status: Database['public']['Enums']['WorkItemStatus'];
          story_points: number | null;
          title: string;
          type: Database['public']['Enums']['WorkItemType'];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          assignee_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: Json | null;
          due_date?: string | null;
          id?: string;
          parent_id?: string | null;
          priority?: Database['public']['Enums']['WorkItemPriority'];
          project_id: string;
          reporter_id?: string | null;
          sprint_id?: string | null;
          status?: Database['public']['Enums']['WorkItemStatus'];
          story_points?: number | null;
          title: string;
          type: Database['public']['Enums']['WorkItemType'];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          assignee_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: Json | null;
          due_date?: string | null;
          id?: string;
          parent_id?: string | null;
          priority?: Database['public']['Enums']['WorkItemPriority'];
          project_id?: string;
          reporter_id?: string | null;
          sprint_id?: string | null;
          status?: Database['public']['Enums']['WorkItemStatus'];
          story_points?: number | null;
          title?: string;
          type?: Database['public']['Enums']['WorkItemType'];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      NotificationType:
        | 'assign'
        | 'status_change'
        | 'comment'
        | 'mention'
        | 'sprint'
        | 'due_date';
      RecordStatus: 'active' | 'inactive' | 'archived' | 'deleted';
      ProjectStatus: 'active' | 'archived';
      SprintStatus: 'planned' | 'active' | 'closed';
      UserRole: 'admin' | 'manager' | 'member';
      WorkItemPriority: 'lowest' | 'low' | 'medium' | 'high' | 'highest';
      WorkItemStatus:
        | 'Draft'
        | 'New'
        | 'ToDo'
        | 'InProgress'
        | 'Testing'
        | 'Done';
      WorkItemType: 'Epic' | 'Story' | 'Task';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      NotificationType: [
        'assign',
        'status_change',
        'comment',
        'mention',
        'sprint',
        'due_date',
      ],
      RecordStatus: ['active', 'inactive', 'archived', 'deleted'],
      ProjectStatus: ['active', 'archived'],
      SprintStatus: ['planned', 'active', 'closed'],
      UserRole: ['admin', 'manager', 'member'],
      WorkItemPriority: ['lowest', 'low', 'medium', 'high', 'highest'],
      WorkItemStatus: ['Draft', 'New', 'ToDo', 'InProgress', 'Testing', 'Done'],
      WorkItemType: ['Epic', 'Story', 'Task'],
    },
  },
} as const;
