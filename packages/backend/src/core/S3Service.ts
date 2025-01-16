/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { URL } from 'node:url';
import * as http from 'node:http';
import * as https from 'node:https';
import { Inject, Injectable } from '@nestjs/common';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { NodeHttpHandler, NodeHttpHandlerOptions } from '@smithy/node-http-handler';
import { bindThis } from '@/decorators.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import type { DeleteObjectCommandInput, PutObjectCommandInput } from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
	constructor(
		@Inject(DI.config)
		private config: Config,

		private httpRequestService: HttpRequestService,
	) {
	}

	@bindThis
	public getS3Client(): S3Client {
		const u = `${this.config.s3?.useSSL ? 'https' : 'http'}://${this.config.s3?.endpoint ?? 'example.net'}`; // dummy url to select http(s) agent

		const agent = this.httpRequestService.getAgentByUrl(new URL(u), !this.config.s3?.options?.useProxy);
		const handlerOption: NodeHttpHandlerOptions = {};
		if (this.config.s3?.useSSL) {
			handlerOption.httpsAgent = agent as https.Agent;
		} else {
			handlerOption.httpAgent = agent as http.Agent;
		}

		return new S3Client({
			endpoint: this.config.s3?.endpoint ? u : undefined,
			credentials: (this.config.s3 && (this.config.s3.accessKey !== null && this.config.s3.secretKey !== null)) ? {
				accessKeyId: this.config.s3.accessKey,
				secretAccessKey: this.config.s3.secretKey,
			} : undefined,
			region: this.config.s3?.region ?? 'us-east-1',
			tls: this.config.s3?.useSSL,
			forcePathStyle: this.config.s3?.options?.forcePathStyle ?? false, // AWS with endPoint omitted
			requestHandler: new NodeHttpHandler(handlerOption),
			requestChecksumCalculation: 'WHEN_REQUIRED',
			responseChecksumValidation: 'WHEN_REQUIRED',
		});
	}

	@bindThis
	public async upload(input: PutObjectCommandInput) {
		const client = this.getS3Client();
		return new Upload({
			client,
			params: input,
			partSize: (client.config.endpoint && (await client.config.endpoint()).hostname === 'storage.googleapis.com')
				? 500 * 1024 * 1024
				: 8 * 1024 * 1024,
		}).done();
	}

	@bindThis
	public delete(input: DeleteObjectCommandInput) {
		const client = this.getS3Client();
		return client.send(new DeleteObjectCommand(input));
	}
}
