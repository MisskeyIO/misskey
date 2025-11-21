import process from 'node:process';
import { portToPid } from 'pid-port';
import fkill from 'fkill';
import Fastify from 'fastify';
import { server } from '../built/boot/common.js';
import { loadConfig } from '../built/config.js';
import { coreLogger } from '../built/logger.js';

const config = loadConfig();
const originEnv = JSON.stringify(process.env);

process.env.NODE_ENV = 'test';

let app;

/**
 * テスト用のサーバインスタンスを起動する
 */
async function launch() {
	process.on('unhandledRejection', console.dir);
	process.on('uncaughtException', err => {
		coreLogger.error(`Uncaught exception: ${err.message}`, { error: err });
	});

	await killTestServer();

	console.log('starting application...');
	app = await server();

	await startControllerEndpoints();

	// ジョブキューは必要な時にテストコード側で起動する
	// ジョブキューが動くとテスト結果の確認に支障が出ることがあるので意図的に動かさないでいる

	console.log('application initialized.');
}

/**
 * 既に重複したポートで待ち受けしているサーバがある場合はkillする
 */
async function killTestServer() {
	//
	try {
		const pid = await portToPid(config.port);
		if (pid) {
			await fkill(pid, { force: true });
		}
	} catch {
		// NOP;
	}
}

/**
 * 別プロセスに切り離してしまったが故に出来なくなった環境変数の書き換え等を実現するためのエンドポイントを作る
 * @param port
 */
async function startControllerEndpoints(port = config.port + 1000) {
	const fastify = Fastify();

	fastify.post('/env', async (req, res) => {
		console.log(req.body);
		const key = req.body['key'];
		if (!key) {
			res.code(400).send({ success: false });
			return;
		}

		process.env[key] = req.body['value'];

		res.code(200).send({ success: true });
	});

	fastify.post('/env-reset', async (req, res) => {
		process.env = JSON.parse(originEnv);

		await app.close();

		await killTestServer();

		console.log('starting application...');
		app = await server();

		res.code(200).send({ success: true });
	});

	await fastify.listen({ port: port, host: 'localhost' });
}

export default launch;
