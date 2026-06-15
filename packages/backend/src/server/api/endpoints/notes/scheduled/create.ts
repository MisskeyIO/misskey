/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { ApiError } from '@/server/api/error.js';
import { meta as noteCreateMeta, paramDef as noteCreateParamDef } from '../create.js';

export const meta = {
	...noteCreateMeta,
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			scheduledNoteId: {
				type: 'string',
				optional: false, nullable: false,
				format: 'misskey:id',
			},
		},
	},
} as const;

export const paramDef = {
	...noteCreateParamDef,
	properties: {
		...noteCreateParamDef.properties,
		scheduledAt: { type: 'integer' },
	},
	required: ['scheduledAt'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private noteCreateService: NoteCreateService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				const scheduledNote = await this.noteCreateService.fetchAndCreate(me, {
					createdAt: new Date(),
					fileIds: ps.fileIds ?? ps.mediaIds ?? [],
					poll: ps.poll ? {
						choices: ps.poll.choices,
						multiple: ps.poll.multiple ?? false,
						expiresAt: ps.poll.expiredAfter ? new Date(Date.now() + ps.poll.expiredAfter) : ps.poll.expiresAt ? new Date(ps.poll.expiresAt) : null,
					} : null,
					text: ps.text ?? null,
					replyId: ps.replyId ?? null,
					renoteId: ps.renoteId ?? null,
					cw: ps.cw ?? null,
					localOnly: ps.localOnly,
					reactionAcceptance: ps.reactionAcceptance,
					visibility: ps.visibility,
					visibleUserIds: ps.visibleUserIds ?? [],
					channelId: ps.channelId ?? null,
					scheduledAt: new Date(ps.scheduledAt),
					apMentions: ps.noExtractMentions ? [] : undefined,
					apHashtags: ps.noExtractHashtags ? [] : undefined,
					apEmojis: ps.noExtractEmojis ? [] : undefined,
				});

				return { scheduledNoteId: scheduledNote.id };
			} catch (err) {
				// TODO: 他のErrorもここでキャッチしてエラーメッセージを当てるようにしたい
				if (err instanceof IdentifiableError) {
					if (err.id === '689ee33f-f97c-479a-ac49-1b9f8140af99') {
						throw new ApiError(meta.errors.containsProhibitedWords);
					} else if (err.id === '9f466dab-c856-48cd-9e65-ff90ff750580') {
						throw new ApiError(meta.errors.containsTooManyMentions);
					} else if (err.id === '801c046c-5bf5-4234-ad2b-e78fc20a2ac7') {
						throw new ApiError(meta.errors.noSuchFile);
					} else if (err.id === '53983c56-e163-45a6-942f-4ddc485d4290') {
						throw new ApiError(meta.errors.noSuchRenoteTarget);
					} else if (err.id === 'bde24c37-121f-4e7d-980d-cec52f599f02') {
						throw new ApiError(meta.errors.cannotReRenote);
					} else if (err.id === '2b4fe776-4414-4a2d-ae39-f3418b8fd4d3') {
						throw new ApiError(meta.errors.youHaveBeenBlocked);
					} else if (err.id === '90b9d6f0-893a-4fef-b0f1-e9a33989f71a') {
						throw new ApiError(meta.errors.cannotRenoteDueToVisibility);
					} else if (err.id === '48d7a997-da5c-4716-b3c3-92db3f37bf7d') {
						throw new ApiError(meta.errors.cannotRenoteDueToVisibility);
					} else if (err.id === 'b060f9a6-8909-4080-9e0b-94d9fa6f6a77') {
						throw new ApiError(meta.errors.noSuchChannel);
					} else if (err.id === '7e435f4a-780d-4cfc-a15a-42519bd6fb67') {
						throw new ApiError(meta.errors.cannotRenoteOutsideOfChannel);
					} else if (err.id === '60142edb-1519-408e-926d-4f108d27bee0') {
						throw new ApiError(meta.errors.noSuchReplyTarget);
					} else if (err.id === 'f089e4e2-c0e7-4f60-8a23-e5a6bf786b36') {
						throw new ApiError(meta.errors.cannotReplyToPureRenote);
					} else if (err.id === '11cd37b3-a411-4f77-8633-c580ce6a8dce') {
						throw new ApiError(meta.errors.cannotReplyToInvisibleNote);
					} else if (err.id === 'ced780a1-2012-4caf-bc7e-a95a291294cb') {
						throw new ApiError(meta.errors.cannotReplyToSpecifiedVisibilityNoteWithExtendedVisibility);
					}
				}

				throw err;
			}
		});
	}
}
