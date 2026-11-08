import type { IDataObject } from 'n8n-workflow';

export type CallOutcome =
	| { readonly kind: 'placed'; readonly json: IDataObject }
	| { readonly kind: 'not_called'; readonly json: IDataObject }
	| { readonly kind: 'error'; readonly message: string; readonly description: string };

const KEY_HELP = "Reconnect the credential with the key from the agent's Sources → API input in Direnium.";

const formatNextOpen = (nextOpenAt: string, timezone: string): string =>
	new Date(nextOpenAt).toLocaleString('en-GB', {
		timeZone: timezone,
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
	});

const errorText = (body: IDataObject): string | null =>
	typeof body.error === 'string' ? body.error : null;

export const toOutcome = (statusCode: number, body: IDataObject, to: string): CallOutcome => {
	if (statusCode === 201 || statusCode === 200) {
		return { kind: 'placed', json: body };
	}
	if (statusCode === 202 && body.status === 'not_dialed') {
		return {
			kind: 'not_called',
			json: {
				status: 'not_called',
				reason: 'test_mode',
				to: body.to ?? to,
				message: `The agent is in test mode, so it only calls your test numbers. ${String(body.to ?? to)} is not one of them.`,
			},
		};
	}
	if (statusCode === 422 && body.error === 'outside_calling_hours') {
		const nextOpenAt = String(body.nextOpenAt);
		const timezone = String(body.timezone);
		return {
			kind: 'not_called',
			json: {
				status: 'not_called',
				reason: 'outside_calling_hours',
				to,
				nextOpenAt,
				timezone,
				message: `The agent is outside its calling hours. Next open: ${formatNextOpen(nextOpenAt, timezone)} (${timezone}).`,
			},
		};
	}
	if (statusCode === 401) {
		return { kind: 'error', message: 'Your Direnium API key is invalid or was deleted', description: KEY_HELP };
	}
	if (statusCode === 403) {
		return { kind: 'error', message: "This API key can't place calls", description: KEY_HELP };
	}
	if (statusCode === 404) {
		return {
			kind: 'error',
			message: 'This agent is not available for calls',
			description: 'It may be paused or deleted. Pick the agent from the list again.',
		};
	}
	if (statusCode === 400) {
		const detail = errorText(body);
		return {
			kind: 'error',
			message: `The call was not placed${detail ? `: ${detail}` : ''}`,
			description: 'Check the phone number and the mapped variables.',
		};
	}
	return {
		kind: 'error',
		message: `Direnium could not place the call (HTTP ${statusCode})`,
		description: errorText(body) ?? 'Try again in a moment.',
	};
};
