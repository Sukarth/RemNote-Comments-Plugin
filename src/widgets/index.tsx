import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css'; // import <widget-name>.css
import { ensureCommentPowerup } from '../lib/comments';
import { createBus } from '../utils/bus';

const OPENING_TOKEN_KEY = 'comments:openingToken';

function setOpeningToken(ttlMs: number, token: string) {
  const data = { token, expires: Date.now() + ttlMs };
  sessionStorage.setItem(OPENING_TOKEN_KEY, JSON.stringify(data));
}

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

function clearOpeningToken() {
  sessionStorage.removeItem(OPENING_TOKEN_KEY);
}

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

async function openOrFlashComments(openView: () => Promise<void> | void) {
  console.log('=== openOrFlashComments called ===');
  
  // 1) If an instance is alive, flash it immediately
  console.log('Pinging for open instance...');
  if (await pingForOpenInstance(180)) {
    console.log('Found open instance, sending flash signal');
    const bus = createBus();
    bus.emit('comments:flash');
    bus.close();
    return;
  }
  
  console.log('No open instance found');

  // 2) Someone else may be in the middle of opening — avoid duplicates
  if (getOpeningTokenValid()) {
    console.log('Opening token still valid, skipping duplicate open');
    return;
  }

  // 3) We are the opener
  console.log('Setting opening token and opening view');
  const token = Math.random().toString(36).slice(2);
  setOpeningToken(1500, token);
  await Promise.resolve(openView()); // your existing call to open the widget

  // 4) Confirm it mounted; if not, clear token quickly so the next click works
  console.log('Waiting for ready signal...');
  const bus = createBus();
  const ready = await waitForEvent(bus, 'comments:ready', 800);
  bus.close();
  clearOpeningToken();
  
  if (!ready) {
    console.log('No ready signal received, view may have been closed during loading');
  } else {
    console.log('View opened and ready');
  }
}

async function onActivate(plugin: ReactRNPlugin) {
  // Register CSS to fix tile overflow for Comments pane
  await plugin.app.registerCSS('comments-tile-overflow-fix', `
    #tile__document:has(iframe[data-plugin-id="comments-plugin"]) {
      overflow-y: unset !important;
    }
  `);

  // Ensure Comment powerup exists
  await ensureCommentPowerup(plugin);

  // A command that inserts text into the editor if focused.
  // Sidebar button to open Comments sidebar
  await plugin.app.registerSidebarButton({
    id: 'open-comments-sidebar',
    name: 'Comments',
    action: async () => {
      console.log('=== Button clicked ===');

      // Debounce rapid clicks
      const lastClick = await plugin.storage.getSession<number>('comments_last_click') || 0;
      const now = Date.now();
      console.log('Last click:', lastClick, 'Now:', now, 'Diff:', now - lastClick);

      if (now - lastClick < 300) { // 300ms debounce
        console.log('Debounced - ignoring click');
        return;
      }
      await plugin.storage.setSession('comments_last_click', now);
      console.log('Click allowed, proceeding...');

      await openOrFlashComments(async () => {
        await plugin.window.openWidgetInPane('comments_sidebar');
      });
    },
  });
  
  // Register popup widget used by the add-comment command
  await plugin.app.registerWidget('add_comment_popup', WidgetLocation.Popup, {
    dimensions: { height: 'auto', width: 420 },
  });

  await plugin.app.registerCommand({
    id: 'open-comments',
    name: 'Open Comments',
    keywords: 'comment,notes,sidebar',
    description: 'Open the Comments view',
    action: async () => {
      // Debounce rapid clicks
      const lastClick = await plugin.storage.getSession<number>('comments_last_click') || 0;
      const now = Date.now();
      if (now - lastClick < 300) {
        return;
      }
      await plugin.storage.setSession('comments_last_click', now);

      await openOrFlashComments(async () => {
        await plugin.window.openWidgetInPane('comments_sidebar');
      });
    },
  });

  // Add Comment command (opens popup for the focused Rem)
  await plugin.app.registerCommand({
    id: 'add-comment',
    name: 'Add Comment to Focused Rem',
    description: 'Add a comment to the currently focused Rem',
    action: async () => {
      const sel = await plugin.editor.getSelection();
      let remId: string | undefined;
      if (sel && (sel as any).type === 'Rem') remId = (sel as any).remIds?.[0];
      if (!remId && sel && (sel as any).type === 'Text') remId = (sel as any).remId;
      if (!remId) {
        await plugin.app.toast('Focus a Rem to add a comment');
        return;
      }
      await plugin.widget.openPopup('add_comment_popup', { remId });
    },
  });

  // Register Comments widgets in a Pane (so openWidgetInPane works)
  await plugin.app.registerWidget('comments_sidebar', WidgetLocation.Pane, {
    dimensions: { height: 'auto', width: '100%' },
    widgetTabTitle: 'Comments',
  });
}

async function onDeactivate(_: ReactRNPlugin) { }

declareIndexPlugin(onActivate, onDeactivate);