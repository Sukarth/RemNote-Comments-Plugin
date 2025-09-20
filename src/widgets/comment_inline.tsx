import React from 'react';
import { renderWidget, usePlugin, useTracker, SelectionType } from '@remnote/plugin-sdk';
import { addComment, listAllComments, CommentRow } from '../lib/comments';

function CommentInline() {
    const plugin = usePlugin();

    const sel = useTracker(async (rp) => {
        const s = await rp.editor.getSelection();
        return s;
    });

    const currentRemId: string | undefined = (() => {
        if (!sel) return undefined;
        if ((sel as any).type === SelectionType.Rem) {
            return (sel as any).remIds?.[0];
        }
        if ((sel as any).type === SelectionType.Text) {
            return (sel as any).remId;
        }
        return undefined;
    })();

    const [val, setVal] = React.useState('');
    const [rows, setRows] = React.useState<CommentRow[]>([]);

    const load = React.useCallback(async () => {
        if (!currentRemId) { setRows([]); return; }
        const all = await listAllComments(plugin);
        setRows(all.filter(r => r.parentId === currentRemId));
    }, [plugin, currentRemId]);

    React.useEffect(() => { load(); }, [load]);

    const onAdd = async () => {
        if (!currentRemId) { await plugin.app.toast('Focus a Rem to add a comment.'); return; }
        await addComment(plugin, currentRemId, val);
        setVal('');
        await load();
    };

    return (
        <div className="p-2 text-sm">
            <div className="font-semibold mb-2">Comments for this Rem</div>
            {!currentRemId && <div className="text-gray-500">Focus a Rem to add/view comments.</div>}
            {currentRemId && (
                <div className="mb-2 flex gap-2">
                    <input className="flex-1 border rounded px-2 py-1" placeholder="Add a comment..." value={val} onChange={e => setVal(e.target.value)} />
                    <button className="px-2 py-1 border rounded" onClick={onAdd}>Add</button>
                </div>
            )}
            <div className="space-y-2">
                {rows.map(r => (
                    <div key={r.id} className="border rounded p-2">
                        <div className="whitespace-pre-wrap">{r.text}</div>
                        <div className="text-xs text-gray-500 mt-1">{r.createdAt}</div>
                    </div>
                ))}
                {currentRemId && rows.length === 0 && <div className="text-gray-500">No comments yet.</div>}
            </div>
        </div>
    );
}

renderWidget(CommentInline);

