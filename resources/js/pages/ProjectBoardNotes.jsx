import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    AlignCenter,
    AlignJustify,
    AlignLeft,
    AlignRight,
    ArrowLeft,
    Bold,
    BookOpen,
    CalendarDays,
    ExternalLink,
    Italic,
    LayoutGrid,
    Link,
    Link2,
    List,
    ListOrdered,
    Loader2,
    Pencil,
    Plus,
    Trash2,
    Underline,
    X,
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExtension from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import LinkExtension from '@tiptap/extension-link';
import { fetchAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    PROJECT_NOTE_CATEGORY_LIST,
    PROJECT_NOTE_CATEGORIES,
    getProjectNoteCategoryLabel,
} from '../utils/projectNoteCategories';

// ── helpers ──────────────────────────────────────────────────────────────────

function formatNoteTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

const CATEGORY_ICON = {
    weekly:      CalendarDays,
    development: Link2,
    document:    BookOpen,
};

const CATEGORY_COLOR = {
    weekly:      'text-violet-600 bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800',
    development: 'text-sky-600   bg-sky-50   border-sky-200   dark:bg-sky-950/30   dark:border-sky-800',
    document:    'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
};

const CATEGORY_ACTIVE_TAB = {
    weekly:      'border-violet-500   text-violet-600   bg-violet-50/50   dark:bg-violet-950/20',
    development: 'border-sky-500     text-sky-600     bg-sky-50/50     dark:bg-sky-950/20',
    document:    'border-emerald-500 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20',
};

const emptyForm = (category) => ({ category, title: '', body: '', url: '' });

function UserAvatar({ name }) {
    const initials = (name || 'U').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    return (
        <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 select-none">
            {initials}
        </div>
    );
}

function getProjectInitials(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}

function ProjectCompanyIcon({ logoUrl, projectName }) {
    if (logoUrl) {
        return (
            <img
                src={logoUrl}
                alt={projectName ? `${projectName} company logo` : 'Company logo'}
                className="size-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 bg-white shrink-0"
            />
        );
    }
    return (
        <div className="size-9 rounded-lg flex items-center justify-center bg-primary/10 text-xs font-black text-primary shrink-0">
            {getProjectInitials(projectName)}
        </div>
    );
}

// ── Rich text editor ──────────────────────────────────────────────────────────

function RichTextEditor({ content, onChange, placeholder }) {
    const [linkMenuOpen, setLinkMenuOpen] = useState(false);
    const [linkUrl, setLinkUrl]           = useState('');

    const editor = useEditor({
        extensions: [
            StarterKit,
            UnderlineExtension,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            LinkExtension.configure({
                openOnClick: false,
                HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
            }),
        ],
        content: content || '',
        onUpdate: ({ editor: e }) => {
            const html = e.getHTML();
            onChange(html === '<p></p>' ? '' : html);
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[120px] px-3 py-2 text-sm text-slate-700 dark:text-slate-200',
            },
            handleKeyDown(view, event) {
                if (event.key === 'Tab') {
                    const { state } = view;
                    const { $from } = state.selection;
                    const inList = $from.node($from.depth - 1)?.type?.name === 'listItem'
                        || $from.node($from.depth)?.type?.name === 'listItem';
                    if (inList) {
                        event.preventDefault();
                        if (event.shiftKey) {
                            view.dispatch(state.tr); // trigger liftListItem via command
                            editor?.chain().focus().liftListItem('listItem').run();
                        } else {
                            editor?.chain().focus().sinkListItem('listItem').run();
                        }
                        return true;
                    }
                }
                return false;
            },
        },
    });

    // sync external content (e.g. switching edit mode)
    useEffect(() => {
        if (!editor) return;
        const current = editor.getHTML();
        if (current !== content && content !== undefined) {
            editor.commands.setContent(content || '', false);
        }
    }, [content, editor]);

    const applyLink = () => {
        if (!editor) return;
        const url = linkUrl.trim();
        if (!url) {
            editor.chain().focus().unsetLink().run();
        } else {
            editor.chain().focus().setLink({ href: url.startsWith('http') ? url : `https://${url}` }).run();
        }
        setLinkMenuOpen(false);
        setLinkUrl('');
    };

    const openLinkMenu = () => {
        if (!editor) return;
        const existing = editor.getAttributes('link').href || '';
        setLinkUrl(existing);
        setLinkMenuOpen(true);
    };

    if (!editor) return null;

    const ToolbarBtn = ({ onClick, active, title, children }) => (
        <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onClick(); }}
            title={title}
            className={cn(
                'p-1.5 rounded text-xs transition-colors',
                active
                    ? 'bg-primary text-white'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200',
            )}
        >
            {children}
        </button>
    );

    const Sep = () => <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />;

    return (
        <div className="rounded-md border border-slate-200 dark:border-slate-700 overflow-visible focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 rounded-t-md">
                {/* Format */}
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
                    <Bold className="size-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
                    <Italic className="size-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
                    <Underline className="size-3.5" />
                </ToolbarBtn>

                <Sep />

                {/* Lists */}
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
                    <List className="size-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
                    <ListOrdered className="size-3.5" />
                </ToolbarBtn>

                <Sep />

                {/* Alignment */}
                <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
                    <AlignLeft className="size-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
                    <AlignCenter className="size-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
                    <AlignRight className="size-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
                    <AlignJustify className="size-3.5" />
                </ToolbarBtn>

                <Sep />

                {/* Link */}
                <div className="relative">
                    <ToolbarBtn onClick={openLinkMenu} active={editor.isActive('link')} title="Insert link">
                        <Link className="size-3.5" />
                    </ToolbarBtn>
                    {linkMenuOpen && (
                        <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 flex gap-1.5 min-w-[220px]">
                            <input
                                autoFocus
                                type="url"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
                                    if (e.key === 'Escape') { setLinkMenuOpen(false); setLinkUrl(''); }
                                }}
                                placeholder="https://..."
                                className="flex-1 text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-primary/40"
                            />
                            <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); applyLink(); }}
                                className="px-2 py-1 text-xs bg-primary text-white rounded hover:opacity-90"
                            >
                                OK
                            </button>
                            <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); setLinkMenuOpen(false); setLinkUrl(''); }}
                                className="px-1.5 py-1 text-xs text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                                <X className="size-3" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Editor area */}
            <div className="bg-white dark:bg-slate-900 rounded-b-md">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function ProjectBoardNotes() {
    const { projectId } = useParams();
    const navigate      = useNavigate();
    const { user }      = useAuth();
    const canUpdate     = hasPermission(user, 'project_board.update');

    const [project,     setProject]     = useState(null);
    const [pageLoading, setPageLoading] = useState(true);

    const [notes,          setNotes]          = useState([]);
    const [notesLoading,   setNotesLoading]   = useState(false);
    const [activeCategory, setActiveCategory] = useState('weekly');

    const [form,       setForm]       = useState(emptyForm('weekly'));
    const [editingId,  setEditingId]  = useState(null);
    const [saving,     setSaving]     = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [error,      setError]      = useState('');

    const meta   = PROJECT_NOTE_CATEGORIES[activeCategory];
    const isLink = meta?.isLink;

    // ── data loading ─────────────────────────────────────────────────────────

    const loadNotes = useCallback(async (pid) => {
        if (!pid) return;
        setNotesLoading(true);
        setError('');
        try {
            const res = await fetchAPI(`/projects/${pid}/notes`);
            setNotes(res.data || []);
        } catch (e) {
            setError(e.message || 'Failed to load notes.');
        } finally {
            setNotesLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!projectId) { navigate('/board'); return; }
        const load = async () => {
            setPageLoading(true);
            try {
                const res   = await fetchAPI('/projects');
                const found = (res.data || []).find((p) => p.id.toString() === projectId.toString());
                if (!found) { navigate('/board'); return; }
                setProject(found);
                await loadNotes(found.id);
            } catch (err) {
                console.error('Failed to load project notes page', err);
            } finally {
                setPageLoading(false);
            }
        };
        load();
    }, [projectId, navigate, loadNotes]);

    useEffect(() => {
        setForm(emptyForm(activeCategory));
        setEditingId(null);
        setError('');
    }, [activeCategory]);

    // ── derived ───────────────────────────────────────────────────────────────

    const notesInCategory = useMemo(
        () => notes.filter((n) => n.category === activeCategory),
        [notes, activeCategory],
    );

    const countsByCategory = useMemo(() => {
        const counts = { weekly: 0, development: 0, document: 0 };
        for (const n of notes) if (counts[n.category] !== undefined) counts[n.category]++;
        return counts;
    }, [notes]);

    // ── handlers ─────────────────────────────────────────────────────────────

    const resetForm = () => {
        setForm(emptyForm(activeCategory));
        setEditingId(null);
        setError('');
    };

    const openEdit = (note) => {
        setActiveCategory(note.category);
        setEditingId(note.id);
        setForm({ category: note.category, title: note.title || '', body: note.body || '', url: note.url || '' });
    };

    const handleSave = async () => {
        if (!project) return;
        setSaving(true);
        setError('');
        try {
            const payload = {
                category: activeCategory,
                title: form.title.trim() || null,
                body:  form.body || null,
                url:   form.url.trim()   || null,
            };
            if (editingId) {
                const res = await fetchAPI(`/projects/${project.id}/notes/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
                setNotes((prev) => prev.map((n) => (n.id === editingId ? res.data : n)));
            } else {
                const res = await fetchAPI(`/projects/${project.id}/notes`, { method: 'POST', body: JSON.stringify(payload) });
                setNotes((prev) => [res.data, ...prev]);
            }
            resetForm();
        } catch (e) {
            setError(e.message || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (noteId) => {
        if (!window.confirm('Delete this note?') || !project) return;
        setDeletingId(noteId);
        try {
            await fetchAPI(`/projects/${project.id}/notes/${noteId}`, { method: 'DELETE' });
            setNotes((prev) => prev.filter((n) => n.id !== noteId));
            if (editingId === noteId) resetForm();
        } catch (e) {
            setError(e.message || 'Failed to delete.');
        } finally {
            setDeletingId(null);
        }
    };

    // ── render ────────────────────────────────────────────────────────────────

    if (pageLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="size-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!project) return null;

    const bodyIsEmpty = !form.body || form.body === '<p></p>' || form.body.trim() === '';
    const formIsEmpty = isLink
        ? !form.title.trim() && !form.url.trim()
        : bodyIsEmpty;

    return (
        <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50 dark:bg-[#0B192C]">
            {/* ── Top bar ── */}
            <div className="relative shrink-0 bg-white/70 backdrop-blur-xl dark:bg-[#151b28]/90 border-b border-white/60 dark:border-white/10 px-4 sm:px-6 py-3">
                <div className="w-full flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={() => navigate(`/board/${projectId}`)}
                            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors shrink-0"
                        >
                            <ArrowLeft className="size-4" />
                            <span className="hidden sm:inline">Board</span>
                        </button>
                        <span className="text-slate-300 dark:text-slate-700 shrink-0">/</span>
                        <div className="flex items-center gap-2 min-w-0">
                            <ProjectCompanyIcon logoUrl={project.company_logo_url} projectName={project.name} />
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                                {project.name}
                            </span>
                        </div>
                        <span className="text-slate-300 dark:text-slate-700 shrink-0">/</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <BookOpen className="size-4 text-primary" />
                            <span className="text-sm font-semibold text-primary">Notes</span>
                        </div>
                    </div>
                    <Button
                        variant="outline" size="sm"
                        className="h-8 gap-1.5 text-slate-600 dark:text-slate-300 shrink-0"
                        onClick={() => navigate(`/board/${projectId}`)}
                    >
                        <LayoutGrid className="size-3.5" />
                        <span className="hidden sm:inline">Open Board</span>
                    </Button>
                </div>
            </div>

            {/* ── Category tab bar ── */}
            <div className="relative shrink-0 bg-white/70 backdrop-blur-xl dark:bg-[#151b28]/90 border-b border-white/60 dark:border-white/10 px-4 sm:px-6">
                <div className="w-full flex gap-1 overflow-x-auto">
                    {PROJECT_NOTE_CATEGORY_LIST.map((cat) => {
                        const Icon   = CATEGORY_ICON[cat.key] || BookOpen;
                        const active = activeCategory === cat.key;
                        return (
                            <button
                                key={cat.key}
                                type="button"
                                onClick={() => setActiveCategory(cat.key)}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
                                    active
                                        ? cn('border-current', CATEGORY_ACTIVE_TAB[cat.key])
                                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300',
                                )}
                            >
                                <Icon className="size-4 shrink-0" />
                                <span className="hidden sm:inline">{getProjectNoteCategoryLabel(cat.key)}</span>
                                {countsByCategory[cat.key] > 0 && (
                                    <Badge
                                        variant="secondary"
                                        className={cn('text-[10px] px-1.5 py-0 h-4', active && CATEGORY_COLOR[cat.key])}
                                    >
                                        {countsByCategory[cat.key]}
                                    </Badge>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Body: two-column ── */}
            <div className="relative flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">

                {/* ── Left: notes list (scrolls independently) ── */}
                <div className="flex-1 min-h-0 overflow-y-auto order-2 lg:order-1">
                    <div className="px-4 sm:px-6 py-6 space-y-3">

                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {meta?.description}
                        </p>

                        {error && (
                            <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
                                {error}
                            </p>
                        )}

                        {notesLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="size-6 animate-spin text-primary" />
                            </div>
                        ) : notesInCategory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-300/70 dark:border-white/10 rounded-xl bg-white/50 backdrop-blur-sm dark:bg-white/5">
                                {(() => { const Icon = CATEGORY_ICON[activeCategory] || BookOpen; return <Icon className="size-10 mb-3 opacity-20" />; })()}
                                <p className="text-sm font-medium">No {getProjectNoteCategoryLabel(activeCategory).toLowerCase()} yet</p>
                                <p className="text-xs mt-1">
                                    {canUpdate ? 'Use the form on the side to add one' : 'No notes in this category yet'}
                                </p>
                            </div>
                        ) : (
                            notesInCategory.map((note) => {
                                const isOwn      = Number(note.user_id) === Number(user?.id);
                                const canManage  = isOwn || canUpdate;
                                const isEditThis = editingId === note.id;

                                return (
                                    <div
                                        key={note.id}
                                        className={cn(
                                            'bg-white/70 backdrop-blur-xl dark:bg-[#151b28] rounded-xl border shadow-sm dark:shadow-xl transition-shadow hover:shadow-md',
                                            isEditThis
                                                ? 'border-primary/40 ring-2 ring-primary/15'
                                                : 'border-white/60 dark:border-white/10',
                                        )}
                                    >
                                        <div className="p-4">
                                            <div className="flex items-start gap-3">
                                                <UserAvatar name={note.user_name} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1.5">
                                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                            {note.user_name}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            {formatNoteTime(note.created_at)}
                                                        </span>
                                                    </div>
                                                    {note.title && (
                                                        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                                                            {note.title}
                                                        </p>
                                                    )}
                                                    {note.body && (
                                                        <div
                                                            className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-300"
                                                            dangerouslySetInnerHTML={{ __html: note.body }}
                                                        />
                                                    )}
                                                    {note.url && (
                                                        <a
                                                            href={note.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={cn(
                                                                'inline-flex items-center gap-1.5 text-sm font-medium hover:underline mt-2 break-all',
                                                                activeCategory === 'development' ? 'text-sky-600' : 'text-emerald-600',
                                                            )}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <ExternalLink className="size-3.5 shrink-0" />
                                                            {note.url}
                                                        </a>
                                                    )}
                                                </div>
                                                {canManage && (
                                                    <div className="flex gap-1 shrink-0">
                                                        {isEditThis ? (
                                                            <button
                                                                type="button"
                                                                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                                onClick={resetForm}
                                                                title="Cancel edit"
                                                            >
                                                                <X className="size-3.5" />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="p-1.5 rounded-md text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                                                                onClick={() => openEdit(note)}
                                                                title="Edit"
                                                            >
                                                                <Pencil className="size-3.5" />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                            onClick={() => handleDelete(note.id)}
                                                            disabled={deletingId === note.id}
                                                            title="Delete"
                                                        >
                                                            {deletingId === note.id
                                                                ? <Loader2 className="size-3.5 animate-spin" />
                                                                : <Trash2 className="size-3.5" />}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ── Right: add / edit form (fixed panel, always visible) ── */}
                {canUpdate && (
                    <div className="shrink-0 w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-t-0 lg:border-l border-white/60 dark:border-white/10 bg-white/70 backdrop-blur-xl dark:bg-[#151b28]/90 flex flex-col min-h-0 order-1 lg:order-2">
                        <div className="px-4 py-3 border-b border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/5 flex items-center justify-between shrink-0">
                            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                {editingId
                                    ? <><Pencil className="size-4 text-primary" /> Edit</>
                                    : <><Plus className="size-4 text-primary" /> Add</>}
                                <span className="font-normal text-slate-500">— {getProjectNoteCategoryLabel(activeCategory)}</span>
                            </h2>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </div>

                        <div className="p-4 space-y-3 overflow-y-auto flex-1">
                            {isLink ? (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                            Title <span className="text-rose-400">*</span>
                                        </label>
                                        <Input
                                            value={form.title}
                                            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                            placeholder="e.g. GitHub Repo, Figma Design"
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                            URL <span className="text-rose-400">*</span>
                                        </label>
                                        <Input
                                            type="url"
                                            value={form.url}
                                            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                                            placeholder="https://..."
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                            Notes
                                        </label>
                                        <Textarea
                                            value={form.body}
                                            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                                            placeholder="A short note about this link..."
                                            rows={3}
                                            className="text-sm resize-none"
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                            Title
                                        </label>
                                        <Input
                                            value={form.title}
                                            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                            placeholder="e.g. Sprint review, Kickoff meeting..."
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                            Note <span className="text-rose-400">*</span>
                                        </label>
                                        <RichTextEditor
                                            content={form.body}
                                            onChange={(html) => setForm((f) => ({ ...f, body: html }))}
                                            placeholder="Progress summary, blockers, next week's plan..."
                                        />
                                    </div>
                                </>
                            )}

                            <Button
                                className="w-full gap-2"
                                disabled={saving || formIsEmpty}
                                onClick={handleSave}
                            >
                                {saving
                                    ? <Loader2 className="size-4 animate-spin" />
                                    : editingId ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                                {editingId ? 'Save Changes' : 'Add'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
