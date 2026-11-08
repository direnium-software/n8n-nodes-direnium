import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DireniumApi implements ICredentialType {
	name = 'direniumApi';

	displayName = 'Direnium API';

	icon = {
		light: 'file:../nodes/Direnium/direnium.svg',
		dark: 'file:../nodes/Direnium/direnium.dark.svg',
	} as const;

	documentationUrl = 'https://github.com/direnium-software/n8n-nodes-direnium#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'In Direnium, open your agent, go to Sources → API input and copy the key shown there',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://platform.direnium.com/api/v1',
			url: '/agents',
		},
	};
}
