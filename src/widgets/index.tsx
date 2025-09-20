import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css'; // import <widget-name>.css
import { ensureCommentPowerup } from '../lib/comments';


async function onActivate(plugin: ReactRNPlugin) {
  // Register CSS to fix tile overflow for Comments pane
  await plugin.app.registerCSS('comments-tile-overflow-fix', `
    #tile__document:has(iframe[data-plugin-id="comments-plugin"]) {
      overflow-y: unset !important;
    }
  `);

  // Ensure Comment powerup exists
  await ensureCommentPowerup(plugin);

  // Helper function to check if comments widget is actually open
  const isCommentsWidgetActuallyOpen = async (): Promise<boolean> => {
    try {
      // Try to get information about open widgets
      // This is a more reliable way to check if the widget is actually open
      const openWidgets = await plugin.window.getOpenWidgets?.() || [];
      const isOpen = openWidgets.some((widget: any) => widget.widgetId === 'comments_sidebar');
      
      // Update our stored state to match reality
      await plugin.storage.setSession('comments_widget_open', isOpen);
      
      return isOpen;
    } catch (error) {
      // Fallback: if we can't check, assume it's closed and let the user try
      console.log('Could not check widget state, assuming closed:', error);
      await plugin.storage.setSession('comments_widget_open', false);
      return false;
    }
  };

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

      if (now - lastClick < 500) { // 500ms debounce
        console.log('Debounced - ignoring click');
        return;
      }
      await plugin.storage.setSession('comments_last_click', now);
      console.log('Click allowed, proceeding...');

      // Check if we're already in the process of opening
      const commentsOpening = await plugin.storage.getSession<boolean>('comments_widget_opening');
      console.log('Comments opening:', commentsOpening);

      if (commentsOpening) {
        console.log('Already opening - ignoring click');
        return;
      }

      // Check if the widget is actually open (more reliable check)
      const isActuallyOpen = await isCommentsWidgetActuallyOpen();
      console.log('Comments actually open:', isActuallyOpen);

      if (isActuallyOpen) {
        console.log('Comments already open - sending flash signal');
        // Send a flash signal to the Comments widget to provide visual feedback
        await plugin.storage.setSession('comments_flash_signal', Date.now());
        return;
      }

      console.log('Opening new pane...');
      // Set opening flag to prevent race conditions
      await plugin.storage.setSession('comments_widget_opening', true);

      try {
        // Open new Comments pane
        await plugin.window.openWidgetInPane('comments_sidebar');
        console.log('Pane opened successfully');
      } catch (error) {
        console.log('Error opening pane:', error);
        // If opening fails, clear the opening flag
        await plugin.storage.setSession('comments_widget_opening', false);
        throw error;
      }
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
      if (now - lastClick < 500) {
        return;
      }
      await plugin.storage.setSession('comments_last_click', now);

      const commentsOpening = await plugin.storage.getSession<boolean>('comments_widget_opening');
      if (commentsOpening) {
        return;
      }

      const isActuallyOpen = await isCommentsWidgetActuallyOpen();
      if (isActuallyOpen) {
        await plugin.storage.setSession('comments_flash_signal', Date.now());
        return;
      }

      await plugin.storage.setSession('comments_widget_opening', true);

      try {
        await plugin.window.openWidgetInPane('comments_sidebar');
      } catch (error) {
        await plugin.storage.setSession('comments_widget_opening', false);
        throw error;
      }
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