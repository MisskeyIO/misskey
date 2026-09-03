/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { MiNoteDraft, NoteDraftsRepository, MiNote, MiDriveFile, MiChannel, UsersRepository, DriveFilesRepository, NotesRepository, BlockingsRepository, ChannelsRepository } from '@/models/_.js';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import { IdService } from '@/core/IdService.js';
import type { MiLocalUser, MiUser } from '@/models/User.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { isRenote, isQuote } from '@/misc/is-renote.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { QueueService } from '@/core/QueueService.js';
import type Logger from '@/logger.js';
import { LoggerService } from '@/core/LoggerService.js';

export type NoteDraftOptions = Omit<MiNoteDraft, 'id' | 'userId' | 'user' | 'reply' | 'renote' | 'channel' | 'scheduledFailureReason' | 'reservedNoteId'>;

export const INVALID_SCHEDULED_NOTE_ID = '4f5bb9ec-5c64-47e9-b21b-da977f45ae3d';

@Injectable()
export class NoteDraftService {
	private logger: Logger;

	constructor(
		@Inject(DI.blockingsRepository)
		private blockingsRepository: BlockingsRepository,

		@Inject(DI.noteDraftsRepository)
		private noteDraftsRepository: NoteDraftsRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		private roleService: RoleService,
		private idService: IdService,
		private noteEntityService: NoteEntityService,
		private queueService: QueueService,
		private loggerService: LoggerService,
	) {
		this.logger = this.loggerService.getLogger('note-draft');
	}

	@bindThis
	public async get(me: MiLocalUser, draftId: MiNoteDraft['id']): Promise<MiNoteDraft | null> {
		const draft = await this.noteDraftsRepository.findOneBy({
			id: draftId,
			userId: me.id,
		});

		return draft;
	}

	@bindThis
	public async create(me: MiLocalUser, data: NoteDraftOptions, draftId = this.idService.gen()): Promise<MiNoteDraft> {
		//#region check draft limit
		const policies = await this.roleService.getUserPolicies(me.id);

		const currentCount = await this.noteDraftsRepository.countBy({
			userId: me.id,
		});
		if (currentCount >= policies.noteDraftLimit) {
			throw new IdentifiableError('9ee33bbe-fde3-4c71-9b51-e50492c6b9c8', 'Too many drafts');
		}

		if (data.isActuallyScheduled) {
			const currentScheduledCount = await this.noteDraftsRepository.countBy({
				userId: me.id,
				isActuallyScheduled: true,
			});
			if (currentScheduledCount >= policies.scheduleNoteLimit) {
				throw new IdentifiableError('c3275f19-4558-4c59-83e1-4f684b5fab66', 'Too many scheduled notes');
			}
		}
		//#endregion

		await this.validate(me, data);

		const draft = await this.noteDraftsRepository.insertOne({
			...data,
			id: draftId,
			userId: me.id,
		});

		if (draft.scheduledAt && draft.isActuallyScheduled) {
			await this.trySchedule(draft);
		}

		return draft;
	}

	@bindThis
	public async update(me: MiLocalUser, draftId: MiNoteDraft['id'], data: Partial<NoteDraftOptions>): Promise<MiNoteDraft> {
		const draft = await this.noteDraftsRepository.findOneBy({
			id: draftId,
			userId: me.id,
		});

		if (draft == null) {
			throw new IdentifiableError('49cd6b9d-848e-41ee-b0b9-adaca711a6b1', 'No such note draft');
		}
		if (draft.reservedNoteId != null) {
			throw new IdentifiableError('49cd6b9d-848e-41ee-b0b9-adaca711a6b1', 'No such note draft');
		}

		//#region check draft limit
		const policies = await this.roleService.getUserPolicies(me.id);

		if (!draft.isActuallyScheduled && data.isActuallyScheduled) {
			const currentScheduledCount = await this.noteDraftsRepository.countBy({
				userId: me.id,
				isActuallyScheduled: true,
			});
			if (currentScheduledCount >= policies.scheduleNoteLimit) {
				throw new IdentifiableError('bacdf856-5c51-4159-b88a-804fa5103be5', 'Too many scheduled notes');
			}
		}
		//#endregion

		const nextData = {
			...data,
			scheduledAt: data.scheduledAt === undefined ? draft.scheduledAt : data.scheduledAt,
			isActuallyScheduled: data.isActuallyScheduled === undefined ? draft.isActuallyScheduled : data.isActuallyScheduled,
		};
		const validatesWholeDraft = nextData.isActuallyScheduled && (data.isActuallyScheduled === true || data.scheduledAt !== undefined);
		const validationData: Partial<NoteDraftOptions> = validatesWholeDraft ? {
			...draft,
			...nextData,
		} : { ...nextData };
		if (!validatesWholeDraft && (data.visibility !== undefined || data.visibleUserIds !== undefined || data.channelId !== undefined)) {
			validationData.visibility = data.visibility ?? draft.visibility;
			validationData.visibleUserIds = data.visibleUserIds ?? draft.visibleUserIds;
			validationData.channelId = data.channelId === undefined ? draft.channelId : data.channelId;
		}
		if (!validatesWholeDraft && (data.dimension !== undefined || data.localOnly !== undefined)) {
			validationData.dimension = data.dimension === undefined ? draft.dimension : data.dimension;
		}

		await this.validate(me, validationData, { ...draft, ...nextData });
		if (validationData.channelId != null) {
			nextData.visibility = validationData.visibility;
			nextData.visibleUserIds = validationData.visibleUserIds;
			nextData.localOnly = validationData.localOnly;
		}
		if (typeof validationData.dimension === 'number' && validationData.dimension >= 1000) {
			nextData.localOnly = true;
		}
		const updatedDraft = await this.noteDraftsRepository.createQueryBuilder().update()
			.set({
				...nextData,
				scheduledFailureReason: null,
			})
			.where('id = :id', { id: draftId })
			.andWhere('"userId" = :userId', { userId: me.id })
			.andWhere('"reservedNoteId" IS NULL')
			.returning('*')
			.execute()
			.then((response) => response.raw[0]);

		if (updatedDraft == null) {
			throw new IdentifiableError('49cd6b9d-848e-41ee-b0b9-adaca711a6b1', 'No such note draft');
		}

		await this.tryClearSchedule(draftId, draft.scheduledAt);
		if (updatedDraft.scheduledAt != null && updatedDraft.isActuallyScheduled) {
			await this.trySchedule(updatedDraft);
		}

		return updatedDraft;
	}

	@bindThis
	public async delete(me: MiLocalUser, draftId: MiNoteDraft['id']): Promise<void> {
		const draft = await this.noteDraftsRepository.findOneBy({
			id: draftId,
			userId: me.id,
		});

		if (draft == null) {
			throw new IdentifiableError('49cd6b9d-848e-41ee-b0b9-adaca711a6b1', 'No such note draft');
		}
		if (draft.reservedNoteId != null) {
			throw new IdentifiableError('49cd6b9d-848e-41ee-b0b9-adaca711a6b1', 'No such note draft');
		}

		const result = await this.noteDraftsRepository.createQueryBuilder().delete()
			.where('id = :id', { id: draftId })
			.andWhere('"userId" = :userId', { userId: me.id })
			.andWhere('"reservedNoteId" IS NULL')
			.execute();
		if (result.affected !== 1) {
			throw new IdentifiableError('49cd6b9d-848e-41ee-b0b9-adaca711a6b1', 'No such note draft');
		}

		await this.tryClearSchedule(draftId, draft.scheduledAt);
	}

	@bindThis
	public async getDraft(me: MiLocalUser, draftId: MiNoteDraft['id']): Promise<MiNoteDraft> {
		const draft = await this.noteDraftsRepository.findOneBy({
			id: draftId,
			userId: me.id,
		});

		if (draft == null) {
			throw new IdentifiableError('49cd6b9d-848e-41ee-b0b9-adaca711a6b1', 'No such note draft');
		}

		return draft;
	}

	@bindThis
	public async validate(
		me: MiLocalUser,
		data: Partial<NoteDraftOptions>,
		scheduledContent: Partial<NoteDraftOptions> = data,
	): Promise<void> {
		if (data.isActuallyScheduled) {
			const policies = await this.roleService.getUserPolicies(me.id);
			if (!policies.canScheduleNote) {
				throw new IdentifiableError('7cc42034-f7ab-4f7c-87b4-e00854479080', 'User has no permission to schedule notes');
			}
			if (data.scheduledAt == null) {
				throw new IdentifiableError('94a89a43-3591-400a-9c17-dd166e71fdfa', 'scheduledAt is required when isActuallyScheduled is true');
			} else if (data.scheduledAt.getTime() <= Date.now()) {
				throw new IdentifiableError('b34d0c1b-996f-4e34-a428-c636d98df457', 'scheduledAt must be in the future');
			} else if ((data.scheduledAt.getTime() - Date.now()) / 86_400_000 > policies.scheduleNoteMaxDays) {
				throw new IdentifiableError('506006cf-3092-4ae1-8145-b025001c591f', `User can schedule notes up to ${policies.scheduleNoteMaxDays} days in the future`);
			}

			const hasContent = scheduledContent.text?.trim() || scheduledContent.hashtag?.trim() || (scheduledContent.fileIds?.length ?? 0) > 0 || scheduledContent.hasPoll || scheduledContent.renoteId != null;
			if (!hasContent) {
				throw new IdentifiableError(INVALID_SCHEDULED_NOTE_ID, 'Scheduled note has no content');
			}
			if (scheduledContent.hasPoll) {
				const choices = scheduledContent.pollChoices ?? [];
				const normalizedChoices = choices.map(choice => choice.trim());
				if (choices.length < 2 || choices.length > 10 || normalizedChoices.some(choice => choice.length === 0) || new Set(normalizedChoices).size !== choices.length) {
					throw new IdentifiableError(INVALID_SCHEDULED_NOTE_ID, 'Scheduled note has an invalid poll');
				}
			}
		}

		if (data.channelId != null) {
			data.visibility = 'public';
			data.visibleUserIds = [];
			data.localOnly = true;
		}
		if (typeof data.dimension === 'number' && data.dimension >= 1000) {
			data.localOnly = true;
		}

		if (data.pollExpiresAt != null) {
			if (data.pollExpiresAt.getTime() < Date.now()) {
				throw new IdentifiableError('04da457d-b083-4055-9082-955525eda5a5', 'Cannot create expired poll');
			}
		}

		//#region visibleUsers
		let visibleUsers: MiUser[] = [];
		if (data.visibleUserIds != null && data.visibleUserIds.length > 0) {
			visibleUsers = await this.usersRepository.findBy({
				id: In(data.visibleUserIds),
			});
		}
		if (data.visibility === 'specified' && data.visibleUserIds != null && (new Set(data.visibleUserIds).size !== data.visibleUserIds.length || visibleUsers.length !== data.visibleUserIds.length)) {
			throw new IdentifiableError('81df0c8d-2cfe-4e1a-9e93-b948ef455d9d', 'Visible users are missing or duplicated');
		}
		//#endregion

		//#region files
		let files: MiDriveFile[] = [];
		const fileIds = data.fileIds ?? null;
		if (fileIds != null && fileIds.length > 0) {
			files = await this.driveFilesRepository.createQueryBuilder('file')
				.where('file.userId = :userId AND file.id IN (:...fileIds)', {
					userId: me.id,
					fileIds: fileIds,
				})
				.orderBy('array_position(ARRAY[:...fileIds], "id"::text)')
				.setParameters({ fileIds })
				.getMany();

			if (files.length !== fileIds.length) {
				throw new IdentifiableError('b6992544-63e7-67f0-fa7f-32444b1b5306', 'No such drive file');
			}
		}
		//#endregion

		//#region renote
		let renote: MiNote | null = null;
		if (data.renoteId != null) {
			renote = await this.notesRepository.findOneBy({ id: data.renoteId });

			if (renote == null) {
				throw new IdentifiableError('64929870-2540-4d11-af41-3b484d78c956', 'No such renote');
			} else if (isRenote(renote) && !isQuote(renote)) {
				throw new IdentifiableError('76cc5583-5a14-4ad3-8717-0298507e32db', 'Cannot renote');
			}

			// Check blocking
			if (renote.userId !== me.id) {
				const blockExist = await this.blockingsRepository.exists({
					where: {
						blockerId: renote.userId,
						blockeeId: me.id,
					},
				});
				if (blockExist) {
					throw new IdentifiableError('075ca298-e6e7-485a-b570-51a128bb5168', 'You have been blocked by the user');
				}
			}

			if (renote.visibility === 'followers' && renote.userId !== me.id) {
				// 他人のfollowers noteはreject
				throw new IdentifiableError('81eb8188-aea1-4e35-9a8f-3334a3be9855', 'Cannot Renote Due to Visibility');
			} else if (renote.visibility === 'specified') {
				// specified / direct noteはreject
				throw new IdentifiableError('81eb8188-aea1-4e35-9a8f-3334a3be9855', 'Cannot Renote Due to Visibility');
			}

			if (renote.channelId && renote.channelId !== data.channelId) {
				// チャンネルのノートに対しリノート要求がきたとき、チャンネル外へのリノート可否をチェック
				// リノートのユースケースのうち、チャンネル内→チャンネル外は少数だと考えられるため、JOINはせず必要な時に都度取得する
				const renoteChannel = await this.channelsRepository.findOneBy({ id: renote.channelId });
				if (renoteChannel == null) {
					// リノートしたいノートが書き込まれているチャンネルがない
					throw new IdentifiableError('6815399a-6f13-4069-b60d-ed5156249d12', 'No such channel');
				} else if (!renoteChannel.allowRenoteToExternal) {
					// リノート作成のリクエストだが、対象チャンネルがリノート禁止だった場合
					throw new IdentifiableError('ed1952ac-2d26-4957-8b30-2deda76bedf7', 'Cannot Renote to External');
				}
			}
		}
		//#endregion

		//#region reply
		let reply: MiNote | null = null;
		if (data.replyId != null) {
			// Fetch reply
			reply = await this.notesRepository.findOneBy({ id: data.replyId });

			if (reply == null) {
				throw new IdentifiableError('c4721841-22fc-4bb7-ad3d-897ef1d375b5', 'No such reply');
			} else if (isRenote(reply) && !isQuote(reply)) {
				throw new IdentifiableError('e6c10b57-2c09-4da3-bd4d-eda05d51d140', 'Cannot reply To Pure Renote');
			} else if (!await this.noteEntityService.isVisibleForMe(reply, me.id)) {
				throw new IdentifiableError('593c323c-6b6a-4501-a25c-2f36bd2a93d6', 'Cannot reply To Invisible Note');
			} else if (reply.visibility === 'specified' && data.visibility !== 'specified') {
				throw new IdentifiableError('215dbc76-336c-4d2a-9605-95766ba7dab0', 'Cannot reply To Specified Note With Extended Visibility');
			}

			// Check blocking
			if (reply.userId !== me.id) {
				const blockExist = await this.blockingsRepository.exists({
					where: {
						blockerId: reply.userId,
						blockeeId: me.id,
					},
				});
				if (blockExist) {
					throw new IdentifiableError('075ca298-e6e7-485a-b570-51a128bb5168', 'You have been blocked by the user');
				}
			}
		}
		//#endregion

		//#region channel
		let channel: MiChannel | null = null;
		if (data.channelId != null) {
			channel = await this.channelsRepository.findOneBy({ id: data.channelId, isArchived: false });

			if (channel == null) {
				throw new IdentifiableError('6815399a-6f13-4069-b60d-ed5156249d12', 'No such channel');
			}
		}
		//#endregion
	}

	@bindThis
	public async schedule(draft: MiNoteDraft): Promise<void> {
		if (!draft.isActuallyScheduled) return;
		if (draft.scheduledAt == null) return;

		await this.queueService.createPostScheduledNoteJob(draft.id, draft.scheduledAt);
	}

	@bindThis
	public async clearSchedule(draftId: MiNoteDraft['id'], scheduledAt: Date | null): Promise<number> {
		if (scheduledAt == null) return 0;
		return this.queueService.removePostScheduledNoteJob(draftId, scheduledAt);
	}

	private async trySchedule(draft: MiNoteDraft): Promise<void> {
		try {
			await this.schedule(draft);
		} catch (err) {
			this.logQueueError('予約投稿をqueueへ追加できませんでした', draft.id, draft.scheduledAt, err);
		}
	}

	private async tryClearSchedule(draftId: MiNoteDraft['id'], scheduledAt: Date | null): Promise<void> {
		try {
			await this.clearSchedule(draftId, scheduledAt);
		} catch (err) {
			this.logQueueError('予約投稿をqueueから削除できませんでした', draftId, scheduledAt, err);
		}
	}

	private logQueueError(message: string, draftId: MiNoteDraft['id'], scheduledAt: Date | null, err: unknown): void {
		this.logger.error(message, {
			draftId,
			scheduledAt: scheduledAt?.getTime() ?? null,
			errorName: err instanceof Error ? err.name : 'unknown',
		});
	}
}
