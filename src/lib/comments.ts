import { RNPlugin } from '@remnote/plugin-sdk';

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
    if (pw?._id) {
        await commentRem.addTag(pw._id);
        await commentRem.setPowerupProperty('comment', 'text', [text]);
        await commentRem.setPowerupProperty('comment', 'createdAt', [new Date().toISOString()]);
        if (author) {
            await commentRem.setPowerupProperty('comment', 'author', [author]);
        }
    }

    await plugin.app.toast('Comment added.');
    // signal list views to refresh
    await plugin.storage.setSession('comments_dirty', Date.now());
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

