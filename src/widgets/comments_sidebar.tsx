import React from 'react';
import { renderWidget, usePlugin, useTracker, AppEvents } from '@remnote/plugin-sdk';
import { listAllComments } from '../lib/comments';
import { createBus } from '../utils/bus';

function CommentsSidebar() {
    const plugin = usePlugin();

    // Use useTracker for reactive updates with debouncing for text edits
    const [lastUpdate, setLastUpdate] = React.useState(Date.now());
    const rows = useTracker(async (plugin) => {
        const items = await listAllComments(plugin);
        // sort by createdAt desc if present
        items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        return items;
    }, [lastUpdate]) || [];

    const [isLoading, setIsLoading] = React.useState(true);
    const [isFlashing, setIsFlashing] = React.useState(false);

    React.useEffect(() => {
        // Set loading to false once we have data or confirmed no data
        if (rows !== undefined) {
            setIsLoading(false);
        }
    }, [rows]);

    // Debounced refresh for text edits
    React.useEffect(() => {
        let debounceTimer: any;
        const handleTextEdit = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                setLastUpdate(Date.now());
            }, 2000);
        };

        // Listen for editor text changes
        plugin.event.addListener(AppEvents.EditorTextEdited, 'comments-text-edit', handleTextEdit);
        plugin.event.addListener(AppEvents.RemChanged, 'comments-rem-change', handleTextEdit);

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            plugin.event.removeListener(AppEvents.EditorTextEdited, 'comments-text-edit');
            plugin.event.removeListener(AppEvents.RemChanged, 'comments-rem-change');
        };
    }, [plugin]);

    // Instant ping/pong system for widget detection
    React.useEffect(() => {
        const bus = createBus();
        
        const onPing = (payload: { requestId?: string } | undefined) => {
            console.log('Received ping, sending pong with requestId:', payload?.requestId);
            bus.emit('comments:pong', payload); // echo back requestId
        };
        
        const onFlash = () => {
            console.log('Received flash request');
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 300); // Flash for 300ms
            bus.emit('comments:didFlash');
        };

        bus.on('comments:ping', onPing);
        bus.on('comments:flash', onFlash);

        // Announce readiness as soon as the widget mounts and is ready
        console.log('Widget ready, announcing readiness');
        bus.emit('comments:ready');

        return () => {
            console.log('Widget unmounting, cleaning up bus');
            bus.off('comments:ping', onPing);
            bus.off('comments:flash', onFlash);
            bus.close();
        };
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
        if (!rem) return;
        await rem.remove();
        // useTracker will automatically refresh when the rem is deleted
    };

    return (
        <div
            className="text-sm w-full"
            id='comments-sidebar'
            style={{
                width: 'calc(100% - 1.5rem)',
                backgroundColor: isFlashing ? '#ffeb3b' : 'transparent',
                transition: 'background-color 0.3s ease',
                padding: '0.75rem'
            }}
        >
            <div className="mb-2 font-semibold">Comments</div>
            {isLoading && <div>Loading…</div>}
            {!isLoading && rows.length === 0 && <div>No comments yet.</div>}
            <div className="space-y-2">
                {rows.map((r) => {
                    const fullComment = r.text || '';
                    const fullParent = r.parentName || '(unknown)';
                    const trunc = (s: string, max: number) => (s && s.length > max ? s.slice(0, max - 1) + '…' : s);
                    const commentDisp = trunc(fullComment, 20);
                    const parentDisp = trunc(fullParent, 50);
                    return (
                        <div key={r.id} className="rounded border rn-clr-border p-2 rn-clr-background-light-positive">
                            <div className="mb-1 whitespace-pre-wrap" title={fullComment}>{commentDisp}</div>
                            <div className="text-xs rn-clr-content-secondary mb-1">{r.createdAt}</div>
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-xs rn-clr-content-secondary" title={fullParent}>in: {parentDisp}</div>
                                <div className="flex gap-2">
                                    <button className="px-2 py-1 border rounded" onClick={() => gotoRem(r.parentId || r.id)}>Open</button>
                                    <button className="px-2 py-1 border rounded" onClick={() => removeComment(r.id)}>Delete</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

renderWidget(CommentsSidebar);
