
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "approval_links": {
                  Row: {
                    "comment": string | null,"created_at": string,"created_by": string | null,"decided_at": string | null,"decision": string | null,"delivery_id": string | null,"expires_at": string,"id": string,"reviewer_ip": string | null,"reviewer_name": string | null,"revoked_at": string | null,"task_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"decision"?: string | null,"delivery_id"?: string | null,"expires_at": string,"id"?: string,"reviewer_ip"?: string | null,"reviewer_name"?: string | null,"revoked_at"?: string | null,"task_id": string,"token_hash": string
                  }
                  Update: {
                    "comment"?: string | null,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"decision"?: string | null,"delivery_id"?: string | null,"expires_at"?: string,"id"?: string,"reviewer_ip"?: string | null,"reviewer_name"?: string | null,"revoked_at"?: string | null,"task_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_links_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_links_delivery_id_fkey"
      columns: ["delivery_id"]
isOneToOne: false
      referencedRelation: "task_deliveries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_links_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
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
                },"board_columns": {
                  Row: {
                    "board_id": string,"color": string,"id": string,"is_done": boolean,"name": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "board_id": string,"color"?: string,"id"?: string,"is_done"?: boolean,"name": string,"position"?: number
                  }
                  Update: {
                    "board_id"?: string,"color"?: string,"id"?: string,"is_done"?: boolean,"name"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "board_columns_board_id_fkey"
      columns: ["board_id"]
isOneToOne: false
      referencedRelation: "boards"
      referencedColumns: ["id"]
    }
                  ]
                },"boards": {
                  Row: {
                    "archived_at": string | null,"client_id": string | null,"created_at": string,"created_by": string | null,"id": string,"name": string,"organization_id": string,"sector_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"organization_id": string,"sector_id"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"organization_id"?: string,"sector_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "boards_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "boards_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "boards_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "boards_sector_id_fkey"
      columns: ["sector_id"]
isOneToOne: false
      referencedRelation: "sectors"
      referencedColumns: ["id"]
    }
                  ]
                },"calendar_attendees": {
                  Row: {
                    "event_id": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"profile_id": string
                  }
                  Update: {
                    "event_id"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_attendees_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "calendar_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calendar_attendees_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"calendar_events": {
                  Row: {
                    "client_id": string | null,"created_at": string,"created_by": string | null,"ends_at": string,"id": string,"kind": string,"link": string | null,"location": string | null,"notes": string | null,"organization_id": string,"sector_id": string | null,"starts_at": string,"task_id": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at": string,"id"?: string,"kind"?: string,"link"?: string | null,"location"?: string | null,"notes"?: string | null,"organization_id": string,"sector_id"?: string | null,"starts_at": string,"task_id"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"location"?: string | null,"notes"?: string | null,"organization_id"?: string,"sector_id"?: string | null,"starts_at"?: string,"task_id"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_events_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calendar_events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calendar_events_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calendar_events_sector_id_fkey"
      columns: ["sector_id"]
isOneToOne: false
      referencedRelation: "sectors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calendar_events_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
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
                },"client_contracts": {
                  Row: {
                    "client_id": string,"created_at": string,"created_by": string | null,"ends_on": string | null,"id": string,"monthly_fee_cents": number | null,"notes": string | null,"scope_text": string | null,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"created_by"?: string | null,"ends_on"?: string | null,"id"?: string,"monthly_fee_cents"?: number | null,"notes"?: string | null,"scope_text"?: string | null,"starts_on": string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"created_by"?: string | null,"ends_on"?: string | null,"id"?: string,"monthly_fee_cents"?: number | null,"notes"?: string | null,"scope_text"?: string | null,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_contracts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_contracts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"client_files": {
                  Row: {
                    "category": string,"client_id": string,"created_at": string,"folder": string,"id": string,"meeting_id": string | null,"mime_type": string | null,"name": string,"size_bytes": number | null,"storage_path": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string,"client_id": string,"created_at"?: string,"folder"?: string,"id"?: string,"meeting_id"?: string | null,"mime_type"?: string | null,"name": string,"size_bytes"?: number | null,"storage_path": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "category"?: string,"client_id"?: string,"created_at"?: string,"folder"?: string,"id"?: string,"meeting_id"?: string | null,"mime_type"?: string | null,"name"?: string,"size_bytes"?: number | null,"storage_path"?: string,"uploaded_by"?: string | null
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
                },"client_materials": {
                  Row: {
                    "category": string,"client_id": string,"created_at": string,"created_by": string,"file_id": string | null,"id": string,"notes": string | null,"title": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"client_id": string,"created_at"?: string,"created_by"?: string,"file_id"?: string | null,"id"?: string,"notes"?: string | null,"title": string,"url"?: string | null
                  }
                  Update: {
                    "category"?: string,"client_id"?: string,"created_at"?: string,"created_by"?: string,"file_id"?: string | null,"id"?: string,"notes"?: string | null,"title"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_materials_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_materials_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_materials_file_id_fkey"
      columns: ["file_id"]
isOneToOne: false
      referencedRelation: "client_files"
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
                },"client_milestones": {
                  Row: {
                    "client_id": string,"created_at": string,"done_at": string | null,"due_on": string | null,"id": string,"key": string,"position": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"done_at"?: string | null,"due_on"?: string | null,"id"?: string,"key": string,"position": number,"title": string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"done_at"?: string | null,"due_on"?: string | null,"id"?: string,"key"?: string,"position"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_milestones_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"client_months": {
                  Row: {
                    "client_id": string,"created_at": string,"ends_on": string,"id": string,"number": number,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"ends_on": string,"id"?: string,"number": number,"starts_on": string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"ends_on"?: string,"id"?: string,"number"?: number,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_months_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
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
                },"client_step_defaults": {
                  Row: {
                    "client_id": string,"profile_id": string,"step_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"profile_id": string,"step_id": string
                  }
                  Update: {
                    "client_id"?: string,"profile_id"?: string,"step_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_step_defaults_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_step_defaults_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_step_defaults_step_id_fkey"
      columns: ["step_id"]
isOneToOne: false
      referencedRelation: "workflow_steps"
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
                    "code": number,"communication_channel": string | null,"contract_end": string | null,"contract_start": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"document": string | null,"id": string,"import_id": string | null,"legal_name": string | null,"media_budget_cents": number | null,"monthly_fee_cents": number | null,"name": string,"notes": string | null,"onboarding_completed_at": string | null,"onboarding_legacy": boolean,"organization_id": string,"owner_id": string | null,"payment_method": string | null,"renewal_date": string | null,"scope_text": string | null,"segment": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": number,"communication_channel"?: string | null,"contract_end"?: string | null,"contract_start"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document"?: string | null,"id"?: string,"import_id"?: string | null,"legal_name"?: string | null,"media_budget_cents"?: number | null,"monthly_fee_cents"?: number | null,"name": string,"notes"?: string | null,"onboarding_completed_at"?: string | null,"onboarding_legacy"?: boolean,"organization_id": string,"owner_id"?: string | null,"payment_method"?: string | null,"renewal_date"?: string | null,"scope_text"?: string | null,"segment"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: number,"communication_channel"?: string | null,"contract_end"?: string | null,"contract_start"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document"?: string | null,"id"?: string,"import_id"?: string | null,"legal_name"?: string | null,"media_budget_cents"?: number | null,"monthly_fee_cents"?: number | null,"name"?: string,"notes"?: string | null,"onboarding_completed_at"?: string | null,"onboarding_legacy"?: boolean,"organization_id"?: string,"owner_id"?: string | null,"payment_method"?: string | null,"renewal_date"?: string | null,"scope_text"?: string | null,"segment"?: string | null,"status"?: string,"updated_at"?: string
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
    },{
      foreignKeyName: "clients_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"creative_library": {
                  Row: {
                    "ad_ref": string | null,"angle": string,"approved_at": string,"campaign": string,"client_id": string,"delivery_id": string | null,"description": string | null,"format": string,"headline": string | null,"id": string,"primary_text": string | null,"status": string,"task_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ad_ref"?: string | null,"angle": string,"approved_at"?: string,"campaign": string,"client_id": string,"delivery_id"?: string | null,"description"?: string | null,"format": string,"headline"?: string | null,"id"?: string,"primary_text"?: string | null,"status"?: string,"task_id": string,"updated_at"?: string
                  }
                  Update: {
                    "ad_ref"?: string | null,"angle"?: string,"approved_at"?: string,"campaign"?: string,"client_id"?: string,"delivery_id"?: string | null,"description"?: string | null,"format"?: string,"headline"?: string | null,"id"?: string,"primary_text"?: string | null,"status"?: string,"task_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creative_library_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "creative_library_delivery_id_fkey"
      columns: ["delivery_id"]
isOneToOne: false
      referencedRelation: "task_deliveries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "creative_library_task_id_fkey"
      columns: ["task_id"]
isOneToOne: true
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"creative_requests": {
                  Row: {
                    "angle": string,"audience": string,"campaign": string,"client_id": string,"copy_suggestion": string | null,"created_at": string,"cta": string,"format": string,"notes": string | null,"objective": string,"quantity": number,"reference_links": (string)[],"requested_by": string | null,"source_ad_ref": string | null,"task_id": string,"variations": number
                  }
                  ComputedFields: never
                  Insert: {
                    "angle": string,"audience": string,"campaign": string,"client_id": string,"copy_suggestion"?: string | null,"created_at"?: string,"cta": string,"format": string,"notes"?: string | null,"objective": string,"quantity"?: number,"reference_links"?: (string)[],"requested_by"?: string | null,"source_ad_ref"?: string | null,"task_id": string,"variations"?: number
                  }
                  Update: {
                    "angle"?: string,"audience"?: string,"campaign"?: string,"client_id"?: string,"copy_suggestion"?: string | null,"created_at"?: string,"cta"?: string,"format"?: string,"notes"?: string | null,"objective"?: string,"quantity"?: number,"reference_links"?: (string)[],"requested_by"?: string | null,"source_ad_ref"?: string | null,"task_id"?: string,"variations"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "creative_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "creative_requests_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "creative_requests_task_id_fkey"
      columns: ["task_id"]
isOneToOne: true
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_assets": {
                  Row: {
                    "delivery_id": string,"id": string,"kind": string,"mime_type": string | null,"name": string,"size_bytes": number | null,"storage_path": string | null,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "delivery_id": string,"id"?: string,"kind": string,"mime_type"?: string | null,"name": string,"size_bytes"?: number | null,"storage_path"?: string | null,"url"?: string | null
                  }
                  Update: {
                    "delivery_id"?: string,"id"?: string,"kind"?: string,"mime_type"?: string | null,"name"?: string,"size_bytes"?: number | null,"storage_path"?: string | null,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "delivery_assets_delivery_id_fkey"
      columns: ["delivery_id"]
isOneToOne: false
      referencedRelation: "task_deliveries"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"delivery_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string,"body": string,"created_at"?: string,"delivery_id": string,"id"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"delivery_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "delivery_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_comments_delivery_id_fkey"
      columns: ["delivery_id"]
isOneToOne: false
      referencedRelation: "task_deliveries"
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
                },"lead_activities": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string | null,"done_at": string | null,"due_at": string | null,"id": string,"kind": string,"lead_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"due_at"?: string | null,"id"?: string,"kind": string,"lead_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"due_at"?: string | null,"id"?: string,"kind"?: string,"lead_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_activities_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_activities_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"lead_imports": {
                  Row: {
                    "created_at": string,"created_by": string | null,"duplicates": number,"file_name": string,"id": string,"organization_id": string,"row_count": number,"undone_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"duplicates"?: number,"file_name": string,"id"?: string,"organization_id"?: string,"row_count"?: number,"undone_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"duplicates"?: number,"file_name"?: string,"id"?: string,"organization_id"?: string,"row_count"?: number,"undone_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_imports_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_imports_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"leads": {
                  Row: {
                    "company": string | null,"created_at": string,"created_by": string | null,"email": string | null,"id": string,"import_id": string | null,"lost_at": string | null,"lost_reason": string | null,"name": string,"notes": string | null,"organization_id": string,"owner_id": string | null,"phone": string | null,"pipeline_id": string,"source": string,"stage_changed_at": string,"stage_id": string,"updated_at": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"value_cents": number | null,"won_at": string | null,"won_client_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "company"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"import_id"?: string | null,"lost_at"?: string | null,"lost_reason"?: string | null,"name": string,"notes"?: string | null,"organization_id"?: string,"owner_id"?: string | null,"phone"?: string | null,"pipeline_id": string,"source"?: string,"stage_changed_at"?: string,"stage_id": string,"updated_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"value_cents"?: number | null,"won_at"?: string | null,"won_client_id"?: string | null
                  }
                  Update: {
                    "company"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"import_id"?: string | null,"lost_at"?: string | null,"lost_reason"?: string | null,"name"?: string,"notes"?: string | null,"organization_id"?: string,"owner_id"?: string | null,"phone"?: string | null,"pipeline_id"?: string,"source"?: string,"stage_changed_at"?: string,"stage_id"?: string,"updated_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"value_cents"?: number | null,"won_at"?: string | null,"won_client_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "leads_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_import_id_fkey"
      columns: ["import_id"]
isOneToOne: false
      referencedRelation: "lead_imports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_pipeline_id_fkey"
      columns: ["pipeline_id"]
isOneToOne: false
      referencedRelation: "pipelines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_stage_id_fkey"
      columns: ["stage_id"]
isOneToOne: false
      referencedRelation: "pipeline_stages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_won_client_id_fkey"
      columns: ["won_client_id"]
isOneToOne: false
      referencedRelation: "clients"
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
                    "assignee_id": string | null,"client_id": string,"created_at": string,"done_at": string | null,"done_by": string | null,"due_at": string | null,"guidance": string | null,"id": string,"milestone": string | null,"position": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"client_id": string,"created_at"?: string,"done_at"?: string | null,"done_by"?: string | null,"due_at"?: string | null,"guidance"?: string | null,"id"?: string,"milestone"?: string | null,"position"?: number,"title": string
                  }
                  Update: {
                    "assignee_id"?: string | null,"client_id"?: string,"created_at"?: string,"done_at"?: string | null,"done_by"?: string | null,"due_at"?: string | null,"guidance"?: string | null,"id"?: string,"milestone"?: string | null,"position"?: number,"title"?: string
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
                    "created_at": string,"day_kind": string,"default_sector_id": string | null,"due_days": number,"guidance": string | null,"id": string,"is_active": boolean,"milestone": string | null,"organization_id": string,"position": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day_kind"?: string,"default_sector_id"?: string | null,"due_days"?: number,"guidance"?: string | null,"id"?: string,"is_active"?: boolean,"milestone"?: string | null,"organization_id": string,"position"?: number,"title": string
                  }
                  Update: {
                    "created_at"?: string,"day_kind"?: string,"default_sector_id"?: string | null,"due_days"?: number,"guidance"?: string | null,"id"?: string,"is_active"?: boolean,"milestone"?: string | null,"organization_id"?: string,"position"?: number,"title"?: string
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
                },"pipeline_stages": {
                  Row: {
                    "color": string,"id": string,"kind": string,"name": string,"pipeline_id": string,"position": number,"sla_days": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"id"?: string,"kind"?: string,"name": string,"pipeline_id": string,"position": number,"sla_days"?: number | null
                  }
                  Update: {
                    "color"?: string,"id"?: string,"kind"?: string,"name"?: string,"pipeline_id"?: string,"position"?: number,"sla_days"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pipeline_stages_pipeline_id_fkey"
      columns: ["pipeline_id"]
isOneToOne: false
      referencedRelation: "pipelines"
      referencedColumns: ["id"]
    }
                  ]
                },"pipelines": {
                  Row: {
                    "created_at": string,"id": string,"is_default": boolean,"name": string,"organization_id": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"name": string,"organization_id"?: string,"position"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"name"?: string,"organization_id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pipelines_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"playbook_runs": {
                  Row: {
                    "client_id": string,"created_at": string,"created_by": string | null,"id": string,"playbook_id": string | null,"playbook_name": string,"start_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"playbook_id"?: string | null,"playbook_name": string,"start_on": string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"playbook_id"?: string | null,"playbook_name"?: string,"start_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "playbook_runs_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "playbook_runs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "playbook_runs_playbook_id_fkey"
      columns: ["playbook_id"]
isOneToOne: false
      referencedRelation: "playbooks"
      referencedColumns: ["id"]
    }
                  ]
                },"playbook_steps": {
                  Row: {
                    "day_kind": string,"guidance": string | null,"id": string,"milestone": string | null,"offset_days": number,"playbook_id": string,"position": number,"sector_id": string | null,"task_type": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day_kind"?: string,"guidance"?: string | null,"id"?: string,"milestone"?: string | null,"offset_days"?: number,"playbook_id": string,"position": number,"sector_id"?: string | null,"task_type"?: string,"title": string
                  }
                  Update: {
                    "day_kind"?: string,"guidance"?: string | null,"id"?: string,"milestone"?: string | null,"offset_days"?: number,"playbook_id"?: string,"position"?: number,"sector_id"?: string | null,"task_type"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "playbook_steps_playbook_id_fkey"
      columns: ["playbook_id"]
isOneToOne: false
      referencedRelation: "playbooks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "playbook_steps_sector_id_fkey"
      columns: ["sector_id"]
isOneToOne: false
      referencedRelation: "sectors"
      referencedColumns: ["id"]
    }
                  ]
                },"playbooks": {
                  Row: {
                    "area": string,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"is_active": boolean,"name": string,"organization_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"organization_id"?: string,"updated_at"?: string
                  }
                  Update: {
                    "area"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"organization_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "playbooks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "playbooks_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"privacy_consents": {
                  Row: {
                    "accepted_at": string,"profile_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string,"profile_id": string,"version": string
                  }
                  Update: {
                    "accepted_at"?: string,"profile_id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "privacy_consents_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"privacy_requests": {
                  Row: {
                    "created_at": string,"details": string | null,"due_on": string,"id": string,"kind": string,"organization_id": string,"profile_id": string,"resolved_at": string | null,"resolved_by": string | null,"response": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"due_on"?: string,"id"?: string,"kind": string,"organization_id"?: string,"profile_id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"response"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"due_on"?: string,"id"?: string,"kind"?: string,"organization_id"?: string,"profile_id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"response"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "privacy_requests_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "privacy_requests_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "privacy_requests_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"privacy_settings": {
                  Row: {
                    "address": string | null,"cnpj": string | null,"dpo_email": string | null,"dpo_name": string | null,"legal_name": string | null,"organization_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"cnpj"?: string | null,"dpo_email"?: string | null,"dpo_name"?: string | null,"legal_name"?: string | null,"organization_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"cnpj"?: string | null,"dpo_email"?: string | null,"dpo_name"?: string | null,"legal_name"?: string | null,"organization_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "privacy_settings_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "privacy_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
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
                },"recording_contents": {
                  Row: {
                    "session_id": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "session_id": string,"task_id": string
                  }
                  Update: {
                    "session_id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recording_contents_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "recording_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recording_contents_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"recording_people": {
                  Row: {
                    "profile_id": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "profile_id": string,"session_id": string
                  }
                  Update: {
                    "profile_id"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recording_people_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recording_people_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "recording_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"recording_sessions": {
                  Row: {
                    "client_id": string,"created_at": string,"created_by": string | null,"id": string,"location": string | null,"notes": string | null,"raw_url": string | null,"recorded_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"location"?: string | null,"notes"?: string | null,"raw_url"?: string | null,"recorded_on": string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"location"?: string | null,"notes"?: string | null,"raw_url"?: string | null,"recorded_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recording_sessions_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recording_sessions_created_by_fkey"
      columns: ["created_by"]
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
                },"run_milestones": {
                  Row: {
                    "done_at": string | null,"due_on": string | null,"id": string,"position": number,"run_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "done_at"?: string | null,"due_on"?: string | null,"id"?: string,"position": number,"run_id": string,"title": string
                  }
                  Update: {
                    "done_at"?: string | null,"due_on"?: string | null,"id"?: string,"position"?: number,"run_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "run_milestones_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "playbook_runs"
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
                },"service_routines": {
                  Row: {
                    "created_at": string,"description": string | null,"due_hour": number,"id": string,"is_active": boolean,"lead_days": number,"organization_id": string,"sector_id": string,"service_id": string,"title": string,"updated_at": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"due_hour"?: number,"id"?: string,"is_active"?: boolean,"lead_days"?: number,"organization_id": string,"sector_id": string,"service_id": string,"title": string,"updated_at"?: string,"weekday": number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"due_hour"?: number,"id"?: string,"is_active"?: boolean,"lead_days"?: number,"organization_id"?: string,"sector_id"?: string,"service_id"?: string,"title"?: string,"updated_at"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_routines_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_routines_sector_id_fkey"
      columns: ["sector_id"]
isOneToOne: false
      referencedRelation: "sectors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_routines_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "service_catalog"
      referencedColumns: ["id"]
    }
                  ]
                },"tags": {
                  Row: {
                    "color": string,"created_at": string,"id": string,"name": string,"organization_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"id"?: string,"name": string,"organization_id": string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"id"?: string,"name"?: string,"organization_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tags_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"task_activity": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"id": number,"kind": string,"task_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: never,"kind": string,"task_id": string,"title": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: never,"kind"?: string,"task_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_activity_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_activity_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_attachments": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"mime_type": string | null,"name": string,"size_bytes": number | null,"storage_path": string | null,"task_id": string,"uploaded_by": string | null,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"mime_type"?: string | null,"name": string,"size_bytes"?: number | null,"storage_path"?: string | null,"task_id": string,"uploaded_by"?: string | null,"url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"mime_type"?: string | null,"name"?: string,"size_bytes"?: number | null,"storage_path"?: string | null,"task_id"?: string,"uploaded_by"?: string | null,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_attachments_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_attachments_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"task_checklist_items": {
                  Row: {
                    "created_at": string,"done_at": string | null,"done_by": string | null,"id": string,"position": number,"task_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"done_at"?: string | null,"done_by"?: string | null,"id"?: string,"position"?: number,"task_id": string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"done_at"?: string | null,"done_by"?: string | null,"id"?: string,"position"?: number,"task_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_checklist_items_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_checklist_items_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"edited_at": string | null,"id": string,"mentions": (string)[],"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string,"body": string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"mentions"?: (string)[],"task_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"mentions"?: (string)[],"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_comments_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_content": {
                  Row: {
                    "caption": string | null,"cover_path": string | null,"destination": (string)[],"editor_id": string | null,"final_url": string | null,"format": string | null,"objective": string | null,"post_on": string | null,"post_url": string | null,"raw_url": string | null,"recorder_id": string | null,"recording_on": string | null,"rework_count": number,"script": string | null,"task_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string | null,"cover_path"?: string | null,"destination"?: (string)[],"editor_id"?: string | null,"final_url"?: string | null,"format"?: string | null,"objective"?: string | null,"post_on"?: string | null,"post_url"?: string | null,"raw_url"?: string | null,"recorder_id"?: string | null,"recording_on"?: string | null,"rework_count"?: number,"script"?: string | null,"task_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "caption"?: string | null,"cover_path"?: string | null,"destination"?: (string)[],"editor_id"?: string | null,"final_url"?: string | null,"format"?: string | null,"objective"?: string | null,"post_on"?: string | null,"post_url"?: string | null,"raw_url"?: string | null,"recorder_id"?: string | null,"recording_on"?: string | null,"rework_count"?: number,"script"?: string | null,"task_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_content_editor_id_fkey"
      columns: ["editor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_content_recorder_id_fkey"
      columns: ["recorder_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_content_task_id_fkey"
      columns: ["task_id"]
isOneToOne: true
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_content_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"task_deliveries": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"note": string | null,"task_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"note"?: string | null,"task_id": string,"version": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"note"?: string | null,"task_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_deliveries_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_deliveries_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_participants": {
                  Row: {
                    "profile_id": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "profile_id": string,"task_id": string
                  }
                  Update: {
                    "profile_id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_participants_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_participants_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_stage_history": {
                  Row: {
                    "assignee_id": string | null,"entered_at": string,"id": number,"left_at": string | null,"moved_by": string | null,"step_id": string | null,"step_name": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"entered_at"?: string,"id"?: never,"left_at"?: string | null,"moved_by"?: string | null,"step_id"?: string | null,"step_name": string,"task_id": string
                  }
                  Update: {
                    "assignee_id"?: string | null,"entered_at"?: string,"id"?: never,"left_at"?: string | null,"moved_by"?: string | null,"step_id"?: string | null,"step_name"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_stage_history_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_stage_history_moved_by_fkey"
      columns: ["moved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_stage_history_step_id_fkey"
      columns: ["step_id"]
isOneToOne: false
      referencedRelation: "workflow_steps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_stage_history_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_tags": {
                  Row: {
                    "tag_id": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "tag_id": string,"task_id": string
                  }
                  Update: {
                    "tag_id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_tags_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_tags_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_templates": {
                  Row: {
                    "category": string,"created_at": string,"description": string | null,"due_days": number,"id": string,"is_active": boolean,"name": string,"organization_id": string,"position": number,"priority": string,"repeat_every": number | null,"repeat_unit": string | null,"type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"description"?: string | null,"due_days"?: number,"id"?: string,"is_active"?: boolean,"name": string,"organization_id": string,"position"?: number,"priority"?: string,"repeat_every"?: number | null,"repeat_unit"?: string | null,"type"?: string,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"description"?: string | null,"due_days"?: number,"id"?: string,"is_active"?: boolean,"name"?: string,"organization_id"?: string,"position"?: number,"priority"?: string,"repeat_every"?: number | null,"repeat_unit"?: string | null,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_templates_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"task_time_entries": {
                  Row: {
                    "ended_at": string | null,"id": string,"profile_id": string,"started_at": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ended_at"?: string | null,"id"?: string,"profile_id"?: string,"started_at"?: string,"task_id": string
                  }
                  Update: {
                    "ended_at"?: string | null,"id"?: string,"profile_id"?: string,"started_at"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_time_entries_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_time_entries_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assignee_id": string | null,"blocked_by_task_id": string | null,"board_column_id": string | null,"board_id": string | null,"client_id": string | null,"completed_at": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"description": string | null,"due_at": string | null,"id": string,"organization_id": string,"playbook_run_id": string | null,"position": number,"priority": string,"repeat_every": number | null,"repeat_from_id": string | null,"repeat_next_id": string | null,"repeat_owner_id": string | null,"repeat_unit": string | null,"routine_id": string | null,"routine_on": string | null,"run_milestone_id": string | null,"sector_id": string | null,"service_id": string | null,"slot_index": number | null,"slot_month": string | null,"slot_total": number | null,"start_at": string | null,"status": string,"title": string,"type": string,"updated_at": string,"waiting_note": string | null,"workflow_step_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"blocked_by_task_id"?: string | null,"board_column_id"?: string | null,"board_id"?: string | null,"client_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"due_at"?: string | null,"id"?: string,"organization_id": string,"playbook_run_id"?: string | null,"position"?: number,"priority"?: string,"repeat_every"?: number | null,"repeat_from_id"?: string | null,"repeat_next_id"?: string | null,"repeat_owner_id"?: string | null,"repeat_unit"?: string | null,"routine_id"?: string | null,"routine_on"?: string | null,"run_milestone_id"?: string | null,"sector_id"?: string | null,"service_id"?: string | null,"slot_index"?: number | null,"slot_month"?: string | null,"slot_total"?: number | null,"start_at"?: string | null,"status"?: string,"title": string,"type"?: string,"updated_at"?: string,"waiting_note"?: string | null,"workflow_step_id"?: string | null
                  }
                  Update: {
                    "assignee_id"?: string | null,"blocked_by_task_id"?: string | null,"board_column_id"?: string | null,"board_id"?: string | null,"client_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"due_at"?: string | null,"id"?: string,"organization_id"?: string,"playbook_run_id"?: string | null,"position"?: number,"priority"?: string,"repeat_every"?: number | null,"repeat_from_id"?: string | null,"repeat_next_id"?: string | null,"repeat_owner_id"?: string | null,"repeat_unit"?: string | null,"routine_id"?: string | null,"routine_on"?: string | null,"run_milestone_id"?: string | null,"sector_id"?: string | null,"service_id"?: string | null,"slot_index"?: number | null,"slot_month"?: string | null,"slot_total"?: number | null,"start_at"?: string | null,"status"?: string,"title"?: string,"type"?: string,"updated_at"?: string,"waiting_note"?: string | null,"workflow_step_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_blocked_by_task_id_fkey"
      columns: ["blocked_by_task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_board_column_id_fkey"
      columns: ["board_column_id"]
isOneToOne: false
      referencedRelation: "board_columns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_board_id_fkey"
      columns: ["board_id"]
isOneToOne: false
      referencedRelation: "boards"
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
      foreignKeyName: "tasks_playbook_run_id_fkey"
      columns: ["playbook_run_id"]
isOneToOne: false
      referencedRelation: "playbook_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_repeat_from_id_fkey"
      columns: ["repeat_from_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_repeat_next_id_fkey"
      columns: ["repeat_next_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_repeat_owner_id_fkey"
      columns: ["repeat_owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_routine_id_fkey"
      columns: ["routine_id"]
isOneToOne: false
      referencedRelation: "service_routines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_run_milestone_id_fkey"
      columns: ["run_milestone_id"]
isOneToOne: false
      referencedRelation: "run_milestones"
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
    },{
      foreignKeyName: "tasks_workflow_step_id_fkey"
      columns: ["workflow_step_id"]
isOneToOne: false
      referencedRelation: "workflow_steps"
      referencedColumns: ["id"]
    }
                  ]
                },"training_assignments": {
                  Row: {
                    "assigned_by": string | null,"completed_at": string | null,"created_at": string,"due_on": string | null,"id": string,"profile_id": string,"training_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"due_on"?: string | null,"id"?: string,"profile_id": string,"training_id": string
                  }
                  Update: {
                    "assigned_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"due_on"?: string | null,"id"?: string,"profile_id"?: string,"training_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "training_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "training_assignments_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "training_assignments_training_id_fkey"
      columns: ["training_id"]
isOneToOne: false
      referencedRelation: "trainings"
      referencedColumns: ["id"]
    }
                  ]
                },"training_lessons": {
                  Row: {
                    "body": string | null,"created_at": string,"duration_min": number | null,"file_name": string | null,"file_path": string | null,"id": string,"position": number,"title": string,"training_id": string,"updated_at": string,"video_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"duration_min"?: number | null,"file_name"?: string | null,"file_path"?: string | null,"id"?: string,"position"?: number,"title": string,"training_id": string,"updated_at"?: string,"video_url"?: string | null
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"duration_min"?: number | null,"file_name"?: string | null,"file_path"?: string | null,"id"?: string,"position"?: number,"title"?: string,"training_id"?: string,"updated_at"?: string,"video_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "training_lessons_training_id_fkey"
      columns: ["training_id"]
isOneToOne: false
      referencedRelation: "trainings"
      referencedColumns: ["id"]
    }
                  ]
                },"training_progress": {
                  Row: {
                    "completed_at": string,"lesson_id": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string,"lesson_id": string,"profile_id": string
                  }
                  Update: {
                    "completed_at"?: string,"lesson_id"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "training_progress_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "training_lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "training_progress_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"trainings": {
                  Row: {
                    "category": string,"created_at": string,"created_by": string | null,"id": string,"is_published": boolean,"organization_id": string,"position": number,"summary": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_published"?: boolean,"organization_id": string,"position"?: number,"summary"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_published"?: boolean,"organization_id"?: string,"position"?: number,"summary"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trainings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trainings_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
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
                },"workflow_steps": {
                  Row: {
                    "archived_at": string | null,"color": string,"created_at": string,"id": string,"is_rework": boolean,"name": string,"position": number,"sector_id": string | null,"status": string,"waits_client": boolean,"workflow_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"id"?: string,"is_rework"?: boolean,"name": string,"position": number,"sector_id"?: string | null,"status"?: string,"waits_client"?: boolean,"workflow_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"id"?: string,"is_rework"?: boolean,"name"?: string,"position"?: number,"sector_id"?: string | null,"status"?: string,"waits_client"?: boolean,"workflow_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workflow_steps_sector_id_fkey"
      columns: ["sector_id"]
isOneToOne: false
      referencedRelation: "sectors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workflow_steps_workflow_id_fkey"
      columns: ["workflow_id"]
isOneToOne: false
      referencedRelation: "workflows"
      referencedColumns: ["id"]
    }
                  ]
                },"workflows": {
                  Row: {
                    "board_sector_id": string | null,"created_at": string,"id": string,"name": string,"organization_id": string,"task_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "board_sector_id"?: string | null,"created_at"?: string,"id"?: string,"name": string,"organization_id": string,"task_type": string
                  }
                  Update: {
                    "board_sector_id"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"organization_id"?: string,"task_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workflows_board_sector_id_fkey"
      columns: ["board_sector_id"]
isOneToOne: false
      referencedRelation: "sectors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workflows_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_delivery":
{ Args: { "p_assets": Json,"p_note": string,"p_task": string }; Returns: number
                           },
"admin_set_user_active":
{ Args: { "p_active": boolean,"p_user": string }; Returns: undefined
                           },
"admin_set_user_role":
{ Args: { "p_role": string,"p_user": string }; Returns: undefined
                           },
"apply_playbook":
{ Args: { "p_client": string,"p_playbook": string,"p_start": string }; Returns: string
                           },
"archive_client":
{ Args: { "p_client": string }; Returns: undefined
                           },
"claim_pending_pushes":
{ Args: { "p_limit"?: number }; Returns: {
              "body": string,"href": string,"id": string,"kind": string,"title": string,"user_id": string
            }[]
                           },
"client_contract_fees":
{ Args: { "p_client": string }; Returns: {
              "id": string,"monthly_fee_cents": number
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
"create_approval_link":
{ Args: { "p_days"?: number,"p_task": string,"p_token_hash": string }; Returns: string
                           },
"create_creative_request":
{ Args: { "p": Json }; Returns: string
                           },
"create_handoff":
{ Args: { "p": Json }; Returns: string
                           },
"crm_people":
{ Args: Record<PropertyKey, never>; Returns: {
              "full_name": string,"id": string
            }[]
                           },
"decide_approval":
{ Args: { "p_comment": string,"p_decision": string,"p_ip": string,"p_name": string,"p_token_hash": string }; Returns: string
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
"import_leads":
{ Args: { "p_file": string,"p_pipeline": string,"p_rows": Json }; Returns: Json
                           },
"mark_all_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"move_lead":
{ Args: { "p_lead": string,"p_reason"?: string,"p_stage": string }; Returns: undefined
                           },
"move_task":
{ Args: { "p_column": string,"p_position": number,"p_step": string,"p_task": string }; Returns: undefined
                           },
"my_permissions":
{ Args: Record<PropertyKey, never>; Returns: {
              "permission_key": string,"scope": Database["public"]['Enums']["permission_scope"]
            }[]
                           },
"my_personal_data":
{ Args: Record<PropertyKey, never>; Returns: Json
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
"review_creative":
{ Args: { "p_comment": string,"p_decision": string,"p_task": string }; Returns: undefined
                           },
"save_content":
{ Args: { "p": Json,"p_task": string }; Returns: undefined
                           },
"save_recording":
{ Args: { "p": Json }; Returns: string
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
"set_content_cover":
{ Args: { "p_path": string,"p_task": string }; Returns: undefined
                           },
"set_onboarding_recipients":
{ Args: { "p_ids": (string)[] }; Returns: undefined
                           },
"start_timer":
{ Args: { "p_task": string }; Returns: undefined
                           },
"stop_timer":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"undo_import":
{ Args: { "p_import": string }; Returns: number
                           },
"undo_lead_import":
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
