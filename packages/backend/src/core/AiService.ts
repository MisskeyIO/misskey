/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { Injectable } from '@nestjs/common';
import type { NSFWJS, PredictionType } from 'nsfwjs';
import { Mutex } from 'async-mutex';
import { sharpBmp } from '@misskey-dev/sharp-read-bmp';
import fetch from 'node-fetch';
import { bindThis } from '@/decorators.js';
import type Logger from '@/logger.js';
import { LoggerService } from '@/core/LoggerService.js';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

const REQUIRED_CPU_FLAGS_X64 = ['avx2', 'fma'];
let isSupportedCpu: undefined | boolean = undefined;

@Injectable()
export class AiService {
	private logger: Logger;
	private model: NSFWJS;
	private modelLoadMutex: Mutex = new Mutex();

	constructor(
		private loggerService: LoggerService,
	) {
		this.logger = this.loggerService.getLogger('ai');
	}

	public async detectSensitive(path: string, mime: string): Promise<PredictionType[] | null>;
	public async detectSensitive(source: string | Buffer): Promise<PredictionType[] | null>;
	@bindThis
	public async detectSensitive(sourceOrPath: string | Buffer, mime?: string): Promise<PredictionType[] | null> {
		try {
			if (isSupportedCpu === undefined) {
				isSupportedCpu = await this.computeIsSupportedCpu();
			}

			if (!isSupportedCpu) {
				this.logger.error('This CPU cannot use TensorFlow.');
				return null;
			}

			const tf = await import('@tensorflow/tfjs-node');
			tf.env().global.fetch = fetch;

			if (this.model == null) {
				const nsfw = await import('nsfwjs');
				await this.modelLoadMutex.runExclusive(async () => {
					if (this.model == null) {
						this.model = await nsfw.load(`file://${_dirname}/../../nsfw-model/`, { size: 299 });
					}
				});
			}

			const image = await (async () => {
				if (typeof sourceOrPath === 'string' && mime != null) {
					const sharp = await sharpBmp(sourceOrPath, mime);
					const { data, info } = await sharp
						.resize(299, 299, { fit: 'inside' })
						.removeAlpha()
						.raw({ depth: 'uchar' })
						.toBuffer({ resolveWithObject: true });

					return tf.tensor3d(data, [info.height, info.width, info.channels], 'int32');
				} else {
					const buffer = sourceOrPath instanceof Buffer ? sourceOrPath : await fs.promises.readFile(sourceOrPath);
					return await tf.node.decodeImage(buffer, 3) as any;
				}
			})();
			try {
				return await this.model.classify(image);
			} finally {
				image.dispose();
			}
		} catch (err) {
			this.logger.error('Failed to detect sensitive', { error: err });
			return null;
		}
	}

	private async computeIsSupportedCpu(): Promise<boolean> {
		switch (process.arch) {
			case 'x64': {
				const cpuFlags = await this.getCpuFlags();
				return REQUIRED_CPU_FLAGS_X64.every(required => cpuFlags.includes(required));
			}
			case 'arm64': {
				// As far as I know, no required CPU flags for ARM64.
				return true;
			}
			default: {
				return false;
			}
		}
	}

	@bindThis
	private async getCpuFlags(): Promise<string[]> {
		try {
			const cpuinfo = await readFile('/proc/cpuinfo', 'utf-8');
			const flagsLine = cpuinfo.split('\n').find(line => line.startsWith('flags'));
			if (!flagsLine) {
				return [];
			}

			const flags = flagsLine.split(':')[1]?.trim() || '';
			return flags.split(/\s+/);
		} catch (err) {
			this.logger.warn('Failed to read CPU flags from /proc/cpuinfo', { error: err });
			return [];
		}
	}
}
