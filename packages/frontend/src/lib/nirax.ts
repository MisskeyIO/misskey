/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// NIRAX --- A lightweight router

import { computed, onBeforeUnmount, shallowRef } from 'vue';
import { EventEmitter } from 'eventemitter3';
import type { Component, ShallowRef, Ref } from 'vue';

function safeURIDecode(str: string): string {
	try {
		return decodeURIComponent(str);
	} catch {
		return str;
	}
}

interface RouteDefBase {
	path: string;
	query?: Record<string, string>;
	loginRequired?: boolean;
	name?: string;
	hash?: string;
	globalCacheKey?: string;
	children?: RouteDef[];
}

interface RouteDefWithComponent extends RouteDefBase {
	component: Component,
}

interface RouteDefWithRedirect extends RouteDefBase {
	redirect: string | ((props: Map<string, string | boolean>) => string);
}

export type RouteDef = RouteDefWithComponent | RouteDefWithRedirect;

type ParsedPath = (string | {
	name: string;
	startsWith?: string;
	wildcard?: boolean;
	optional?: boolean;
})[];

export type RouterEvent = {
	change: (ctx: {
		beforePath: string;
		path: string;
		resolved: Resolved;
		key: string;
	}) => void;
	replace: (ctx: {
		path: string;
		key: string;
	}) => void;
	push: (ctx: {
		beforePath: string;
		path: string;
		route: RouteDef | null;
		props: Map<string, string | boolean> | null;
		key: string;
	}) => void;
	same: () => void;
};

export type Resolved = {
	route: RouteDef;
	props: Map<string, string | boolean>;
	child?: Resolved;
	redirected?: boolean;

	/** @internal */
	_parsedRoute: {
		fullPath: string;
		queryString: string | null;
		hash: string | null;
	};
};

export type AfterNavigationHook = (to: RouteDef, from: RouteDef) => any;

export type PathResolvedResult = Resolved;

export type RouterFlag = 'forcePage';

//#region Path Types
type Prettify<T> = {
	[K in keyof T]: T[K]
} & {};

type RemoveNever<T> = {
	[K in keyof T as T[K] extends never ? never : K]: T[K];
} & {};

type IsPathParameter<Part extends string> = Part extends `${string}:${infer Parameter}` ? Parameter : never;

type GetPathParamKeys<Path extends string> =
	Path extends `${infer A}/${infer B}`
		? IsPathParameter<A> | GetPathParamKeys<B>
		: IsPathParameter<Path>;

type GetPathParams<Path extends string> = Prettify<{
	[Param in GetPathParamKeys<Path> as Param extends `${string}?` ? never : Param]: string;
} & {
	[Param in GetPathParamKeys<Path> as Param extends `${infer OptionalParam}?` ? OptionalParam : never]?: string;
}>;

type UnwrapReadOnly<T> = T extends ReadonlyArray<infer U>
	? U
	: T extends Readonly<infer U>
		? U
		: T;

type GetPaths<Def extends RouteDef> = Def extends { path: infer Path }
	? Path extends string
		? Def extends { children: infer Children }
			? Children extends RouteDef[]
				? Path | `${Path}${FlattenAllPaths<Children>}`
				: Path
			: Path
		: never
	: never;

type FlattenAllPaths<Defs extends RouteDef[]> = GetPaths<Defs[number]>;

type GetSinglePathQuery<Def extends RouteDef, Path extends FlattenAllPaths<RouteDef[]>> = RemoveNever<
	Def extends { path: infer BasePath, children: infer Children }
		? BasePath extends string
			? Path extends `${BasePath}${infer ChildPath}`
				? Children extends RouteDef[]
					? ChildPath extends FlattenAllPaths<Children>
						? GetPathQuery<Children, ChildPath>
						: Record<string, never>
				: never
				: never
			: never
		: Def['path'] extends Path
			? Def extends { query: infer Query }
				? Query extends Record<string, string>
					? UnwrapReadOnly<{ [Key in keyof Query]?: string; }>
					: Record<string, never>
			: Record<string, never>
		: Record<string, never>
	>;

type GetPathQuery<Defs extends RouteDef[], Path extends FlattenAllPaths<Defs>> = GetSinglePathQuery<Defs[number], Path>;

type RequiredIfNotEmpty<K extends string, T extends Record<string, unknown>> = T extends Record<string, never>
	? { [Key in K]?: T }
	: { [Key in K]: T };

type NotRequiredIfEmpty<T extends Record<string, unknown>> = T extends Record<string, never> ? T | undefined : T;

type GetRouterOperationProps<Defs extends RouteDef[], Path extends FlattenAllPaths<Defs>> = NotRequiredIfEmpty<RequiredIfNotEmpty<'params', GetPathParams<Path>> & {
	query?: GetPathQuery<Defs, Path>;
	hash?: string;
}>;
//#endregion

function buildFullPath(args: {
	path: string;
	params?: Record<string, string>;
	query?: Record<string, string>;
	hash?: string;
}) {
	let fullPath = args.path;

	if (args.params) {
		for (const key in args.params) {
			const value = args.params[key];
			const replaceRegex = new RegExp(`:${key}(\\?)?`, 'g');
			fullPath = fullPath.replace(replaceRegex, value ? encodeURIComponent(value) : '');
		}
		// remove any optional parameters that are not provided
		fullPath = fullPath.replace(/\/:\w+\?(?=\/|$)/g, '');
	}

	if (args.query) {
		const queryString = new URLSearchParams(args.query).toString();
		if (queryString) {
			fullPath += '?' + queryString;
		}
	}

	if (args.hash) {
		fullPath += '#' + encodeURIComponent(args.hash);
	}

	return fullPath;
}

function parsePath(path: string): ParsedPath {
	const res = [] as ParsedPath;

	path = path.substring(1);

	for (const part of path.split('/')) {
		if (part.includes(':')) {
			const prefix = part.substring(0, part.indexOf(':'));
			const placeholder = part.substring(part.indexOf(':') + 1);
			const wildcard = placeholder.includes('(*)');
			const optional = placeholder.endsWith('?');
			res.push({
				name: placeholder.replace('(*)', '').replace('?', ''),
				startsWith: prefix !== '' ? prefix : undefined,
				wildcard,
				optional,
			});
		} else if (part.length !== 0) {
			res.push(part);
		}
	}

	return res;
}

export interface IRouter<DEF extends RouteDef[] = RouteDef[]> extends EventEmitter<RouterEvent> {
	current: Resolved;
	currentRef: ShallowRef<Resolved>;
	currentRoute: Ref<RouteDef>;
	navHook: ((path: string, flag?: RouterFlag | null) => boolean) | null;
	afterHooks: Array<AfterNavigationHook | null>;

	/**
	 * ルートの初期化（eventListenerの定義後に必ず呼び出すこと）
	 */
	init(): void;

	resolve(path: string): Resolved | null;

	isReady(): Promise<boolean>;

	getCurrentPath(): string;

	getCurrentFullPath(): string;

	getCurrentKey(): string;

	afterEach(hook: AfterNavigationHook): AfterNavigationHook | undefined;

	push<P extends FlattenAllPaths<DEF>>(path: P, props?: GetRouterOperationProps<DEF, P>, flag?: RouterFlag | null): void;

	replace<P extends FlattenAllPaths<DEF>>(path: P, props?: GetRouterOperationProps<DEF, P>, key?: string | null): void;

	/** どうしても必要な場合に使用（パスが確定している場合は `Nirax.push` を使用すること） */
	pushByPath(fullPath: string, flag?: RouterFlag | null): void;

	/** どうしても必要な場合に使用（パスが確定している場合は `Nirax.replace` を使用すること） */
	replaceByPath(fullPath: string, key?: string | null): void;

	useListener<E extends keyof RouterEvent>(event: E, listener: EventEmitter.EventListener<RouterEvent, E>): void;

	/** @see EventEmitter */
	eventNames(): Array<EventEmitter.EventNames<RouterEvent>>;

	/** @see EventEmitter */
	listeners<T extends EventEmitter.EventNames<RouterEvent>>(
		event: T
	): Array<EventEmitter.EventListener<RouterEvent, T>>;

	/** @see EventEmitter */
	listenerCount(
		event: EventEmitter.EventNames<RouterEvent>
	): number;

	/** @see EventEmitter */
	emit<T extends EventEmitter.EventNames<RouterEvent>>(
		event: T,
		...args: EventEmitter.EventArgs<RouterEvent, T>
	): boolean;

	/** @see EventEmitter */
	on<T extends EventEmitter.EventNames<RouterEvent>>(
		event: T,
		fn: EventEmitter.EventListener<RouterEvent, T>,
		context?: any
	): this;

	/** @see EventEmitter */
	addListener<T extends EventEmitter.EventNames<RouterEvent>>(
		event: T,
		fn: EventEmitter.EventListener<RouterEvent, T>,
		context?: any
	): this;

	/** @see EventEmitter */
	once<T extends EventEmitter.EventNames<RouterEvent>>(
		event: T,
		fn: EventEmitter.EventListener<RouterEvent, T>,
		context?: any
	): this;

	/** @see EventEmitter */
	removeListener<T extends EventEmitter.EventNames<RouterEvent>>(
		event: T,
		fn?: EventEmitter.EventListener<RouterEvent, T>,
		context?: any,
		once?: boolean | undefined
	): this;

	/** @see EventEmitter */
	off<T extends EventEmitter.EventNames<RouterEvent>>(
		event: T,
		fn?: EventEmitter.EventListener<RouterEvent, T>,
		context?: any,
		once?: boolean | undefined
	): this;

	/** @see EventEmitter */
	removeAllListeners(
		event?: EventEmitter.EventNames<RouterEvent>
	): this;
}

export class Nirax<DEF extends RouteDef[]> extends EventEmitter<RouterEvent> implements IRouter<DEF> {
	public current: Resolved;
	public currentRef: ShallowRef<Resolved>;
	public currentRoute: Ref<RouteDef>;
	public navHook: ((path: string, flag?: any) => boolean) | null = null;
	public afterHooks: Array<AfterNavigationHook | null> = [];
	private routes: DEF;
	private currentPath: string;
	private isLoggedIn: boolean;
	private notFoundPageComponent: Component;
	private currentKey = Date.now().toString();
	private redirectCount = 0;

	constructor(routes: Nirax<DEF>['routes'], currentPath: Nirax<DEF>['currentPath'], isLoggedIn: boolean, notFoundPageComponent: Component) {
		super();

		this.routes = routes;
		this.current = this.resolve(currentPath)!;
		this.currentRef = shallowRef(this.current);
		this.currentRoute = computed(() => this.currentRef.value.route);
		this.currentPath = currentPath;
		this.isLoggedIn = isLoggedIn;
		this.notFoundPageComponent = notFoundPageComponent;
	}

	public init() {
		const res = this.navigate(this.currentPath, null, false);
		this.emit('replace', {
			path: res._parsedRoute.fullPath,
			key: this.currentKey,
		});
	}

	public resolve(path: string): Resolved | null {
		const fullPath = path;
		let queryString: string | null = null;
		let hash: string | null = null;
		if (path[0] === '/') path = path.substring(1);
		if (path.includes('#')) {
			hash = path.substring(path.indexOf('#') + 1);
			path = path.substring(0, path.indexOf('#'));
		}
		if (path.includes('?')) {
			queryString = path.substring(path.indexOf('?') + 1);
			path = path.substring(0, path.indexOf('?'));
		}

		const _parsedRoute = {
			fullPath,
			queryString,
			hash,
		};

		if (_DEV_) console.log('Routing: ', path, queryString);

		function check(routes: RouteDef[], _parts: string[]): Resolved | null {
			forEachRouteLoop:
			for (const route of routes) {
				let parts = [..._parts];
				const props = new Map<string, string | boolean>();

				pathMatchLoop:
				for (const p of parsePath(route.path)) {
					if (typeof p === 'string') {
						if (p === parts[0]) {
							parts.shift();
						} else {
							continue forEachRouteLoop;
						}
					} else {
						if (parts[0] == null && !p.optional) {
							continue forEachRouteLoop;
						}
						if (p.wildcard) {
							if (parts.length !== 0) {
								props.set(p.name, safeURIDecode(parts.join('/')));
								parts = [];
							}
							break pathMatchLoop;
						} else {
							if (p.startsWith) {
								if (parts[0] == null || !parts[0].startsWith(p.startsWith)) continue forEachRouteLoop;

								props.set(p.name, safeURIDecode(parts[0].substring(p.startsWith.length)));
								parts.shift();
							} else {
								if (parts[0]) {
									props.set(p.name, safeURIDecode(parts[0]));
								}
								parts.shift();
							}
						}
					}
				}

				if (parts.length === 0) {
					if (route.children) {
						const child = check(route.children, []);
						if (child) {
							return {
								route,
								props,
								child,
								_parsedRoute,
							};
						} else {
							continue forEachRouteLoop;
						}
					}

					if (route.hash != null && hash != null) {
						props.set(route.hash, safeURIDecode(hash));
					}

					if (route.query != null && queryString != null) {
						const queryObject = [...new URLSearchParams(queryString).entries()]
							.reduce((obj, entry) => ({ ...obj, [entry[0]]: entry[1] }), {});

						for (const q in route.query) {
							const as = route.query[q];
							if (queryObject[q]) {
								props.set(as, safeURIDecode(queryObject[q]));
							}
						}
					}

					return {
						route,
						props,
						_parsedRoute,
					};
				} else {
					if (route.children) {
						const child = check(route.children, parts);
						if (child) {
							return {
								route,
								props,
								child,
								_parsedRoute,
							};
						} else {
							continue forEachRouteLoop;
						}
					} else {
						continue forEachRouteLoop;
					}
				}
			}

			return null;
		}

		const _parts = path.split('/').filter(part => part.length !== 0);

		return check(this.routes, _parts);
	}

	public isReady() {
		return Promise.resolve(true);
	}

	public getCurrentPath() {
		return this.currentPath;
	}

	public getCurrentFullPath() {
		return this.current._parsedRoute.fullPath;
	}

	public getCurrentKey() {
		return this.currentKey;
	}

	public afterEach(hook: AfterNavigationHook): AfterNavigationHook | undefined {
		this.afterHooks.push(hook);
		return () => {
			const index = this.afterHooks.indexOf(hook);
			if (index !== -1) {
				return this.afterHooks.splice(index, 1);
			} else {
				return undefined;
			}
		};
	}

	public push<P extends FlattenAllPaths<DEF>>(path: P, props?: GetRouterOperationProps<DEF, P>, flag?: RouterFlag | null) {
		const fullPath = buildFullPath({
			path,
			params: props?.params,
			query: props?.query,
			hash: props?.hash,
		});
		this.pushByPath(fullPath, flag);
	}

	public replace<P extends FlattenAllPaths<DEF>>(path: P, props?: GetRouterOperationProps<DEF, P>, key?: string | null) {
		const fullPath = buildFullPath({
			path,
			params: props?.params,
			query: props?.query,
			hash: props?.hash,
		});
		this.replaceByPath(fullPath, key);
	}

	/** どうしても必要な場合に使用（パスが確定している場合は `Nirax.push` を使用すること） */
	public pushByPath(fullPath: string, flag?: RouterFlag | null) {
		const beforePath = this.getCurrentFullPath();
		if (fullPath === beforePath) {
			this.emit('same');
			return;
		}
		if (this.navHook) {
			const cancel = this.navHook(fullPath, flag ?? undefined);
			if (cancel) return;
		}
		const res = this.navigate(fullPath, null);
		if (res.route.path === '/:(*)') {
			window.location.href = fullPath;
		} else {
			this.emit('push', {
				beforePath,
				path: res._parsedRoute.fullPath,
				route: res.route,
				props: res.props,
				key: this.currentKey,
			});
		}
	}

	/** どうしても必要な場合に使用（パスが確定している場合は `Nirax.replace` を使用すること） */
	public replaceByPath(fullPath: string, key?: string | null) {
		const res = this.navigate(fullPath, key);
		this.emit('replace', {
			path: res._parsedRoute.fullPath,
			key: this.currentKey,
		});
	}

	public useListener<E extends keyof RouterEvent>(event: E, listener: EventEmitter.EventListener<RouterEvent, E>) {
		this.addListener(event, listener);

		onBeforeUnmount(() => {
			this.removeListener(event, listener);
		});
	}

	private navigate(path: string, key: string | null | undefined, emitChange = true, _redirected = false): Resolved {
		const beforePath = this.currentPath;
		const beforeRoute = this.currentRoute.value;
		this.currentPath = path;

		const res = this.resolve(this.currentPath);

		if (res == null) {
			throw new Error('no route found for: ' + path);
		}

		for (let current: Resolved | undefined = res; current; current = current.child) {
			if ('redirect' in current.route) {
				let redirectPath: string;
				if (typeof current.route.redirect === 'function') {
					redirectPath = current.route.redirect(current.props);
				} else {
					redirectPath = current.route.redirect + (current._parsedRoute.queryString ? '?' + current._parsedRoute.queryString : '') + (current._parsedRoute.hash ? '#' + current._parsedRoute.hash : '');
				}
				if (_DEV_) console.log('Redirecting to: ', redirectPath);
				if (_redirected && this.redirectCount++ > 10) {
					throw new Error('redirect loop detected');
				}
				return this.navigate(redirectPath, null, emitChange, true);
			}
		}

			if (res.route.loginRequired && !this.isLoggedIn && 'component' in res.route) {
				res.route.component = this.notFoundPageComponent;
				res.props.set('showLoginPopup', true);
			}

		const isSamePath = beforePath === path;
		if (isSamePath && key == null) key = this.currentKey;
		this.current = res;
		this.currentRef.value = res;
		this.currentRoute.value = res.route;
		this.currentKey = res.route.globalCacheKey ?? key ?? path;

		if (emitChange && res.route.path !== '/:(*)') {
			this.emit('change', {
				beforePath,
				path,
				resolved: res,
				key: this.currentKey,
			});
		}

		if (this.afterHooks.length > 0) {
			for (const hook of this.afterHooks) {
				if (hook) hook(res.route, beforeRoute);
			}
		}

		this.redirectCount = 0;
		return {
			...res,
			redirected: _redirected,
		};
	}
}
