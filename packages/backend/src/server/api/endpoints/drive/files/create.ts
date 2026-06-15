/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import * as Redis from 'ioredis';
import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { DB_MAX_IMAGE_COMMENT_LENGTH } from '@/const.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { DriveService } from '@/core/DriveService.js';
import type { DriveFilesRepository, MiMeta } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '../../../error.js';

const IDEMPOTENCY_PROCESSING = '_';

export const meta = {
	tags: ['drive'],

	requireCredential: true,
	requiredRolePolicy: 'canCreateContent',

	prohibitMoved: true,

	limit: {
		duration: ms('1hour'),
		max: 120,
	},

	requireFile: true,

	kind: 'write:drive',

	description: 'Upload a new drive file.',

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'DriveFile',
	},

	errors: {
		invalidParam: {
			message: 'Invalid param.',
			code: 'INVALID_PARAM',
			id: 'b2da4a73-a9d2-44e5-a81b-28e796874fc3',
		},

		processing: {
			message: 'We are processing your request. Please wait a moment.',
			code: 'PROCESSING',
			id: 'b495d816-b077-4dc1-b135-7fde73fcca5e',
			httpStatusCode: 202,
		},

		invalidFileName: {
			message: 'Invalid file name.',
			code: 'INVALID_FILE_NAME',
			id: 'f449b209-0c60-4e51-84d5-29486263bfd4',
		},

		inappropriate: {
			message: 'Cannot upload the file because it has been determined that it possibly contains inappropriate content.',
			code: 'INAPPROPRIATE',
			id: 'bec5bd69-fba3-43c9-b4fb-2894b66ad5d2',
		},

		noFreeSpace: {
			message: 'Cannot upload the file because you have no free space of drive.',
			code: 'NO_FREE_SPACE',
			id: 'd08dbc37-a6a9-463a-8c47-96c32ab5f064',
		},

		maxFileSizeExceeded: {
			message: 'Cannot upload the file because it exceeds the maximum file size.',
			code: 'MAX_FILE_SIZE_EXCEEDED',
			id: 'b9d8c348-33f0-4673-b9a9-5d4da058977a',
			httpStatusCode: 413,
		},

		unallowedFileType: {
			message: 'Cannot upload the file because it is an unallowed file type.',
			code: 'UNALLOWED_FILE_TYPE',
			id: '4becd248-7f2c-48c4-a9f0-75edc4f9a1ea',
		},

		noSuchFolder: {
			message: 'No such folder.',
			code: 'NO_SUCH_FOLDER',
			id: '31ca6cdb-44f7-4b9d-bf03-4c8067dd7a1a',
		},

		failedToCreateDriveFile: {
			message: 'Failed to create drive file.',
			code: 'FAILED_TO_CREATE_DRIVE_FILE',
			id: '6708863c-6791-4487-aa01-2d682c6e7db0',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		folderId: { type: 'string', format: 'misskey:id', nullable: true, default: null },
		name: { type: 'string', nullable: true, default: null },
		comment: { type: 'string', nullable: true, maxLength: DB_MAX_IMAGE_COMMENT_LENGTH, default: null },
		isSensitive: { type: 'boolean', default: false },
		force: { type: 'boolean', default: false },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		@Inject(DI.meta)
		private serverSettings: MiMeta,

		private driveFileEntityService: DriveFileEntityService,
		private driveService: DriveService,
	) {
		super(meta, paramDef, async (ps, me, _, file, cleanup, ip, headers) => {
			if (file == null) {
				throw new ApiError(meta.errors.invalidParam);
			}

			let idempotencyKey: string | null = null;
			let idempotencyLocked = false;

			// Get 'name' parameter
			try {
				const calcHash = createHash('sha256');
				calcHash.update(JSON.stringify([ps.folderId, ps.name, ps.isSensitive]));
				await pipeline(fs.createReadStream(file.path, { start: 0, end: 1024 * 1024 }), calcHash);
				const hash = calcHash.digest('base64url');
				idempotencyKey = `drive:files:create:idempotent:${me.id}:${hash}`;

				const existing = await this.redisClient.get(idempotencyKey);
				if (existing === IDEMPOTENCY_PROCESSING) {
					throw new ApiError(meta.errors.processing);
				}
				if (existing != null) {
					const driveFile = await this.driveFilesRepository.findOneBy({ id: existing });
					if (driveFile != null) {
						return await this.driveFileEntityService.pack(driveFile, { self: true });
					}
					await this.redisClient.del(idempotencyKey);
				}

				const locked = await this.redisClient.set(idempotencyKey, IDEMPOTENCY_PROCESSING, 'EX', 30, 'NX');
				if (locked !== 'OK') {
					const latest = await this.redisClient.get(idempotencyKey);
					if (latest != null && latest !== IDEMPOTENCY_PROCESSING) {
						const driveFile = await this.driveFilesRepository.findOneBy({ id: latest });
						if (driveFile != null) {
							return await this.driveFileEntityService.pack(driveFile, { self: true });
						}
					}
					throw new ApiError(meta.errors.processing);
				}
				idempotencyLocked = true;

				let name = ps.name ?? file.name ?? null;
				if (name != null) {
					name = name.trim();
					if (name.length === 0) {
						name = null;
					} else if (name === 'blob') {
						name = null;
					} else if (!this.driveFileEntityService.validateFileName(name)) {
						throw new ApiError(meta.errors.invalidFileName);
					}
				}

				// Create file
				const driveFile = await this.driveService.addFile({
					user: me,
					path: file.path,
					name,
					comment: ps.comment,
					folderId: ps.folderId,
					force: ps.force,
					sensitive: ps.isSensitive,
					requestIp: this.serverSettings.enableIpLogging ? ip : null,
					requestHeaders: this.serverSettings.enableIpLogging ? headers : null,
				});
				await this.redisClient.set(idempotencyKey, driveFile.id, 'EX', 60);
				idempotencyLocked = false;
				return await this.driveFileEntityService.pack(driveFile, { self: true });
			} catch (err) {
				if (idempotencyKey != null && idempotencyLocked) {
					await this.deleteProcessingIdempotencyKey(idempotencyKey);
				}

				if (err instanceof ApiError) {
					throw err;
				}

				if (err instanceof Error || typeof err === 'string') {
					console.error(err);
				}
				if (err instanceof IdentifiableError) {
					if (err.id === '282f77bf-5816-4f72-9264-aa14d8261a21') throw new ApiError(meta.errors.inappropriate);
					if (err.id === 'c6244ed2-a39a-4e1c-bf93-f0fbd7764fa6') throw new ApiError(meta.errors.noFreeSpace);
					if (err.id === 'f9e4e5f3-4df4-40b5-b400-f236945f7073') throw new ApiError(meta.errors.maxFileSizeExceeded);
					if (err.id === 'bd71c601-f9b0-4808-9137-a330647ced9b') throw new ApiError(meta.errors.unallowedFileType);
				}
				if (err instanceof DriveService.NoSuchFolderError) throw new ApiError(meta.errors.noSuchFolder);
				throw new ApiError(meta.errors.failedToCreateDriveFile, {
					message: err instanceof Error ? err.message : String(err),
				});
			} finally {
				cleanup?.();
			}
		});
	}

	private async deleteProcessingIdempotencyKey(key: string): Promise<void> {
		await this.redisClient.eval(
			'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
			1,
			key,
			IDEMPOTENCY_PROCESSING,
		);
	}
}
