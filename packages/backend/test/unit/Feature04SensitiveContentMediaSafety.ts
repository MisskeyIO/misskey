/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { describe, expect, test, vi } from 'vitest';
import type { Config } from '@/config.js';
import { DriveService } from '@/core/DriveService.js';
import type { DownloadService } from '@/core/DownloadService.js';
import type { FileInfoService } from '@/core/FileInfoService.js';
import type { GlobalEventService } from '@/core/GlobalEventService.js';
import type { IdService } from '@/core/IdService.js';
import type { ImageProcessingService } from '@/core/ImageProcessingService.js';
import type { InternalStorageService } from '@/core/InternalStorageService.js';
import type { ModerationLogService } from '@/core/ModerationLogService.js';
import type { QueueService } from '@/core/QueueService.js';
import type { RolePolicies, RoleService } from '@/core/RoleService.js';
import type { S3Service } from '@/core/S3Service.js';
import { UtilityService } from '@/core/UtilityService.js';
import type { VideoProcessingService } from '@/core/VideoProcessingService.js';
import type DriveChart from '@/core/chart/charts/drive.js';
import type InstanceChart from '@/core/chart/charts/instance.js';
import type PerUserDriveChart from '@/core/chart/charts/per-user-drive.js';
import type { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type {
	DriveFilesRepository,
	DriveFoldersRepository,
	MiMeta,
	UserProfilesRepository,
	UsersRepository,
} from '@/models/_.js';
import { MiDriveFile } from '@/models/DriveFile.js';
import { MiUser } from '@/models/User.js';

function asDependency<T>(value: unknown): T {
	return value as T;
}

function createUser(data: Partial<MiUser> = {}): MiUser {
	return new MiUser({
		id: 'user1',
		username: 'user1',
		usernameLower: 'user1',
		name: null,
		host: null,
		uri: null,
		inbox: null,
		...data,
	});
}

function createDriveFile(data: Partial<MiDriveFile> = {}): MiDriveFile {
	const file = new MiDriveFile();
	file.id = 'file1';
	file.userId = 'owner';
	file.userHost = null;
	file.name = 'file.png';
	file.type = 'image/png';
	file.md5 = '0123456789abcdef0123456789abcdef';
	file.size = 1;
	file.isSensitive = false;
	file.isSensitiveByModerator = false;
	file.maybeSensitive = false;
	file.maybePorn = false;
	file.folderId = null;
	file.comment = null;
	file.blurhash = null;
	file.properties = {};
	file.storedInternal = false;
	file.url = 'https://media.example/file.png';
	file.thumbnailUrl = null;
	file.webpublicUrl = null;
	file.webpublicType = null;
	file.accessKey = null;
	file.thumbnailAccessKey = null;
	file.webpublicAccessKey = null;
	file.uri = null;
	file.src = null;
	file.isLink = false;
	file.requestHeaders = null;
	file.requestIp = null;
	return Object.assign(file, data);
}

function createDriveServiceFixture(options: {
	mediaSilencedHosts?: string[];
	isModerator?: boolean;
	rolePolicies?: Partial<RolePolicies>;
	packResult?: Record<string, unknown>;
} = {}) {
	const config = { host: 'local.example' } as unknown as Config;
	const meta = {
		sensitiveMediaDetection: 'all',
		sensitiveMediaDetectionSensitivity: 'medium',
		enableSensitiveMediaDetectionForVideos: false,
		setSensitiveFlagAutomatically: false,
		mediaSilencedHosts: options.mediaSilencedHosts ?? [],
		disallowUploadWhenPredictedAsPorn: false,
		useObjectStorage: false,
		enableChartsForFederatedInstances: false,
	} as unknown as MiMeta;

	const usersRepository = {
		findOneByOrFail: vi.fn(async ({ id }: { id: string }) => createUser({ id, username: id, usernameLower: id })),
	};
	const userProfilesRepository = {
		findOneBy: vi.fn(async () => ({ alwaysMarkNsfw: false, autoSensitive: false })),
	};
	const insertedFiles: MiDriveFile[] = [];
	const driveFilesRepository = {
		findOneBy: vi.fn(async () => null),
		insertOne: vi.fn(async (file: MiDriveFile) => {
			insertedFiles.push(file);
			return file;
		}),
		update: vi.fn(async () => undefined),
	};
	const driveFoldersRepository = {
		findOneBy: vi.fn(async () => null),
	};
	const fileInfoService = {
		getFileInfo: vi.fn(async () => ({
			size: 1,
			md5: '0123456789abcdef0123456789abcdef',
			type: { mime: 'image/png', ext: 'png' },
			width: 1,
			height: 1,
			orientation: undefined,
			blurhash: null,
			sensitive: false,
			porn: false,
			warnings: [],
		})),
	};
	const userEntityService = {
		isLocalUser: vi.fn((user: MiUser) => user.host == null),
		isRemoteUser: vi.fn((user: MiUser) => user.host != null),
	};
	const driveFileEntityService = {
		validateFileName: vi.fn(() => true),
		calcDriveUsageOf: vi.fn(async () => 0),
		pack: vi.fn(async () => options.packResult ?? { id: 'file1' }),
	};
	const roleService = {
		getUserPolicies: vi.fn(async () => ({
			alwaysMarkNsfw: false,
			canIgnoreAiNsfw: false,
			uploadableFileTypes: ['*/*'],
			driveCapacityMb: 1024,
			maxFileSizeMb: 1024,
			...options.rolePolicies,
		})),
		isModerator: vi.fn(async () => options.isModerator ?? false),
	};
	const globalEventService = {
		publishDriveStream: vi.fn(),
		publishMainStream: vi.fn(),
	};
	const moderationLogService = {
		log: vi.fn(),
	};
	const chart = { update: vi.fn() };

	const service = new DriveService(
		config,
		meta,
		asDependency<UsersRepository>(usersRepository),
		asDependency<UserProfilesRepository>(userProfilesRepository),
		asDependency<DriveFilesRepository>(driveFilesRepository),
		asDependency<DriveFoldersRepository>(driveFoldersRepository),
		asDependency<FileInfoService>(fileInfoService),
		asDependency<UserEntityService>(userEntityService),
		asDependency<DriveFileEntityService>(driveFileEntityService),
		asDependency<IdService>({ gen: vi.fn(() => 'file1') }),
		asDependency<DownloadService>({}),
		asDependency<InternalStorageService>({}),
		asDependency<S3Service>({}),
		asDependency<ImageProcessingService>({}),
		asDependency<VideoProcessingService>({}),
		asDependency<GlobalEventService>(globalEventService),
		asDependency<QueueService>({}),
		asDependency<RoleService>(roleService),
		asDependency<ModerationLogService>(moderationLogService),
		asDependency<DriveChart>(chart),
		asDependency<PerUserDriveChart>(chart),
		asDependency<InstanceChart>(chart),
		new UtilityService(config, meta),
	);

	return {
		service,
		insertedFiles,
		driveFilesRepository,
		fileInfoService,
		globalEventService,
		moderationLogService,
		roleService,
	};
}

describe('Feature 04 sensitive content media safety backend contracts', () => {
	test('marks uploads from configured media-silenced remote hosts as sensitive', async () => {
		const fixture = createDriveServiceFixture({ mediaSilencedHosts: ['media.example'] });
		const remoteUser = createUser({ id: 'remote-user', username: 'remote', usernameLower: 'remote', host: 'media.example' });

		const file = await fixture.service.addFile({
			user: remoteUser,
			path: '/tmp/remote-image.png',
			name: 'remote-image.png',
			isLink: true,
			url: 'https://media.example/remote-image.png',
			uri: 'https://media.example/remote-image.png',
		});

		expect(file.isSensitive).toBe(true);
		expect(fixture.insertedFiles[0]?.isSensitive).toBe(true);
		expect(fixture.fileInfoService.getFileInfo).toHaveBeenCalledWith('/tmp/remote-image.png', expect.objectContaining({
			skipSensitiveDetection: false,
		}));
	});

	test('canIgnoreAiNsfw skips AI detection without forcing sensitivity', async () => {
		const fixture = createDriveServiceFixture({ rolePolicies: { canIgnoreAiNsfw: true } });
		const localUser = createUser({ id: 'local-user', username: 'local', usernameLower: 'local' });

		const file = await fixture.service.addFile({
			user: localUser,
			path: '/tmp/local-image.png',
			name: 'local-image.png',
			isLink: true,
			url: 'https://local.example/local-image.png',
		});

		expect(fixture.fileInfoService.getFileInfo).toHaveBeenCalledWith('/tmp/local-image.png', expect.objectContaining({
			skipSensitiveDetection: true,
		}));
		expect(file.isSensitive).toBe(false);
		expect(fixture.insertedFiles[0]?.isSensitive).toBe(false);
	});

	test('alwaysMarkNsfw still skips detection and forces sensitivity', async () => {
		const fixture = createDriveServiceFixture({ rolePolicies: { alwaysMarkNsfw: true } });
		const localUser = createUser({ id: 'local-user', username: 'local', usernameLower: 'local' });

		const file = await fixture.service.addFile({
			user: localUser,
			path: '/tmp/local-image.png',
			name: 'local-image.png',
			isLink: true,
			url: 'https://local.example/local-image.png',
		});

		expect(fixture.fileInfoService.getFileInfo).toHaveBeenCalledWith('/tmp/local-image.png', expect.objectContaining({
			skipSensitiveDetection: true,
		}));
		expect(file.isSensitive).toBe(true);
		expect(fixture.insertedFiles[0]?.isSensitive).toBe(true);
	});

	test('records moderator-applied sensitivity and emits the moderator audit log', async () => {
		const fixture = createDriveServiceFixture({ isModerator: true });
		const file = createDriveFile({ userId: 'owner', isSensitive: false, isSensitiveByModerator: false });
		const moderator = createUser({ id: 'moderator', username: 'moderator', usernameLower: 'moderator' });

		await fixture.service.updateFile(file, { isSensitive: true }, moderator);

		expect(fixture.driveFilesRepository.update).toHaveBeenCalledWith('file1', expect.objectContaining({
			isSensitive: true,
			isSensitiveByModerator: true,
		}));
		expect(fixture.moderationLogService.log).toHaveBeenCalledWith(moderator, 'markSensitiveDriveFile', expect.objectContaining({
			fileId: 'file1',
			fileUserId: 'owner',
		}));
	});

	test('prevents owners from clearing moderator-applied sensitivity', async () => {
		const fixture = createDriveServiceFixture();
		const owner = createUser({ id: 'owner', username: 'owner', usernameLower: 'owner' });
		const file = createDriveFile({ userId: owner.id, isSensitive: true, isSensitiveByModerator: true });

		await expect(fixture.service.updateFile(file, { isSensitive: false }, owner)).rejects.toThrow(DriveService.CannotUnmarkSensitiveError);
		expect(fixture.driveFilesRepository.update).not.toHaveBeenCalled();
	});
});
