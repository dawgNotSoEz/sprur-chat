<script lang="ts">
	import MessageBubble from './MessageBubble.svelte';

	let messages = $state<Array<{ sender: 'user' | 'ai'; text: string }>>([]);
	let input = $state('');
	let loading = $state(false);
	let error = $state('');
	let sessionId = $state<string | null>(null);

	let chatContainer = $state<HTMLDivElement | null>(null);

	function safeStorage(action: 'get' | 'set' | 'remove', key: string, value?: string): string | null {
		try {
			if (action === 'get') return localStorage.getItem(key);
			if (action === 'set') { localStorage.setItem(key, value!); return null; }
			if (action === 'remove') { localStorage.removeItem(key); return null; }
		} catch {
			return null;
		}
		return null;
	}

	// ---------- Mount once: load session & history ----------
	let mounted = $state(false);
	$effect(() => {
		if (mounted) return;
		mounted = true;

		const stored = safeStorage('get', 'sessionId');
		if (stored) {
			sessionId = stored;
			loadHistory();
		}
	});

	// ---------- Auto‑scroll after messages update ----------
	$effect(() => {
		void messages.length;
		chatContainer?.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
	});

	async function loadHistory() {
		try {
			const res = await fetch(`/api/chat/history?sessionId=${sessionId}`);
			if (res.ok) {
				const data = await res.json();
				messages = data.messages.map((m: any) => ({
					sender: m.sender,
					text: m.text
				}));
			} else if (res.status === 404 || res.status === 400) {
				// Old session no longer valid, start fresh
				sessionId = null;
				messages = [];
				safeStorage('remove', 'sessionId');
			}
		} catch {
			// silently fail – user can still start a new chat
		}
	}

	async function sendMessage() {
		const trimmed = input.trim();
		if (!trimmed || loading) return;

		// Optimistic UI: show user message immediately
		messages = [...messages, { sender: 'user', text: trimmed }];
		input = '';
		loading = true;
		error = '';

		try {
			const res = await fetch('/api/chat/message', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: trimmed, sessionId })
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.error || 'Something went wrong.');
			}

			const data = await res.json();

			// Update sessionId if we got a new one
			if (data.sessionId && data.sessionId !== sessionId) {
				sessionId = data.sessionId;
				safeStorage('set', 'sessionId', sessionId);
			}

			// Add AI reply
			messages = [...messages, { sender: 'ai', text: data.reply }];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to send message.';
			// Remove the optimistic message on failure
			messages = messages.filter((_, i) => i !== messages.length - 1);
		} finally {
			loading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}
</script>

<div class="widget">
	<!-- Header -->
	<div class="header">
		<h2>ShopSpur Support</h2>
		<p>We reply in seconds</p>
	</div>

	<!-- Messages -->
	<div class="messages" bind:this={chatContainer}>
		{#if messages.length === 0}
			<div class="empty">
				<p>👋 Hey! Ask us anything about our store, shipping, or returns.</p>
			</div>
		{:else}
			{#each messages as msg}
				<MessageBubble sender={msg.sender} text={msg.text} />
			{/each}
		{/if}

		{#if loading}
			<div class="typing">Agent is typing…</div>
		{/if}

		{#if error}
			<div class="error">{error}</div>
		{/if}
	</div>

	<!-- Input -->
	<div class="input-area">
		<textarea
			bind:value={input}
			placeholder="Type your message…"
			disabled={loading}
			on:keydown={handleKeydown}
			rows="1"
		></textarea>
		<button on:click={sendMessage} disabled={loading || !input.trim()}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				fill="currentColor"
				viewBox="0 0 16 16"
			>
				<path
					d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.763l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15Zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471-.47 1.178Z"
				/>
			</svg>
		</button>
	</div>
</div>

<style>
	.widget {
		width: 100%;
		max-width: 420px;
		height: 600px;
		margin: 2rem auto;
		border: 1px solid #ddd;
		border-radius: 1rem;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
		background: white;
	}
	.header {
		padding: 1rem;
		background: #007aff;
		color: white;
		text-align: center;
	}
	.header h2 {
		margin: 0;
		font-size: 1.2rem;
	}
	.header p {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.9;
	}
	.messages {
		flex: 1;
		padding: 0.75rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}
	.empty {
		text-align: center;
		color: #666;
		margin-top: 2rem;
	}
	.typing {
		align-self: flex-start;
		font-style: italic;
		color: #888;
		font-size: 0.9rem;
		margin: 0.25rem 0;
	}
	.error {
		background: #ffe3e3;
		color: #b00020;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		margin: 0.5rem 0;
		font-size: 0.9rem;
	}
	.input-area {
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem;
		border-top: 1px solid #ddd;
		background: #f9f9f9;
	}
	textarea {
		flex: 1;
		border: 1px solid #ccc;
		border-radius: 1.5rem;
		padding: 0.6rem 1rem;
		resize: none;
		font-size: 0.95rem;
		font-family: inherit;
		outline: none;
	}
	textarea:disabled {
		background: #eee;
	}
	button {
		background: #007aff;
		color: white;
		border: none;
		border-radius: 50%;
		width: 42px;
		height: 42px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: opacity 0.2s;
	}
	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>