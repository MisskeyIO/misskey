/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

declare module 'misskey-bubble-game' {
	import type { EventEmitter } from 'eventemitter3';
	import type * as Matter from 'matter-js';

	export type Mono = {
		id: string;
		level: number;
		sizeX: number;
		sizeY: number;
		shape: 'circle' | 'rectangle' | 'custom';
		vertices?: Matter.Vector[][];
		verticesSize?: number;
		score: number;
		dropCandidate: boolean;
	};

	type Log = {
		frame: number;
		operation: 'drop';
		x: number;
	} | {
		frame: number;
		operation: 'hold';
	} | {
		frame: number;
		operation: 'surrender';
	};

	type DropAndFusionGameEvents = {
		changeScore: (newScore: number) => void;
		changeCombo: (newCombo: number) => void;
		changeStock: (newStock: { id: string; mono: Mono }[]) => void;
		changeHolding: (newHolding: { id: string; mono: Mono } | null) => void;
		dropped: (x: number) => void;
		fusioned: (x: number, y: number, nextMono: Mono | null, scoreDelta: number) => void;
		collision: (energy: number, bodyA: Matter.Body, bodyB: Matter.Body) => void;
		monoAdded: (mono: Mono) => void;
		gameOver: () => void;
	};

	export class DropAndFusionGame extends EventEmitter<DropAndFusionGameEvents> {
		readonly GAME_VERSION: number;
		readonly GAME_WIDTH: number;
		readonly GAME_HEIGHT: number;
		readonly DROP_COOLTIME: number;
		readonly PLAYAREA_MARGIN: number;
		frame: number;
		engine: Matter.Engine;
		replayPlaybackRate: number;
		readonly monoDefinitions: Mono[];

		constructor(env: {
			seed: string;
			gameMode: 'normal' | 'yen' | 'square' | 'sweets' | 'space';
			getMonoRenderOptions?: (mono: Mono) => Partial<Matter.IBodyRenderOptions>;
		});

		msToFrame(ms: number): number;
		frameToMs(frame: number): number;
		start(): void;
		tick(): boolean;
		drop(x: number): void;
		hold(): void;
		surrender(): void;
		dispose(): void;
		getLogs(): Log[];
		getActiveMonos(): Mono[];

		static serializeLogs(logs: Log[]): number[][];
	}
}
