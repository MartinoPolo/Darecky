export const SENTRY_REPLAY_NAVIGATION_EVENT = 'sentry-replay-navigation';

interface SentryReplayControl {
	startBuffering(): void;
	stop(options: { flush: false }): Promise<void>;
}

// Keep retired authentication URLs excluded from session recordings.
const SENSITIVE_PATH_PATTERNS = [
	/^\/(?:en\/)?(?:login|magic-link|register|reset-password)(?:\/|$)/,
	/^\/(?:en\/)?unsubscribe(?:\/|$)/,
	/^\/(?:en\/)?w\/[^/]+\/(?:claim|invite)\/[^/]+(?:\/|$)/,
];

export function shouldDisableSentryReplay(url: URL): boolean {
	return (
		url.search !== '' || SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(url.pathname))
	);
}

export function createLazySentryReplaySynchronizer<T>({
	client,
	loadIntegration,
	getReplay,
	onFailure = () => {},
}: {
	client: { addIntegration(integration: T): void };
	loadIntegration: () => Promise<T>;
	getReplay: () => SentryReplayControl | undefined;
	onFailure?: (error: unknown) => void;
}) {
	let integrationPromise: Promise<T> | undefined;
	let integrationAdded = false;
	let replayDisabled = false;
	let replay: SentryReplayControl | undefined;
	let latestUrl: URL;
	let stoppedForSensitiveRoute = false;

	return async (url: URL): Promise<void> => {
		latestUrl = url;
		if (shouldDisableSentryReplay(url)) {
			stoppedForSensitiveRoute = true;
			if (replay !== undefined) {
				try {
					await replay.stop({ flush: false });
				} catch (error) {
					replayDisabled = true;
					onFailure(error);
				}
			}
			return;
		}
		if (replayDisabled) {
			return;
		}

		const replayWasAlreadyIntegrated = integrationAdded;
		if (!integrationAdded) {
			try {
				integrationPromise ??= loadIntegration();
				const integration = await integrationPromise;
				if (shouldDisableSentryReplay(latestUrl) || replayDisabled) {
					return;
				}
				if (!integrationAdded) {
					integrationAdded = true;
					client.addIntegration(integration);
				}
			} catch (error) {
				replayDisabled = true;
				onFailure(error);
				return;
			}
		}
		replay ??= getReplay();
		if (replay !== undefined && stoppedForSensitiveRoute && replayWasAlreadyIntegrated) {
			try {
				replay.startBuffering();
			} catch (error) {
				replayDisabled = true;
				onFailure(error);
				return;
			}
		}
		stoppedForSensitiveRoute = false;
	};
}
