/* eslint-disable no-unused-vars */
'use client';

import {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { USER_PROJECTION } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Avatar, AvatarFallback } from '@repo/ui/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
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
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Separator } from '@repo/ui/components/ui/separator';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import { formatDateTime, formatTime, getInitials } from '@/app/_shared/utility';
import { SearchInput } from '@/components/search-input';
import { SearchableSelect } from '@/components/searchable-select';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';
import { preventDismissForComboboxPortal } from '@/lib/dialog-outside-events';
import {
  MessageSquareText,
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
  RotateCcw,
  Trash2,
  X,
} from '@repo/ui/lib/icons';
import {
  CommentItem,
  CommentUser,
  CommentWorkItemOption,
  updateComment,
  archiveComment,
  restoreComment,
} from '../_services/comments.service';
import { createCommentAction } from './actions';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { tryHandleLockedMutationError } from '@/lib/optimistic-lock/run-locked-mutation';

type CommentsFeedProps = {
  initialComments: CommentItem[];
  workItems: CommentWorkItemOption[];
  currentUserId?: string;
  workItemId?: string;
  embedded?: boolean;
};

const MENTION_BADGE_CLASS =
  'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400';
const ISSUE_BADGE_CLASS =
  'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400';

type StatMetricCardProps = {
  label: string;
  value: number;
  icon: ReactNode;
  iconClassName: string;
};

function StatMetricCard({
  label,
  value,
  icon,
  iconClassName,
}: Readonly<StatMetricCardProps>) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            iconClassName
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="text-foreground text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CommentAvatar({ name }: Readonly<{ name?: string | null }>) {
  return (
    <Avatar size="default">
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
        {getInitials(name ?? 'U')}
      </AvatarFallback>
    </Avatar>
  );
}

type AutocompleteDropdownShellProps = {
  readonly show: boolean;
  readonly anchorRef: React.RefObject<HTMLElement | null>;
  readonly preferredPosition?: 'top' | 'bottom';
  readonly children: ReactNode;
};

/**
 * Renders the mention / work-item suggestion list in a portal so Card's
 * `overflow-hidden` (and other clipping ancestors) cannot crop it.
 */
function AutocompleteDropdownShell({
  show,
  anchorRef,
  preferredPosition = 'top',
  children,
}: Readonly<AutocompleteDropdownShellProps>) {
  const [coords, setCoords] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!show) {
      setCoords(null);
      return;
    }

    const update = () => {
      const el = anchorRef.current;
      if (!el) {
        setCoords(null);
        return;
      }

      const rect = el.getBoundingClientRect();
      const gap = 4;
      const estimatedHeight = 160; // matches max-h-40
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      let placeAbove = preferredPosition === 'top';
      if (
        placeAbove &&
        spaceAbove < estimatedHeight &&
        spaceBelow > spaceAbove
      ) {
        placeAbove = false;
      } else if (
        !placeAbove &&
        spaceBelow < estimatedHeight &&
        spaceAbove > spaceBelow
      ) {
        placeAbove = true;
      }

      setCoords(
        placeAbove
          ? {
              left: rect.left,
              width: rect.width,
              bottom: window.innerHeight - rect.top + gap,
            }
          : {
              left: rect.left,
              width: rect.width,
              top: rect.bottom + gap,
            }
      );
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [show, anchorRef, preferredPosition]);

  if (!show || !coords || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="border-border bg-popover text-popover-foreground fixed z-50 max-h-40 overflow-y-auto rounded-lg border shadow-md"
      style={{
        left: coords.left,
        width: coords.width,
        top: coords.top,
        bottom: coords.bottom,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

type MentionDropdownListProps = {
  show: boolean;
  usersList: CommentUser[];
  highlightIdx: number;
  onSelect: (user: CommentUser) => void;
  position?: 'top' | 'bottom';
  anchorRef: React.RefObject<HTMLElement | null>;
};

function MentionDropdownList({
  show,
  usersList,
  highlightIdx,
  onSelect,
  position = 'top',
  anchorRef,
}: Readonly<MentionDropdownListProps>) {
  if (!show || usersList.length === 0) return null;
  return (
    <AutocompleteDropdownShell
      show={show}
      anchorRef={anchorRef}
      preferredPosition={position}
    >
      {usersList.map((user, idx) => (
        <button
          key={user.id}
          type="button"
          onClick={() => onSelect(user)}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
            idx === highlightIdx
              ? 'bg-accent text-accent-foreground'
              : 'text-foreground hover:bg-muted/80'
          )}
        >
          <Avatar size="sm">
            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span>{user.name}</span>
          <span className="text-muted-foreground text-xs">({user.email})</span>
        </button>
      ))}
    </AutocompleteDropdownShell>
  );
}

type WIDropdownListProps = {
  show: boolean;
  wiList: Array<{ id: string; key: string; title: string }>;
  highlightIdx: number;
  onSelect: (item: { id: string; key: string; title: string }) => void;
  position?: 'top' | 'bottom';
  anchorRef: React.RefObject<HTMLElement | null>;
};

function WIDropdownList({
  show,
  wiList,
  highlightIdx,
  onSelect,
  position = 'top',
  anchorRef,
}: Readonly<WIDropdownListProps>) {
  if (!show || wiList.length === 0) return null;
  return (
    <AutocompleteDropdownShell
      show={show}
      anchorRef={anchorRef}
      preferredPosition={position}
    >
      {wiList.map((item, idx) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item)}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
            idx === highlightIdx
              ? 'bg-accent text-accent-foreground'
              : 'text-foreground hover:bg-muted/80'
          )}
        >
          <Badge
            variant="outline"
            className={cn('shrink-0 font-mono', ISSUE_BADGE_CLASS)}
          >
            {item.key}
          </Badge>
          <TruncatedText className="text-foreground min-w-0 flex-1 text-sm">
            {item.title}
          </TruncatedText>
        </button>
      ))}
    </AutocompleteDropdownShell>
  );
}

type AutocompleteInputProps = {
  as?: 'input' | 'textarea';
  value: string;
  onChange: (val: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  users: CommentUser[];
  workItems: Pick<CommentWorkItemOption, 'id' | 'key' | 'title'>[];
  rows?: number;
  className?: string;
  position?: 'top' | 'bottom';
  id?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
};

function AutocompleteInput({
  as = 'textarea',
  value,
  onChange,
  onSubmit,
  placeholder,
  users,
  workItems,
  rows = 3,
  className,
  position = 'bottom',
  id,
  textareaRef,
}: Readonly<AutocompleteInputProps>) {
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionTriggerIdx, setMentionTriggerIdx] = useState(-1);
  const [mentionHighlightIdx, setMentionHighlightIdx] = useState(0);

  const [showWISuggestions, setShowWISuggestions] = useState(false);
  const [wiSearch, setWISearch] = useState('');
  const [wiTriggerIdx, setWiTriggerIdx] = useState(-1);
  const [wiHighlightIdx, setWiHighlightIdx] = useState(0);

  const localRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const activeRef = textareaRef || localRef;

  const filteredUsers = useMemo(() => {
    const q = mentionSearch.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, mentionSearch]);

  const filteredWorkItems = useMemo(() => {
    const q = wiSearch.toLowerCase();
    return workItems.filter(
      (w) =>
        w.key.toLowerCase().includes(q) || w.title.toLowerCase().includes(q)
    );
  }, [workItems, wiSearch]);

  const handleTextChangeMentionsLocal = (text: string, cursorPos: number) => {
    const lastAtIdx = text.lastIndexOf('@', cursorPos - 1);
    const lastHashIdx = text.lastIndexOf('#', cursorPos - 1);

    if (lastAtIdx !== -1 && (lastHashIdx === -1 || lastAtIdx > lastHashIdx)) {
      const charBeforeAt = lastAtIdx > 0 ? text[lastAtIdx - 1] : ' ';
      const textBetween = text.slice(lastAtIdx + 1, cursorPos);
      const hasSpace = textBetween.includes(' ') || textBetween.includes('\n');

      if ((charBeforeAt === ' ' || charBeforeAt === '\n') && !hasSpace) {
        setMentionTriggerIdx(lastAtIdx);
        setMentionSearch(textBetween);
        setShowMentionDropdown(true);
        setMentionHighlightIdx(0);
        return;
      }
    }
    setShowMentionDropdown(false);
  };

  const handleTextChangeWorkItemsLocal = (text: string, cursorPos: number) => {
    const lastAtIdx = text.lastIndexOf('@', cursorPos - 1);
    const lastHashIdx = text.lastIndexOf('#', cursorPos - 1);

    if (lastHashIdx !== -1 && (lastAtIdx === -1 || lastHashIdx > lastAtIdx)) {
      const charBeforeHash = lastHashIdx > 0 ? text[lastHashIdx - 1] : ' ';
      const textBetween = text.slice(lastHashIdx + 1, cursorPos);
      const hasSpace = textBetween.includes(' ') || textBetween.includes('\n');

      if ((charBeforeHash === ' ' || charBeforeHash === '\n') && !hasSpace) {
        setWiTriggerIdx(lastHashIdx);
        setWISearch(textBetween);
        setShowWISuggestions(true);
        setWiHighlightIdx(0);
        return;
      }
    }
    setShowWISuggestions(false);
  };

  const handleInsertMentionLocal = (
    insertText: string,
    triggerIdx: number,
    isWI: boolean
  ) => {
    const inputEl = activeRef.current;
    const cursorPos = inputEl?.selectionStart || 0;
    const before = value.slice(0, triggerIdx);
    const after = value.slice(cursorPos);
    const formatted = `${insertText} `;
    const nextText = before + formatted + after;
    onChange(nextText);

    if (isWI) {
      setShowWISuggestions(false);
    } else {
      setShowMentionDropdown(false);
    }

    if (inputEl) {
      const nextCursorPos = triggerIdx + formatted.length;
      setTimeout(() => {
        inputEl.focus();
        inputEl.setSelectionRange(nextCursorPos, nextCursorPos);
      }, 0);
    }
  };

  const handleMentionKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    if (!showMentionDropdown || filteredUsers.length === 0) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionHighlightIdx((mentionHighlightIdx + 1) % filteredUsers.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionHighlightIdx(
        (mentionHighlightIdx - 1 + filteredUsers.length) % filteredUsers.length
      );
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const selected = filteredUsers[mentionHighlightIdx];
      if (selected) {
        handleInsertMentionLocal(`@${selected.name}`, mentionTriggerIdx, false);
      }
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setShowMentionDropdown(false);
      return true;
    }
    return false;
  };

  const handleWIKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    if (!showWISuggestions || filteredWorkItems.length === 0) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setWiHighlightIdx((wiHighlightIdx + 1) % filteredWorkItems.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setWiHighlightIdx(
        (wiHighlightIdx - 1 + filteredWorkItems.length) %
          filteredWorkItems.length
      );
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const selected = filteredWorkItems[wiHighlightIdx];
      if (selected) {
        handleInsertMentionLocal(`#${selected.key}`, wiTriggerIdx, true);
      }
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setShowWISuggestions(false);
      return true;
    }
    return false;
  };

  const handleKeyDownLocal = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    if (handleMentionKeyDown(e)) return;
    if (handleWIKeyDown(e)) return;

    if (e.key === 'Enter' && as === 'input' && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative flex-1">
      {as === 'textarea' ? (
        <Textarea
          id={id}
          ref={activeRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          placeholder={placeholder}
          rows={rows}
          className={className}
          onChange={(e) => {
            const val = e.target.value;
            const pos = e.target.selectionStart || 0;
            onChange(val);
            handleTextChangeMentionsLocal(val, pos);
            handleTextChangeWorkItemsLocal(val, pos);
          }}
          onKeyDown={handleKeyDownLocal}
        />
      ) : (
        <Input
          id={id}
          ref={activeRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          placeholder={placeholder}
          className={className}
          onChange={(e) => {
            const val = e.target.value;
            const pos = e.target.selectionStart || 0;
            onChange(val);
            handleTextChangeMentionsLocal(val, pos);
            handleTextChangeWorkItemsLocal(val, pos);
          }}
          onKeyDown={handleKeyDownLocal}
        />
      )}
      <MentionDropdownList
        show={showMentionDropdown}
        usersList={filteredUsers}
        highlightIdx={mentionHighlightIdx}
        position={position}
        anchorRef={activeRef}
        onSelect={(user) =>
          handleInsertMentionLocal(`@${user.name}`, mentionTriggerIdx, false)
        }
      />
      <WIDropdownList
        show={showWISuggestions}
        wiList={filteredWorkItems}
        highlightIdx={wiHighlightIdx}
        position={position}
        anchorRef={activeRef}
        onSelect={(item) =>
          handleInsertMentionLocal(`#${item.key}`, wiTriggerIdx, true)
        }
      />
    </div>
  );
}

export function CommentsFeed({
  initialComments,
  workItems,
  currentUserId = 'user-admin-1',
  workItemId,
  embedded = false,
}: Readonly<CommentsFeedProps>) {
  const { handleMutationError } = useOptimisticLock();
  const [activeUserId, setActiveUserId] = useState<string>(currentUserId);
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<
    'all' | 'active' | 'archived'
  >('active');
  const [showNewCommentModal, setShowNewCommentModal] = useState(false);

  // New Comment Form State
  const [newWorkItemId, setNewWorkItemId] = useState(
    workItemId || workItems[0]?.id || ''
  );
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reply State
  const [replyingParentId, setReplyingParentId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // Edit State
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Delete Confirmation State
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Users for mentions
  const [users, setUsers] = useState<CommentUser[]>([]);

  // Refs for focusing inputs
  const newCommentRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const editCommentRef = useRef<HTMLTextAreaElement>(null);

  // Sync activeUserId with currentUserId prop if it changes
  useEffect(() => {
    setActiveUserId(currentUserId);
  }, [currentUserId]);

  // Load active users from database and get current user on mount
  useEffect(() => {
    async function loadUsers() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('users')
          .select(USER_PROJECTION)
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

        // Get logged in user UUID dynamically to set activeUserId
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setActiveUserId(user.id);
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
  }, [currentUserId]);

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

  // Stats calculation
  const stats = useMemo(() => {
    const total = comments.length;
    const active = comments.filter((c) => c.status === 'active').length;
    const authors = new Set(comments.map((c) => c.author?.name || c.author_id))
      .size;
    const workItemsDiscussed = new Set(comments.map((c) => c.work_item_id))
      .size;

    return { total, active, authors, workItemsDiscussed };
  }, [comments]);

  // Filtered comments
  const filteredComments = useMemo(() => {
    return comments.filter((c) => {
      // Work Item lock
      if (workItemId) {
        if (c.work_item_id !== workItemId) return false;
      } else if (
        selectedWorkItemId !== 'all' &&
        c.work_item_id !== selectedWorkItemId
      ) {
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

  // Helper function to create database notifications for mentioned users
  const createMentionNotifications = async (
    mentionedUserIds: string[],
    rawContent: string,
    targetWorkItemId: string
  ) => {
    if (mentionedUserIds.length === 0) return;
    try {
      const supabase = createClient();
      const actorName =
        users.find((u) => u.id === activeUserId)?.name || 'A teammate';

      const { data: wi } = await supabase
        .from('work_items')
        .select('title')
        .eq('id', targetWorkItemId)
        .maybeSingle();

      const titleSnippet = wi?.title ? `"${wi.title}"` : 'work item';
      const rawTextSnippet =
        rawContent.length > 60 ? rawContent.slice(0, 60) + '...' : rawContent;

      for (const mId of mentionedUserIds) {
        if (mId === activeUserId) continue;

        await supabase.from('notifications').insert({
          user_id: mId,
          type: 'mention',
          message: `${actorName} mentioned you in a comment on ${titleSnippet}: "${rawTextSnippet}"`,
          related_item_id: targetWorkItemId,
          read_status: false,
          created_by: activeUserId,
          updated_by: activeUserId,
          updated_at: new Date().toISOString(),
          status: 'active',
        });
      }
    } catch (err) {
      console.error('Failed to create mention notifications:', err);
    }
  };

  // Helper to parse mentions, notify users, and format before saving comment to DB
  const processCommentBeforeSave = async (
    rawContent: string,
    targetWorkItemId: string,
    shouldNotify = false
  ) => {
    let processed = rawContent;
    const mentionedUserIds: string[] = [];

    const sortedUsers = [...users].sort(
      (a, b) => b.name.length - a.name.length
    );

    for (const u of sortedUsers) {
      const escapedName = u.name.replace(
        /[-\\^$*+?.()|[\]{}]/g,
        String.raw`\$&`
      );
      const regex = new RegExp(String.raw`@${escapedName}\b`, 'g');
      if (regex.test(processed)) {
        processed = processed.replace(regex, `@[${u.name}](${u.id})`);
        mentionedUserIds.push(u.id);
      }
    }

    // Process work item references (#KEY -> #[KEY](id))
    const sortedWorkItems = [...workItems].sort(
      (a, b) => b.key.length - a.key.length
    );

    for (const w of sortedWorkItems) {
      const escapedKey = w.key.replace(/[-\\^$*+?.()|[\]{}]/g, String.raw`\$&`);
      const regex = new RegExp(String.raw`#${escapedKey}\b`, 'g');
      if (regex.test(processed)) {
        processed = processed.replace(regex, `#[${w.key}](${w.id})`);
      }
    }

    // Insert database notifications for mentioned users
    if (shouldNotify) {
      await createMentionNotifications(
        mentionedUserIds,
        rawContent,
        targetWorkItemId
      );
    }

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
          <Badge
            key={`mention-${match.index}-${id}`}
            variant="outline"
            className={cn('animate-fade-in font-semibold', MENTION_BADGE_CLASS)}
          >
            @{label}
          </Badge>
        );
      } else {
        parts.push(
          <Badge
            key={`issue-${match.index}-${id}`}
            variant="outline"
            asChild
            className={cn('animate-fade-in font-semibold', ISSUE_BADGE_CLASS)}
          >
            <Link href="/work-items">#{label}</Link>
          </Badge>
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
      const processedContent = await processCommentBeforeSave(
        newContent.trim(),
        newWorkItemId
      );
      const res = await createCommentAction({
        work_item_id: newWorkItemId,
        content: processedContent,
      });
      if (!res.success) {
        throw new Error(res.error || 'Failed to create comment');
      }
      const created = res.data!;

      setComments((prev) => [created, ...prev]);
      setNewContent('');
      setShowNewCommentModal(false);
    } catch (err) {
      console.error('Failed to create comment:', err);
      // Fallback local update for mock environment
      const selectedItem = workItems.find((w) => w.id === newWorkItemId);
      const processedContent = await processCommentBeforeSave(
        newContent.trim(),
        newWorkItemId,
        true
      );
      const mockCreated: CommentItem = {
        id: `comment-${Date.now()}`,
        work_item_id: newWorkItemId,
        author_id: activeUserId,
        parent_id: null,
        content: processedContent,
        edited: false,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: {
          id: activeUserId,
          name:
            users.find((u) => u.id === activeUserId)?.name || 'Current User',
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
      const processedContent = await processCommentBeforeSave(
        replyContent.trim(),
        workItemId
      );
      const res = await createCommentAction({
        work_item_id: workItemId,
        content: processedContent,
        parent_id: parentId,
      });
      if (!res.success) {
        throw new Error(res.error || 'Failed to post reply');
      }
      const created = res.data!;
      setComments((prev) => [...prev, created]);
    } catch (err) {
      console.error('Failed to post reply:', err);
      // Local fallback
      const parentComment = comments.find((c) => c.id === parentId);
      const processedContent = await processCommentBeforeSave(
        replyContent.trim(),
        workItemId,
        true
      );
      const mockReply: CommentItem = {
        id: `reply-${Date.now()}`,
        work_item_id: workItemId,
        author_id: activeUserId,
        parent_id: parentId,
        content: processedContent,
        edited: false,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: {
          id: activeUserId,
          name:
            users.find((u) => u.id === activeUserId)?.name || 'Current User',
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
    if (!targetComment) {
      return;
    }

    const targetWIId = targetComment.work_item_id || newWorkItemId;
    const expectedUpdatedAt = targetComment.updated_at;
    const processedContent = await processCommentBeforeSave(
      editContent.trim(),
      targetWIId
    );

    try {
      const updated = await updateComment(
        commentId,
        processedContent,
        expectedUpdatedAt
      );
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? updated : c))
      );
    } catch (err) {
      if (
        await tryHandleLockedMutationError({
          error: err,
          handleMutationError,
          entityType: 'comment',
          entityId: commentId,
          expectedUpdatedAt,
          pendingFields: { content: processedContent },
          currentUserId: activeUserId,
        })
      ) {
        return;
      }
      console.error('Failed to update comment:', err);
    } finally {
      setEditingCommentId(null);
      setEditContent('');
    }
  };

  // Helper to locally update status of a comment in state
  const updateCommentStatusLocal = (
    commentId: string,
    status: 'active' | 'archived'
  ) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, status } : c))
    );
  };

  // Handle Archive
  const handleArchive = async (commentId: string) => {
    const targetComment = comments.find((c) => c.id === commentId);
    if (!targetComment) {
      return;
    }

    try {
      await archiveComment(commentId, targetComment.updated_at);
      updateCommentStatusLocal(commentId, 'archived');
    } catch (err) {
      if (
        await tryHandleLockedMutationError({
          error: err,
          handleMutationError,
          entityType: 'comment',
          entityId: commentId,
          expectedUpdatedAt: targetComment.updated_at,
          pendingFields: { status: 'archived' },
          currentUserId: activeUserId,
        })
      ) {
        return;
      }
      console.error('Failed to archive comment:', err);
    }
  };

  // Handle Restore
  const handleRestore = async (commentId: string) => {
    const targetComment = comments.find((c) => c.id === commentId);
    if (!targetComment) {
      return;
    }

    try {
      await restoreComment(commentId, targetComment.updated_at);
      updateCommentStatusLocal(commentId, 'active');
    } catch (err) {
      if (
        await tryHandleLockedMutationError({
          error: err,
          handleMutationError,
          entityType: 'comment',
          entityId: commentId,
          expectedUpdatedAt: targetComment.updated_at,
          pendingFields: { status: 'active' },
          currentUserId: activeUserId,
        })
      ) {
        return;
      }
      console.error('Failed to restore comment:', err);
    }
  };

  // Handle Permanent Delete
  const handleDeletePermanent = (commentId: string) => {
    setDeletingCommentId(commentId);
  };

  // Confirm and execute delete from modal
  const confirmDelete = async () => {
    if (!deletingCommentId) return;
    const targetComment = comments.find((c) => c.id === deletingCommentId);
    if (!targetComment) return;
    setIsDeleting(true);
    try {
      await archiveComment(deletingCommentId, targetComment.updated_at, true);
      setComments((prev) => prev.filter((c) => c.id !== deletingCommentId));
    } catch (err) {
      console.error('error. failed to delete comment permanently', err);
    } finally {
      setIsDeleting(false);
      setDeletingCommentId(null);
    }
  };

  return (
    <div className="space-y-6">
      {!workItemId && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-foreground text-2xl font-bold tracking-tight">
                Discussions & Comments
              </h1>
              <p className="text-muted-foreground text-sm">
                Collaborate, review feedback, and track conversation threads
                across all project work items.
              </p>
            </div>
            <Button onClick={() => setShowNewCommentModal(true)}>
              <Plus className="size-4" />
              New Comment
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatMetricCard
              label="Total Comments"
              value={stats.total}
              icon={<MessageSquareText className="size-5" />}
              iconClassName="bg-primary/10 text-primary"
            />
            <StatMetricCard
              label="Active Discussions"
              value={stats.active}
              icon={<MessageCircle className="size-5" />}
              iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            />
            <StatMetricCard
              label="Contributors"
              value={stats.authors}
              icon={<Users className="size-5" />}
              iconClassName="bg-violet-500/10 text-violet-600 dark:text-violet-400"
            />
            <StatMetricCard
              label="Discussed Items"
              value={stats.workItemsDiscussed}
              icon={<Tag className="size-5" />}
              iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            />
          </div>

          <Card>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SearchInput
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder="Search comments by text, author, or issue key..."
                className="w-full sm:max-w-70 md:max-w-90"
              />

              <div className="flex w-full flex-row items-center gap-2 sm:w-auto">
                <SearchableSelect
                  id="select-work-item-filter"
                  value={selectedWorkItemId}
                  onValueChange={setSelectedWorkItemId}
                  ariaLabel="Filter by Work Item"
                  placeholder="All Work Items"
                  className="w-1/2 sm:w-44"
                  options={[
                    { value: 'all', label: 'All Work Items' },
                    ...workItems.map((item) => ({
                      value: item.id,
                      label: `${item.key} — ${item.title.slice(0, 25)}${item.title.length > 25 ? '…' : ''}`,
                    })),
                  ]}
                />

                <Select
                  value={selectedStatus}
                  onValueChange={(value) =>
                    setSelectedStatus(value as 'all' | 'active' | 'archived')
                  }
                >
                  <SelectTrigger
                    id="select-status-filter"
                    aria-label="Filter by Status"
                    className="w-1/2 sm:w-44"
                  >
                    <SelectValue placeholder="Active Comments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active Comments</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                    <SelectItem value="all">All Statuses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {workItemId && !embedded && (
        <div className="border-border flex items-center justify-between border-b pb-2">
          <h3 className="text-foreground flex items-center gap-2 text-lg font-bold">
            <MessageSquareText className="text-primary size-5" />
            Discussion ({stats.active})
          </h3>
        </div>
      )}

      <div className="space-y-4">
        {parentComments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="space-y-3 py-12 text-center">
              <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
                <MessageSquareText className="text-muted-foreground size-6" />
              </div>
              <h3 className="text-foreground text-base font-semibold">
                No comments found
              </h3>
              <p className="text-muted-foreground mx-auto max-w-sm text-sm">
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
                  <Plus className="size-4" />
                  Add Comment
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          parentComments.map((parent) => (
            <Card
              key={parent.id}
              className={cn(
                parent.status === 'archived' && 'bg-muted/40 opacity-70'
              )}
            >
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CommentAvatar name={parent.author?.name} />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground text-sm font-semibold">
                          {parent.author?.name || 'Anonymous User'}
                        </span>
                        {parent.status === 'archived' && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          >
                            Archived
                          </Badge>
                        )}
                        {parent.edited && (
                          <span className="text-muted-foreground text-[11px] italic">
                            (edited)
                          </span>
                        )}
                      </div>

                      <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                        <Clock className="size-3 shrink-0" />
                        <span>{formatDateTime(parent.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!workItemId && parent.work_item && (
                      <Badge
                        variant="outline"
                        asChild
                        className={cn(
                          'gap-1.5 font-semibold',
                          ISSUE_BADGE_CLASS
                        )}
                      >
                        <Link href="/work-items">
                          <Tag className="size-3 shrink-0" />
                          {parent.work_item.key}
                          <ExternalLink className="size-3 opacity-60" />
                        </Link>
                      </Badge>
                    )}

                    {parent.author_id === activeUserId && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground"
                          >
                            <MoreVertical className="size-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {parent.status === 'active' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingCommentId(parent.id);
                                  // Replace @[Name](userId) with @Name, and #[KEY](id) with #KEY
                                  const rawText = parent.content
                                    .replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '@$1')
                                    .replace(
                                      /#\[([^\]]+)\]\(([^)]+)\)/g,
                                      '#$1'
                                    );
                                  setEditContent(rawText);
                                }}
                                className="gap-2"
                              >
                                <Pencil className="size-3.5" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleArchive(parent.id)}
                                className="gap-2 text-amber-600 focus:text-amber-600 dark:text-amber-400"
                              >
                                <Archive className="size-3.5" />
                                Archive
                              </DropdownMenuItem>
                            </>
                          )}
                          {parent.status === 'archived' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleRestore(parent.id)}
                                className="gap-2 text-emerald-600 focus:text-emerald-600 dark:text-emerald-400"
                              >
                                <RotateCcw className="size-3.5" />
                                Restore
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeletePermanent(parent.id)}
                                className="text-destructive focus:text-destructive gap-2"
                              >
                                <Trash2 className="size-3.5" />
                                Purge
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {editingCommentId === parent.id ? (
                  <div className="relative space-y-2 pt-1">
                    <AutocompleteInput
                      as="textarea"
                      textareaRef={editCommentRef}
                      value={editContent}
                      onChange={setEditContent}
                      users={users}
                      workItems={workItems}
                      rows={3}
                      position="bottom"
                    />
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
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-foreground pl-12 text-sm leading-relaxed">
                    {renderCommentContent(parent.content)}
                  </p>
                )}

                {!workItemId && parent.work_item && (
                  <div className="border-border bg-muted/50 text-muted-foreground ml-12 flex items-center gap-2 rounded-lg border p-2 text-xs">
                    <Building2 className="size-3.5 shrink-0" />
                    <span>
                      Item:{' '}
                      <span className="text-foreground font-medium">
                        {parent.work_item.title}
                      </span>
                    </span>
                    {parent.work_item.project && (
                      <>
                        <Separator orientation="vertical" className="h-3" />
                        <span>
                          Project:{' '}
                          <span className="text-foreground font-medium">
                            {parent.work_item.project.name}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                )}

                {parent.threadReplies.length > 0 && (
                  <div className="border-border ml-12 space-y-3 border-l-2 pt-2 pl-4">
                    {parent.threadReplies.map((reply) => (
                      <div key={reply.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground text-xs font-semibold">
                              {reply.author?.name || 'Reply User'}
                            </span>
                            <span className="text-muted-foreground text-[11px]">
                              {formatTime(reply.created_at)}
                            </span>
                          </div>
                          {reply.author_id === activeUserId && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="text-muted-foreground h-6 w-6"
                                >
                                  <MoreVertical className="size-3.5" />
                                  <span className="sr-only">Open menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingCommentId(reply.id);
                                    const rawText = reply.content
                                      .replace(
                                        /@\[([^\]]+)\]\(([^)]+)\)/g,
                                        '@$1'
                                      )
                                      .replace(
                                        /#\[([^\]]+)\]\(([^)]+)\)/g,
                                        '#$1'
                                      );
                                    setEditContent(rawText);
                                  }}
                                  className="gap-2 text-xs"
                                >
                                  <Pencil className="size-3" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleDeletePermanent(reply.id)
                                  }
                                  className="text-destructive focus:text-destructive gap-2 text-xs"
                                >
                                  <Trash2 className="size-3" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        {editingCommentId === reply.id ? (
                          <div className="relative space-y-2 pt-1">
                            <AutocompleteInput
                              as="textarea"
                              textareaRef={editCommentRef}
                              value={editContent}
                              onChange={setEditContent}
                              users={users}
                              workItems={workItems}
                              rows={2}
                              position="top"
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setEditingCommentId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="xs"
                                onClick={() => handleSaveEdit(reply.id)}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground pl-1 text-xs">
                            {renderCommentContent(reply.content)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-border ml-12 flex items-center justify-between border-t pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setReplyingParentId(
                        replyingParentId === parent.id ? null : parent.id
                      )
                    }
                    className="text-muted-foreground hover:text-primary h-8 gap-1.5 text-xs font-medium"
                  >
                    <Reply className="size-3.5" />
                    Reply
                    {parent.threadReplies.length > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {parent.threadReplies.length}
                      </Badge>
                    )}
                  </Button>
                </div>

                {replyingParentId === parent.id && (
                  <div className="relative ml-12 flex flex-col gap-2 pt-2">
                    <div className="relative flex w-full items-center gap-2">
                      <AutocompleteInput
                        as="input"
                        textareaRef={replyInputRef}
                        value={replyContent}
                        onChange={setReplyContent}
                        onSubmit={() =>
                          handleReplySubmit(parent.id, parent.work_item_id)
                        }
                        placeholder="Write a reply..."
                        users={users}
                        workItems={workItems}
                        position="top"
                      />
                      <Button
                        size="sm"
                        onClick={() =>
                          handleReplySubmit(parent.id, parent.work_item_id)
                        }
                      >
                        <Send className="size-3" />
                        Post
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setReplyingParentId(null);
                          setReplyContent('');
                        }}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        title="Cancel reply"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {workItemId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Plus className="text-primary size-4" />
              Add to discussion
            </CardTitle>
            <CardDescription>
              Use @ to mention someone or # to link a work item.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AutocompleteInput
              as="textarea"
              textareaRef={newCommentRef}
              value={newContent}
              onChange={setNewContent}
              placeholder="Share your thoughts, feedback, or update..."
              users={users}
              workItems={workItems}
              rows={3}
              position="top"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => handleCreateComment()}
                disabled={isSubmitting || !newContent.trim()}
              >
                {isSubmitting ? 'Posting...' : 'Post Comment'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showNewCommentModal} onOpenChange={setShowNewCommentModal}>
        <DialogContent
          className="sm:max-w-125"
          onPointerDownOutside={preventDismissForComboboxPortal}
          onInteractOutside={preventDismissForComboboxPortal}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareText className="text-primary size-5" />
              Post New Comment
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateComment} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="new-comment-work-item-select">
                Select Work Item
              </Label>
              <SearchableSelect
                id="new-comment-work-item-select"
                value={newWorkItemId}
                onValueChange={setNewWorkItemId}
                placeholder="Search work items…"
                options={workItems.map((item) => ({
                  value: item.id,
                  label: `[${item.key}] ${item.title}`,
                }))}
                emptyText="No matching work items."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-comment-content-textarea">Comment Text</Label>
              <AutocompleteInput
                id="new-comment-content-textarea"
                as="textarea"
                textareaRef={newCommentRef}
                value={newContent}
                onChange={setNewContent}
                placeholder="Share your thoughts, feedback, or update..."
                users={users}
                workItems={workItems}
                rows={4}
                position="top"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewCommentModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !newContent.trim()}
              >
                {isSubmitting ? 'Posting...' : 'Post Comment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {deletingCommentId !== null ? (
        <RegistryConfirmDialog
          title="Confirm Purge"
          subject="this comment"
          detail="This action cannot be undone and will permanently remove the comment record from the database."
          confirmLabel="Purge Comment"
          pendingLabel="Purging..."
          isPending={isDeleting}
          isSoft={false}
          onCancel={() => setDeletingCommentId(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
