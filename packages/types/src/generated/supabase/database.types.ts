export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      access_allowlist: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["AccessAllowlistKind"]
          label: string | null
          status: Database["public"]["Enums"]["RecordStatus"]
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["AccessAllowlistKind"]
          label?: string | null
          status?: Database["public"]["Enums"]["RecordStatus"]
          updated_at: string
          updated_by?: string | null
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["AccessAllowlistKind"]
          label?: string | null
          status?: Database["public"]["Enums"]["RecordStatus"]
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_allowlist_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_allowlist_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string
          file_size: number
          id: string
          mime_type: string
          status: Database["public"]["Enums"]["RecordStatus"]
          storage_path: string
          updated_at: string
          updated_by: string | null
          uploader_id: string
          work_item_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          status?: Database["public"]["Enums"]["RecordStatus"]
          storage_path: string
          updated_at: string
          updated_by?: string | null
          uploader_id: string
          work_item_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          status?: Database["public"]["Enums"]["RecordStatus"]
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
          uploader_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          is_processing: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_processing?: boolean
          title?: string
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_processing?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          content: Json
          created_at: string
          created_by: string | null
          edited: boolean
          id: string
          parent_id: string | null
          status: Database["public"]["Enums"]["RecordStatus"]
          updated_at: string
          updated_by: string | null
          work_item_id: string
        }
        Insert: {
          author_id: string
          content: Json
          created_at?: string
          created_by?: string | null
          edited?: boolean
          id?: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["RecordStatus"]
          updated_at: string
          updated_by?: string | null
          work_item_id: string
        }
        Update: {
          author_id?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          edited?: boolean
          id?: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["RecordStatus"]
          updated_at?: string
          updated_by?: string | null
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      github_pull_requests: {
        Row: {
          branch_name: string | null
          created_at: string
          id: string
          pr_number: number
          pr_title: string
          pr_url: string
          repo_name: string
          repo_owner: string
          status: string | null
          updated_at: string
          work_item_id: string
        }
        Insert: {
          branch_name?: string | null
          created_at?: string
          id?: string
          pr_number: number
          pr_title: string
          pr_url: string
          repo_name: string
          repo_owner: string
          status?: string | null
          updated_at: string
          work_item_id: string
        }
        Update: {
          branch_name?: string | null
          created_at?: string
          id?: string
          pr_number?: number
          pr_title?: string
          pr_url?: string
          repo_name?: string
          repo_owner?: string
          status?: string | null
          updated_at?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "github_pull_requests_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      jira_settings: {
        Row: {
          created_at: string
          id: string
          jira_email: string
          jira_token: string
          jira_url: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          jira_email: string
          jira_token: string
          jira_url: string
          singleton?: boolean
          updated_at: string
        }
        Update: {
          created_at?: string
          id?: string
          jira_email?: string
          jira_token?: string
          jira_url?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          read_status: boolean
          related_item_id: string | null
          status: Database["public"]["Enums"]["RecordStatus"]
          type: Database["public"]["Enums"]["NotificationType"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          read_status?: boolean
          related_item_id?: string | null
          status?: Database["public"]["Enums"]["RecordStatus"]
          type: Database["public"]["Enums"]["NotificationType"]
          updated_at: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          read_status?: boolean
          related_item_id?: string | null
          status?: Database["public"]["Enums"]["RecordStatus"]
          type?: Database["public"]["Enums"]["NotificationType"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          created_by: string | null
          project_id: string
          status: Database["public"]["Enums"]["RecordStatus"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["RecordStatus"]
          updated_at: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["RecordStatus"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          attributes_config: Json | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          end_date: string | null
          github_repo: string | null
          github_token: string | null
          id: string
          jira_email: string | null
          jira_project_key: string | null
          jira_token: string | null
          jira_url: string | null
          key: string
          logo_url: string | null
          cover_picture: string | null
          name: string
          owner_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["ProjectStatus"]
          updated_at: string
          updated_by: string | null
          workflow_config: Json | null
        }
        Insert: {
          attributes_config?: Json | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          github_repo?: string | null
          github_token?: string | null
          id?: string
          jira_email?: string | null
          jira_project_key?: string | null
          jira_token?: string | null
          jira_url?: string | null
          key: string
          logo_url?: string | null
          cover_picture?: string | null
          name: string
          owner_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["ProjectStatus"]
          updated_at: string
          updated_by?: string | null
          workflow_config?: Json | null
        }
        Update: {
          attributes_config?: Json | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          github_repo?: string | null
          github_token?: string | null
          id?: string
          jira_email?: string | null
          jira_project_key?: string | null
          jira_token?: string | null
          jira_url?: string | null
          key?: string
          logo_url?: string | null
          cover_picture?: string | null
          name?: string
          owner_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["ProjectStatus"]
          updated_at?: string
          updated_by?: string | null
          workflow_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_view_shares: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          status: Database["public"]["Enums"]["RecordStatus"]
          updated_at: string
          updated_by: string | null
          user_id: string
          view_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["RecordStatus"]
          updated_at: string
          updated_by?: string | null
          user_id: string
          view_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["RecordStatus"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          view_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_view_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_view_shares_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_view_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_view_shares_view_id_fkey"
            columns: ["view_id"]
            isOneToOne: false
            referencedRelation: "saved_views"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          owner_id: string
          pathname: string
          project_id: string | null
          search: string
          status: Database["public"]["Enums"]["RecordStatus"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          owner_id: string
          pathname: string
          project_id?: string | null
          search?: string
          status?: Database["public"]["Enums"]["RecordStatus"]
          title: string
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          owner_id?: string
          pathname?: string
          project_id?: string | null
          search?: string
          status?: Database["public"]["Enums"]["RecordStatus"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_views_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_views_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          goal: string | null
          id: string
          name: string
          project_id: string
          start_date: string
          status: Database["public"]["Enums"]["SprintStatus"]
          summary_report: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          goal?: string | null
          id?: string
          name: string
          project_id: string
          start_date: string
          status?: Database["public"]["Enums"]["SprintStatus"]
          summary_report?: Json | null
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          goal?: string | null
          id?: string
          name?: string
          project_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["SprintStatus"]
          summary_report?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sprints_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprints_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          allocation: number | null
          capacity: number | null
          created_at: string
          created_by: string | null
          reporting_line: string | null
          role: string | null
          seniority: string | null
          status: Database["public"]["Enums"]["RecordStatus"]
          team_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          allocation?: number | null
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          reporting_line?: string | null
          role?: string | null
          seniority?: string | null
          status?: Database["public"]["Enums"]["RecordStatus"]
          team_id: string
          updated_at: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          allocation?: number | null
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          reporting_line?: string | null
          role?: string | null
          seniority?: string | null
          status?: Database["public"]["Enums"]["RecordStatus"]
          team_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_reporting_line_fkey"
            columns: ["reporting_line"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          manager_id: string
          name: string
          project_id: string | null
          status: Database["public"]["Enums"]["RecordStatus"]
          tech_stack: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          manager_id: string
          name: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["RecordStatus"]
          tech_stack?: string | null
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          manager_id?: string
          name?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["RecordStatus"]
          tech_stack?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active: boolean
          cover_picture: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          membership_status: Database["public"]["Enums"]["UserMembershipStatus"]
          name: string
          profile_picture: string | null
          role: Database["public"]["Enums"]["UserRole"]
          status: Database["public"]["Enums"]["RecordStatus"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          cover_picture?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id: string
          membership_status?: Database["public"]["Enums"]["UserMembershipStatus"]
          name: string
          profile_picture?: string | null
          role?: Database["public"]["Enums"]["UserRole"]
          status?: Database["public"]["Enums"]["RecordStatus"]
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          cover_picture?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          membership_status?: Database["public"]["Enums"]["UserMembershipStatus"]
          name?: string
          profile_picture?: string | null
          role?: Database["public"]["Enums"]["UserRole"]
          status?: Database["public"]["Enums"]["RecordStatus"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      work_item_worklogs: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          id: string
          logged_at: string
          logged_hours: number
          status: Database["public"]["Enums"]["RecordStatus"]
          updated_at: string
          updated_by: string | null
          user_id: string
          work_item_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          logged_at?: string
          logged_hours: number
          status?: Database["public"]["Enums"]["RecordStatus"]
          updated_at: string
          updated_by?: string | null
          user_id: string
          work_item_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          logged_at?: string
          logged_hours?: number
          status?: Database["public"]["Enums"]["RecordStatus"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_worklogs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_worklogs_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_items: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          description: Json | null
          done_at: string | null
          due_date: string | null
          id: string
          jira_issue_key: string | null
          labels: Json
          parent_id: string | null
          priority: Database["public"]["Enums"]["WorkItemPriority"]
          project_id: string
          record_status: Database["public"]["Enums"]["RecordStatus"]
          reporter_id: string | null
          sprint_id: string | null
          status: Database["public"]["Enums"]["WorkItemStatus"]
          story_points: number | null
          title: string
          type: Database["public"]["Enums"]["WorkItemType"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: Json | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          jira_issue_key?: string | null
          labels?: Json
          parent_id?: string | null
          priority?: Database["public"]["Enums"]["WorkItemPriority"]
          project_id: string
          record_status?: Database["public"]["Enums"]["RecordStatus"]
          reporter_id?: string | null
          sprint_id?: string | null
          status?: Database["public"]["Enums"]["WorkItemStatus"]
          story_points?: number | null
          title: string
          type: Database["public"]["Enums"]["WorkItemType"]
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: Json | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          jira_issue_key?: string | null
          labels?: Json
          parent_id?: string | null
          priority?: Database["public"]["Enums"]["WorkItemPriority"]
          project_id?: string
          record_status?: Database["public"]["Enums"]["RecordStatus"]
          reporter_id?: string | null
          sprint_id?: string | null
          status?: Database["public"]["Enums"]["WorkItemStatus"]
          story_points?: number | null
          title?: string
          type?: Database["public"]["Enums"]["WorkItemType"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      deactivate_user_guarded: {
        Args: {
          p_actor_id: string
          p_expected_updated_at: string
          p_user_id: string
        }
        Returns: {
          active: boolean
          cover_picture: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          membership_status: Database["public"]["Enums"]["UserMembershipStatus"]
          name: string
          profile_picture: string | null
          role: Database["public"]["Enums"]["UserRole"]
          status: Database["public"]["Enums"]["RecordStatus"]
          updated_at: string
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      AccessAllowlistKind: "domain" | "email"
      NotificationType:
        | "assign"
        | "status_change"
        | "comment"
        | "mention"
        | "sprint"
        | "due_date"
        | "view_shared"
      ProjectStatus: "active" | "archived"
      RecordStatus: "active" | "inactive" | "archived" | "deleted"
      SprintStatus: "planned" | "active" | "closed" | "archived"
      UserMembershipStatus: "pending" | "active"
      UserRole: "admin" | "manager" | "member"
      WorkItemPriority: "lowest" | "low" | "medium" | "high" | "highest"
      WorkItemStatus:
        | "Draft"
        | "New"
        | "ToDo"
        | "InProgress"
        | "Testing"
        | "Done"
      WorkItemType: "Epic" | "Story" | "Task" | "Issue" | "Feature"
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
    Enums: {
      AccessAllowlistKind: ["domain", "email"],
      NotificationType: [
        "assign",
        "status_change",
        "comment",
        "mention",
        "sprint",
        "due_date",
        "view_shared",
      ],
      ProjectStatus: ["active", "archived"],
      RecordStatus: ["active", "inactive", "archived", "deleted"],
      SprintStatus: ["planned", "active", "closed", "archived"],
      UserMembershipStatus: ["pending", "active"],
      UserRole: ["admin", "manager", "member"],
      WorkItemPriority: ["lowest", "low", "medium", "high", "highest"],
      WorkItemStatus: ["Draft", "New", "ToDo", "InProgress", "Testing", "Done"],
      WorkItemType: ["Epic", "Story", "Task", "Issue", "Feature"],
    },
  },
} as const

