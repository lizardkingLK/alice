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
          file_name: string;
          file_size: number;
          id: string;
          mime_type: string;
          storage_path: string;
          uploaded_at: string;
          uploader_id: string;
          work_item_id: string;
        };
        Insert: {
          file_name: string;
          file_size: number;
          id?: string;
          mime_type: string;
          storage_path: string;
          uploaded_at?: string;
          uploader_id: string;
          work_item_id: string;
        };
        Update: {
          file_name?: string;
          file_size?: number;
          id?: string;
          mime_type?: string;
          storage_path?: string;
          uploaded_at?: string;
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
          edited: boolean;
          id: string;
          parent_id: string | null;
          updated_at: string;
          work_item_id: string;
        };
        Insert: {
          author_id: string;
          content: string;
          created_at?: string;
          edited?: boolean;
          id?: string;
          parent_id?: string | null;
          updated_at?: string;
          work_item_id: string;
        };
        Update: {
          author_id?: string;
          content?: string;
          created_at?: string;
          edited?: boolean;
          id?: string;
          parent_id?: string | null;
          updated_at?: string;
          work_item_id?: string;
        };
        Relationships: [];
      };
      instruments: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: never;
          name: string;
        };
        Update: {
          id?: never;
          name?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          read_status: boolean;
          related_item_id: string | null;
          type: Database['public']['Enums']['NotificationType'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message: string;
          read_status?: boolean;
          related_item_id?: string | null;
          type: Database['public']['Enums']['NotificationType'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          read_status?: boolean;
          related_item_id?: string | null;
          type?: Database['public']['Enums']['NotificationType'];
          user_id?: string;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          joined_at: string;
          project_id: string;
          user_id: string;
        };
        Insert: {
          joined_at?: string;
          project_id: string;
          user_id: string;
        };
        Update: {
          joined_at?: string;
          project_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          end_date: string | null;
          id: string;
          key: string;
          name: string;
          owner_id: string;
          start_date: string | null;
          status: Database['public']['Enums']['ProjectStatus'];
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          key: string;
          name: string;
          owner_id: string;
          start_date?: string | null;
          status?: Database['public']['Enums']['ProjectStatus'];
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          key?: string;
          name?: string;
          owner_id?: string;
          start_date?: string | null;
          status?: Database['public']['Enums']['ProjectStatus'];
        };
        Relationships: [];
      };
      sprints: {
        Row: {
          created_at: string;
          end_date: string;
          goal: string | null;
          id: string;
          name: string;
          project_id: string;
          start_date: string;
          status: Database['public']['Enums']['SprintStatus'];
          summary_report: Json | null;
        };
        Insert: {
          created_at?: string;
          end_date: string;
          goal?: string | null;
          id?: string;
          name: string;
          project_id: string;
          start_date: string;
          status?: Database['public']['Enums']['SprintStatus'];
          summary_report?: Json | null;
        };
        Update: {
          created_at?: string;
          end_date?: string;
          goal?: string | null;
          id?: string;
          name?: string;
          project_id?: string;
          start_date?: string;
          status?: Database['public']['Enums']['SprintStatus'];
          summary_report?: Json | null;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          allocation: number | null;
          capacity: number | null;
          reporting_line: string | null;
          role: string | null;
          seniority: string | null;
          team_id: string;
          user_id: string;
        };
        Insert: {
          allocation?: number | null;
          capacity?: number | null;
          reporting_line?: string | null;
          role?: string | null;
          seniority?: string | null;
          team_id: string;
          user_id: string;
        };
        Update: {
          allocation?: number | null;
          capacity?: number | null;
          reporting_line?: string | null;
          role?: string | null;
          seniority?: string | null;
          team_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          manager_id: string;
          name: string;
          tech_stack: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          manager_id: string;
          name: string;
          tech_stack?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          manager_id?: string;
          name?: string;
          tech_stack?: string | null;
        };
        Relationships: [];
      };
      users: {
        Row: {
          active: boolean;
          created_at: string;
          email: string;
          id: string;
          name: string;
          profile_picture: string | null;
          role: Database['public']['Enums']['UserRole'];
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          email: string;
          id: string;
          name: string;
          profile_picture?: string | null;
          role?: Database['public']['Enums']['UserRole'];
        };
        Update: {
          active?: boolean;
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          profile_picture?: string | null;
          role?: Database['public']['Enums']['UserRole'];
        };
        Relationships: [];
      };
      work_items: {
        Row: {
          assignee_id: string | null;
          created_at: string;
          description: Json | null;
          due_date: string | null;
          id: string;
          parent_id: string | null;
          priority: Database['public']['Enums']['WorkItemPriority'];
          project_id: string;
          reporter_id: string;
          sprint_id: string | null;
          status: Database['public']['Enums']['WorkItemStatus'];
          story_points: number | null;
          title: string;
          type: Database['public']['Enums']['WorkItemType'];
          updated_at: string;
        };
        Insert: {
          assignee_id?: string | null;
          created_at?: string;
          description?: Json | null;
          due_date?: string | null;
          id?: string;
          parent_id?: string | null;
          priority?: Database['public']['Enums']['WorkItemPriority'];
          project_id: string;
          reporter_id: string;
          sprint_id?: string | null;
          status?: Database['public']['Enums']['WorkItemStatus'];
          story_points?: number | null;
          title: string;
          type: Database['public']['Enums']['WorkItemType'];
          updated_at?: string;
        };
        Update: {
          assignee_id?: string | null;
          created_at?: string;
          description?: Json | null;
          due_date?: string | null;
          id?: string;
          parent_id?: string | null;
          priority?: Database['public']['Enums']['WorkItemPriority'];
          project_id?: string;
          reporter_id?: string;
          sprint_id?: string | null;
          status?: Database['public']['Enums']['WorkItemStatus'];
          story_points?: number | null;
          title?: string;
          type?: Database['public']['Enums']['WorkItemType'];
          updated_at?: string;
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
      ProjectStatus: ['active', 'archived'],
      SprintStatus: ['planned', 'active', 'closed'],
      UserRole: ['admin', 'manager', 'member'],
      WorkItemPriority: ['lowest', 'low', 'medium', 'high', 'highest'],
      WorkItemStatus: ['Draft', 'New', 'ToDo', 'InProgress', 'Testing', 'Done'],
      WorkItemType: ['Epic', 'Story', 'Task'],
    },
  },
} as const;
