<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkStickyContainer>
	<template #header><XHeader :actions="headerActions" :tabs="headerTabs"/></template>
	<MkSpacer :contentMax="700" :marginMin="16" :marginMax="32">
		<div class="_gaps_m">
			<XBotProtection/>

			<MkFolder>
				<template #icon><i class="ti ti-eye-off"></i></template>
				<template #label>{{ i18n.ts.sensitiveMediaDetection }}</template>
				<template v-if="sensitiveMediaDetectionForm.savedState.sensitiveMediaDetection === 'all'" #suffix>{{ i18n.ts.all }}</template>
				<template v-else-if="sensitiveMediaDetectionForm.savedState.sensitiveMediaDetection === 'local'" #suffix>{{ i18n.ts.localOnly }}</template>
				<template v-else-if="sensitiveMediaDetectionForm.savedState.sensitiveMediaDetection === 'remote'" #suffix>{{ i18n.ts.remoteOnly }}</template>
				<template v-else #suffix>{{ i18n.ts.none }}</template>
				<template v-if="sensitiveMediaDetectionForm.modified.value" #footer>
					<MkFormFooter :form="sensitiveMediaDetectionForm"/>
				</template>

				<div class="_gaps_m">
					<span>{{ i18n.ts._sensitiveMediaDetection.description }}</span>

					<MkRadios v-model="sensitiveMediaDetectionForm.state.sensitiveMediaDetection">
						<option value="none">{{ i18n.ts.none }}</option>
						<option value="all">{{ i18n.ts.all }}</option>
						<option value="local">{{ i18n.ts.localOnly }}</option>
						<option value="remote">{{ i18n.ts.remoteOnly }}</option>
					</MkRadios>

					<MkRange v-model="sensitiveMediaDetectionForm.state.sensitiveMediaDetectionSensitivity" :min="0" :max="4" :step="1" :textConverter="(v) => `${v + 1}`">
						<template #label>{{ i18n.ts._sensitiveMediaDetection.sensitivity }}</template>
						<template #caption>{{ i18n.ts._sensitiveMediaDetection.sensitivityDescription }}</template>
					</MkRange>

					<MkSwitch v-model="sensitiveMediaDetectionForm.state.enableSensitiveMediaDetectionForVideos">
						<template #label>{{ i18n.ts._sensitiveMediaDetection.analyzeVideos }}<span class="_beta">{{ i18n.ts.beta }}</span></template>
						<template #caption>{{ i18n.ts._sensitiveMediaDetection.analyzeVideosDescription }}</template>
					</MkSwitch>

					<MkSwitch v-model="sensitiveMediaDetectionForm.state.setSensitiveFlagAutomatically">
						<template #label>{{ i18n.ts._sensitiveMediaDetection.setSensitiveFlagAutomatically }} ({{ i18n.ts.notRecommended }})</template>
						<template #caption>{{ i18n.ts._sensitiveMediaDetection.setSensitiveFlagAutomaticallyDescription }}</template>
					</MkSwitch>

					<!-- 現状 false positive が多すぎて実用に耐えない
					<MkSwitch v-model="disallowUploadWhenPredictedAsPorn">
						<template #label>{{ i18n.ts._sensitiveMediaDetection.disallowUploadWhenPredictedAsPorn }}</template>
					</MkSwitch>
					-->
				</div>
			</MkFolder>

			<MkFolder>
				<template #label>Active Email Validation</template>
				<template v-if="emailValidationForm.savedState.enableActiveEmailValidation" #suffix>Enabled</template>
				<template v-else #suffix>Disabled</template>
				<template v-if="emailValidationForm.modified.value" #footer>
					<MkFormFooter :form="emailValidationForm"/>
				</template>

				<div class="_gaps_m">
					<span>{{ i18n.ts.activeEmailValidationDescription }}</span>
					<MkSwitch v-model="emailValidationForm.state.enableActiveEmailValidation">
						<template #label>Enable</template>
					</MkSwitch>
					<MkSwitch v-model="emailValidationForm.state.enableVerifymailApi">
						<template #label>Use Verifymail.io API</template>
					</MkSwitch>
					<MkInput v-model="emailValidationForm.state.verifymailAuthKey">
						<template #prefix><i class="ti ti-key"></i></template>
						<template #label>Verifymail.io API Auth Key</template>
					</MkInput>
					<MkSwitch v-model="emailValidationForm.state.enableTruemailApi">
						<template #label>Use TrueMail API</template>
					</MkSwitch>
					<MkInput v-model="emailValidationForm.state.truemailInstance">
						<template #prefix><i class="ti ti-key"></i></template>
						<template #label>TrueMail API Instance</template>
					</MkInput>
					<MkInput v-model="emailValidationForm.state.truemailAuthKey">
						<template #prefix><i class="ti ti-key"></i></template>
						<template #label>TrueMail API Auth Key</template>
					</MkInput>
				</div>
			</MkFolder>

			<MkFolder>
				<template #label>Banned Email Domains</template>
				<template v-if="bannedEmailDomainsForm.modified.value" #footer>
					<MkFormFooter :form="bannedEmailDomainsForm"/>
				</template>

				<div class="_gaps_m">
					<MkTextarea v-model="bannedEmailDomainsForm.state.bannedEmailDomains">
						<template #label>Banned Email Domains List</template>
					</MkTextarea>
				</div>
			</MkFolder>

			<MkFolder>
				<template #label>Log IP address</template>
				<template v-if="ipLoggingForm.savedState.enableIpLogging" #suffix>Enabled</template>
				<template v-else #suffix>Disabled</template>
				<template v-if="ipLoggingForm.modified.value" #footer>
					<MkFormFooter :form="ipLoggingForm"/>
				</template>

				<div class="_gaps_m">
					<MkSwitch v-model="ipLoggingForm.state.enableIpLogging">
							<template #label>Enable</template>
						</MkSwitch>
					</div>
				</MkFolder>

				<MkFolder>
					<template #label>IndieAuth Clients</template>

					<div class="_gaps">
						<MkButton primary full @click="indieAuthAddNew"><i class="ti ti-plus"></i> New</MkButton>
						<MkFolder v-for="(client, index) in indieAuthClients" :key="`${indieAuthTimestamp}-${index}-${client.createdAt ? client.id : 'new'}`" :defaultOpen="!client.createdAt">
							<template #label>{{ client.name || client.id }}</template>
							<template #icon>
								<i v-if="client.id" class="ti ti-key"></i>
								<i v-else class="ti ti-plus"></i>
							</template>
							<template v-if="client.name && client.id" #caption>{{ client.id }}</template>

							<div class="_gaps_m">
								<MkInput v-model="client.id" :disabled="!!client.createdAt">
									<template #label>Client ID</template>
								</MkInput>
								<MkInput v-model="client.name">
									<template #label>Name</template>
								</MkInput>
								<MkTextarea v-model="client.redirectUris">
									<template #label>Redirect URIs</template>
								</MkTextarea>
								<div class="buttons _buttons">
									<MkButton primary @click="indieAuthSave(client)"><i class="ti ti-device-floppy"></i> Save</MkButton>
									<MkButton v-if="client.createdAt" warn @click="indieAuthDelete(client)"><i class="ti ti-trash"></i> Delete</MkButton>
								</div>
							</div>
						</MkFolder>
						<MkButton v-if="indieAuthHasMore" :class="$style.more" :disabled="!indieAuthHasMore" primary rounded @click="indieAuthFetch()">
							<i class="ti ti-reload"></i>{{ i18n.ts.more }}
						</MkButton>
					</div>
				</MkFolder>

				<MkFolder>
					<template #label>Single Sign-On Service Providers</template>

					<div class="_gaps">
						<MkButton primary full @click="ssoServiceAddNew"><i class="ti ti-plus"></i> New</MkButton>
						<MkFolder v-for="(service, index) in ssoServices" :key="`${ssoServiceTimestamp}-${index}-${service.createdAt ? service.id : 'new'}`" :defaultOpen="!service.createdAt">
							<template #label>{{ service.name || service.id }}</template>
							<template #icon>
								<i v-if="service.id" class="ti ti-key"></i>
								<i v-else class="ti ti-plus"></i>
							</template>
							<template v-if="service.name && service.id" #caption>{{ service.id }}</template>

							<div class="_gaps_m">
								<MkInput v-model="service.id" disabled>
									<template #label>Service ID</template>
								</MkInput>
								<MkInput v-model="service.name">
									<template #label>Name</template>
								</MkInput>
								<MkRadios v-model="service.type" :disabled="!!service.createdAt">
									<option value="jwt">JWT</option>
									<option value="saml">SAML</option>
								</MkRadios>
								<MkInput v-model="service.issuer">
									<template #label>Issuer</template>
								</MkInput>
								<MkTextarea v-model="service.audience">
									<template #label>Audience</template>
								</MkTextarea>
								<MkRadios v-model="service.binding">
									<option value="post">POST</option>
									<option value="redirect">Redirect</option>
								</MkRadios>
								<MkInput v-model="service.acsUrl">
									<template #label>Assertion Consumer Service URL</template>
								</MkInput>
								<MkTextarea v-model="service.publicKey">
									<template #label>{{ service['useCertificate'] ? 'Public Key' : 'Secret' }}</template>
								</MkTextarea>
								<MkInput v-model="service.signatureAlgorithm">
									<template #label>Signature Algorithm</template>
								</MkInput>
								<MkInput v-model="service.cipherAlgorithm">
									<template #label>Cipher Algorithm</template>
								</MkInput>
								<MkSwitch v-model="service.wantAuthnRequestsSigned">
									<template #label>Want Authn Requests Signed</template>
								</MkSwitch>
								<MkSwitch v-model="service.wantAssertionsSigned">
									<template #label>Want Assertions Signed</template>
								</MkSwitch>
								<MkSwitch v-model="service.useCertificate" :disabled="!!service.createdAt">
									<template #label>Use Certificate</template>
								</MkSwitch>
								<MkSwitch v-if="service.useCertificate" v-model="service.regenerateCertificate">
									<template #label>Regenerate Certificate</template>
								</MkSwitch>
								<div class="buttons _buttons">
									<MkButton primary @click="ssoServiceSave(service)"><i class="ti ti-device-floppy"></i> Save</MkButton>
									<MkButton v-if="service.createdAt" warn @click="ssoServiceDelete(service)"><i class="ti ti-trash"></i> Delete</MkButton>
								</div>
							</div>
						</MkFolder>
						<MkButton v-if="ssoServiceHasMore" :class="$style.more" :disabled="!ssoServiceHasMore" primary rounded @click="ssoServiceFetch()">
							<i class="ti ti-reload"></i>{{ i18n.ts.more }}
						</MkButton>
					</div>
				</MkFolder>
			</div>

	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import XBotProtection from './bot-protection.vue';
import XHeader from './_header_.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkRadios from '@/components/MkRadios.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkRange from '@/components/MkRange.vue';
import MkInput from '@/components/MkInput.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/scripts/misskey-api.js';
import { fetchInstance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { definePageMetadata } from '@/scripts/page-metadata.js';
import { useForm } from '@/scripts/use-form.js';
import MkFormFooter from '@/components/MkFormFooter.vue';

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
			'veryLow',
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

function indieAuthFetch(resetOffset = false) {
	if (resetOffset) {
		indieAuthClients.value = [];
		indieAuthOffset.value = 0;
	}

	misskeyApi('admin/indie-auth/list', {
		offsetMode: true,
		offset: indieAuthOffset.value,
		limit: 10,
	}).then(clients => {
		indieAuthClients.value = indieAuthClients.value.concat(clients.map(client => ({
			...client,
			redirectUris: client.redirectUris.join('\n'),
		})));
		indieAuthTimestamp.value = Date.now();
		indieAuthHasMore.value = clients.length === 10;
		indieAuthOffset.value += clients.length;
	});
}

indieAuthFetch(true);

function indieAuthAddNew() {
	indieAuthClients.value.unshift({
		id: '',
		name: '',
		redirectUris: '',
	});
}

function indieAuthDelete(client) {
	os.confirm({
		type: 'warning',
		text: i18n.tsx.deleteAreYouSure({ x: client.id }),
	}).then(({ canceled }) => {
		if (canceled) return;
		indieAuthClients.value = indieAuthClients.value.filter(x => x !== client);
		os.apiWithDialog('admin/indie-auth/delete', client).then(() => {
			indieAuthFetch(true);
		});
	});
}

async function indieAuthSave(client) {
	const params = {
		id: client.id,
		name: client.name,
		redirectUris: client.redirectUris.split('\n'),
	};

	if (client.createdAt !== undefined) {
		await os.apiWithDialog('admin/indie-auth/update', params).then(() => {
			indieAuthFetch(true);
		});
	} else {
		await os.apiWithDialog('admin/indie-auth/create', params).then(() => {
			indieAuthFetch(true);
		});
	}
}

function ssoServiceFetch(resetOffset = false) {
	if (resetOffset) {
		ssoServices.value = [];
		ssoServiceOffset.value = 0;
	}

	misskeyApi('admin/sso/list', {
		offsetMode: true,
		offset: ssoServiceOffset.value,
		limit: 10,
	}).then(services => {
		ssoServices.value = ssoServices.value.concat(services.map(service => ({
			...service,
			audience: service.audience.join('\n'),
		})));
		ssoServiceTimestamp.value = Date.now();
		ssoServiceHasMore.value = services.length === 10;
		ssoServiceOffset.value += services.length;
	});
}

ssoServiceFetch(true);

function ssoServiceAddNew() {
	ssoServices.value.unshift({
		id: '',
		name: '',
		type: 'jwt',
		issuer: '',
		audience: '',
		binding: 'post',
		acsUrl: '',
		useCertificate: false,
		publicKey: '',
		signatureAlgorithm: 'HS256',
		cipherAlgorithm: '',
		wantAuthnRequestsSigned: false,
		wantAssertionsSigned: true,
		regenerateCertificate: false,
	});
}

function ssoServiceDelete(service) {
	os.confirm({
		type: 'warning',
		text: i18n.tsx.deleteAreYouSure({ x: service.id }),
	}).then(({ canceled }) => {
		if (canceled) return;
		ssoServices.value = ssoServices.value.filter(x => x !== service);
		os.apiWithDialog('admin/sso/delete', service).then(() => {
			ssoServiceFetch(true);
		});
	});
}

async function ssoServiceSave(service) {
	const params = {
		id: service.id,
		name: service.name,
		type: service.type,
		issuer: service.issuer,
		audience: service.audience.split('\n'),
		binding: service.binding,
		acsUrl: service.acsUrl,
		secret: service.publicKey,
		signatureAlgorithm: service.signatureAlgorithm,
		cipherAlgorithm: service.cipherAlgorithm,
		wantAuthnRequestsSigned: service.wantAuthnRequestsSigned,
		wantAssertionsSigned: service.wantAssertionsSigned,
	};

	if (service.createdAt !== undefined) {
		await os.apiWithDialog('admin/sso/update', {
			...params,
			regenerateCertificate: service.regenerateCertificate,
		}).then(() => {
			ssoServiceFetch(true);
		});
	} else {
		await os.apiWithDialog('admin/sso/create', {
			...params,
			useCertificate: service.useCertificate,
		}).then(() => {
			ssoServiceFetch(true);
		});
	}
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePageMetadata(() => ({
	title: i18n.ts.security,
	icon: 'ti ti-lock',
}));
</script>

<style lang="scss" module>
.more {
	margin-left: auto;
	margin-right: auto;
}
</style>
