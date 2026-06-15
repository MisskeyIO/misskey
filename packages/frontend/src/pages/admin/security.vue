<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<SearchMarker path="/admin/security" :label="i18n.ts.security" :keywords="['security']" icon="ti ti-lock" :inlining="['botProtection']">
			<div class="_gaps_m">
				<XBotProtection/>

				<SearchMarker v-slot="slotProps" :keywords="['sensitive', 'media', 'detection']">
					<MkFolder :defaultOpen="slotProps.isParentOfTarget">
						<template #icon><SearchIcon><i class="ti ti-eye-off"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.sensitiveMediaDetection }}</SearchLabel></template>
						<template v-if="sensitiveMediaDetectionForm.savedState.sensitiveMediaDetection === 'all'" #suffix>{{ i18n.ts.all }}</template>
						<template v-else-if="sensitiveMediaDetectionForm.savedState.sensitiveMediaDetection === 'local'" #suffix>{{ i18n.ts.localOnly }}</template>
						<template v-else-if="sensitiveMediaDetectionForm.savedState.sensitiveMediaDetection === 'remote'" #suffix>{{ i18n.ts.remoteOnly }}</template>
						<template v-else #suffix>{{ i18n.ts.none }}</template>
						<template v-if="sensitiveMediaDetectionForm.modified.value" #footer>
							<MkFormFooter :form="sensitiveMediaDetectionForm"/>
						</template>

						<div class="_gaps_m">
							<div><SearchText>{{ i18n.ts._sensitiveMediaDetection.description }}</SearchText></div>

							<MkRadios
								v-model="sensitiveMediaDetectionForm.state.sensitiveMediaDetection"
								:options="[
									{ value: 'none', label: i18n.ts.none },
									{ value: 'all', label: i18n.ts.all },
									{ value: 'local', label: i18n.ts.localOnly },
									{ value: 'remote', label: i18n.ts.remoteOnly },
								]"
							>
							</MkRadios>

							<SearchMarker :keywords="['sensitivity']">
								<MkRange v-model="sensitiveMediaDetectionForm.state.sensitiveMediaDetectionSensitivity" :min="0" :max="4" :step="1" :textConverter="(v) => `${v + 1}`">
									<template #label><SearchLabel>{{ i18n.ts._sensitiveMediaDetection.sensitivity }}</SearchLabel></template>
									<template #caption><SearchText>{{ i18n.ts._sensitiveMediaDetection.sensitivityDescription }}</SearchText></template>
								</MkRange>
							</SearchMarker>

							<SearchMarker :keywords="['video', 'analyze']">
								<MkSwitch v-model="sensitiveMediaDetectionForm.state.enableSensitiveMediaDetectionForVideos">
									<template #label><SearchLabel>{{ i18n.ts._sensitiveMediaDetection.analyzeVideos }}</SearchLabel><span class="_beta">{{ i18n.ts.beta }}</span></template>
									<template #caption><SearchText>{{ i18n.ts._sensitiveMediaDetection.analyzeVideosDescription }}</SearchText></template>
								</MkSwitch>
							</SearchMarker>

							<SearchMarker :keywords="['flag', 'automatically']">
								<MkSwitch v-model="sensitiveMediaDetectionForm.state.setSensitiveFlagAutomatically">
									<template #label><SearchLabel>{{ i18n.ts._sensitiveMediaDetection.setSensitiveFlagAutomatically }}</SearchLabel> ({{ i18n.ts.notRecommended }})</template>
									<template #caption><SearchText>{{ i18n.ts._sensitiveMediaDetection.setSensitiveFlagAutomaticallyDescription }}</SearchText></template>
								</MkSwitch>
							</SearchMarker>

							<!-- 現状 false positive が多すぎて実用に耐えない
					<MkSwitch v-model="disallowUploadWhenPredictedAsPorn">
						<template #label>{{ i18n.ts._sensitiveMediaDetection.disallowUploadWhenPredictedAsPorn }}</template>
					</MkSwitch>
					-->
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker v-slot="slotProps" :keywords="['email', 'validation']">
					<MkFolder :defaultOpen="slotProps.isParentOfTarget">
						<template #label><SearchLabel>Active Email Validation</SearchLabel></template>
						<template v-if="emailValidationForm.savedState.enableActiveEmailValidation" #suffix>Enabled</template>
						<template v-else #suffix>Disabled</template>
						<template v-if="emailValidationForm.modified.value" #footer>
							<MkFormFooter :form="emailValidationForm"/>
						</template>

						<div class="_gaps_m">
							<div><SearchText>{{ i18n.ts.activeEmailValidationDescription }}</SearchText></div>

							<SearchMarker>
								<MkSwitch v-model="emailValidationForm.state.enableActiveEmailValidation">
									<template #label><SearchLabel>Enable</SearchLabel></template>
								</MkSwitch>
							</SearchMarker>

							<SearchMarker>
								<MkSwitch v-model="emailValidationForm.state.enableVerifymailApi">
									<template #label><SearchLabel>Use Verifymail.io API</SearchLabel></template>
								</MkSwitch>
							</SearchMarker>

							<SearchMarker>
								<MkInput v-model="emailValidationForm.state.verifymailAuthKey">
									<template #prefix><i class="ti ti-key"></i></template>
									<template #label><SearchLabel>Verifymail.io API Auth Key</SearchLabel></template>
								</MkInput>
							</SearchMarker>

							<SearchMarker>
								<MkSwitch v-model="emailValidationForm.state.enableTruemailApi">
									<template #label><SearchLabel>Use TrueMail API</SearchLabel></template>
								</MkSwitch>
							</SearchMarker>

							<SearchMarker>
								<MkInput v-model="emailValidationForm.state.truemailInstance">
									<template #prefix><i class="ti ti-key"></i></template>
									<template #label><SearchLabel>TrueMail API Instance</SearchLabel></template>
								</MkInput>
							</SearchMarker>

							<SearchMarker>
								<MkInput v-model="emailValidationForm.state.truemailAuthKey">
									<template #prefix><i class="ti ti-key"></i></template>
									<template #label><SearchLabel>TrueMail API Auth Key</SearchLabel></template>
								</MkInput>
							</SearchMarker>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker v-slot="slotProps" :keywords="['banned', 'email', 'domains', 'blacklist']">
					<MkFolder :defaultOpen="slotProps.isParentOfTarget">
						<template #label><SearchLabel>Banned Email Domains</SearchLabel></template>
						<template v-if="bannedEmailDomainsForm.modified.value" #footer>
							<MkFormFooter :form="bannedEmailDomainsForm"/>
						</template>

						<div class="_gaps_m">
							<SearchMarker>
								<MkTextarea v-model="bannedEmailDomainsForm.state.bannedEmailDomains">
									<template #label><SearchLabel>Banned Email Domains List</SearchLabel></template>
								</MkTextarea>
							</SearchMarker>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker v-slot="slotProps" :keywords="['indieauth', 'indie', 'auth', 'client']">
					<MkFolder :defaultOpen="slotProps.isParentOfTarget">
						<template #icon><SearchIcon><i class="ti ti-id"></i></SearchIcon></template>
						<template #label><SearchLabel>IndieAuth Clients</SearchLabel></template>
						<template #suffix>{{ indieAuthClients.length }}</template>
						<template #footer>
							<div class="_buttons">
								<MkButton rounded @click="addIndieAuthClient"><i class="ti ti-plus"></i> {{ i18n.ts.add }}</MkButton>
							</div>
						</template>

						<div class="_gaps_m">
							<MkLoading v-if="indieAuthLoading"/>
							<template v-else>
								<MkFolder v-for="client in indieAuthClients" :key="client._id" :defaultOpen="client.isNew">
									<template #label><SearchLabel>{{ client.name || client.id || 'New IndieAuth Client' }}</SearchLabel></template>
									<template #caption>{{ client.id }}</template>
									<template #footer>
										<div class="_buttons">
											<MkButton rounded primary @click="saveIndieAuthClient(client)"><i class="ti ti-device-floppy"></i> {{ i18n.ts.save }}</MkButton>
											<MkButton rounded danger @click="deleteIndieAuthClient(client)"><i class="ti ti-trash"></i> {{ i18n.ts.delete }}</MkButton>
										</div>
									</template>

									<div class="_gaps_m">
										<SearchMarker>
											<MkInput v-model="client.id" :disabled="!client.isNew">
												<template #label><SearchLabel>Client ID</SearchLabel></template>
											</MkInput>
										</SearchMarker>
										<SearchMarker>
											<MkInput v-model="client.name">
												<template #label><SearchLabel>{{ i18n.ts.name }}</SearchLabel></template>
											</MkInput>
										</SearchMarker>
										<SearchMarker>
											<MkTextarea v-model="client.redirectUrisText">
												<template #label><SearchLabel>Redirect URIs</SearchLabel></template>
												<template #caption><SearchText>Enter one URI per line.</SearchText></template>
											</MkTextarea>
										</SearchMarker>
									</div>
								</MkFolder>
								<MkButton v-if="indieAuthHasMore" :disabled="indieAuthLoadingMore" @click="loadMoreIndieAuthClients">
									<i class="ti ti-reload"></i>{{ i18n.ts.more }}
								</MkButton>
							</template>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker v-slot="slotProps" :keywords="['sso', 'single', 'sign', 'on', 'saml', 'jwt']">
					<MkFolder :defaultOpen="slotProps.isParentOfTarget">
						<template #icon><SearchIcon><i class="ti ti-login-2"></i></SearchIcon></template>
						<template #label><SearchLabel>Single Sign-On Service Providers</SearchLabel></template>
						<template #suffix>{{ ssoProviders.length }}</template>
						<template #footer>
							<div class="_buttons">
								<MkButton rounded @click="addSsoProvider"><i class="ti ti-plus"></i> {{ i18n.ts.add }}</MkButton>
							</div>
						</template>

						<div class="_gaps_m">
							<MkLoading v-if="ssoLoading"/>
							<template v-else>
								<MkFolder v-for="provider in ssoProviders" :key="provider._id" :defaultOpen="provider.isNew">
									<template #label><SearchLabel>{{ provider.name || provider.issuer || 'New SSO Provider' }}</SearchLabel></template>
									<template #caption>{{ provider.type.toUpperCase() }} / {{ provider.binding }}</template>
									<template #footer>
										<div class="_buttons">
											<MkButton rounded primary @click="saveSsoProvider(provider)"><i class="ti ti-device-floppy"></i> {{ i18n.ts.save }}</MkButton>
											<MkButton rounded danger @click="deleteSsoProvider(provider)"><i class="ti ti-trash"></i> {{ i18n.ts.delete }}</MkButton>
										</div>
									</template>

									<div class="_gaps_m">
										<SearchMarker>
											<MkInput v-model="provider.name">
												<template #label><SearchLabel>{{ i18n.ts.name }}</SearchLabel></template>
											</MkInput>
										</SearchMarker>
										<SearchMarker>
											<MkRadios
												v-model="provider.type"
												:options="[
													{ value: 'saml', label: 'SAML', disabled: !provider.isNew },
													{ value: 'jwt', label: 'JWT', disabled: !provider.isNew },
												]"
											>
												<template #label><SearchLabel>Type</SearchLabel></template>
											</MkRadios>
										</SearchMarker>
										<SearchMarker>
											<MkRadios
												v-model="provider.binding"
												:options="[
													{ value: 'redirect', label: 'Redirect' },
													{ value: 'post', label: 'POST' },
												]"
											>
												<template #label><SearchLabel>Binding</SearchLabel></template>
											</MkRadios>
										</SearchMarker>
										<SearchMarker>
											<MkInput v-model="provider.issuer">
												<template #label><SearchLabel>Issuer</SearchLabel></template>
											</MkInput>
										</SearchMarker>
										<SearchMarker>
											<MkTextarea v-model="provider.audienceText">
												<template #label><SearchLabel>Audience</SearchLabel></template>
												<template #caption><SearchText>Enter one audience value per line.</SearchText></template>
											</MkTextarea>
										</SearchMarker>
										<SearchMarker>
											<MkInput v-model="provider.acsUrl" type="url">
												<template #label><SearchLabel>ACS URL</SearchLabel></template>
											</MkInput>
										</SearchMarker>
										<SearchMarker>
											<MkTextarea v-model="provider.publicKey">
												<template #label><SearchLabel>Public Key</SearchLabel></template>
											</MkTextarea>
										</SearchMarker>
										<SearchMarker>
											<MkTextarea v-model="provider.privateKey">
												<template #label><SearchLabel>Private Key</SearchLabel></template>
											</MkTextarea>
										</SearchMarker>
										<SearchMarker>
											<MkInput v-model="provider.signatureAlgorithm">
												<template #label><SearchLabel>Signature Algorithm</SearchLabel></template>
											</MkInput>
										</SearchMarker>
										<SearchMarker>
											<MkInput v-model="provider.cipherAlgorithm">
												<template #label><SearchLabel>Cipher Algorithm</SearchLabel></template>
											</MkInput>
										</SearchMarker>
										<SearchMarker>
											<MkSwitch v-model="provider.wantAuthnRequestsSigned">
												<template #label><SearchLabel>Require signed AuthnRequests</SearchLabel></template>
											</MkSwitch>
										</SearchMarker>
										<SearchMarker>
											<MkSwitch v-model="provider.wantAssertionsSigned">
												<template #label><SearchLabel>Require signed assertions</SearchLabel></template>
											</MkSwitch>
										</SearchMarker>
										<SearchMarker>
											<MkSwitch v-model="provider.wantEmailAddressNormalized">
												<template #label><SearchLabel>Normalize email address</SearchLabel></template>
											</MkSwitch>
										</SearchMarker>
									</div>
								</MkFolder>
								<MkButton v-if="ssoHasMore" :disabled="ssoLoadingMore" @click="loadMoreSsoProviders">
									<i class="ti ti-reload"></i>{{ i18n.ts.more }}
								</MkButton>
							</template>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker v-slot="slotProps" :keywords="['log', 'ipAddress']">
					<MkFolder :defaultOpen="slotProps.isParentOfTarget">
						<template #label><SearchLabel>Log IP address</SearchLabel></template>
						<template v-if="ipLoggingForm.savedState.enableIpLogging" #suffix>Enabled</template>
						<template v-else #suffix>Disabled</template>
						<template v-if="ipLoggingForm.modified.value" #footer>
							<MkFormFooter :form="ipLoggingForm"/>
						</template>

						<div class="_gaps_m">
							<SearchMarker>
								<MkSwitch v-model="ipLoggingForm.state.enableIpLogging">
									<template #label><SearchLabel>Enable</SearchLabel></template>
								</MkSwitch>
							</SearchMarker>
						</div>
					</MkFolder>
				</SearchMarker>
			</div>
		</SearchMarker>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import * as Misskey from 'misskey-js';
import XBotProtection from './bot-protection.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkRadios from '@/components/MkRadios.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkRange from '@/components/MkRange.vue';
import MkInput from '@/components/MkInput.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useForm } from '@/composables/use-form.js';
import MkFormFooter from '@/components/MkFormFooter.vue';
import { genId } from '@/utility/id.js';

type AdminAuthEndpoint = 'admin/indie-auth/list' | 'admin/indie-auth/create' | 'admin/indie-auth/update' | 'admin/indie-auth/delete' | 'admin/sso/list' | 'admin/sso/create' | 'admin/sso/update' | 'admin/sso/delete';
type SsoProviderType = 'saml' | 'jwt';
type SsoProviderBinding = 'post' | 'redirect';
type ApiReq = Misskey.Endpoints[keyof Misskey.Endpoints]['req'];

interface IndieAuthClientResponse {
	id: string;
	createdAt: string;
	name: string | null;
	redirectUris: string[];
}

interface EditableIndieAuthClient {
	_id: string;
	id: string;
	createdAt: string | null;
	name: string;
	redirectUrisText: string;
	isNew: boolean;
}

interface SsoProviderResponse {
	id: string;
	createdAt: string;
	name: string | null;
	type: SsoProviderType;
	issuer: string;
	audience: string[];
	binding: SsoProviderBinding;
	acsUrl: string;
	publicKey: string;
	signatureAlgorithm: string;
	cipherAlgorithm: string | null;
	wantAuthnRequestsSigned: boolean;
	wantAssertionsSigned: boolean;
	wantEmailAddressNormalized: boolean;
}

interface EditableSsoProvider {
	_id: string;
	id: string | null;
	createdAt: string | null;
	name: string;
	type: SsoProviderType;
	issuer: string;
	audienceText: string;
	binding: SsoProviderBinding;
	acsUrl: string;
	publicKey: string;
	privateKey: string;
	signatureAlgorithm: string;
	cipherAlgorithm: string;
	wantAuthnRequestsSigned: boolean;
	wantAssertionsSigned: boolean;
	wantEmailAddressNormalized: boolean;
	isNew: boolean;
}

const ADMIN_AUTH_PAGE_SIZE = 10;

function adminEndpoint(endpoint: AdminAuthEndpoint): keyof Misskey.Endpoints {
	return endpoint as keyof Misskey.Endpoints;
}

function apiReq(data: Record<string, unknown>): ApiReq {
	return data as ApiReq;
}

function splitMultilineValue(value: string): string[] {
	return value.split('\n').map(line => line.trim()).filter(line => line !== '');
}

function nullableText(value: string): string | null {
	return value.trim() === '' ? null : value;
}

function toEditableIndieAuthClient(client: IndieAuthClientResponse): EditableIndieAuthClient {
	return {
		_id: client.id,
		id: client.id,
		createdAt: client.createdAt,
		name: client.name ?? '',
		redirectUrisText: client.redirectUris.join('\n'),
		isNew: false,
	};
}

function toEditableSsoProvider(provider: SsoProviderResponse): EditableSsoProvider {
	return {
		_id: provider.id,
		id: provider.id,
		createdAt: provider.createdAt,
		name: provider.name ?? '',
		type: provider.type,
		issuer: provider.issuer,
		audienceText: provider.audience.join('\n'),
		binding: provider.binding,
		acsUrl: provider.acsUrl,
		publicKey: provider.publicKey,
		privateKey: '',
		signatureAlgorithm: provider.signatureAlgorithm,
		cipherAlgorithm: provider.cipherAlgorithm ?? '',
		wantAuthnRequestsSigned: provider.wantAuthnRequestsSigned,
		wantAssertionsSigned: provider.wantAssertionsSigned,
		wantEmailAddressNormalized: provider.wantEmailAddressNormalized,
		isNew: false,
	};
}

const meta = await misskeyApi('admin/meta');

const sensitiveMediaDetectionForm = useForm({
	sensitiveMediaDetection: meta.sensitiveMediaDetection,
	sensitiveMediaDetectionSensitivity: meta.sensitiveMediaDetectionSensitivity === 'veryLow' ? 0 :
	meta.sensitiveMediaDetectionSensitivity === 'low' ? 1 :
	meta.sensitiveMediaDetectionSensitivity === 'medium' ? 2 :
	meta.sensitiveMediaDetectionSensitivity === 'high' ? 3 :
	meta.sensitiveMediaDetectionSensitivity === 'veryHigh' ? 4 : 0,
	setSensitiveFlagAutomatically: meta.setSensitiveFlagAutomatically,
	enableSensitiveMediaDetectionForVideos: meta.enableSensitiveMediaDetectionForVideos,
}, async (state) => {
	await os.apiWithDialog('admin/update-meta', {
		sensitiveMediaDetection: state.sensitiveMediaDetection,
		sensitiveMediaDetectionSensitivity:
			state.sensitiveMediaDetectionSensitivity === 0 ? 'veryLow' :
			state.sensitiveMediaDetectionSensitivity === 1 ? 'low' :
			state.sensitiveMediaDetectionSensitivity === 2 ? 'medium' :
			state.sensitiveMediaDetectionSensitivity === 3 ? 'high' :
			state.sensitiveMediaDetectionSensitivity === 4 ? 'veryHigh' :
			null as never,
		setSensitiveFlagAutomatically: state.setSensitiveFlagAutomatically,
		enableSensitiveMediaDetectionForVideos: state.enableSensitiveMediaDetectionForVideos,
	});
	fetchInstance(true);
});

const ipLoggingForm = useForm({
	enableIpLogging: meta.enableIpLogging,
}, async (state) => {
	await os.apiWithDialog('admin/update-meta', {
		enableIpLogging: state.enableIpLogging,
	});
	fetchInstance(true);
});

const emailValidationForm = useForm({
	enableActiveEmailValidation: meta.enableActiveEmailValidation,
	enableVerifymailApi: meta.enableVerifymailApi,
	verifymailAuthKey: meta.verifymailAuthKey,
	enableTruemailApi: meta.enableTruemailApi,
	truemailInstance: meta.truemailInstance,
	truemailAuthKey: meta.truemailAuthKey,
}, async (state) => {
	await os.apiWithDialog('admin/update-meta', {
		enableActiveEmailValidation: state.enableActiveEmailValidation,
		enableVerifymailApi: state.enableVerifymailApi,
		verifymailAuthKey: state.verifymailAuthKey,
		enableTruemailApi: state.enableTruemailApi,
		truemailInstance: state.truemailInstance,
		truemailAuthKey: state.truemailAuthKey,
	});
	fetchInstance(true);
});

const bannedEmailDomainsForm = useForm({
	bannedEmailDomains: meta.bannedEmailDomains?.join('\n') || '',
}, async (state) => {
	await os.apiWithDialog('admin/update-meta', {
		bannedEmailDomains: state.bannedEmailDomains.split('\n'),
	});
	fetchInstance(true);
});

const indieAuthClients = ref<EditableIndieAuthClient[]>([]);
const indieAuthLoading = ref(true);
const indieAuthLoadingMore = ref(false);
const indieAuthHasMore = ref(false);

const ssoProviders = ref<EditableSsoProvider[]>([]);
const ssoLoading = ref(true);
const ssoLoadingMore = ref(false);
const ssoHasMore = ref(false);

function errorToString(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

async function loadIndieAuthClients(options: { append: boolean; } = { append: false }) {
	if (options.append) {
		indieAuthLoadingMore.value = true;
	} else {
		indieAuthLoading.value = true;
	}

	try {
		const clients = await misskeyApi<IndieAuthClientResponse[]>(adminEndpoint('admin/indie-auth/list'), apiReq({
			limit: ADMIN_AUTH_PAGE_SIZE,
			offset: options.append ? indieAuthClients.value.filter(client => !client.isNew).length : 0,
		}));
		const editableClients = clients.map(toEditableIndieAuthClient);
		indieAuthClients.value = options.append ? indieAuthClients.value.concat(editableClients) : editableClients;
		indieAuthHasMore.value = clients.length === ADMIN_AUTH_PAGE_SIZE;
	} catch (err) {
		console.error(err);
		os.alert({
			type: 'error',
			text: errorToString(err),
		});
	} finally {
		indieAuthLoading.value = false;
		indieAuthLoadingMore.value = false;
	}
}

function loadMoreIndieAuthClients() {
	loadIndieAuthClients({ append: true });
}

function addIndieAuthClient() {
	indieAuthClients.value.unshift({
		_id: genId(),
		id: '',
		createdAt: null,
		name: '',
		redirectUrisText: '',
		isNew: true,
	});
}

async function saveIndieAuthClient(client: EditableIndieAuthClient) {
	const payload = {
		id: client.id,
		name: nullableText(client.name),
		redirectUris: splitMultilineValue(client.redirectUrisText),
	};

	await os.apiWithDialog(adminEndpoint(client.isNew ? 'admin/indie-auth/create' : 'admin/indie-auth/update'), apiReq(payload));
	await loadIndieAuthClients();
}

async function deleteIndieAuthClient(client: EditableIndieAuthClient) {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.tsx.deleteAreYouSure({ x: client.name || client.id || 'IndieAuth Client' }),
	});
	if (canceled) return;

	indieAuthClients.value = indieAuthClients.value.filter(item => item !== client);
	if (client.isNew) return;

	await os.apiWithDialog(adminEndpoint('admin/indie-auth/delete'), apiReq({ id: client.id }));
	await loadIndieAuthClients();
}

async function loadSsoProviders(options: { append: boolean; } = { append: false }) {
	if (options.append) {
		ssoLoadingMore.value = true;
	} else {
		ssoLoading.value = true;
	}

	try {
		const providers = await misskeyApi<SsoProviderResponse[]>(adminEndpoint('admin/sso/list'), apiReq({
			limit: ADMIN_AUTH_PAGE_SIZE,
			offset: options.append ? ssoProviders.value.filter(provider => !provider.isNew).length : 0,
		}));
		const editableProviders = providers.map(toEditableSsoProvider);
		ssoProviders.value = options.append ? ssoProviders.value.concat(editableProviders) : editableProviders;
		ssoHasMore.value = providers.length === ADMIN_AUTH_PAGE_SIZE;
	} catch (err) {
		console.error(err);
		os.alert({
			type: 'error',
			text: errorToString(err),
		});
	} finally {
		ssoLoading.value = false;
		ssoLoadingMore.value = false;
	}
}

function loadMoreSsoProviders() {
	loadSsoProviders({ append: true });
}

function addSsoProvider() {
	ssoProviders.value.unshift({
		_id: genId(),
		id: null,
		createdAt: null,
		name: '',
		type: 'saml',
		issuer: '',
		audienceText: '',
		binding: 'redirect',
		acsUrl: '',
		publicKey: '',
		privateKey: '',
		signatureAlgorithm: 'rsa-sha256',
		cipherAlgorithm: '',
		wantAuthnRequestsSigned: false,
		wantAssertionsSigned: true,
		wantEmailAddressNormalized: true,
		isNew: true,
	});
}

function ssoProviderPayload(provider: EditableSsoProvider, isNew: boolean): Record<string, unknown> {
	const payload: Record<string, unknown> = {
		name: nullableText(provider.name),
		issuer: provider.issuer,
		audience: splitMultilineValue(provider.audienceText),
		binding: provider.binding,
		acsUrl: provider.acsUrl,
		publicKey: provider.publicKey,
		signatureAlgorithm: provider.signatureAlgorithm,
		cipherAlgorithm: nullableText(provider.cipherAlgorithm),
		wantAuthnRequestsSigned: provider.wantAuthnRequestsSigned,
		wantAssertionsSigned: provider.wantAssertionsSigned,
		wantEmailAddressNormalized: provider.wantEmailAddressNormalized,
	};

	if (isNew) {
		payload.type = provider.type;
	}

	const privateKey = nullableText(provider.privateKey);
	if (isNew || privateKey != null) {
		payload.privateKey = privateKey;
	}

	return payload;
}

async function saveSsoProvider(provider: EditableSsoProvider) {
	if (provider.id == null) {
		await os.apiWithDialog(adminEndpoint('admin/sso/create'), apiReq(ssoProviderPayload(provider, true)));
	} else {
		await os.apiWithDialog(adminEndpoint('admin/sso/update'), apiReq({
			id: provider.id,
			...ssoProviderPayload(provider, false),
		}));
	}

	await loadSsoProviders();
}

async function deleteSsoProvider(provider: EditableSsoProvider) {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.tsx.deleteAreYouSure({ x: provider.name || provider.issuer || 'SSO Provider' }),
	});
	if (canceled) return;

	ssoProviders.value = ssoProviders.value.filter(item => item !== provider);
	if (provider.id == null) return;

	await os.apiWithDialog(adminEndpoint('admin/sso/delete'), apiReq({ id: provider.id }));
	await loadSsoProviders();
}

loadIndieAuthClients();
loadSsoProviders();

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.security,
	icon: 'ti ti-lock',
}));
</script>
