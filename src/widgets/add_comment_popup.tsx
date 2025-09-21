import React from 'react';
import { renderWidget, usePlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { addComment } from '../lib/comments';
import '../style.css';

/**
 * A popup widget for adding a comment to a Rem.
 */
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

    const lineHeightRef = React.useRef<number | null>(null);
    const autosize = React.useCallback(() => {
        const el = taRef.current;
        if (!el) return;
        if (!lineHeightRef.current) {
            const cs = window.getComputedStyle(el);
            const lh = parseFloat(cs.lineHeight || '0') || 18; // fallback
            lineHeightRef.current = lh;
        }
        const maxH = Math.max(160, Math.floor(window.innerHeight * 0.5));
        const minH = (lineHeightRef.current || 18) * 2 + 10; // two lines plus small padding fudge
        el.style.height = 'auto';
        let desired = el.scrollHeight;
        if (desired < minH) desired = minH;
        if (desired > maxH) desired = maxH;
        el.style.height = desired + 'px';
        el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
    }, []);

    React.useEffect(() => { autosize(); }, [text, autosize]);
    React.useEffect(() => {
        const onResize = () => autosize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [autosize]);


    const truncatedParent = React.useMemo(() => {
        if (!remName) return '';
        const max = 60;
        return remName.length > max ? remName.slice(0, max - 1) + '…' : remName;
    }, [remName]);

    // Mouse tracking for popup glow effect (same as comment cards)
    const updatePopupGlowPosition = React.useCallback((e: React.MouseEvent, element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        requestAnimationFrame(() => {
            element.style.setProperty('--cmt-mx', `${x}%`);
            element.style.setProperty('--cmt-my', `${y}%`);
        });
    }, []);

    const clearPopupGlowPosition = React.useCallback((element: HTMLElement) => {
        requestAnimationFrame(() => {
            element.style.removeProperty('--cmt-mx');
            element.style.removeProperty('--cmt-my');
        });
    }, []);

    return (
        <div
            className="cmt-popup-container"
            onMouseMove={(e) => updatePopupGlowPosition(e, e.currentTarget)}
            onMouseLeave={(e) => clearPopupGlowPosition(e.currentTarget)}
        >
            {}
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
                        .comment-textarea { font-family: inherit; font-size: inherit; line-height: inherit; opacity:.65; color: #232329; }
                        /* Popup container styling - matches comment cards */
                        .cmt-popup-container {
                            position:relative; border:1px solid var(--cmt-border); border-radius:.75rem; padding:1.4rem;
                            background:linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02));
                            transition:background-color .18s ease, border-color .18s ease, box-shadow .18s ease;
                        }
                        .cmt-popup-container:before {
                            content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
                            background:radial-gradient(circle at var(--cmt-mx, 50%) var(--cmt-my, 50%), rgba(120,180,255,.12), transparent 70%);
                            opacity:0; transition:opacity .25s ease;
                        }
                        .cmt-popup-container:hover:before { opacity:.45; }
                        @media (prefers-color-scheme: dark) {
                            .cmt-popup-container { background:linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015)); }
                            .cmt-popup-container:before { background:radial-gradient(circle at var(--cmt-mx, 50%) var(--cmt-my, 50%), rgba(120,180,255,.22), transparent 70%); }
                        }
                        .cmt-btn { 
                            position:relative; display:inline-flex; align-items:center; justify-content:center; gap:.35rem;
                            font-size:.70rem; font-weight:500; letter-spacing:.25px; line-height:1;
                            padding:.45rem .75rem; border-radius:.45rem; border:1px solid var(--cmt-border);
                            background:var(--cmt-bg); color:inherit; cursor:pointer; user-select:none;
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
                        `}</style>
            <div className="font-semibold mb-1">Add a comment</div>
            {remName && (
                <div className="text-xs rn-clr-content-secondary mb-2" title={remName}>
                    to: {truncatedParent}
                </div>
            )}
            <textarea
                ref={taRef}
                className="w-full border rounded px-2 py-2 mb-3 comment-textarea"
                rows={2}
                placeholder="Type your comment. Press Enter to submit, Shift+Enter for a new line"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                style={{ resize: 'none', overflow: 'hidden' }}
            />
            <div className="flex gap-2 justify-end">
                <button className="cmt-btn" onClick={() => plugin.widget.closePopup()}>Cancel</button>
                <button className="cmt-btn cmt-btn--primary" onClick={onAdd} disabled={!text.trim()}>Add</button>
            </div>
        </div>
    );
}

renderWidget(AddCommentPopup);

