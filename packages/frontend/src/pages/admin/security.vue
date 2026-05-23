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

							<MkRadios v-model="sensitiveMediaDetectionForm.state.sensitiveMediaDetection">
								<option value="none">{{ i18n.ts.none }}</option>
								<option value="all">{{ i18n.ts.all }}</option>
								<option value="local">{{ i18n.ts.localOnly }}</option>
								<option value="remote">{{ i18n.ts.remoteOnly }}</option>
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

				<SearchMarker v-slot="slotProps" :keywords="['indieauth', 'indie', 'auth', 'clients', 'oauth', 'redirect', 'uris']">
					<MkFolder :defaultOpen="slotProps.isParentOfTarget">
						<template #label><SearchLabel>IndieAuth Clients</SearchLabel></template>

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
									<SearchMarker :keywords="['client', 'id']">
										<MkInput v-model="client.id" :disabled="!!client.createdAt">
											<template #label><SearchLabel>Client ID</SearchLabel></template>
										</MkInput>
									</SearchMarker>

									<SearchMarker :keywords="['name']">
										<MkInput v-model="client.name">
											<template #label><SearchLabel>Name</SearchLabel></template>
										</MkInput>
									</SearchMarker>

									<SearchMarker :keywords="['redirect', 'uris', 'urls']">
										<MkTextarea v-model="client.redirectUris">
											<template #label><SearchLabel>Redirect URIs</SearchLabel></template>
										</MkTextarea>
									</SearchMarker>

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
				</SearchMarker>

				<SearchMarker v-slot="slotProps" :keywords="['single sign-on', 'sso', 'service', 'providers', 'jwt', 'saml']">
					<MkFolder :defaultOpen="slotProps.isParentOfTarget">
						<template #label><SearchLabel>Single Sign-On Service Providers</SearchLabel></template>

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
									<SearchMarker :keywords="['service', 'id']">
										<MkInput v-model="service.id" disabled>
											<template #label><SearchLabel>Service ID</SearchLabel></template>
										</MkInput>
									</SearchMarker>

									<SearchMarker :keywords="['name']">
										<MkInput v-model="service.name">
											<template #label><SearchLabel>Name</SearchLabel></template>
										</MkInput>
									</SearchMarker>

									<SearchMarker :keywords="['type', 'jwt', 'saml']">
										<MkRadios v-model="service.type" :disabled="!!service.createdAt">
											<option value="jwt">JWT</option>
											<option value="saml">SAML</option>
										</MkRadios>
									</SearchMarker>

									<SearchMarker :keywords="['issuer']">
										<MkInput v-model="service.issuer">
											<template #label><SearchLabel>Issuer</SearchLabel></template>
										</MkInput>
									</SearchMarker>

									<SearchMarker :keywords="['audience']">
										<MkTextarea v-model="service.audience">
											<template #label><SearchLabel>Audience</SearchLabel></template>
										</MkTextarea>
									</SearchMarker>

									<SearchMarker :keywords="['binding', 'post', 'redirect']">
										<MkRadios v-model="service.binding">
											<option value="post">POST</option>
											<option value="redirect">Redirect</option>
										</MkRadios>
									</SearchMarker>

									<SearchMarker :keywords="['assertion', 'consumer', 'service', 'url', 'acs']">
										<MkInput v-model="service.acsUrl">
											<template #label><SearchLabel>Assertion Consumer Service URL</SearchLabel></template>
										</MkInput>
									</SearchMarker>

									<SearchMarker :keywords="['public', 'key', 'secret']">
										<MkTextarea v-model="service.publicKey">
											<template #label><SearchLabel>{{ service.useCertificate ? 'Public Key' : 'Secret' }}</SearchLabel></template>
										</MkTextarea>
									</SearchMarker>

									<SearchMarker :keywords="['signature', 'algorithm']">
										<MkInput v-model="service.signatureAlgorithm">
											<template #label><SearchLabel>Signature Algorithm</SearchLabel></template>
										</MkInput>
									</SearchMarker>

									<SearchMarker :keywords="['cipher', 'algorithm']">
										<MkInput v-model="service.cipherAlgorithm">
											<template #label><SearchLabel>Cipher Algorithm</SearchLabel></template>
										</MkInput>
									</SearchMarker>

									<SearchMarker :keywords="['authn', 'requests', 'signed']">
										<MkSwitch v-model="service.wantAuthnRequestsSigned">
											<template #label><SearchLabel>Want Authn Requests Signed</SearchLabel></template>
										</MkSwitch>
									</SearchMarker>

									<SearchMarker :keywords="['assertions', 'signed']">
										<MkSwitch v-model="service.wantAssertionsSigned">
											<template #label><SearchLabel>Want Assertions Signed</SearchLabel></template>
										</MkSwitch>
									</SearchMarker>

									<SearchMarker :keywords="['email', 'address', 'normalized']">
										<MkSwitch v-model="service.wantEmailAddressNormalized">
											<template #label><SearchLabel>Want Email Address Normalized</SearchLabel></template>
										</MkSwitch>
									</SearchMarker>

									<SearchMarker :keywords="['certificate']">
										<MkSwitch v-model="service.useCertificate" :disabled="!!service.createdAt">
											<template #label><SearchLabel>Use Certificate</SearchLabel></template>
										</MkSwitch>
									</SearchMarker>

									<SearchMarker v-if="service.useCertificate" :keywords="['regenerate', 'certificate']">
										<MkSwitch v-model="service.regenerateCertificate">
											<template #label><SearchLabel>Regenerate Certificate</SearchLabel></template>
										</MkSwitch>
									</SearchMarker>

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
				</SearchMarker>
			</div>
		</SearchMarker>

	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import XBotProtection from './bot-protection.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkRadios from '@/components/MkRadios.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkRange from '@/components/MkRange.vue';
import MkInput from '@/components/MkInput.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useForm } from '@/composables/use-form.js';
import MkFormFooter from '@/components/MkFormFooter.vue';
import MkButton from '@/components/MkButton.vue';

const meta = await misskeyApi('admin/meta');

const indieAuthClients = ref<any[]>([]);
const indieAuthTimestamp = ref(0);
const indieAuthOffset = ref(0);
const indieAuthHasMore = ref(false);
const ssoServices = ref<any[]>([]);
const ssoServiceTimestamp = ref(0);
const ssoServiceOffset = ref(0);
const ssoServiceHasMore = ref(false);

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
		wantEmailAddressNormalized: true,
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
		wantEmailAddressNormalized: service.wantEmailAddressNormalized,
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

definePage(() => ({
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
