import { RNPlugin } from '@remnote/plugin-sdk';
import { createBus } from '../utils/bus';

export async function ensureCommentPowerup(plugin: RNPlugin) {
    // Idempotently register the Comment powerup with hidden slots for storage
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
            parentName = await plugin.richText.toString(parentNameRT);
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

export async function listAllComments(plugin: RNPlugin): Promise<CommentRow[]> {
    const pw = await plugin.powerup.getPowerupByCode('comment');
    if (!pw) return [];
    const comments = await pw.taggedRem();
    const rows: CommentRow[] = [];
    for (const c of comments) {
        const parentId = c.parent || undefined;
        const textStr = await c.getPowerupProperty('comment', 'text');
        const createdStr = await c.getPowerupProperty('comment', 'createdAt');
        const text = textStr || undefined;
        const createdAt = createdStr || undefined;
        let parentName: string | undefined;
        if (parentId) {
            const parentRem = await plugin.rem.findOne(parentId);
            if (parentRem) {
                const parentNameRT = parentRem.text;
                parentName = await plugin.richText.toString(parentNameRT);
            }
        }
        rows.push({ id: c._id, parentId, parentName, text, createdAt });
    }
    return rows;
}
