import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css'; // import <widget-name>.css
import { ensureCommentPowerup } from '../lib/comments';
import { createBus } from '../utils/bus';

const OPENING_TOKEN_KEY = 'comments:openingToken';

/**
 * Sets a token in session storage to prevent multiple instances of the widget from opening.
 * @param ttlMs Time to live in milliseconds.
 * @param token The token to set.
 */
function setOpeningToken(ttlMs: number, token: string) {
    const data = { token, expires: Date.now() + ttlMs };
    sessionStorage.setItem(OPENING_TOKEN_KEY, JSON.stringify(data));
}

/**
 * Checks if a valid opening token exists.
 * @returns `true` if a valid token exists, `false` otherwise.
 */
function getOpeningTokenValid(): boolean {
    const raw = sessionStorage.getItem(OPENING_TOKEN_KEY);
    if (!raw) return false;
    try {
        const data = JSON.parse(raw);
        return typeof data.expires === 'number' && data.expires > Date.now();
    } catch {
        return false;
    }
}

/**
 * Clears the opening token from session storage.
 */
function clearOpeningToken() {
    sessionStorage.removeItem(OPENING_TOKEN_KEY);
}

/**
 * Waits for a specific event to be emitted on the event bus.
 * @param bus The event bus instance.
 * @param type The type of event to wait for.
 * @param timeoutMs The maximum time to wait for the event.
 * @returns A promise that resolves with the event payload, or `null` if the event is not received within the timeout.
 */
function waitForEvent<T = any>(bus: any, type: string, timeoutMs: number): Promise<T | null> {
    return new Promise((resolve) => {
        const on = (payload: T) => {
            clearTimeout(timer);
            bus.off(type, on as any);
            resolve(payload);
        };
        const timer = setTimeout(() => {
            bus.off(type, on as any);
            resolve(null);
        }, timeoutMs);
        bus.on(type, on as any);
    });
}

/**
 * Pings for an open instance of the widget.
 * @param timeoutMs The maximum time to wait for a response.
 * @returns A promise that resolves to `true` if an open instance is found, `false` otherwise.
 */
async function pingForOpenInstance(timeoutMs = 180): Promise<boolean> {
    const bus = createBus();
    const requestId = Math.random().toString(36).slice(2);
    const p = new Promise<boolean>((resolve) => {
        const onPong = (payload?: { requestId?: string }) => {
            if (payload?.requestId !== requestId) return;
            bus.off('comments:pong', onPong as any);
            resolve(true);
        };
        bus.on('comments:pong', onPong as any);
        bus.emit('comments:ping', { requestId });
        setTimeout(() => {
            bus.off('comments:pong', onPong as any);
            resolve(false);
        }, timeoutMs);
    });
    const res = await p;
    bus.close();
    return res;
}

/**
 * Opens the comments widget or flashes it if it is already open.
 * @param openView A function that opens the widget.
 */
async function openOrFlashComments(openView: () => Promise<void> | void) {
    if (await pingForOpenInstance(180)) {
        const bus = createBus();
        bus.emit('comments:flash');
        bus.close();
        return;
    }

    if (getOpeningTokenValid()) {
        return;
    }

    const token = Math.random().toString(36).slice(2);
    setOpeningToken(1500, token);
    await Promise.resolve(openView());

    const bus = createBus();
    const ready = await waitForEvent(bus, 'comments:ready', 800);
    bus.close();
    clearOpeningToken();
}

async function onActivate(plugin: ReactRNPlugin) {
    await plugin.app.registerCSS('comments-tile-overflow-fix', `
    #tile__document:has(iframe[data-plugin-id="remnote-comments-plugin"]) {
      overflow-y: unset !important;
    }
  `);

    const commentIconSvg = `data:image/svg+xml;base64,${globalThis.btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <style>
          .comment-icon-path { stroke: #333; stroke-width: 2; }
          @media (prefers-color-scheme: dark) {
            .comment-icon-path { stroke: #fff; }
          }
        </style>
          <path class="comment-icon-path" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <path class="comment-icon-path" d="M8 8h8M8 12h6"/>
        </svg>
    `)}`;

    await ensureCommentPowerup(plugin);

    const openComments = async () => {
        const lastClick = await plugin.storage.getSession<number>('comments_last_click') || 0;
        const now = Date.now();
        if (now - lastClick < 300) {
            return;
        }
        await plugin.storage.setSession('comments_last_click', now);
        await openOrFlashComments(async () => {
            await plugin.window.openWidgetInRightSidebar('comments_sidebar_right');
        });
    };

    await plugin.app.registerSidebarButton({
        id: 'open-comments-sidebar',
        name: 'View Comments',
        icon: commentIconSvg,
        action: openComments,
    });

    await plugin.app.registerWidget('add_comment_popup', WidgetLocation.Popup, {
        dimensions: { height: 'auto', width: 500 },
    });

    await plugin.app.registerWidget('comments_sidebar_right', WidgetLocation.RightSidebar, {
        dimensions: { height: 'auto', width: '100%' },
        widgetTabTitle: 'Comments',
        widgetTabIcon: commentIconSvg,
    });

    await plugin.app.registerCommand({
        id: 'open-comments',
        name: 'Open Comments',
        keywords: 'comment,notes,sidebar',
        description: 'Open the Comments view',
        action: async () => {
            try {
                await openComments();
            } catch (e) {
                console.error('Error opening comments pane:', e);
            }
        },
        keyboardShortcut: 'Ctrl+Shift+H',
    });

    await plugin.app.registerCommand({
        id: 'add-comment',
        name: 'Add Comment to Focused Rem',
        description: 'Add a comment to the currently focused Rem',
        action: async () => {
            try {
                const sel = await plugin.editor.getSelection();
                let remId: string | undefined;
                if (sel?.type === 'Rem') {
                    remId = sel.remIds?.[0];
                } else if (sel?.type === 'Text') {
                    remId = sel.remId;
                }

                if (!remId) {
                    await plugin.app.toast('Focus a Rem to add a comment');
                    return;
                }
                await plugin.widget.openPopup('add_comment_popup', { remId });
            } catch (e) {
                console.error('Error adding comment to Rem:', e);
            }
        },
        keyboardShortcut: 'Ctrl+Shift+G',
    });
}

async function onDeactivate(_: ReactRNPlugin) { }

declareIndexPlugin(onActivate, onDeactivate);