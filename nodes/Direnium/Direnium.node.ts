import { createHash } from 'crypto';
import {
	NodeApiError,
	NodeConnectionTypes,
	type IDataObject,
	type IExecuteFunctions,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodeListSearchResult,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
	type ResourceMapperFields,
} from 'n8n-workflow';
import {
	agentLabel,
	direniumFullRequest,
	direniumRequest,
	humanize,
	type CallableAgent,
	type PlaceCallBody,
} from './api';
import { toOutcome, type CallOutcome } from './outcome';

const showForPlaceCall = { resource: ['call'], operation: ['place'] };

const idempotencyKeyFor = (agentId: string, leadReference: string): string =>
	`n8n-${createHash('sha256').update(`${agentId}:${leadReference}`).digest('hex')}`;

const filledVariables = (mapped: IDataObject): IDataObject =>
	Object.fromEntries(
		Object.entries(mapped).filter(([, value]) => value !== undefined && value !== null && value !== ''),
	);

export class Direnium implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Direnium',
		name: 'direnium',
		icon: { light: 'file:direnium.svg', dark: 'file:direnium.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Place calls with your Direnium AI voice agents',
		defaults: {
			name: 'Direnium',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'direniumApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Call', value: 'call' }],
				default: 'call',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['call'] } },
				options: [
					{
						name: 'Place',
						value: 'place',
						description: 'Place an outbound phone call by one of your voice agents',
						action: 'Place a call',
					},
				],
				default: 'place',
			},
			{
				displayName: 'Agent',
				name: 'agent',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description:
					'The voice agent that makes the call. An agent in test mode only calls your test numbers.',
				displayOptions: { show: showForPlaceCall },
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: { searchListMethod: 'searchAgents', searchable: true },
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 7f1c2d3e-0000-4000-8000-000000000001',
					},
				],
			},
			{
				displayName: 'Phone Number',
				name: 'to',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. +972501234567',
				description: 'Israeli or US number. Local format such as 050-1234567 works too.',
				displayOptions: { show: showForPlaceCall },
			},
			{
				displayName: 'Agent Variables',
				name: 'variables',
				type: 'resourceMapper',
				noDataExpression: true,
				default: { mappingMode: 'defineBelow', value: null },
				required: true,
				displayOptions: { show: showForPlaceCall },
				typeOptions: {
					loadOptionsDependsOn: ['agent.value'],
					resourceMapper: {
						resourceMapperMethod: 'getAgentVariables',
						mode: 'add',
						fieldWords: { singular: 'variable', plural: 'variables' },
						addAllFields: true,
						supportAutoMap: true,
						hideNoDataError: true,
						noFieldsError: 'This agent has no variables to fill',
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: showForPlaceCall },
				options: [
					{
						displayName: 'Lead Reference',
						name: 'leadReference',
						type: 'string',
						default: '',
						description:
							'A value that is unique per lead, such as the row or record ID. If the workflow runs again for the same lead, the agent does not call twice.',
					},
					{
						displayName: 'Only Call During Calling Hours',
						name: 'respectCallingHours',
						type: 'boolean',
						default: true,
						description:
							"Whether to skip leads that arrive outside the agent's calling hours. Skipped leads come out with status not_called and the next opening time.",
					},
				],
			},
		],
	};

	methods = {
		listSearch: {
			async searchAgents(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const { agents } = await direniumRequest.call<ILoadOptionsFunctions, ['GET', string], Promise<{ agents: CallableAgent[] }>>(
					this,
					'GET',
					'/agents',
				);
				const query = (filter ?? '').trim().toLowerCase();
				return {
					results: agents
						.filter((agent) => !query || agent.name.toLowerCase().includes(query))
						.map((agent) => ({
							name: agentLabel(agent),
							value: agent.id,
							url: `https://platform.direnium.com/business/agents/${agent.id}`,
						})),
				};
			},
		},
		resourceMapping: {
			async getAgentVariables(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const agentId = this.getNodeParameter('agent', undefined, { extractValue: true }) as string;
				if (!agentId) return { fields: [] };
				const agent = await direniumRequest.call<ILoadOptionsFunctions, ['GET', string], Promise<CallableAgent>>(
					this,
					'GET',
					`/agents/${encodeURIComponent(agentId)}`,
				);
				return {
					fields: agent.variables.map((name) => ({
						id: name,
						displayName: humanize(name),
						required: false,
						defaultMatch: false,
						canBeUsedToMatch: false,
						display: true,
						type: 'string',
					})),
				};
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			let outcome: CallOutcome;
			let responseBody: IDataObject = {};
			let statusCode = 0;
			try {
				const agentId = this.getNodeParameter('agent', i, '', { extractValue: true }) as string;
				const to = (this.getNodeParameter('to', i) as string).trim();
				const variables = filledVariables(this.getNodeParameter('variables.value', i, {}) as IDataObject);
				const options = this.getNodeParameter('options', i, {}) as {
					leadReference?: string;
					respectCallingHours?: boolean;
				};

				const body: PlaceCallBody = {
					agentId,
					to,
					...(Object.keys(variables).length > 0 ? { variables } : {}),
					...(options.leadReference ? { idempotencyKey: idempotencyKeyFor(agentId, options.leadReference) } : {}),
					...(options.respectCallingHours === false ? { respectCallingHours: false as const } : {}),
				};

				const response = await direniumFullRequest.call(this, 'POST', '/calls', body as IDataObject);
				statusCode = response.statusCode;
				responseBody = (response.body ?? {}) as IDataObject;
				outcome = toOutcome(statusCode, responseBody, to);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}

			if (outcome.kind === 'error') {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: outcome.message, description: outcome.description },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeApiError(this.getNode(), responseBody as JsonObject, {
					message: outcome.message,
					description: outcome.description,
					httpCode: String(statusCode),
					itemIndex: i,
				});
			}

			returnData.push({ json: outcome.json, pairedItem: { item: i } });
		}

		return [returnData];
	}
}
