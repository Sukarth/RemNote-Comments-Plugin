import { RNPlugin } from '@remnote/plugin-sdk';
import { createBus } from '../utils/bus';

/**
 * Idempotently registers the Comment powerup with hidden slots for storage.
 * @param plugin The plugin instance.
 */
export async function ensureCommentPowerup(plugin: RNPlugin) {
    await plugin.app.registerPowerup(
        'Comment',
        'comment',
        'Marks a Rem as a comment and stores metadata.',
        {
            slots: [
                { code: 'text', name: 'Text', hidden: true, onlyProgrammaticModifying: true },
                { code: 'createdAt', name: 'Created At', hidden: true, onlyProgrammaticModifying: true },
                { code: 'author', name: 'Author', hidden: true, onlyProgrammaticModifying: true }
            ]
        }
    );
}

/**
 * Adds a comment to a Rem.
 * @param plugin The plugin instance.
 * @param parentRemId The ID of the Rem to add the comment to.
 * @param text The text of the comment.
 * @param author The author of the comment.
 */
export async function addComment(plugin: RNPlugin, parentRemId: string, text: string, author?: string) {
    if (!text?.trim()) {
        await plugin.app.toast('Please enter a comment.');
        return;
    }

    const commentRem = await plugin.rem.createRem();
    if (!commentRem) {
        await plugin.app.toast('Failed to create comment.');
        return;
    }

    await commentRem.setText([text]);
    await commentRem.setParent(parentRemId);

    const pw = await plugin.powerup.getPowerupByCode('comment');
    const createdAt = new Date().toISOString();

    if (pw?._id) {
        await commentRem.addTag(pw._id);
        await commentRem.setPowerupProperty('comment', 'text', [text]);
        await commentRem.setPowerupProperty('comment', 'createdAt', [createdAt]);
        if (author) {
            await commentRem.setPowerupProperty('comment', 'author', [author]);
        }
    }

    await plugin.app.toast('Comment added.');

    // Get parent name for the complete comment data
    let parentName: string | undefined;
    if (parentRemId) {
        const parentRem = await plugin.rem.findOne(parentRemId);
        if (parentRem) {
            const parentNameRT = parentRem.text;
            try {
                if (!parentNameRT) {
                    parentName = '';
                } else if (typeof parentNameRT === 'string') {
                    parentName = parentNameRT;
                } else {
                    parentName = await plugin.richText.toString(parentNameRT);
                }
            } catch {
                parentName = '';
            }
        }
    }

    // Create complete comment data to send
    const newCommentData = {
        id: commentRem._id,
        parentId: parentRemId,
        parentName,
        text,
        createdAt
    };

    // Use event bus to notify view with complete comment data
    const bus = createBus();
    bus.emit('comments:updated', { remId: parentRemId, comment: newCommentData });
    bus.close();

    // Keep existing notification methods for backward compatibility
    await plugin.storage.setSession('comments_dirty', Date.now());
    try {
        await plugin.messaging.broadcast({ type: 'comments_dirty', ts: Date.now() });
    } catch { }
}

export type CommentRow = {
    id: string;
    parentId?: string;
    parentName?: string;
    text?: string;
    createdAt?: string;
};

/**
 * Lists all comments in the knowledge base.
 * @param plugin The plugin instance.
 * @returns A promise that resolves to an array of comment rows.
 */
export async function listAllComments(plugin: RNPlugin): Promise<CommentRow[]> {
    const pw = await plugin.powerup.getPowerupByCode('comment');
    if (!pw) return [];
    const comments = await pw.taggedRem();
    const rows: CommentRow[] = [];
    let reconciledCount = 0;
    for (const c of comments) {
        const parentId = c.parent || undefined;
        let textStr: any = await c.getPowerupProperty('comment', 'text');
        let createdStr: any = await c.getPowerupProperty('comment', 'createdAt');
        // Coerce arrays (SDK stores values as arrays) to single values
        if (Array.isArray(textStr)) textStr = textStr[0];
        if (Array.isArray(createdStr)) createdStr = createdStr[0];
        // If user manually tagged a Rem, initialize missing fields
        if ((textStr === undefined || textStr === null) || (createdStr === undefined || createdStr === null)) {
            try {
                const textraw = c.text;
                let liveText = '';
                if (!textraw) {
                    liveText = '';
                } else if (typeof textraw === 'string') {
                    liveText = textraw;
                } else {
                    liveText = await plugin.richText.toString(textraw);
                }
                if (textStr === undefined || textStr === null) {
                    textStr = liveText || '';
                    await c.setPowerupProperty('comment', 'text', [textStr]);
                    reconciledCount++;
                }
                if (createdStr === undefined || createdStr === null) {
                    createdStr = new Date().toISOString();
                    await c.setPowerupProperty('comment', 'createdAt', [createdStr]);
                    reconciledCount++;
                }
            } catch { /* ignore */ }
        } else {
            // Reconcile drift: if live text changed while panel closed, update text & createdAt to represent latest edit time
            try {
                const textraw = c.text;
                let liveText = '';
                if (!textraw) {
                    liveText = '';
                } else if (typeof textraw === 'string') {
                    liveText = textraw;
                } else {
                    liveText = await plugin.richText.toString(textraw);
                }
                if (liveText !== textStr) {
                    const newTs = new Date().toISOString();
                    await c.setPowerupProperty('comment', 'text', [liveText || '']);
                    await c.setPowerupProperty('comment', 'createdAt', [newTs]);
                    textStr = liveText;
                    createdStr = newTs;
                    reconciledCount++;
                }
            } catch { /* ignore */ }
        }
        const text = textStr || '';
        const createdAt = createdStr || undefined;
        let parentName: string | undefined;
        if (parentId) {
            const parentRem = await plugin.rem.findOne(parentId);
            if (parentRem) {
                const parentNameRT = parentRem.text;
                try {
                    if (!parentNameRT) {
                        parentName = '';
                    } else if (typeof parentNameRT === 'string') {
                        parentName = parentNameRT;
                    } else {
                        parentName = await plugin.richText.toString(parentNameRT);
                    }
                } catch {
                    parentName = '';
                }
            }
        }
        rows.push({ id: c._id, parentId, parentName, text, createdAt });
    }
    if (reconciledCount > 0) {
        try { await plugin.storage.setSession('comments_reconciled_last', Date.now()); } catch { }
    }
    return rows;
}
