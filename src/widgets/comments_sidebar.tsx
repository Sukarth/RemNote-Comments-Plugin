import React from 'react';
import { renderWidget, usePlugin, useTracker, AppEvents } from '@remnote/plugin-sdk';
import { listAllComments } from '../lib/comments';

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

    React.useEffect(() => {
        // Mark Comments widget as open and clear opening flag
        (async () => {
            await plugin.storage.setSession('comments_widget_open', true);
            await plugin.storage.setSession('comments_widget_opening', false);
        })();

        return () => {
            // Mark Comments widget as closed when component unmounts
            (async () => {
                await plugin.storage.setSession('comments_widget_open', false);
                await plugin.storage.setSession('comments_widget_opening', false);
            })();
        };
    }, [plugin]);

    // Periodic state verification - double-check our state is correct
    React.useEffect(() => {
        const stateVerificationInterval = setInterval(async () => {
            try {
                // If this component is running, the widget should definitely be marked as open
                const currentState = await plugin.storage.getSession<boolean>('comments_widget_open');
                if (!currentState) {
                    // If for some reason our state got out of sync, fix it
                    console.log('State verification: fixing widget state to open');
                    await plugin.storage.setSession('comments_widget_open', true);
                }
                // Always clear the opening flag if it's somehow still set
                await plugin.storage.setSession('comments_widget_opening', false);
            } catch (error) {
                console.log('State verification error:', error);
            }
        }, 2000); // Check every 2 seconds

        return () => clearInterval(stateVerificationInterval);
    }, [plugin]);

    // Listen for flash signals from the button
    React.useEffect(() => {
        let lastFlashTime = 0;

        const checkFlashSignal = async () => {
            const flashSignal = await plugin.storage.getSession<number>('comments_flash_signal');
            if (flashSignal && flashSignal > lastFlashTime) {
                lastFlashTime = flashSignal;
                setIsFlashing(true);
                setTimeout(() => setIsFlashing(false), 300); // Flash for 300ms
            }
        };

        // Check for flash signal every 100ms
        const interval = setInterval(checkFlashSignal, 100);

        return () => clearInterval(interval);
    }, [plugin]);



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
