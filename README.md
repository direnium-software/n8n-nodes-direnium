# n8n-nodes-direnium

Place phone calls with your [Direnium](https://direnium.com) AI voice agents from any n8n workflow.

Direnium is an AI voice agent platform that places and answers phone calls for businesses. With this node, a new lead in your CRM, form or spreadsheet can trigger a call by one of your agents within seconds, with the lead's details passed to the agent.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Usage](#usage) · [Compatibility](#compatibility) · [Resources](#resources)

## Installation

Self-hosted n8n: go to **Settings → Community Nodes → Install** and enter `n8n-nodes-direnium`.

For other options, follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Credentials

You need a Direnium account with at least one voice agent.

1. In Direnium, open the agent that should make the calls.
2. Go to **Sources → API input** and copy the API key shown there.
3. In n8n, create a **Direnium API** credential and paste the key.

n8n checks the key when you save the credential. A key from the agent's API input can place calls with any of your voice agents.

## Operations

**Call → Place.** Places an outbound phone call by one of your voice agents.

| Field | What it does |
| --- | --- |
| Agent | The voice agent that makes the call. Pick it from the list, or pass its ID. Agents in test mode are marked "(test mode)". |
| Phone Number | Israeli or US number. Local format such as 050-1234567 works too. |
| Agent Variables | The details the agent uses during the call, such as the lead's name. The list matches the variables of the agent you picked. |
| Lead Reference (option) | A value that is unique per lead. If the workflow runs again for the same lead, the agent does not call twice. |
| Only Call During Calling Hours (option) | On by default. Leads that arrive outside the agent's calling hours are not called. |

### Output

Every input item produces one output item, so you can branch on `status` with an IF node.

A placed call:

```json
{
  "id": "e60ee560-3c1b-4a8e-9a77-2f1d6c0b9e12",
  "status": "dialing",
  "to": "+972501234567",
  "createdAt": "2026-11-08T14:02:11.000Z",
  "url": "https://platform.direnium.com/business/agents/…?call=e60ee560-…"
}
```

A lead that was not called, with the reason (`outside_calling_hours` or `test_mode`):

```json
{
  "status": "not_called",
  "reason": "outside_calling_hours",
  "to": "+972501234567",
  "nextOpenAt": "2026-11-09T07:00:00.000Z",
  "timezone": "Asia/Jerusalem",
  "message": "The agent is outside its calling hours. Next open: Mon 9 Nov, 09:00 (Asia/Jerusalem)."
}
```

An invalid key, a paused or deleted agent, or an invalid phone number stops the node with a clear error, unless **On Error → Continue** is set.

## Usage

- The call itself can last several minutes. The node returns as soon as the call is placed and does not wait for it to end. Call results such as summaries, outcomes and CRM updates are set up in Direnium under the agent's automations.
- The node can also be used as a tool by n8n AI agents, so an agent can place a call when a conversation calls for one.
- If you rename or remove a variable in the agent, open the node and refresh the Agent Variables list.

## Compatibility

Tested with n8n 2.46. Requires an n8n version that supports community nodes.

## Resources

- [Direnium](https://direnium.com)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Version history

See [CHANGELOG.md](CHANGELOG.md).
