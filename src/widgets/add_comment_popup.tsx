import React from 'react';
import { renderWidget, usePlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { addComment } from '../lib/comments';

function AddCommentPopup() {
    const plugin = usePlugin();
    const [text, setText] = React.useState('');
    const [remId, setRemId] = React.useState<string | undefined>();
    const [remName, setRemName] = React.useState<string>('');

    React.useEffect(() => {
        (async () => {
            const ctx = await plugin.widget.getWidgetContext<WidgetLocation.Popup>();
            const rid = (ctx as any)?.contextData?.remId || (ctx as any)?.focusedRemId;
            setRemId(rid);
            if (rid) {
                const r = await plugin.rem.findOne(rid);
                if (r) setRemName(await plugin.richText.toString(r.text));
            }
        })();
    }, [plugin]);

    const onAdd = async () => {
        if (!remId) { await plugin.app.toast('No focused Rem'); return; }
        await addComment(plugin, remId, text.trim());
        // proactively notify listeners
        try { await plugin.messaging.broadcast({ type: 'comments_dirty', ts: Date.now() }); } catch { }
        setText('');
        await plugin.widget.closePopup();
    };

    const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onAdd();
        }
    };
    const taRef = React.useRef<HTMLTextAreaElement | null>(null);

    const autosize = React.useCallback(() => {
        const el = taRef.current;
        if (!el) return;
        const maxH = Math.max(160, Math.floor(window.innerHeight * 0.5));
        el.style.height = 'auto';
        const newH = Math.min(el.scrollHeight, maxH);
        el.style.height = newH + 'px';
        el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
    }, []);

    React.useEffect(() => { autosize(); }, [text, autosize]);
    React.useEffect(() => {
        const onResize = () => autosize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [autosize]);


    return (
        <div className="p-3 rn-clr-background-light-positive">
            <div className="font-semibold mb-1">Add a comment</div>
            {remName && <div className="text-xs rn-clr-content-secondary mb-2">to: {remName}</div>}
            <textarea
                ref={taRef}
                className="w-full border rounded px-2 py-2 mb-3"
                rows={1}
                placeholder="Type your comment. Press Enter to submit, Shift+Enter for a new line"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                style={{ resize: 'none', overflow: 'hidden' }}
            />
            <div className="flex gap-2 justify-end">
                <button className="px-3 py-1 border rounded" onClick={() => plugin.widget.closePopup()}>Cancel</button>
                <button className="px-3 py-1 border rounded" onClick={onAdd} disabled={!text.trim()}>Add</button>
            </div>
        </div>
    );
}

renderWidget(AddCommentPopup);

