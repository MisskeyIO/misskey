import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';

export const meta = {
	tags: ['account'],

	requireCredential: true,
	requireRolePolicy: 'canUpdateContent',

	kind: 'write:account',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		fileId: { type: 'string', format: 'misskey:id' },
		width: { type: 'integer' },
		height: { type: 'integer' },
		fit: { type: 'string', enum: ['scale-down', 'contain', 'cover', 'crop', 'pad'] },
		gravity: { type: 'string', enum: ['auto', 'left', 'right', 'top', 'bottom'] },
		opacity: { type: 'number' },
		repeat: { type: 'string', enum: ['true', 'x', 'y'] },
		top: { type: 'number' },
		left: { type: 'number' },
		bottom: { type: 'number' },
		right: { type: 'number' },
		background: { type: 'string' },
		rotate: { type: 'number' },
	},
	required: [],
} as const;

// eslint-disable-next-line import/no-default-export
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
	) {
		super(meta, paramDef, async (ps, me) => {
			// THIS ENDPOINT IS STUB
		});
	}
}
