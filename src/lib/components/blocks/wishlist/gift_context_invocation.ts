export type GiftContextInvocation =
	| { kind: 'native'; point: { x: number; y: number } }
	| { kind: 'longpress' }
	| { kind: 'more'; anchor: HTMLButtonElement };

export type GiftContextSurface = 'menu' | 'sheet';

export interface GiftContextSession<Gift> {
	id: number;
	gift: Gift;
	viewportAtOpen: boolean;
	invocation:
		| { kind: 'native'; point: { x: number; y: number } }
		| { kind: 'longpress'; surface: 'sheet' }
		| { kind: 'more'; anchor: HTMLButtonElement; surface: GiftContextSurface };
}

export type GiftContextFinishPolicy = 'restore-focus' | 'handoff';
