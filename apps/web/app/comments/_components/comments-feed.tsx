/* eslint-disable no-unused-vars */
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@repo/ui/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { cn } from '@repo/ui/lib/utils';
import {
  MessageSquareText,
  Search,
  Plus,
  MoreVertical,
  Reply,
  Pencil,
  Archive,
  ExternalLink,
  MessageCircle,
  Users,
  Clock,
  Send,
  Building2,
  Tag,
} from '@repo/ui/lib/icons';
import {
  CommentItem,
  CommentUser,
  createComment,
  updateComment,
  archiveComment,
} from '../_services/comments.service';

type CommentsFeedProps = {
  initialComments: CommentItem[];
  workItems: Array<{
    id: string;
    title: string;
    key: string;
    type: string;
    project_id: string;
    project_name?: string;
  }>;
  currentUserId?: string;
  workItemId?: string;
};

// Autocomplete type signatures
type StringCallback = (val: string) => void;
type NumberCallback = (val: number) => void;
type BooleanCallback = (val: boolean) => void;
type VoidCallback = () => void;

export function CommentsFeed({
  initialComments,
  workItems,
  currentUserId = 'user-admin-1',
  workItemId,
}: Readonly<CommentsFeedProps>) {
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'archived'>('active');
  const [showNewCommentModal, setShowNewCommentModal] = useState(false);

  // New Comment Form State
  const [newWorkItemId, setNewWorkItemId] = useState(workItemId || workItems[0]?.id || '');
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reply State
  const [replyingParentId, setReplyingParentId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // Edit State
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Users for mentions
  const [users, setUsers] = useState<CommentUser[]>([]);

  // Autocomplete dropdown state for New Comment
  const [showNewMentionDropdown, setShowNewMentionDropdown] = useState(false);
  const [newMentionSearch, setNewMentionSearch] = useState('');
  const [newMentionTriggerIdx, setNewMentionTriggerIdx] = useState(-1);
  const [newMentionHighlightIdx, setNewMentionHighlightIdx] = useState(0);

  const [showNewWISuggestions, setShowNewWISuggestions] = useState(false);
  const [newWISearch, setNewWISearch] = useState('');
  const [newWITriggerIdx, setNewWITriggerIdx] = useState(-1);
  const [newWIHighlightIdx, setNewWIHighlightIdx] = useState(0);

  // Autocomplete dropdown state for Reply
  const [showReplyMentionDropdown, setShowReplyMentionDropdown] = useState(false);
  const [replyMentionSearch, setReplyMentionSearch] = useState('');
  const [replyMentionTriggerIdx, setReplyMentionTriggerIdx] = useState(-1);
  const [replyMentionHighlightIdx, setReplyMentionHighlightIdx] = useState(0);

  const [showReplyWISuggestions, setShowReplyWISuggestions] = useState(false);
  const [replyWISearch, setReplyWISearch] = useState('');
  const [replyWITriggerIdx, setReplyWITriggerIdx] = useState(-1);
  const [replyWIHighlightIdx, setReplyWIHighlightIdx] = useState(0);

  // Autocomplete dropdown state for Edit
  const [showEditMentionDropdown, setShowEditMentionDropdown] = useState(false);
  const [editMentionSearch, setEditMentionSearch] = useState('');
  const [editMentionTriggerIdx, setEditMentionTriggerIdx] = useState(-1);
  const [editMentionHighlightIdx, setEditMentionHighlightIdx] = useState(0);

  const [showEditWISuggestions, setShowEditWISuggestions] = useState(false);
  const [editWISearch, setEditWISearch] = useState('');
  const [editWITriggerIdx, setEditWITriggerIdx] = useState(-1);
  const [editWIHighlightIdx, setEditWIHighlightIdx] = useState(0);

  // Refs for focusing inputs
  const newCommentRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const editCommentRef = useRef<HTMLTextAreaElement>(null);

  // Load active users from database on mount
  useEffect(() => {
    async function loadUsers() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('users')
          .select('id, name, email, profile_picture')
          .eq('active', true)
          .order('name');
        
        const fallbackUsers = [
          { id: 'user-admin-1', name: 'Alana Admin', email: 'admin@alice.dev' },
          { id: 'user-mgr-1', name: 'Marcus Lead', email: 'marcus@alice.dev' },
          { id: 'user-dev-1', name: 'Devin Smith', email: 'devin@alice.dev' },
        ];

        if (!error && data && data.length > 0) {
          // Merge default users and loaded ones, filtering duplicates
          const seen = new Set();
          const merged = [...data, ...fallbackUsers].filter((u) => {
            if (seen.has(u.id)) return false;
            seen.add(u.id);
            return true;
          });
          setUsers(merged);
        } else {
          setUsers(fallbackUsers);
        }
      } catch (err) {
        console.error('Failed to load users for mentions autocomplete:', err);
        setUsers([
          { id: 'user-admin-1', name: 'Alana Admin', email: 'admin@alice.dev' },
          { id: 'user-mgr-1', name: 'Marcus Lead', email: 'marcus@alice.dev' },
          { id: 'user-dev-1', name: 'Devin Smith', email: 'devin@alice.dev' },
        ]);
      }
    }
    loadUsers();
  }, []);

  // Update comments if initialComments changes
  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  // Focus the reply input field when replying parent comment ID is set
  useEffect(() => {
    if (replyingParentId) {
      setTimeout(() => {
        replyInputRef.current?.focus();
      }, 50);
    }
  }, [replyingParentId]);

  // Update newWorkItemId if workItemId changes
  useEffect(() => {
    if (workItemId) {
      setNewWorkItemId(workItemId);
    }
  }, [workItemId]);

  // Autocomplete suggestions filtering
  const filteredUsersNew = useMemo(() => {
    const q = newMentionSearch.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, newMentionSearch]);

  const filteredUsersReply = useMemo(() => {
    const q = replyMentionSearch.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, replyMentionSearch]);

  const filteredUsersEdit = useMemo(() => {
    const q = editMentionSearch.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, editMentionSearch]);

  // Work item suggestions filtering
  const filteredWorkItemsNew = useMemo(() => {
    const q = newWISearch.toLowerCase();
    return workItems.filter(w => w.key.toLowerCase().includes(q) || w.title.toLowerCase().includes(q));
  }, [workItems, newWISearch]);

  const filteredWorkItemsReply = useMemo(() => {
    const q = replyWISearch.toLowerCase();
    return workItems.filter(w => w.key.toLowerCase().includes(q) || w.title.toLowerCase().includes(q));
  }, [workItems, replyWISearch]);

  const filteredWorkItemsEdit = useMemo(() => {
    const q = editWISearch.toLowerCase();
    return workItems.filter(w => w.key.toLowerCase().includes(q) || w.title.toLowerCase().includes(q));
  }, [workItems, editWISearch]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = comments.length;
    const active = comments.filter((c) => c.status === 'active').length;
    const authors = new Set(comments.map((c) => c.author?.name || c.author_id)).size;
    const workItemsDiscussed = new Set(comments.map((c) => c.work_item_id)).size;

    return { total, active, authors, workItemsDiscussed };
  }, [comments]);

  // Filtered comments
  const filteredComments = useMemo(() => {
    return comments.filter((c) => {
      // Work Item lock
      if (workItemId) {
        if (c.work_item_id !== workItemId) return false;
      } else if (selectedWorkItemId !== 'all' && c.work_item_id !== selectedWorkItemId) {
        return false;
      }

      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        c.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.author?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.work_item?.key?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.work_item?.title?.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        selectedStatus === 'all' || c.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [comments, searchQuery, selectedWorkItemId, selectedStatus, workItemId]);

  // Separate parent comments and build threads
  const parentComments = useMemo(() => {
    const parents = filteredComments.filter((c) => !c.parent_id);
    const repliesMap = new Map<string, CommentItem[]>();

    comments.forEach((c) => {
      if (c.parent_id) {
        const existing = repliesMap.get(c.parent_id) || [];
        repliesMap.set(c.parent_id, [...existing, c]);
      }
    });

    return parents.map((parent) => ({
      ...parent,
      threadReplies: repliesMap.get(parent.id) || [],
    }));
  }, [filteredComments, comments]);

  // Helper to handle text area change detection for mentions
  const handleTextChangeMentions = (
    text: string,
    cursorPos: number,
    setTriggerIdx: NumberCallback,
    setSearch: StringCallback,
    setDropdown: BooleanCallback,
    setHighlightIdx: NumberCallback
  ) => {
    const lastAtIdx = text.lastIndexOf('@', cursorPos - 1);
    const lastHashIdx = text.lastIndexOf('#', cursorPos - 1);

    if (lastAtIdx !== -1 && (lastHashIdx === -1 || lastAtIdx > lastHashIdx)) {
      const charBeforeAt = lastAtIdx > 0 ? text[lastAtIdx - 1] : ' ';
      const textBetween = text.slice(lastAtIdx + 1, cursorPos);
      const hasSpace = textBetween.includes(' ') || textBetween.includes('\n');

      if ((charBeforeAt === ' ' || charBeforeAt === '\n') && !hasSpace) {
        setTriggerIdx(lastAtIdx);
        setSearch(textBetween);
        setDropdown(true);
        setHighlightIdx(0);
        return;
      }
    }
    setDropdown(false);
  };

  // Helper to handle text area change detection for work items
  const handleTextChangeWorkItems = (
    text: string,
    cursorPos: number,
    setTriggerIdx: NumberCallback,
    setSearch: StringCallback,
    setDropdown: BooleanCallback,
    setHighlightIdx: NumberCallback
  ) => {
    const lastAtIdx = text.lastIndexOf('@', cursorPos - 1);
    const lastHashIdx = text.lastIndexOf('#', cursorPos - 1);

    if (lastHashIdx !== -1 && (lastAtIdx === -1 || lastHashIdx > lastAtIdx)) {
      const charBeforeHash = lastHashIdx > 0 ? text[lastHashIdx - 1] : ' ';
      const textBetween = text.slice(lastHashIdx + 1, cursorPos);
      const hasSpace = textBetween.includes(' ') || textBetween.includes('\n');

      if ((charBeforeHash === ' ' || charBeforeHash === '\n') && !hasSpace) {
        setTriggerIdx(lastHashIdx);
        setSearch(textBetween);
        setDropdown(true);
        setHighlightIdx(0);
        return;
      }
    }
    setDropdown(false);
  };

  
  // Generic helper to handle keyboard navigation inside dropdown menus
  const handleAutocompleteKeyDown = <T,>(
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    showDropdown: boolean,
    list: T[],
    highlightIdx: number,
    setHighlightIdx: NumberCallback,
    onSelect: (item: T) => void,
    onClose: VoidCallback
  ) => {
    if (!showDropdown || list.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((highlightIdx + 1) % list.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((highlightIdx - 1 + list.length) % list.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const selected = list[highlightIdx];
      if (selected) {
        onSelect(selected);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Helper to insert autocomplete tag into input field
  const handleInsertMention = (
    text: string,
    triggerIdx: number,
    cursorPos: number,
    insertText: string,
    inputEl: HTMLTextAreaElement | HTMLInputElement | null,
    setVal: StringCallback,
    setDropdown: BooleanCallback
  ) => {
    const before = text.slice(0, triggerIdx);
    const after = text.slice(cursorPos);
    const formatted = `${insertText} `;
    const nextText = before + formatted + after;
    setVal(nextText);
    setDropdown(false);

    if (inputEl) {
      const nextCursorPos = triggerIdx + formatted.length;
      setTimeout(() => {
        inputEl.focus();
        inputEl.setSelectionRange(nextCursorPos, nextCursorPos);
      }, 0);
    }
  };

  // Helper function to create database notifications for mentioned users
  const createMentionNotifications = async (
    mentionedUserIds: string[],
    rawContent: string,
    targetWorkItemId: string
  ) => {
    if (mentionedUserIds.length === 0) return;
    try {
      const supabase = createClient();
      const actorName = users.find(u => u.id === currentUserId)?.name || 'A teammate';
      
      const { data: wi } = await supabase
        .from('work_items')
        .select('title')
        .eq('id', targetWorkItemId)
        .maybeSingle();

      const titleSnippet = wi?.title ? `"${wi.title}"` : 'work item';
      const rawTextSnippet = rawContent.length > 60 ? rawContent.slice(0, 60) + '...' : rawContent;

      for (const mId of mentionedUserIds) {
        if (mId === currentUserId) continue;

        await supabase.from('notifications').insert({
          user_id: mId,
          type: 'mention',
          message: `${actorName} mentioned you in a comment on ${titleSnippet}: "${rawTextSnippet}"`,
          related_item_id: targetWorkItemId,
          read_status: false,
          created_by: currentUserId,
          updated_by: currentUserId,
          updated_at: new Date().toISOString(),
          status: 'active',
        });
      }
    } catch (err) {
      console.error('Failed to create mention notifications:', err);
    }
  };

  // Helper to parse mentions, notify users, and format before saving comment to DB
  const processCommentBeforeSave = async (rawContent: string, targetWorkItemId: string) => {
    let processed = rawContent;
    const mentionedUserIds: string[] = [];
    
    const sortedUsers = [...users].sort((a, b) => b.name.length - a.name.length);

    for (const u of sortedUsers) {
      const escapedName = u.name.replace(/[-\\^$*+?.()|[\]{}]/g, String.raw`\$&`);
      const regex = new RegExp(String.raw`@${escapedName}\b`, 'g');
      if (regex.test(processed)) {
        processed = processed.replace(regex, `@[${u.name}](${u.id})`);
        mentionedUserIds.push(u.id);
      }
    }

    // Process work item references (#KEY -> #[KEY](id))
    const sortedWorkItems = [...workItems].sort((a, b) => b.key.length - a.key.length);

    for (const w of sortedWorkItems) {
      const escapedKey = w.key.replace(/[-\\^$*+?.()|[\]{}]/g, String.raw`\$&`);
      const regex = new RegExp(String.raw`#${escapedKey}\b`, 'g');
      if (regex.test(processed)) {
        processed = processed.replace(regex, `#[${w.key}](${w.id})`);
      }
    }

    // Insert database notifications for mentioned users
    await createMentionNotifications(mentionedUserIds, rawContent, targetWorkItemId);

    return processed;
  };

  // Render parses comments text and decorates mentions/issues as styled badges
  const renderCommentContent = (contentString: string) => {
    if (!contentString) return '';
    const combinedRegex = /([@#])\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIdx = 0;
    let match;

    combinedRegex.lastIndex = 0;
    while ((match = combinedRegex.exec(contentString)) !== null) {
      const textBefore = contentString.substring(lastIdx, match.index);
      if (textBefore) {
        parts.push(textBefore);
      }

      const type = match[1];
      const label = match[2];
      const id = match[3];

      if (type === '@') {
        parts.push(
          <span
            key={`mention-${match.index}-${id}`}
            className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 font-semibold text-xs border border-blue-500/20 shadow-xs animate-fade-in"
          >
            @{label}
          </span>
        );
      } else {
        parts.push(
          <Link
            key={`issue-${match.index}-${id}`}
            href="/work-items"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 font-semibold text-xs border border-purple-500/20 shadow-xs transition-colors"
          >
            #{label}
          </Link>
        );
      }

      lastIdx = combinedRegex.lastIndex;
    }

    const textAfter = contentString.substring(lastIdx);
    if (textAfter) {
      parts.push(textAfter);
    }

    return parts.length > 0 ? parts : contentString;
  };

  // Handle post new comment
  const handleCreateComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newContent.trim() || !newWorkItemId) return;

    setIsSubmitting(true);
    try {
      const processedContent = await processCommentBeforeSave(newContent.trim(), newWorkItemId);
      const created = await createComment({
        work_item_id: newWorkItemId,
        content: processedContent,
        author_id: currentUserId,
      });

      setComments((prev) => [created, ...prev]);
      setNewContent('');
      setShowNewCommentModal(false);
    } catch (err) {
      console.error('Failed to create comment:', err);
      // Fallback local update for mock environment
      const selectedItem = workItems.find((w) => w.id === newWorkItemId);
      const processedContent = await processCommentBeforeSave(newContent.trim(), newWorkItemId);
      const mockCreated: CommentItem = {
        id: `comment-${Date.now()}`,
        work_item_id: newWorkItemId,
        author_id: currentUserId,
        parent_id: null,
        content: processedContent,
        edited: false,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: {
          id: currentUserId,
          name: users.find((u) => u.id === currentUserId)?.name || 'Current User',
          email: 'user@alice.dev',
          role: 'admin',
        },
        work_item: selectedItem
          ? {
              id: selectedItem.id,
              title: selectedItem.title,
              key: selectedItem.key,
              type: selectedItem.type,
              project: {
                id: selectedItem.project_id,
                name: selectedItem.project_name || 'Project',
                key: selectedItem.key.split('-')[0] || 'PROJ',
              },
            }
          : null,
      };
      setComments((prev) => [mockCreated, ...prev]);
      setNewContent('');
      setShowNewCommentModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle reply submit
  const handleReplySubmit = async (parentId: string, workItemId: string) => {
    if (!replyContent.trim()) return;

    try {
      const processedContent = await processCommentBeforeSave(replyContent.trim(), workItemId);
      const created = await createComment({
        work_item_id: workItemId,
        content: processedContent,
        author_id: currentUserId,
        parent_id: parentId,
      });
      setComments((prev) => [...prev, created]);
    } catch (err) {
      console.error('Failed to post reply:', err);
      // Local fallback
      const parentComment = comments.find((c) => c.id === parentId);
      const processedContent = await processCommentBeforeSave(replyContent.trim(), workItemId);
      const mockReply: CommentItem = {
        id: `reply-${Date.now()}`,
        work_item_id: workItemId,
        author_id: currentUserId,
        parent_id: parentId,
        content: processedContent,
        edited: false,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: {
          id: currentUserId,
          name: users.find((u) => u.id === currentUserId)?.name || 'Current User',
          email: 'user@alice.dev',
        },
        work_item: parentComment?.work_item || null,
      };
      setComments((prev) => [...prev, mockReply]);
    } finally {
      setReplyingParentId(null);
      setReplyContent('');
    }
  };

  // Handle Edit
  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) return;

    const targetComment = comments.find((c) => c.id === commentId);
    const targetWIId = targetComment?.work_item_id || newWorkItemId;

    try {
      const processedContent = await processCommentBeforeSave(editContent.trim(), targetWIId);
      const updated = await updateComment(commentId, processedContent);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? updated : c))
      );
    } catch (err) {
      console.error('Failed to update comment:', err);
      const processedContent = await processCommentBeforeSave(editContent.trim(), targetWIId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, content: processedContent, edited: true }
            : c
        )
      );
    } finally {
      setEditingCommentId(null);
      setEditContent('');
    }
  };

  // Handle Archive
  const handleArchive = async (commentId: string) => {
    try {
      await archiveComment(commentId);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, status: 'archived' } : c))
      );
    } catch (err) {
      console.error('Failed to archive comment:', err);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, status: 'archived' } : c))
      );
    }
  };

  return (
    <div className="space-y-6">
      {!workItemId && (
        <>
          {/* Header Banner */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Discussions & Comments
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Collaborate, review feedback, and track conversation threads across all project work items.
              </p>
            </div>
            <Button
              onClick={() => setShowNewCommentModal(true)}
              className="inline-flex items-center gap-2 bg-blue-600 font-medium text-white hover:bg-blue-700 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>New Comment</span>
            </Button>
          </div>

          {/* Metrics Bar */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-zinc-200/80 bg-white/60 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-xl bg-blue-500/10 p-3 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Total Comments
                  </p>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {stats.total}
                  </h3>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-200/80 bg-white/60 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Active Discussions
                  </p>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {stats.active}
                  </h3>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-200/80 bg-white/60 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-xl bg-violet-500/10 p-3 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Contributors
                  </p>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {stats.authors}
                  </h3>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-200/80 bg-white/60 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-xl bg-amber-500/10 p-3 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Discussed Items
                  </p>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {stats.workItemsDiscussed}
                  </h3>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filters Controls */}
          <Card className="border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="search-comments-input"
                    type="text"
                    aria-label="Search comments"
                    placeholder="Search comments by text, author, or issue key..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 py-2 pl-9 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-900"
                  />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                  {/* Work Item Select */}
                  <select
                    id="select-work-item-filter"
                    aria-label="Filter by Work Item"
                    value={selectedWorkItemId}
                    onChange={(e) => setSelectedWorkItemId(e.target.value)}
                    className="rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs font-medium text-zinc-700 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300"
                  >
                    <option value="all">All Work Items</option>
                    {workItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.key} — {item.title.slice(0, 25)}...
                      </option>
                    ))}
                  </select>

                  {/* Status Select */}
                  <select
                    id="select-status-filter"
                    aria-label="Filter by Status"
                    value={selectedStatus}
                    onChange={(e) =>
                      setSelectedStatus(e.target.value as 'all' | 'active' | 'archived')
                    }
                    className="rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs font-medium text-zinc-700 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300"
                  >
                    <option value="active">Active Comments</option>
                    <option value="archived">Archived</option>
                    <option value="all">All Statuses</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {workItemId && (
        <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-blue-600" />
            Discussion ({stats.active})
          </h3>
        </div>
      )}

      {/* Comments Feed List */}
      <div className="space-y-4">
        {parentComments.length === 0 ? (
          <Card className="border-dashed border-zinc-200 py-12 text-center dark:border-zinc-800">
            <CardContent className="space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <MessageSquareText className="h-6 w-6 text-zinc-400" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                No comments found
              </h3>
              <p className="mx-auto max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                {searchQuery || selectedWorkItemId !== 'all'
                  ? 'Try adjusting your search query or filter settings.'
                  : 'Be the first to start a conversation on this work item!'}
              </p>
              {!workItemId && (
                <Button
                  onClick={() => setShowNewCommentModal(true)}
                  variant="outline"
                  className="mt-2"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Comment
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          parentComments.map((parent) => (
            <Card
              key={parent.id}
              className={cn(
                'border-zinc-200/80 transition-all dark:border-zinc-800',
                parent.status === 'archived' && 'opacity-60 bg-zinc-50/50 dark:bg-zinc-900/30'
              )}
            >
              <CardContent className="p-5 space-y-4">
                {/* Parent Comment Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* User Avatar Badge */}
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-indigo-600 font-semibold text-white text-xs shadow-sm">
                      {parent.author?.name
                        ? parent.author.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                        : 'U'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {parent.author?.name || 'Anonymous User'}
                        </span>
                        {parent.status === 'archived' && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                            Archived
                          </span>
                        )}
                        {parent.edited && (
                          <span className="text-[11px] text-zinc-400 italic">
                            (edited)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        <Clock className="h-3 w-3" />
                        <span>
                          {new Date(parent.created_at).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Header Badges & Actions */}
                  <div className="flex items-center gap-2">
                    {!workItemId && parent.work_item && (
                      <Link
                        href="/work-items"
                        className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60"
                      >
                        <Tag className="h-3 w-3" />
                        <span>{parent.work_item.key}</span>
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </Link>
                    )}

                    {/* Menu Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingCommentId(parent.id);
                            // Replace @[Name](userId) with @Name, and #[KEY](id) with #KEY
                            const rawText = parent.content
                              .replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '@$1')
                              .replace(/#\[([^\]]+)\]\(([^)]+)\)/g, '#$1');
                            setEditContent(rawText);
                          }}
                          className="gap-2"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </DropdownMenuItem>
                        {parent.status === 'active' && (
                          <DropdownMenuItem
                            onClick={() => handleArchive(parent.id)}
                            className="gap-2 text-amber-600 dark:text-amber-400"
                          >
                            <Archive className="h-3.5 w-3.5" /> Archive
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Comment Body / Edit Mode */}
                {editingCommentId === parent.id ? (
                  <div className="space-y-2 pt-1 relative">
                    <textarea
                      ref={editCommentRef}
                      aria-label="Edit comment content"
                      value={editContent}
                      onChange={(e) => {
                        const val = e.target.value;
                        const pos = e.target.selectionStart || 0;
                        setEditContent(val);
                        handleTextChangeMentions(
                          val,
                          pos,
                          setEditMentionTriggerIdx,
                          setEditMentionSearch,
                          setShowEditMentionDropdown,
                          setEditMentionHighlightIdx
                        );
                        handleTextChangeWorkItems(
                          val,
                          pos,
                          setEditWITriggerIdx,
                          setEditWISearch,
                          setShowEditWISuggestions,
                          setEditWIHighlightIdx
                        );
                      }}
                      onKeyDown={(e) => {
                        if (showEditMentionDropdown) {
                          handleAutocompleteKeyDown(
                            e,
                            showEditMentionDropdown,
                            filteredUsersEdit,
                            editMentionHighlightIdx,
                            setEditMentionHighlightIdx,
                            (user) =>
                              handleInsertMention(
                                editContent,
                                editMentionTriggerIdx,
                                editCommentRef.current?.selectionStart || 0,
                                `@${user.name}`,
                                editCommentRef.current,
                                setEditContent,
                                setShowEditMentionDropdown
                              ),
                            () => setShowEditMentionDropdown(false)
                          );
                        } else if (showEditWISuggestions) {
                          handleAutocompleteKeyDown(
                            e,
                            showEditWISuggestions,
                            filteredWorkItemsEdit,
                            editWIHighlightIdx,
                            setEditWIHighlightIdx,
                            (item) =>
                              handleInsertMention(
                                editContent,
                                editWITriggerIdx,
                                editCommentRef.current?.selectionStart || 0,
                                `#${item.key}`,
                                editCommentRef.current,
                                setEditContent,
                                setShowEditWISuggestions
                              ),
                            () => setShowEditWISuggestions(false)
                          );
                        }
                      }}
                      className="w-full rounded-lg border border-zinc-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      rows={3}
                    />
                    {showEditMentionDropdown && filteredUsersEdit.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                        {filteredUsersEdit.map((user, idx) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() =>
                              handleInsertMention(
                                editContent,
                                editMentionTriggerIdx,
                                editCommentRef.current?.selectionStart || 0,
                                `@${user.name}`,
                                editCommentRef.current,
                                setEditContent,
                                setShowEditMentionDropdown
                              )
                            }
                            className={cn(
                              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                              idx === editMentionHighlightIdx
                                ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                                : "text-zinc-700 dark:text-zinc-300"
                            )}
                          >
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 font-semibold text-white text-[10px]">
                              {user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                            </div>
                            <span>{user.name}</span>
                            <span className="text-xs text-zinc-400">({user.email})</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {showEditWISuggestions && filteredWorkItemsEdit.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                        {filteredWorkItemsEdit.map((item, idx) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              handleInsertMention(
                                editContent,
                                editWITriggerIdx,
                                editCommentRef.current?.selectionStart || 0,
                                `#${item.key}`,
                                editCommentRef.current,
                                setEditContent,
                                setShowEditWISuggestions
                              )
                            }
                            className={cn(
                              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                              idx === editWIHighlightIdx
                                ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                                : "text-zinc-700 dark:text-zinc-300"
                            )}
                          >
                            <div className="flex h-5 w-12 items-center justify-center rounded-md bg-purple-500 font-bold text-white text-[10px]">
                              {item.key}
                            </div>
                            <span className="truncate flex-1">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingCommentId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(parent.id)}
                        className="bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 pl-12">
                    {renderCommentContent(parent.content)}
                  </p>
                )}

                {/* Work Item Context Details Banner */}
                {!workItemId && parent.work_item && (
                  <div className="ml-12 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-md border border-zinc-100 dark:border-zinc-800">
                    <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                    <span>
                      Item:{' '}
                      <strong className="text-zinc-700 dark:text-zinc-200">
                        {parent.work_item.title}
                      </strong>
                    </span>
                    {parent.work_item.project && (
                      <>
                        <span className="text-zinc-300 dark:text-zinc-600">•</span>
                        <span>
                          Project:{' '}
                          <span className="font-medium text-zinc-600 dark:text-zinc-300">
                            {parent.work_item.project.name}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Thread Replies */}
                {parent.threadReplies.length > 0 && (
                  <div className="ml-12 border-l-2 border-zinc-200 dark:border-zinc-800 pl-4 space-y-3 pt-2">
                    {parent.threadReplies.map((reply) => (
                      <div key={reply.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                              {reply.author?.name || 'Reply User'}
                            </span>
                            <span className="text-[11px] text-zinc-400">
                              {new Date(reply.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          {renderCommentContent(reply.content)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Bar Action */}
                <div className="ml-12 pt-1 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setReplyingParentId(
                        replyingParentId === parent.id ? null : parent.id
                      )
                    }
                    className="h-8 gap-1.5 text-xs font-medium text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
                  >
                    <Reply className="h-3.5 w-3.5" />
                    <span>Reply</span>
                    {parent.threadReplies.length > 0 && (
                      <span className="ml-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[10px]">
                        {parent.threadReplies.length}
                      </span>
                    )}
                  </Button>
                </div>

                {/* Reply Form Collapse */}
                {replyingParentId === parent.id && (
                  <div className="ml-12 pt-2 flex flex-col gap-2 relative">
                    <div className="flex items-center gap-2 relative w-full">
                      <input
                        ref={replyInputRef}
                        type="text"
                        aria-label="Write a reply"
                        placeholder="Write a reply..."
                        value={replyContent}
                        onChange={(e) => {
                          const val = e.target.value;
                          const pos = e.target.selectionStart || 0;
                          setReplyContent(val);
                          handleTextChangeMentions(
                            val,
                            pos,
                            setReplyMentionTriggerIdx,
                            setReplyMentionSearch,
                            setShowReplyMentionDropdown,
                            setReplyMentionHighlightIdx
                          );
                          handleTextChangeWorkItems(
                            val,
                            pos,
                            setReplyWITriggerIdx,
                            setReplyWISearch,
                            setShowReplyWISuggestions,
                            setReplyWIHighlightIdx
                          );
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !showReplyMentionDropdown && !showReplyWISuggestions) {
                            handleReplySubmit(parent.id, parent.work_item_id);
                          } else if (showReplyMentionDropdown) {
                            handleAutocompleteKeyDown(
                              e,
                              showReplyMentionDropdown,
                              filteredUsersReply,
                              replyMentionHighlightIdx,
                              setReplyMentionHighlightIdx,
                              (user) =>
                                handleInsertMention(
                                  replyContent,
                                  replyMentionTriggerIdx,
                                  replyInputRef.current?.selectionStart || 0,
                                  `@${user.name}`,
                                  replyInputRef.current,
                                  setReplyContent,
                                  setShowReplyMentionDropdown
                                ),
                              () => setShowReplyMentionDropdown(false)
                            );
                          } else if (showReplyWISuggestions) {
                            handleAutocompleteKeyDown(
                              e,
                              showReplyWISuggestions,
                              filteredWorkItemsReply,
                              replyWIHighlightIdx,
                              setReplyWIHighlightIdx,
                              (item) =>
                                handleInsertMention(
                                  replyContent,
                                  replyWITriggerIdx,
                                  replyInputRef.current?.selectionStart || 0,
                                  `#${item.key}`,
                                  replyInputRef.current,
                                  setReplyContent,
                                  setShowReplyWISuggestions
                                ),
                              () => setShowReplyWISuggestions(false)
                            );
                          }
                        }}
                        className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 px-3 text-xs text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      {showReplyMentionDropdown && filteredUsersReply.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 bottom-full mb-1 max-h-40 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                          {filteredUsersReply.map((user, idx) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() =>
                                handleInsertMention(
                                  replyContent,
                                  replyMentionTriggerIdx,
                                  replyInputRef.current?.selectionStart || 0,
                                  `@${user.name}`,
                                  replyInputRef.current,
                                  setReplyContent,
                                  setShowReplyMentionDropdown
                                )
                              }
                              className={cn(
                                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                                idx === replyMentionHighlightIdx
                                  ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                                  : "text-zinc-700 dark:text-zinc-300"
                              )}
                            >
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 font-semibold text-white text-[10px]">
                                {user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                              </div>
                              <span>{user.name}</span>
                              <span className="text-xs text-zinc-400">({user.email})</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {showReplyWISuggestions && filteredWorkItemsReply.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 bottom-full mb-1 max-h-40 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                          {filteredWorkItemsReply.map((item, idx) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() =>
                                handleInsertMention(
                                  replyContent,
                                  replyWITriggerIdx,
                                  replyInputRef.current?.selectionStart || 0,
                                  `#${item.key}`,
                                  replyInputRef.current,
                                  setReplyContent,
                                  setShowReplyWISuggestions
                                )
                              }
                              className={cn(
                                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                                idx === replyWIHighlightIdx
                                  ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                                  : "text-zinc-700 dark:text-zinc-300"
                              )}
                            >
                              <div className="flex h-5 w-12 items-center justify-center rounded-md bg-purple-500 font-bold text-white text-[10px]">
                                {item.key}
                              </div>
                              <span className="truncate flex-1">{item.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleReplySubmit(parent.id, parent.work_item_id)}
                        className="h-8 bg-blue-600 px-3 text-white hover:bg-blue-700"
                      >
                        <Send className="h-3 w-3 mr-1" /> Post
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Inline Comment Box for specific Work Item */}
      {workItemId && (
        <Card className="border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardContent className="p-4 space-y-4">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" />
              Add to discussion
            </h4>
            <div className="relative">
              <textarea
                ref={newCommentRef}
                placeholder="Share your thoughts, feedback, or update... Use @ to mention someone, # to link a work item."
                value={newContent}
                onChange={(e) => {
                  const val = e.target.value;
                  const pos = e.target.selectionStart || 0;
                  setNewContent(val);
                  handleTextChangeMentions(
                    val,
                    pos,
                    setNewMentionTriggerIdx,
                    setNewMentionSearch,
                    setShowNewMentionDropdown,
                    setNewMentionHighlightIdx
                  );
                  handleTextChangeWorkItems(
                    val,
                    pos,
                    setNewWITriggerIdx,
                    setNewWISearch,
                    setShowNewWISuggestions,
                    setNewWIHighlightIdx
                  );
                }}
                onKeyDown={(e) => {
                  if (showNewMentionDropdown) {
                    handleAutocompleteKeyDown(
                      e,
                      showNewMentionDropdown,
                      filteredUsersNew,
                      newMentionHighlightIdx,
                      setNewMentionHighlightIdx,
                      (user) =>
                        handleInsertMention(
                          newContent,
                          newMentionTriggerIdx,
                          newCommentRef.current?.selectionStart || 0,
                          `@${user.name}`,
                          newCommentRef.current,
                          setNewContent,
                          setShowNewMentionDropdown
                        ),
                      () => setShowNewMentionDropdown(false)
                    );
                  } else if (showNewWISuggestions) {
                    handleAutocompleteKeyDown(
                      e,
                      showNewWISuggestions,
                      filteredWorkItemsNew,
                      newWIHighlightIdx,
                      setNewWIHighlightIdx,
                      (item) =>
                        handleInsertMention(
                          newContent,
                          newWITriggerIdx,
                          newCommentRef.current?.selectionStart || 0,
                          `#${item.key}`,
                          newCommentRef.current,
                          setNewContent,
                          setShowNewWISuggestions
                        ),
                      () => setShowNewWISuggestions(false)
                    );
                  }
                }}
                rows={3}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 p-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-900"
              />
              {showNewMentionDropdown && filteredUsersNew.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                  {filteredUsersNew.map((user, idx) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() =>
                        handleInsertMention(
                          newContent,
                          newMentionTriggerIdx,
                          newCommentRef.current?.selectionStart || 0,
                          `@${user.name}`,
                          newCommentRef.current,
                          setNewContent,
                          setShowNewMentionDropdown
                        )
                      }
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                        idx === newMentionHighlightIdx
                          ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-700 dark:text-zinc-300"
                      )}
                    >
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 font-semibold text-white text-[10px]">
                        {user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                      </div>
                      <span>{user.name}</span>
                      <span className="text-xs text-zinc-400">({user.email})</span>
                    </button>
                  ))}
                </div>
              )}
              {showNewWISuggestions && filteredWorkItemsNew.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                  {filteredWorkItemsNew.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        handleInsertMention(
                          newContent,
                          newWITriggerIdx,
                          newCommentRef.current?.selectionStart || 0,
                          `#${item.key}`,
                          newCommentRef.current,
                          setNewContent,
                          setShowNewWISuggestions
                        )
                      }
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                        idx === newWIHighlightIdx
                          ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-700 dark:text-zinc-300"
                      )}
                    >
                      <div className="flex h-5 w-12 items-center justify-center rounded-md bg-purple-500 font-bold text-white text-[10px]">
                        {item.key}
                      </div>
                      <span className="truncate flex-1">{item.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => handleCreateComment()}
                disabled={isSubmitting || !newContent.trim()}
                className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2"
              >
                {isSubmitting ? 'Posting...' : 'Post Comment'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Comment Modal */}
      <Dialog open={showNewCommentModal} onOpenChange={setShowNewCommentModal}>
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <MessageSquareText className="h-5 w-5 text-blue-600" />
              Post New Comment
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateComment} className="space-y-4 pt-2">
            <div>
              <label
                htmlFor="new-comment-work-item-select"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Select Work Item
              </label>
              <select
                id="new-comment-work-item-select"
                value={newWorkItemId}
                onChange={(e) => setNewWorkItemId(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                required
              >
                {workItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    [{item.key}] {item.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="new-comment-content-textarea"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Comment Text
              </label>
              <div className="relative">
                <textarea
                  id="new-comment-content-textarea"
                  ref={newCommentRef}
                  placeholder="Share your thoughts, feedback, or update... Use @ to mention someone, # to link a work item."
                  value={newContent}
                  onChange={(e) => {
                    const val = e.target.value;
                    const pos = e.target.selectionStart || 0;
                    setNewContent(val);
                    handleTextChangeMentions(
                      val,
                      pos,
                      setNewMentionTriggerIdx,
                      setNewMentionSearch,
                      setShowNewMentionDropdown,
                      setNewMentionHighlightIdx
                    );
                    handleTextChangeWorkItems(
                      val,
                      pos,
                      setNewWITriggerIdx,
                      setNewWISearch,
                      setShowNewWISuggestions,
                      setNewWIHighlightIdx
                    );
                  }}
                  onKeyDown={(e) => {
                    if (showNewMentionDropdown) {
                      handleAutocompleteKeyDown(
                        e,
                        showNewMentionDropdown,
                        filteredUsersNew,
                        newMentionHighlightIdx,
                        setNewMentionHighlightIdx,
                        (user) =>
                          handleInsertMention(
                            newContent,
                            newMentionTriggerIdx,
                            newCommentRef.current?.selectionStart || 0,
                            `@${user.name}`,
                            newCommentRef.current,
                            setNewContent,
                            setShowNewMentionDropdown
                          ),
                        () => setShowNewMentionDropdown(false)
                      );
                    } else if (showNewWISuggestions) {
                      handleAutocompleteKeyDown(
                        e,
                        showNewWISuggestions,
                        filteredWorkItemsNew,
                        newWIHighlightIdx,
                        setNewWIHighlightIdx,
                        (item) =>
                          handleInsertMention(
                            newContent,
                            newWITriggerIdx,
                            newCommentRef.current?.selectionStart || 0,
                            `#${item.key}`,
                            newCommentRef.current,
                            setNewContent,
                            setShowNewWISuggestions
                          ),
                        () => setShowNewWISuggestions(false)
                      );
                    }
                  }}
                  rows={4}
                  required
                  className="w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
                {showNewMentionDropdown && filteredUsersNew.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                    {filteredUsersNew.map((user, idx) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() =>
                          handleInsertMention(
                            newContent,
                            newMentionTriggerIdx,
                            newCommentRef.current?.selectionStart || 0,
                            `@${user.name}`,
                            newCommentRef.current,
                            setNewContent,
                            setShowNewMentionDropdown
                          )
                        }
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                          idx === newMentionHighlightIdx
                            ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                            : "text-zinc-700 dark:text-zinc-300"
                        )}
                      >
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 font-semibold text-white text-[10px]">
                          {user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                        </div>
                        <span>{user.name}</span>
                        <span className="text-xs text-zinc-400">({user.email})</span>
                      </button>
                    ))}
                  </div>
                )}
                {showNewWISuggestions && filteredWorkItemsNew.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                    {filteredWorkItemsNew.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          handleInsertMention(
                            newContent,
                            newWITriggerIdx,
                            newCommentRef.current?.selectionStart || 0,
                            `#${item.key}`,
                            newCommentRef.current,
                            setNewContent,
                            setShowNewWISuggestions
                          )
                        }
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                          idx === newWIHighlightIdx
                            ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                            : "text-zinc-700 dark:text-zinc-300"
                        )}
                      >
                        <div className="flex h-5 w-12 items-center justify-center rounded-md bg-purple-500 font-bold text-white text-[10px]">
                          {item.key}
                        </div>
                        <span className="truncate flex-1">{item.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewCommentModal(true)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !newContent.trim()}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {isSubmitting ? 'Posting...' : 'Post Comment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
