/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash } from 'node:crypto';
import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import type { NotesRepository } from '@/models/_.js';
import { MAX_NOTE_TEXT_LENGTH } from '@/const.js';
import { postingLangCodes } from '@/misc/langmap.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { NoteDraftService } from '@/core/NoteDraftService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { LoggerService } from '@/core/LoggerService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['notes'],

	requireCredential: true,
	requireRolePolicy: 'canCreateContent',

	prohibitMoved: true,

	limit: {
		duration: ms('1hour'),
		max: 300,
	},

	kind: 'write:notes',

	res: {
		type: 'object',
		optional: true, nullable: false,
		properties: {
			createdNote: {
				type: 'object',
				optional: false, nullable: false,
				ref: 'Note',
			},
		},
	},

	errors: {
		processing: {
			message: 'We are processing your request. Please wait a moment.',
			code: 'PROCESSING',
			id: '3247052c-005d-440e-b3d8-2a64274483b0',
			httpStatusCode: 202,
		},

		noSuchRenoteTarget: {
			message: 'No such renote target.',
			code: 'NO_SUCH_RENOTE_TARGET',
			id: 'b5c90186-4ab0-49c8-9bba-a1f76c282ba4',
		},

		cannotReRenote: {
			message: 'You can not Renote a pure Renote.',
			code: 'CANNOT_RENOTE_TO_A_PURE_RENOTE',
			id: 'fd4cc33e-2a37-48dd-99cc-9b806eb2031a',
		},

		cannotRenoteDueToVisibility: {
			message: 'You can not Renote due to target visibility.',
			code: 'CANNOT_RENOTE_DUE_TO_VISIBILITY',
			id: 'be9529e9-fe72-4de0-ae43-0b363c4938af',
		},

		noSuchReplyTarget: {
			message: 'No such reply target.',
			code: 'NO_SUCH_REPLY_TARGET',
			id: '749ee0f6-d3da-459a-bf02-282e2da4292c',
		},

		cannotReplyToInvisibleNote: {
			message: 'You cannot reply to an invisible Note.',
			code: 'CANNOT_REPLY_TO_AN_INVISIBLE_NOTE',
			id: 'b98980fa-3780-406c-a935-b6d0eeee10d1',
		},

		cannotReplyToPureRenote: {
			message: 'You can not reply to a pure Renote.',
			code: 'CANNOT_REPLY_TO_A_PURE_RENOTE',
			id: '3ac74a84-8fd5-4bb0-870f-01804f82ce15',
		},

		cannotReplyToSpecifiedVisibilityNoteWithExtendedVisibility: {
			message: 'You cannot reply to a specified visibility note with extended visibility.',
			code: 'CANNOT_REPLY_TO_SPECIFIED_VISIBILITY_NOTE_WITH_EXTENDED_VISIBILITY',
			id: 'ed940410-535c-4d5e-bfa3-af798671e93c',
		},

		cannotCreateAlreadyExpiredPoll: {
			message: 'Poll is already expired.',
			code: 'CANNOT_CREATE_ALREADY_EXPIRED_POLL',
			id: '04da457d-b083-4055-9082-955525eda5a5',
		},

		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: 'b1653923-5453-4edc-b786-7c4f39bb0bbb',
		},

		youHaveBeenBlocked: {
			message: 'You have been blocked by this user.',
			code: 'YOU_HAVE_BEEN_BLOCKED',
			id: 'b390d7e1-8a5e-46ed-b625-06271cafd3d3',
		},

		noSuchFile: {
			message: 'Some files are not found.',
			code: 'NO_SUCH_FILE',
			id: 'b6992544-63e7-67f0-fa7f-32444b1b5306',
		},

		noSuchVisibleUser: {
			message: 'Some visible users are not found.',
			code: 'NO_SUCH_VISIBLE_USER',
			id: '96fe23ce-3494-4ad8-b69f-1a166e41ee94',
		},

		cannotRenoteOutsideOfChannel: {
			message: 'Cannot renote outside of channel.',
			code: 'CANNOT_RENOTE_OUTSIDE_OF_CHANNEL',
			id: '33510210-8452-094c-6227-4a6c05d99f00',
		},

		containsProhibitedWords: {
			message: 'Cannot post because it contains prohibited words.',
			code: 'CONTAINS_PROHIBITED_WORDS',
			id: 'aa6e01d3-a85c-669d-758a-76aab43af334',
		},

		containsTooManyMentions: {
			message: 'Cannot post because it exceeds the allowed number of mentions.',
			code: 'CONTAINS_TOO_MANY_MENTIONS',
			id: '4de0363a-3046-481b-9b0f-feff3e211025',
		},

		replyingToAnotherBot: {
			message: 'Replying to another bot account is not allowed.',
			code: 'REPLY_TO_BOT_NOT_ALLOWED',
			id: '66819f28-9525-389d-4b0a-4974363fbbbf',
		},

		tooManyDrafts: {
			message: 'You cannot create drafts any more.',
			code: 'TOO_MANY_DRAFTS',
			id: '9ee33bbe-fde3-4c71-9b51-e50492c6b9c8',
		},

		tooManyScheduledNotes: {
			message: 'You cannot create scheduled notes any more.',
			code: 'TOO_MANY_SCHEDULED_NOTES',
			id: '22ae69eb-09e3-4541-a850-773cfa45e693',
		},

		cannotScheduleToPast: {
			message: 'Cannot schedule to the past.',
			code: 'CANNOT_SCHEDULE_TO_PAST',
			id: 'e577d185-8179-4a17-b47f-6093985558e6',
		},

		cannotScheduleToFarFuture: {
			message: 'Cannot schedule to the far future.',
			code: 'CANNOT_SCHEDULE_TO_FAR_FUTURE',
			id: 'ea102856-e8da-4ae9-a98a-0326821bd177',
		},

		rolePermissionDenied: {
			message: 'You are not assigned to a required role.',
			code: 'ROLE_PERMISSION_DENIED',
			id: '12f1d5d2-f7ec-4d7c-b608-e873f4b20327',
			httpStatusCode: 403,
		},

		invalidScheduledNote: {
			message: 'Scheduled note content is invalid.',
			code: 'INVALID_SCHEDULED_NOTE',
			id: 'e35e6376-01de-476f-a752-a90a848a4f55',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		visibility: { type: 'string', enum: ['public', 'home', 'followers', 'specified'], default: 'public' },
		visibleUserIds: { type: 'array', uniqueItems: true, items: {
			type: 'string', format: 'misskey:id',
		} },
		cw: { type: 'string', nullable: true, minLength: 1, maxLength: 100 },
		localOnly: { type: 'boolean', default: false },
		dimension: { type: 'integer', nullable: true, minimum: 0 },
		reactionAcceptance: { type: 'string', nullable: true, enum: [null, 'likeOnly', 'likeOnlyForRemote', 'nonSensitiveOnly', 'nonSensitiveOnlyForLocalLikeOnlyForRemote'], default: null },
		noExtractMentions: { type: 'boolean', default: false },
		noExtractHashtags: { type: 'boolean', default: false },
		noExtractEmojis: { type: 'boolean', default: false },
		replyId: { type: 'string', format: 'misskey:id', nullable: true },
		renoteId: { type: 'string', format: 'misskey:id', nullable: true },
		channelId: { type: 'string', format: 'misskey:id', nullable: true },
		lang: { type: 'string', enum: [null, ...postingLangCodes] as string[], nullable: true },

		// anyOf内にバリデーションを書いても最初の一つしかチェックされない
		// See https://github.com/misskey-dev/misskey/pull/10082
		text: {
			type: 'string',
			minLength: 1,
			maxLength: MAX_NOTE_TEXT_LENGTH,
			nullable: true,
		},
		fileIds: {
			type: 'array',
			uniqueItems: true,
			minItems: 1,
			maxItems: 16,
			items: { type: 'string', format: 'misskey:id' },
		},
		mediaIds: {
			type: 'array',
			uniqueItems: true,
			minItems: 1,
			maxItems: 16,
			items: { type: 'string', format: 'misskey:id' },
		},
		poll: {
			type: 'object',
			nullable: true,
			properties: {
				choices: {
					type: 'array',
					uniqueItems: true,
					minItems: 2,
					maxItems: 10,
					items: { type: 'string', minLength: 1, maxLength: 50 },
				},
				multiple: { type: 'boolean' },
				expiresAt: { type: 'integer', nullable: true },
				expiredAfter: { type: 'integer', nullable: true, minimum: 1 },
			},
			required: ['choices'],
		},
		scheduledAt: { type: 'integer', nullable: true, maximum: 253_402_300_799_999 },
		noCreatedNote: { type: 'boolean', default: false },
	},
	// (re)note with text, files and poll are optional
	if: {
		properties: {
			renoteId: {
				type: 'null',
			},
			fileIds: {
				type: 'null',
			},
			mediaIds: {
				type: 'null',
			},
			poll: {
				type: 'null',
			},
		},
	},
	then: {
		properties: {
			text: {
				type: 'string',
				minLength: 1,
				maxLength: MAX_NOTE_TEXT_LENGTH,
				pattern: '[^\\s]+',
			},
		},
		required: ['text'],
	},
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.redisForTimelines)
		private redisForTimelines: Redis.Redis,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private loggerService: LoggerService,
		private noteEntityService: NoteEntityService,
		private noteCreateService: NoteCreateService,
		private noteDraftService: NoteDraftService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const logger = this.loggerService.getLogger('api:notes:create');
			const hash = createHash('sha256').update(JSON.stringify(ps)).digest('base64');
			const key = `note:idempotent:${me.id}:${hash}`;
			const idempotent = process.env.FORCE_IGNORE_IDEMPOTENCY_FOR_TESTING !== 'true' ? await this.redisForTimelines.get(key) : null;

			if (idempotent === '_') {
				throw new ApiError(meta.errors.processing);
			}

			if (idempotent != null) {
				const note = await this.notesRepository.findOneBy({ id: idempotent });
				if (note != null) {
					if (ps.noCreatedNote) return;
					return {
						createdNote: await this.noteEntityService.pack(note, me, {
							skipLanguageCheck: true,
							viewerDimension: null,
						}),
					};
				}

				const draft = await this.noteDraftService.get(me, idempotent);
				if (draft != null) return;
			}

			await this.redisForTimelines.set(key, '_', 'EX', 30);

			try {
				if (ps.scheduledAt != null) {
					const draft = await this.noteDraftService.create(me, {
						fileIds: ps.fileIds ?? ps.mediaIds ?? [],
						pollChoices: ps.poll?.choices ?? [],
						pollMultiple: ps.poll?.multiple ?? false,
						pollExpiresAt: ps.poll?.expiresAt == null ? null : new Date(ps.poll.expiresAt),
						pollExpiredAfter: ps.poll?.expiredAfter ?? null,
						hasPoll: ps.poll != null,
						text: ps.text ?? null,
						replyId: ps.replyId ?? null,
						renoteId: ps.renoteId ?? null,
						cw: ps.cw ?? null,
						hashtag: null,
						localOnly: ps.localOnly,
						dimension: ps.dimension ?? null,
						lang: ps.lang ?? null,
						reactionAcceptance: ps.reactionAcceptance,
						visibility: ps.visibility,
						visibleUserIds: ps.visibleUserIds ?? [],
						channelId: ps.channelId ?? null,
						scheduledAt: new Date(ps.scheduledAt),
						isActuallyScheduled: true,
						noExtractMentions: ps.noExtractMentions,
						noExtractHashtags: ps.noExtractHashtags,
						noExtractEmojis: ps.noExtractEmojis,
					});

					await this.redisForTimelines.set(key, draft.id, 'EX', 60);
					return;
				}

				const note = await this.noteCreateService.fetchAndCreate(me, {
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
					dimension: ps.dimension,
					lang: ps.lang,
					apMentions: ps.noExtractMentions ? [] : undefined,
					apHashtags: ps.noExtractHashtags ? [] : undefined,
					apEmojis: ps.noExtractEmojis ? [] : undefined,
				});

				await this.redisForTimelines.set(key, note.id, 'EX', 60);
				if (ps.noCreatedNote) return;

				return {
					createdNote: await this.noteEntityService.pack(note, me, {
						skipLanguageCheck: true,
						viewerDimension: null,
					}),
				};
			} catch (err) {
				await this.redisForTimelines.unlinkIf(key, '_');
				logger.error('ノートの作成に失敗しました。', {
					errorName: err instanceof Error ? err.name : 'unknown',
					errorId: err instanceof IdentifiableError ? err.id : undefined,
				});
				// TODO: 他のErrorもここでキャッチしてエラーメッセージを当てるようにしたい
				if (err instanceof IdentifiableError) {
					if (err.id === '689ee33f-f97c-479a-ac49-1b9f8140af99') {
						throw new ApiError(meta.errors.containsProhibitedWords);
					} else if (err.id === '9f466dab-c856-48cd-9e65-ff90ff750580') {
						throw new ApiError(meta.errors.containsTooManyMentions);
					} else if (err.id === '801c046c-5bf5-4234-ad2b-e78fc20a2ac7') {
						throw new ApiError(meta.errors.noSuchFile);
					} else if (err.id === '81df0c8d-2cfe-4e1a-9e93-b948ef455d9d') {
						throw new ApiError(meta.errors.noSuchVisibleUser);
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
					} else if (err.id === 'b0df6025-f2e8-44b4-a26a-17ad99104612') {
						throw new ApiError(meta.errors.youHaveBeenBlocked);
					} else if (err.id === '0c11c11e-0c8d-48e7-822c-76ccef660068') {
						throw new ApiError(meta.errors.cannotCreateAlreadyExpiredPoll);
					} else if (err.id === 'bfa3905b-25f5-4894-b430-da331a490e4b') {
						throw new ApiError(meta.errors.noSuchChannel);
					} else if (err.id === '66819f28-9525-389d-4b0a-4974363fbbbf') {
						throw new ApiError(meta.errors.replyingToAnotherBot);
					} else if (err.id === '9ee33bbe-fde3-4c71-9b51-e50492c6b9c8') {
						throw new ApiError(meta.errors.tooManyDrafts);
					} else if (err.id === 'c3275f19-4558-4c59-83e1-4f684b5fab66') {
						throw new ApiError(meta.errors.tooManyScheduledNotes);
					} else if (err.id === '7cc42034-f7ab-4f7c-87b4-e00854479080') {
						throw new ApiError(meta.errors.rolePermissionDenied);
					} else if (err.id === '94a89a43-3591-400a-9c17-dd166e71fdfa' || err.id === 'b34d0c1b-996f-4e34-a428-c636d98df457') {
						throw new ApiError(meta.errors.cannotScheduleToPast);
					} else if (err.id === '506006cf-3092-4ae1-8145-b025001c591f') {
						throw new ApiError(meta.errors.cannotScheduleToFarFuture);
					} else if (err.id === '4f5bb9ec-5c64-47e9-b21b-da977f45ae3d') {
						throw new ApiError(meta.errors.invalidScheduledNote);
					}
				}
				throw err;
			}
		});
	}
}
