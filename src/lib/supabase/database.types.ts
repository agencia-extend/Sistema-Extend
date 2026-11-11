
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"changes": NonNullable<Json>,"created_at": string,"entity_id": string | null,"entity_type": string,"id": number,"organization_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"changes"?: NonNullable<Json>,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: never,"organization_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"changes"?: NonNullable<Json>,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"organization_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"client_accounts": {
                  Row: {
                    "client_id": string,"created_at": string,"id": string,"kind": string,"label": string | null,"value": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"id"?: string,"kind": string,"label"?: string | null,"value": string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"label"?: string | null,"value"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_accounts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"client_contacts": {
                  Row: {
                    "client_id": string,"created_at": string,"email": string | null,"id": string,"is_primary": boolean,"name": string,"phone": string | null,"role": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"email"?: string | null,"id"?: string,"is_primary"?: boolean,"name": string,"phone"?: string | null,"role"?: string | null
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"email"?: string | null,"id"?: string,"is_primary"?: boolean,"name"?: string,"phone"?: string | null,"role"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_contacts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"client_files": {
                  Row: {
                    "category": string,"client_id": string,"created_at": string,"id": string,"meeting_id": string | null,"mime_type": string | null,"name": string,"size_bytes": number | null,"storage_path": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string,"client_id": string,"created_at"?: string,"id"?: string,"meeting_id"?: string | null,"mime_type"?: string | null,"name": string,"size_bytes"?: number | null,"storage_path": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "category"?: string,"client_id"?: string,"created_at"?: string,"id"?: string,"meeting_id"?: string | null,"mime_type"?: string | null,"name"?: string,"size_bytes"?: number | null,"storage_path"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_files_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_files_meeting_id_fkey"
      columns: ["meeting_id"]
isOneToOne: false
      referencedRelation: "client_meetings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_files_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"client_ideas": {
                  Row: {
                    "body": string | null,"client_id": string,"converted_task_id": string | null,"created_at": string,"created_by": string | null,"id": string,"link": string | null,"tags": (string)[],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"client_id": string,"converted_task_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"link"?: string | null,"tags"?: (string)[],"title": string
                  }
                  Update: {
                    "body"?: string | null,"client_id"?: string,"converted_task_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"link"?: string | null,"tags"?: (string)[],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_ideas_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_ideas_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"client_imports": {
                  Row: {
                    "created_at": string,"created_by": string | null,"file_name": string,"id": string,"organization_id": string,"row_count": number,"undone_at": string | null,"undone_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"file_name": string,"id"?: string,"organization_id": string,"row_count"?: number,"undone_at"?: string | null,"undone_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"file_name"?: string,"id"?: string,"organization_id"?: string,"row_count"?: number,"undone_at"?: string | null,"undone_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_imports_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_imports_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_imports_undone_by_fkey"
      columns: ["undone_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"client_meetings": {
                  Row: {
                    "client_id": string,"created_at": string,"created_by": string | null,"held_at": string,"id": string,"kind": string,"link": string | null,"participant_ids": (string)[],"summary": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"created_by"?: string | null,"held_at": string,"id"?: string,"kind"?: string,"link"?: string | null,"participant_ids"?: (string)[],"summary"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"created_by"?: string | null,"held_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"participant_ids"?: (string)[],"summary"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_meetings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_meetings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"client_members": {
                  Row: {
                    "client_id": string,"created_at": string,"created_by": string | null,"is_default": boolean,"profile_id": string,"sector_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"created_by"?: string | null,"is_default"?: boolean,"profile_id": string,"sector_id": string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"created_by"?: string | null,"is_default"?: boolean,"profile_id"?: string,"sector_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_members_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_members_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_members_sector_id_fkey"
      columns: ["sector_id"]
isOneToOne: false
      referencedRelation: "sectors"
      referencedColumns: ["id"]
    }
                  ]
                },"client_onboarding": {
                  Row: {
                    "answers": NonNullable<Json>,"client_id": string,"completed_at": string | null,"completed_by": string | null,"form_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "answers"?: NonNullable<Json>,"client_id": string,"completed_at"?: string | null,"completed_by"?: string | null,"form_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "answers"?: NonNullable<Json>,"client_id"?: string,"completed_at"?: string | null,"completed_by"?: string | null,"form_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_onboarding_client_id_fkey"
      columns: ["client_id"]
isOneToOne: true
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_onboarding_completed_by_fkey"
      columns: ["completed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_onboarding_form_id_fkey"
      columns: ["form_id"]
isOneToOne: false
      referencedRelation: "onboarding_forms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_onboarding_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"client_services": {
                  Row: {
                    "client_id": string,"created_at": string,"ends_on": string | null,"id": string,"monthly_qty": number,"price_cents": number | null,"service_id": string,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"ends_on"?: string | null,"id"?: string,"monthly_qty"?: number,"price_cents"?: number | null,"service_id": string,"starts_on"?: string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"ends_on"?: string | null,"id"?: string,"monthly_qty"?: number,"price_cents"?: number | null,"service_id"?: string,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_services_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_services_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "service_catalog"
      referencedColumns: ["id"]
    }
                  ]
                },"client_timeline": {
                  Row: {
                    "actor_id": string | null,"client_id": string,"created_at": string,"data": NonNullable<Json>,"id": number,"kind": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"client_id": string,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"kind": string,"title": string
                  }
                  Update: {
                    "actor_id"?: string | null,"client_id"?: string,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"kind"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_timeline_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_timeline_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "communication_channel": string | null,"contract_end": string | null,"contract_start": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"document": string | null,"id": string,"import_id": string | null,"legal_name": string | null,"media_budget_cents": number | null,"monthly_fee_cents": number | null,"name": string,"notes": string | null,"onboarding_completed_at": string | null,"onboarding_legacy": boolean,"organization_id": string,"payment_method": string | null,"renewal_date": string | null,"segment": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "communication_channel"?: string | null,"contract_end"?: string | null,"contract_start"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document"?: string | null,"id"?: string,"import_id"?: string | null,"legal_name"?: string | null,"media_budget_cents"?: number | null,"monthly_fee_cents"?: number | null,"name": string,"notes"?: string | null,"onboarding_completed_at"?: string | null,"onboarding_legacy"?: boolean,"organization_id": string,"payment_method"?: string | null,"renewal_date"?: string | null,"segment"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "communication_channel"?: string | null,"contract_end"?: string | null,"contract_start"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document"?: string | null,"id"?: string,"import_id"?: string | null,"legal_name"?: string | null,"media_budget_cents"?: number | null,"monthly_fee_cents"?: number | null,"name"?: string,"notes"?: string | null,"onboarding_completed_at"?: string | null,"onboarding_legacy"?: boolean,"organization_id"?: string,"payment_method"?: string | null,"renewal_date"?: string | null,"segment"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clients_import_id_fkey"
      columns: ["import_id"]
isOneToOne: false
      referencedRelation: "client_imports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clients_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"commercial_handoffs": {
                  Row: {
                    "client_id": string,"closed_on": string,"contract_months": number | null,"created_at": string,"created_by": string | null,"id": string,"monthly_fee_cents": number | null,"notes": string | null,"payment_method": string | null,"setup_fee_cents": number | null,"sold_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"closed_on"?: string,"contract_months"?: number | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"monthly_fee_cents"?: number | null,"notes"?: string | null,"payment_method"?: string | null,"setup_fee_cents"?: number | null,"sold_by"?: string | null
                  }
                  Update: {
                    "client_id"?: string,"closed_on"?: string,"contract_months"?: number | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"monthly_fee_cents"?: number | null,"notes"?: string | null,"payment_method"?: string | null,"setup_fee_cents"?: number | null,"sold_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "commercial_handoffs_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "commercial_handoffs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "commercial_handoffs_sold_by_fkey"
      columns: ["sold_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"handoff_promises": {
                  Row: {
                    "client_id": string,"created_at": string,"description": string,"done_at": string | null,"done_by": string | null,"due_at": string,"handoff_id": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"description": string,"done_at"?: string | null,"done_by"?: string | null,"due_at": string,"handoff_id"?: string | null,"id"?: string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"description"?: string,"done_at"?: string | null,"done_by"?: string | null,"due_at"?: string,"handoff_id"?: string | null,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "handoff_promises_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "handoff_promises_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "handoff_promises_handoff_id_fkey"
      columns: ["handoff_id"]
isOneToOne: false
      referencedRelation: "commercial_handoffs"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"client_ids": (string)[],"created_at": string,"email": string,"expires_at": string,"full_name": string,"id": string,"invited_by": string | null,"last_sent_at": string,"organization_id": string,"role_id": string,"sector_ids": (string)[],"send_count": number,"status": Database["public"]['Enums']["invitation_status"],"token_hash": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_ids"?: (string)[],"created_at"?: string,"email": string,"expires_at"?: string,"full_name"?: string,"id"?: string,"invited_by"?: string | null,"last_sent_at"?: string,"organization_id": string,"role_id": string,"sector_ids"?: (string)[],"send_count"?: number,"status"?: Database["public"]['Enums']["invitation_status"],"token_hash": string,"user_id"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_ids"?: (string)[],"created_at"?: string,"email"?: string,"expires_at"?: string,"full_name"?: string,"id"?: string,"invited_by"?: string | null,"last_sent_at"?: string,"organization_id"?: string,"role_id"?: string,"sector_ids"?: (string)[],"send_count"?: number,"status"?: Database["public"]['Enums']["invitation_status"],"token_hash"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "in_app": boolean,"kind": string,"push": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "in_app"?: boolean,"kind": string,"push"?: boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "in_app"?: boolean,"kind"?: string,"push"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"body": string | null,"created_at": string,"dedupe_key": string | null,"href": string | null,"id": string,"kind": string,"organization_id": string,"push_status": string,"read_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"body"?: string | null,"created_at"?: string,"dedupe_key"?: string | null,"href"?: string | null,"id"?: string,"kind": string,"organization_id": string,"push_status"?: string,"read_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"body"?: string | null,"created_at"?: string,"dedupe_key"?: string | null,"href"?: string | null,"id"?: string,"kind"?: string,"organization_id"?: string,"push_status"?: string,"read_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"onboarding_checklist_items": {
                  Row: {
                    "assignee_id": string | null,"client_id": string,"created_at": string,"done_at": string | null,"done_by": string | null,"due_at": string | null,"id": string,"position": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"client_id": string,"created_at"?: string,"done_at"?: string | null,"done_by"?: string | null,"due_at"?: string | null,"id"?: string,"position"?: number,"title": string
                  }
                  Update: {
                    "assignee_id"?: string | null,"client_id"?: string,"created_at"?: string,"done_at"?: string | null,"done_by"?: string | null,"due_at"?: string | null,"id"?: string,"position"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "onboarding_checklist_items_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "onboarding_checklist_items_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "onboarding_checklist_items_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"onboarding_checklist_templates": {
                  Row: {
                    "created_at": string,"default_sector_id": string | null,"due_days": number,"id": string,"is_active": boolean,"organization_id": string,"position": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_sector_id"?: string | null,"due_days"?: number,"id"?: string,"is_active"?: boolean,"organization_id": string,"position"?: number,"title": string
                  }
                  Update: {
                    "created_at"?: string,"default_sector_id"?: string | null,"due_days"?: number,"id"?: string,"is_active"?: boolean,"organization_id"?: string,"position"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "onboarding_checklist_templates_default_sector_id_fkey"
      columns: ["default_sector_id"]
isOneToOne: false
      referencedRelation: "sectors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "onboarding_checklist_templates_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"onboarding_forms": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_current": boolean,"organization_id": string,"sections": NonNullable<Json>,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_current"?: boolean,"organization_id": string,"sections": NonNullable<Json>,"version": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_current"?: boolean,"organization_id"?: string,"sections"?: NonNullable<Json>,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "onboarding_forms_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "onboarding_forms_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"settings": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"settings"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"settings"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"permissions": {
                  Row: {
                    "description": string,"key": string,"label": string,"module": string,"position": number,"scoped": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string,"key": string,"label": string,"module": string,"position"?: number,"scoped"?: boolean
                  }
                  Update: {
                    "description"?: string,"key"?: string,"label"?: string,"module"?: string,"position"?: number,"scoped"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"profile_sectors": {
                  Row: {
                    "created_at": string,"is_lead": boolean,"profile_id": string,"sector_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"is_lead"?: boolean,"profile_id": string,"sector_id": string
                  }
                  Update: {
                    "created_at"?: string,"is_lead"?: boolean,"profile_id"?: string,"sector_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_sectors_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_sectors_sector_id_fkey"
      columns: ["sector_id"]
isOneToOne: false
      referencedRelation: "sectors"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"deactivated_at": string | null,"email": string,"full_name": string,"id": string,"is_active": boolean,"job_title": string | null,"last_seen_at": string | null,"organization_id": string,"phone_e164": string | null,"preferences": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"email": string,"full_name"?: string,"id": string,"is_active"?: boolean,"job_title"?: string | null,"last_seen_at"?: string | null,"organization_id": string,"phone_e164"?: string | null,"preferences"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"email"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"job_title"?: string | null,"last_seen_at"?: string | null,"organization_id"?: string,"phone_e164"?: string | null,"preferences"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"last_used_at": string | null,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"last_used_at"?: string | null,"p256dh": string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"last_used_at"?: string | null,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "permission_key": string,"role_id": string,"scope": Database["public"]['Enums']["permission_scope"]
                  }
                  ComputedFields: never
                  Insert: {
                    "permission_key": string,"role_id": string,"scope"?: Database["public"]['Enums']["permission_scope"]
                  }
                  Update: {
                    "permission_key"?: string,"role_id"?: string,"scope"?: Database["public"]['Enums']["permission_scope"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_permission_key_fkey"
      columns: ["permission_key"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "role_permissions_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    }
                  ]
                },"roles": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"is_system": boolean,"key": string,"name": string,"organization_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"id"?: string,"is_system"?: boolean,"key": string,"name": string,"organization_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"is_system"?: boolean,"key"?: string,"name"?: string,"organization_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roles_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"sectors": {
                  Row: {
                    "area": string,"color": string,"created_at": string,"id": string,"is_active": boolean,"key": string,"name": string,"organization_id": string,"position": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area": string,"color"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"key": string,"name": string,"organization_id": string,"position"?: number,"updated_at"?: string
                  }
                  Update: {
                    "area"?: string,"color"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"key"?: string,"name"?: string,"organization_id"?: string,"position"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sectors_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"service_catalog": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"key": string,"name": string,"organization_id": string,"position": number,"sector_id": string | null,"tabs": (string)[],"task_type": string | null,"unit": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"key": string,"name": string,"organization_id": string,"position"?: number,"sector_id"?: string | null,"tabs"?: (string)[],"task_type"?: string | null,"unit"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"key"?: string,"name"?: string,"organization_id"?: string,"position"?: number,"sector_id"?: string | null,"tabs"?: (string)[],"task_type"?: string | null,"unit"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_catalog_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_catalog_sector_id_fkey"
      columns: ["sector_id"]
isOneToOne: false
      referencedRelation: "sectors"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assignee_id": string | null,"client_id": string | null,"completed_at": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"description": string | null,"due_at": string | null,"id": string,"organization_id": string,"priority": string,"sector_id": string | null,"service_id": string | null,"slot_index": number | null,"slot_month": string | null,"slot_total": number | null,"status": string,"title": string,"type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"client_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"due_at"?: string | null,"id"?: string,"organization_id": string,"priority"?: string,"sector_id"?: string | null,"service_id"?: string | null,"slot_index"?: number | null,"slot_month"?: string | null,"slot_total"?: number | null,"status"?: string,"title": string,"type"?: string,"updated_at"?: string
                  }
                  Update: {
                    "assignee_id"?: string | null,"client_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"due_at"?: string | null,"id"?: string,"organization_id"?: string,"priority"?: string,"sector_id"?: string | null,"service_id"?: string | null,"slot_index"?: number | null,"slot_month"?: string | null,"slot_total"?: number | null,"status"?: string,"title"?: string,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_sector_id_fkey"
      columns: ["sector_id"]
isOneToOne: false
      referencedRelation: "sectors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "service_catalog"
      referencedColumns: ["id"]
    }
                  ]
                },"user_permission_overrides": {
                  Row: {
                    "created_at": string,"created_by": string | null,"effect": Database["public"]['Enums']["override_effect"],"permission_key": string,"scope": Database["public"]['Enums']["permission_scope"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"effect": Database["public"]['Enums']["override_effect"],"permission_key": string,"scope"?: Database["public"]['Enums']["permission_scope"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"effect"?: Database["public"]['Enums']["override_effect"],"permission_key"?: string,"scope"?: Database["public"]['Enums']["permission_scope"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_permission_overrides_permission_key_fkey"
      columns: ["permission_key"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "user_permission_overrides_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"created_by": string | null,"role_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"role_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"role_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_set_user_active":
{ Args: { "p_active": boolean,"p_user": string }; Returns: undefined
                           },
"admin_set_user_role":
{ Args: { "p_role": string,"p_user": string }; Returns: undefined
                           },
"archive_client":
{ Args: { "p_client": string }; Returns: undefined
                           },
"claim_pending_pushes":
{ Args: { "p_limit"?: number }; Returns: {
              "body": string,"href": string,"id": string,"kind": string,"title": string,"user_id": string
            }[]
                           },
"client_operational_summary":
{ Args: { "p_client": string }; Returns: {
              "answer": string,"label": string,"section": string
            }[]
                           },
"complete_onboarding":
{ Args: { "p_client": string }; Returns: number
                           },
"create_handoff":
{ Args: { "p": Json }; Returns: string
                           },
"duplicate_role":
{ Args: { "p_name": string,"p_role": string }; Returns: string
                           },
"finalize_invitation":
{ Args: { "p_full_name": string,"p_invitation": string }; Returns: string
                           },
"finish_pushes":
{ Args: { "p_failed": (string)[],"p_sent": (string)[],"p_skipped": (string)[] }; Returns: undefined
                           },
"import_clients":
{ Args: { "p_file": string,"p_mode": string,"p_rows": Json }; Returns: string
                           },
"mark_all_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"my_permissions":
{ Args: Record<PropertyKey, never>; Returns: {
              "permission_key": string,"scope": Database["public"]['Enums']["permission_scope"]
            }[]
                           },
"notify_users":
{ Args: { "p_actor": string,"p_body": string,"p_dedupe_key": string,"p_href": string,"p_kind": string,"p_title": string,"p_users": (string)[] }; Returns: number
                           },
"onboarding_missing":
{ Args: { "p_client": string }; Returns: (string)[]
                           },
"publish_onboarding_form":
{ Args: { "p_sections": Json }; Returns: number
                           },
"rate_limit_blocked":
{ Args: { "p_bucket": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"rate_limit_hit":
{ Args: { "p_bucket": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"rate_limit_reset":
{ Args: { "p_bucket": string }; Returns: undefined
                           },
"send_test_notification":
{ Args: { "p_user": string }; Returns: undefined
                           },
"set_client_service":
{ Args: { "p_client": string,"p_price_cents"?: number,"p_qty": number,"p_service": string }; Returns: undefined
                           },
"set_client_status":
{ Args: { "p_client": string,"p_status": string }; Returns: undefined
                           },
"set_onboarding_recipients":
{ Args: { "p_ids": (string)[] }; Returns: undefined
                           },
"undo_import":
{ Args: { "p_import": string }; Returns: number
                           },
"user_effective_permissions":
{ Args: { "p_user": string }; Returns: {
              "permission_key": string,"scope": Database["public"]['Enums']["permission_scope"]
            }[]
                           }
          }
          Enums: {
            "invitation_status": "pendente"|"aceito"|"cancelado","override_effect": "grant"|"deny","permission_scope": "own"|"clients"|"sector"|"all"
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
  "public": {
          Enums: {
            "invitation_status": ["pendente", "aceito", "cancelado"],"override_effect": ["grant", "deny"],"permission_scope": ["own", "clients", "sector", "all"]
          }
        }
} as const
