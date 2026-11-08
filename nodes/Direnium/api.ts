import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	IN8nHttpFullResponse,
} from 'n8n-workflow';

export const BASE_URL = 'https://platform.direnium.com/api/v1';

export type CallableAgent = {
	readonly id: string;
	readonly name: string;
	readonly variables: readonly string[];
	readonly testMode?: boolean;
};

export type PlaceCallBody = {
	readonly agentId: string;
	readonly to: string;
	readonly variables?: IDataObject;
	readonly idempotencyKey?: string;
	readonly respectCallingHours?: false;
};

export async function direniumRequest<T>(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
): Promise<T> {
	return (await this.helpers.httpRequestWithAuthentication.call(this, 'direniumApi', {
		method,
		url: `${BASE_URL}${path}`,
		body,
		json: true,
	})) as T;
}

export async function direniumFullRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	path: string,
	body: IDataObject,
): Promise<IN8nHttpFullResponse> {
	return (await this.helpers.httpRequestWithAuthentication.call(this, 'direniumApi', {
		method,
		url: `${BASE_URL}${path}`,
		body,
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	})) as IN8nHttpFullResponse;
}

export const agentLabel = (agent: CallableAgent): string =>
	agent.testMode ? `${agent.name} (test mode)` : agent.name;

export const humanize = (name: string): string => {
	const words = name.replace(/[_-]+/g, ' ').trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
};
