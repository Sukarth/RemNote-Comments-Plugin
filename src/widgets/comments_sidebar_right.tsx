import React from 'react';
import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { listAllComments } from '../lib/comments';
import { createBus } from '../utils/bus';
import '../style.css';
import '../index.css';

/**
 * A widget that displays a list of all comments in the knowledge base.
 */
export function RightSidebarComments() {
    const plugin = usePlugin();

    // Debounced-driven update flag
    const [lastUpdate, setLastUpdate] = React.useState(Date.now());
    const [rows, setRows] = React.useState<any[]>([]);
    const [sortMode, setSortMode] = React.useState<'newest' | 'oldest' | 'parentName'>('newest');

    // Load persisted sort mode on mount
    React.useEffect(() => {
        (async () => {
            try {
                const saved = await plugin.storage.getSession<string>('comments_sort_mode');
                if (saved === 'newest' || saved === 'oldest' || saved === 'parentName') {
                    setSortMode(saved);
                }
            } catch { /* ignore */ }
        })();
    }, [plugin]);

    // Persist sort mode changes
    const setSortModeWithPersist = React.useCallback(async (mode: 'newest' | 'oldest' | 'parentName') => {
        setSortMode(mode);
        try {
            await plugin.storage.setSession('comments_sort_mode', mode);
        } catch { /* ignore */ }
    }, [plugin]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isFlashing, setIsFlashing] = React.useState(false);
    const [isManualRefreshing, setIsManualRefreshing] = React.useState(false);
    const manualRefreshStartRef = React.useRef<number>(0);

    // Manual fetch tied only to debounced lastUpdate changes
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            setIsLoading(prev => prev && rows.length === 0); // only show loading spinner on first load
            try {
                console.log('[RightSidebarComments] manual fetch triggered (debounced).');
                const items = await listAllComments(plugin);
                if (!cancelled) {
                    setRows(items);
                    setIsLoading(false);
                    // IMPORTANT: keep caches in sync IMMEDIATELY with the fetched authoritative list
                    const newCommentIds = new Set<string>();
                    const newParentIds = new Set<string>();
                    for (const item of items) {
                        if (item.id) newCommentIds.add(item.id);
                        if (item.parentId) newParentIds.add(item.parentId);
                    }
                    commentRemIds.current = newCommentIds;
                    parentRemIds.current = newParentIds;
                    // If this fetch was triggered by a manual refresh, enforce minimum spinner duration
                    if (isManualRefreshing) {
                        const elapsed = Date.now() - manualRefreshStartRef.current;
                        const remaining = 1000 - elapsed; // 1s min
                        if (remaining > 0) {
                            setTimeout(() => setIsManualRefreshing(false), remaining);
                        } else {
                            setIsManualRefreshing(false);
                        }
                    }
                }
            } catch (e) {
                if (!cancelled) setIsLoading(false);
                if (isManualRefreshing) {
                    const elapsed = Date.now() - manualRefreshStartRef.current;
                    const remaining = 1000 - elapsed;
                    if (remaining > 0) {
                        setTimeout(() => setIsManualRefreshing(false), remaining);
                    } else {
                        setIsManualRefreshing(false);
                    }
                }
            }
        })();
        return () => { cancelled = true; };
    }, [lastUpdate, plugin, isManualRefreshing]);

    // Cache comment Rem IDs and parent Rem IDs to avoid processing every single rem edit
    const commentRemIds = React.useRef<Set<string>>(new Set());
    const parentRemIds = React.useRef<Set<string>>(new Set());
    const throttleRef = React.useRef<any>(null);

    // Debounced refresh for comment Rem changes - only process known comment Rems
    const pendingRef = React.useRef<Map<string, { timer: any; text: string }>>(new Map());
    // Debounced refresh for parent Rem changes
    const pendingParentRef = React.useRef<Map<string, { timer: any; text: string }>>(new Map());
    // Cache of last known parent text to avoid unnecessary refresh due to unrelated property changes
    const parentTextCache = React.useRef<Map<string, string>>(new Map());
    const commentPowerupIdRef = React.useRef<string | null>(null);

    // Fetch and cache the comment powerup id once
    React.useEffect(() => {
        (async () => {
            try {
                const pw = await plugin.powerup.getPowerupByCode('comment');
                if (pw?._id) commentPowerupIdRef.current = pw._id;
            } catch { /* ignore */ }
        })();
    }, [plugin]);

    // Update cache of comment Rem IDs
    const updateCommentCache = React.useCallback(async () => {
        try {
            const items = await listAllComments(plugin);
            const newCommentIds = new Set<string>();
            const newParentIds = new Set<string>();
            for (const item of items) {
                if (item.id) newCommentIds.add(item.id);
                if (item.parentId) newParentIds.add(item.parentId);
            }
            commentRemIds.current = newCommentIds;
            parentRemIds.current = newParentIds;
            console.log('[RightSidebarComments] Updated caches with', newCommentIds.size, 'comment Rems and', newParentIds.size, 'parent Rems');
        } catch (err) {
            console.error('[RightSidebarComments] Error updating comment/parent cache:', err);
        }
    }, [plugin]);

    // Initialize cache when component mounts and refresh periodically
    React.useEffect(() => {
        updateCommentCache();
        const interval = setInterval(updateCommentCache, 30000);
        return () => clearInterval(interval);
    }, [updateCommentCache]);

    // Throttled event handler to reduce CPU spikes
    const handleRemChange = React.useCallback(async (remId: string) => {
        if (!commentRemIds.current.has(remId)) {
            return;
        }

        const rem = await plugin.rem.findOne(remId);
        if (!rem) {
            // If the rem is gone (deleted), purge from cache and refresh immediately
            if (commentRemIds.current.delete(remId)) {
                console.log('[RightSidebarComments] Comment rem deleted, refreshing list');
                setLastUpdate(Date.now());
            }
            return;
        }

        const currentPwText = await rem.getPowerupProperty?.('comment', 'text');
        const liveText = await plugin.richText.toString(rem.text);

        // If powerup property missing now -> untagged, remove from list
        if (currentPwText === undefined || currentPwText === null) {
            if (commentRemIds.current.delete(remId)) {
                console.log('[RightSidebarComments] Comment powerup removed (untagged). Forcing refresh.');
                setLastUpdate(Date.now());
            }
            return;
        }

        const pending = pendingRef.current.get(remId);
        if (!pending && liveText === currentPwText) {
            return; // nothing changed
        }

        if (pending && pending.timer) {
            clearTimeout(pending.timer);
        }

        const timer = setTimeout(async () => {
            try {
                const latestRem = await plugin.rem.findOne(remId);
                if (!latestRem) {
                    if (commentRemIds.current.delete(remId)) {
                        console.log('[RightSidebarComments] Comment rem deleted during debounce flush. Refreshing.');
                        setLastUpdate(Date.now());
                    }
                    return;
                }
                const latestLiveText = await plugin.richText.toString(latestRem.text);
                const latestPwText = await latestRem.getPowerupProperty?.('comment', 'text');

                if (latestPwText === undefined || latestPwText === null) {
                    if (commentRemIds.current.delete(remId)) {
                        console.log('[RightSidebarComments] Powerup removed during debounce flush. Refreshing.');
                        setLastUpdate(Date.now());
                    }
                } else if (latestLiveText === latestPwText) {
                    console.log('[RightSidebarComments] No change since last check; skipping write for remId:', remId);
                } else {
                    console.log('[RightSidebarComments] Writing updated powerup text for remId:', remId);
                    await latestRem.setPowerupProperty('comment', 'text', [latestLiveText || '']);
                    await latestRem.setPowerupProperty('comment', 'createdAt', [new Date().toISOString()]);
                }

                setLastUpdate(Date.now());
            } catch (err) {
                console.error('[RightSidebarComments] Error while flushing pending text for remId:', remId, err);
            } finally {
                pendingRef.current.delete(remId);
            }
        }, 2000);

        pendingRef.current.set(remId, { timer, text: liveText });
    }, [plugin]);

    // Debounced handler for parent Rem edits
    const handleParentRemChange = React.useCallback(async (remId: string) => {
        if (!parentRemIds.current.has(remId)) return;

        const rem = await plugin.rem.findOne(remId);
        if (!rem) return;
        const liveText = await plugin.richText.toString(rem.text || []);
        const lastCached = parentTextCache.current.get(remId);

        const pending = pendingParentRef.current.get(remId);
        if (!pending && lastCached === liveText) return;

        if (pending && pending.timer) clearTimeout(pending.timer);

        const timer = setTimeout(async () => {
            try {
                const latestRem = await plugin.rem.findOne(remId);
                if (!latestRem) return;
                const latestLiveText = await plugin.richText.toString(latestRem.text || []);
                const prev = parentTextCache.current.get(remId);
                if (prev !== latestLiveText) {
                    parentTextCache.current.set(remId, latestLiveText);
                    setLastUpdate(Date.now());
                }
            } catch (e) {
                console.error('[RightSidebarComments] Error flushing parent text for remId', remId, e);
            } finally {
                pendingParentRef.current.delete(remId);
            }
        }, 2000);

        pendingParentRef.current.set(remId, { timer, text: liveText });
    }, [plugin]);

    // Register listener with throttling
    require('@remnote/plugin-sdk').useAPIEventListener(
        require('@remnote/plugin-sdk').AppEvents.GlobalRemChanged,
        undefined,
        (data: any) => {
            const remId = data?.remId;
            if (!remId) return;
            const hasComment = commentRemIds.current.has(remId);
            const hasParent = parentRemIds.current.has(remId);

            // If we don't already track it as a comment, check if it JUST gained the tag (faster + avoids property reliance)
            if (!hasComment) {
                (async () => {
                    try {
                        const rem = await plugin.rem.findOne(remId);
                        if (!rem) return;
                        const pwId = commentPowerupIdRef.current;
                        if (pwId) {
                            // getTagRems returns Rem[] of tag Rems applied to this rem
                            const tagRems = await rem.getTagRems?.();
                            if (Array.isArray(tagRems) && tagRems.some(t => t._id === pwId)) {
                                console.log('[RightSidebarComments] Newly tagged comment rem detected via getTagRems:', remId);
                                commentRemIds.current.add(remId);
                                setLastUpdate(Date.now());
                            }
                        }
                    } catch { /* ignore */ }
                })();
            }

            // If neither tracked comment nor parent (after possible tagging), bail
            const effectiveIsComment = commentRemIds.current.has(remId);
            const effectiveIsParent = hasParent; // Parent membership can't change w/o refresh
            if (!effectiveIsComment && !effectiveIsParent) return;

            if (throttleRef.current) clearTimeout(throttleRef.current);
            throttleRef.current = setTimeout(() => {
                if (effectiveIsComment) handleRemChange(remId);
                if (effectiveIsParent) handleParentRemChange(remId);
            }, 100);
        }
    );

    // Cleanup timers
    React.useEffect(() => {
        return () => {
            pendingRef.current.forEach(v => clearTimeout(v.timer));
            pendingRef.current.clear();
            pendingParentRef.current.forEach(v => clearTimeout(v.timer));
            pendingParentRef.current.clear();
            if (throttleRef.current) clearTimeout(throttleRef.current);
        };
    }, []);

    // Listen for real-time comment updates via bus
    React.useEffect(() => {
        const bus = createBus();
        const onCommentsUpdated = (data: any) => {
            console.log('[RightSidebarComments] Received comment update:', data);
            setLastUpdate(Date.now());
        };
        bus.on('comments:updated', onCommentsUpdated);
        return () => {
            bus.off('comments:updated', onCommentsUpdated);
            bus.close();
        };
    }, []);

    // Session storage dirty flag listener
    React.useEffect(() => {
        let lastDirtyTime = 0;
        const checkDirtyFlag = async () => {
            try {
                const dirtyTime = await plugin.storage.getSession<number>('comments_dirty') || 0;
                if (dirtyTime > lastDirtyTime) {
                    lastDirtyTime = dirtyTime;
                    console.log('[RightSidebarComments] Session storage dirty flag detected, refreshing');
                    setLastUpdate(Date.now());
                }
            } catch { }
        };
        const interval = setInterval(checkDirtyFlag, 500);
        return () => clearInterval(interval);
    }, [plugin]);

    // Ping/pong + flash highlight + readiness announcement
    React.useEffect(() => {
        const bus = createBus();
        const onPing = (payload: { requestId?: string } | undefined) => {
            bus.emit('comments:pong', payload);
        };
        const onFlash = () => {
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 300);
            bus.emit('comments:didFlash');
        };
        bus.on('comments:ping', onPing);
        bus.on('comments:flash', onFlash);
        bus.emit('comments:ready');
        return () => {
            bus.off('comments:ping', onPing);
            bus.off('comments:flash', onFlash);
            bus.close();
        };
    }, []);

    // Safety periodic refresh (every 60s) to catch any missed edge cases
    React.useEffect(() => {
        const interval = setInterval(() => {
            console.log('[RightSidebarComments] Safety interval refresh');
            setLastUpdate(Date.now());
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    const gotoRem = async (remId?: string) => {
        const id = remId || undefined;
        if (!id) return;
        const rem = await plugin.rem.findOne(id);
        if (rem) {
            await plugin.window.openRem(rem);
        }
    };

    const removeComment = async (id: string) => {
        const rem = await plugin.rem.findOne(id);
        if (!rem) {
            if (commentRemIds.current.delete(id)) setLastUpdate(Date.now());
            return;
        }
        try {
            await rem.remove();
        } finally {
            // Ensure it's gone from cache immediately and trigger refresh
            if (commentRemIds.current.delete(id)) {
                setLastUpdate(Date.now());
            } else {
                // Still force refresh to resync list ordering/count
                setLastUpdate(Date.now());
            }
        }
    };

    const formatDate = React.useCallback((iso?: string) => {
        if (!iso) return '';
        try { return new Date(iso).toLocaleString(); } catch { return iso; }
    }, []);

    // Mouse tracking for dynamic glow effect
    const updateGlowPosition = React.useCallback((e: React.MouseEvent, element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        requestAnimationFrame(() => {
            element.style.setProperty('--cmt-mx', `${x}%`);
            element.style.setProperty('--cmt-my', `${y}%`);
        });
    }, []);

    const clearGlowPosition = React.useCallback((element: HTMLElement) => {
        requestAnimationFrame(() => {
            element.style.removeProperty('--cmt-mx');
            element.style.removeProperty('--cmt-my');
        });
    }, []);

    // Derived sorted rows based on sortMode
    const sortedRows = React.useMemo(() => {
        const copy = [...rows];
        if (sortMode === 'newest') {
            copy.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        } else if (sortMode === 'oldest') {
            copy.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        } else if (sortMode === 'parentName') {
            copy.sort((a, b) => (a.parentName || '').localeCompare(b.parentName || ''));
        }
        return copy;
    }, [rows, sortMode]);

    return (
        <div
            className="text-sm w-full h-full overflow-y-auto rn-clr-background-primary"
            id='comments-sidebar-right'
            style={{
                backgroundColor: isFlashing ? '#ffeb3b' : 'transparent',
                transition: 'background-color 0.3s ease',
                padding: '0.75rem'
            }}
        >
            <style>{`
                        :root {
                            --cmt-border: rgba(120,120,120,.35);
                            --cmt-bg: rgba(255,255,255,0.04);
                            --cmt-bg-hover: rgba(127,127,127,.08);
                            --cmt-bg-active: rgba(127,127,127,.15);
                            --cmt-primary-bg: rgba(120,180,255,.15);
                            --cmt-primary-bg-hover: rgba(120,180,255,.25);
                            --cmt-primary-bg-active: rgba(120,180,255,.32);
                            --cmt-danger-bg: rgba(244,63,94,.10);
                            --cmt-danger-bg-hover: rgba(244,63,94,.18);
                            --cmt-danger-bg-active: rgba(244,63,94,.25);
                            --cmt-danger-color: #b91c1c;
                        }
                        @media (prefers-color-scheme: dark) {
                            :root {
                                --cmt-border: rgba(180,180,180,.30);
                                --cmt-bg: rgba(255,255,255,.02);
                                --cmt-bg-hover: rgba(255,255,255,.08);
                                --cmt-bg-active: rgba(255,255,255,.14);
                                --cmt-primary-bg: rgba(120,180,255,.22);
                                --cmt-primary-bg-hover: rgba(120,180,255,.30);
                                --cmt-primary-bg-active: rgba(120,180,255,.38);
                                --cmt-danger-bg: rgba(244,63,94,.18);
                                --cmt-danger-bg-hover: rgba(244,63,94,.26);
                                --cmt-danger-bg-active: rgba(244,63,94,.34);
                            }
                        }
                        .cmt-btn { 
                            position:relative; display:inline-flex; align-items:center; justify-content:center;
                            font-size:.70rem; font-weight:500; line-height:1; padding:.45rem .7rem; border-radius:.45rem;
                            border:1px solid var(--cmt-border); background:var(--cmt-bg); color:inherit; cursor:pointer; user-select:none;
                            transition:background-color .15s ease, border-color .15s ease, color .15s ease, transform .15s ease;
                        }
                        .cmt-btn:hover { background:var(--cmt-bg-hover); }
                        .cmt-btn:active { background:var(--cmt-bg-active); transform:translateY(1px); }
                        .cmt-btn:focus { outline:none; }
                        .cmt-btn[disabled] { opacity:.55; cursor:not-allowed; }
                        .cmt-btn--primary { background:var(--cmt-primary-bg); border-color:var(--cmt-primary-bg-hover); }
                        .cmt-btn--primary:hover { background:var(--cmt-primary-bg-hover); }
                        .cmt-btn--primary:active { background:var(--cmt-primary-bg-active); }
                        .cmt-btn--danger { background:var(--cmt-danger-bg); border-color:var(--cmt-danger-bg-hover); color:var(--cmt-danger-color); }
                        .cmt-btn--danger:hover { background:var(--cmt-danger-bg-hover); }
                        .cmt-btn--danger:active { background:var(--cmt-danger-bg-active); }
                        .cmt-btn--seg { border-radius:.35rem; padding:.40rem .6rem; }
                        .cmt-btn--seg.cmt-btn--active { background:var(--cmt-primary-bg); border-color:var(--cmt-primary-bg-hover); }
                                    /* Comment card styling */
                                    .cmt-card {
                                        position:relative; border:1px solid var(--cmt-border); border-radius:.55rem; padding:.6rem .65rem;
                                        background:linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02));
                                        transition:background-color .18s ease, border-color .18s ease, transform .18s ease, box-shadow .18s ease;
                                    }
                                    .cmt-card:hover {
                                        background:linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025));
                                        border-color: var(--cmt-primary-bg-hover);
                                    }
                                    .cmt-card:active { transform:translateY(1px); }
                                    .cmt-card:before {
                                        content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
                                        background:radial-gradient(circle at var(--cmt-mx, 50%) var(--cmt-my, 50%), rgba(120,180,255,.18), transparent 70%);
                                        opacity:0; transition:opacity .25s ease;
                                    }
                                    .cmt-card:hover:before { opacity:.55; }
                                    @media (prefers-color-scheme: dark) {
                                        .cmt-card { background:linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015)); }
                                        .cmt-card:hover { background:linear-gradient(145deg, rgba(255,255,255,0.085), rgba(255,255,255,0.025)); }
                                        .cmt-card:before { background:radial-gradient(circle at var(--cmt-mx, 50%) var(--cmt-my, 50%), rgba(120,180,255,.28), transparent 70%); }
                                    }
                        `}</style>
            <div className="mb-2 font-semibold rn-clr-content-primary flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span>Comments</span>
                    <button
                        className="relative cmt-btn cmt-btn--primary overflow-hidden"
                        disabled={isManualRefreshing}
                        onClick={() => {
                            if (isManualRefreshing) return;
                            manualRefreshStartRef.current = Date.now();
                            setIsManualRefreshing(true);
                            console.log('[RightSidebarComments] Manual refresh button clicked');
                            setLastUpdate(Date.now());
                        }}
                    >
                        <span className={`transition-opacity duration-150 ${isManualRefreshing ? 'opacity-0' : 'opacity-100'}`}>Refresh</span>
                        <span
                            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${isManualRefreshing ? 'opacity-100' : 'opacity-0'}`}
                            aria-hidden={!isManualRefreshing}
                        >
                            {/* Inline SVG spinner */}
                            <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                            </svg>
                        </span>
                    </button>
                </div>
                <div className="flex items-center gap-1 text-xs font-normal flex-wrap">
                    <span className="mr-1 rn-clr-content-secondary">Sort:</span>
                    <button
                        className={`cmt-btn cmt-btn--seg ${sortMode === 'newest' ? 'cmt-btn--active' : ''}`}
                        onClick={() => setSortModeWithPersist('newest')}
                        aria-pressed={sortMode === 'newest'}
                    >Newest</button>
                    <button
                        className={`cmt-btn cmt-btn--seg ${sortMode === 'oldest' ? 'cmt-btn--active' : ''}`}
                        onClick={() => setSortModeWithPersist('oldest')}
                        aria-pressed={sortMode === 'oldest'}
                    >Oldest</button>
                    <button
                        className={`cmt-btn cmt-btn--seg ${sortMode === 'parentName' ? 'cmt-btn--active' : ''}`}
                        onClick={() => setSortModeWithPersist('parentName')}
                        aria-pressed={sortMode === 'parentName'}
                    >Parent Name</button>
                </div>
            </div>
            {isLoading && <div className="rn-clr-content-secondary">Loading…</div>}
            {!isLoading && rows.length === 0 && <div className="rn-clr-content-secondary">No comments yet.</div>}
            <div className="space-y-2">
                {sortedRows.map((r) => {
                    const fullCommentRaw = (r.text ?? '').trim();
                    const isEmpty = fullCommentRaw.length === 0;
                    const fullComment = isEmpty ? 'Empty Comment' : fullCommentRaw;
                    const fullParent = r.parentName || '(unknown)';
                    const trunc = (s: string, max: number) => (s && s.length > max ? s.slice(0, max - 1) + '…' : s);
                    const commentDisp = trunc(fullComment, 60);
                    const parentDisp = trunc(fullParent, 50);
                    return (
                        <div
                            key={r.id}
                            className="cmt-card"
                            onMouseMove={(e) => updateGlowPosition(e, e.currentTarget)}
                            onMouseLeave={(e) => clearGlowPosition(e.currentTarget)}
                        >
                            <div className="mb-1 whitespace-pre-wrap break-words" title={fullComment}>{commentDisp}</div>
                            <div className="text-xs rn-clr-content-secondary mb-1">{formatDate(r.createdAt)}</div>
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-xs rn-clr-content-secondary truncate" title={fullParent}>in: {parentDisp}</div>
                                <div className="flex gap-2">
                                    <button
                                        className="cmt-btn"
                                        onClick={() => gotoRem(r.parentId || r.id)}
                                    >Open</button>
                                    <button
                                        className="cmt-btn cmt-btn--danger"
                                        onClick={() => removeComment(r.id)}
                                    >Delete</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

renderWidget(RightSidebarComments);
