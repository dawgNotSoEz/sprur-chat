import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMessages } from '$lib/server/repository';
import { db } from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
	const sessionId = url.searchParams.get('sessionId');

	if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
		return json({ error: 'Missing or invalid sessionId' }, { status: 400 });
	}

	// Check if the conversation exists
	const conversation = db.prepare('SELECT id FROM conversations WHERE id = ?').get(sessionId);
	if (!conversation) {
		return json({ error: 'Session not found', messages: [] }, { status: 404 });
	}

	try {
		const messages = getMessages(sessionId);
		return json({ messages, sessionId });
	} catch (err) {
		console.error('Failed to fetch history:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};