<template>
<MkModal
	ref="modal"
	preferType="dialog"
	zPriority="middle"
	hasInteractionWithOtherFocusTrappedEls
	@closed="emit('closed')"
>
	<div class="_panel _shadow" :class="$style.root">
		<div class="_gaps_s" :class="$style.content">
			<div :class="$style.header">
				<div :class="$style.headerIcon"><i class="ti ti-rating-18-plus"></i></div>
				<div :class="$style.headerTitle">{{ i18n.ts.sensitiveContentConsentTitle }}</div>
			</div>
			<Mfm :class="$style.question" :text="i18n.ts.sensitiveContentConsentAreYouOver18" />
			<div class="_gaps_s">
				<div :class="$style.ageToggle">
					<div :class="$style.toggleWrapper">
						<input
							id="acb-under"
							v-model="iAmAdult"
							class="mk-input-checkbox"
							type="radio"
							name="sensitiveContentConsentAge"
							:value="false"
							:class="$style.ageRadio"
						/>
						<input
							id="acb-unknown"
							v-model="iAmAdult"
							class="mk-input-checkbox"
							type="radio"
							name="sensitiveContentConsentAge"
							disabled
							:value="null"
							:aria-label="i18n.ts.none"
							:class="$style.ageRadio"
						/>
						<input
							id="acb-over"
							v-model="iAmAdult"
							class="mk-input-checkbox"
							type="radio"
							name="sensitiveContentConsentAge"
							:value="true"
							:class="$style.ageRadio"
						/>

						<div
							:class="[
								$style.toggle,
								iAmAdult === true && $style.stateAdult,
								iAmAdult === false && $style.stateTeen,
								iAmAdult === null && $style.stateUnknown,
							]"
						>
							<label for="acb-under" :class="$style.before">{{ i18n.ts.no }}</label>
							<span :class="$style.toggleBg">
								<span :class="$style.ageMarks" aria-hidden="true">
									<span :class="$style.ageMarkAge">17↓</span>
									<span :class="$style.ageMarkAnswer">{{ i18n.ts.no }}</span>
									<span />
									<span :class="$style.ageMarkAge">18+</span>
									<span :class="$style.ageMarkAnswer">{{ i18n.ts.yes }}</span>
								</span>
								<span :class="$style.decoLayer" aria-hidden="true">
									<i
										v-for="deco in decoIcons"
										:key="deco.key"
										:class="['ti', deco.ti, $style.deco]"
										:style="deco.style"
									></i>
								</span>
								<span :class="$style.toggleHandler" aria-hidden="true">
									<span :class="$style.handlerIconUnder">17↓</span>
									<span :class="$style.handlerIconOver">18+</span>
								</span>
								<span :class="$style.hitAreas" aria-hidden="true">
									<label for="acb-under" :class="$style.hitArea"></label>
									<label for="acb-unknown" :class="$style.hitArea"></label>
									<label for="acb-over" :class="$style.hitArea"></label>
								</span>
							</span>
							<label for="acb-over" :class="$style.after">{{ i18n.ts.yes }}</label>
						</div>
					</div>
				</div>

				<MkFolder v-if="iAmAdult" :defaultOpen="true">
					<template #icon><i class="ti ti-settings"></i></template>
					<template #label>{{ i18n.ts.displayedContentSettings }}</template>
					<div class="_gaps_s">
						<MkInfo>{{ i18n.ts._initialAccountSetting.theseSettingsCanEditLater }}</MkInfo>
						<MkSelect v-model="draft.nsfw">
							<template #label>{{ i18n.ts.displayOfSensitiveMedia }}</template>
							<option value="respect">{{ i18n.ts._displayOfSensitiveMedia.respect }}</option>
							<option value="ignore">{{ i18n.ts._displayOfSensitiveMedia.ignore }}</option>
							<option value="force">{{ i18n.ts._displayOfSensitiveMedia.force }}</option>
						</MkSelect>
						<MkSwitch v-model="draft.highlightSensitiveMedia">
							{{ i18n.ts.highlightSensitiveMedia }}
						</MkSwitch>
						<MkSwitch v-model="draft.confirmWhenRevealingSensitiveMedia">
							{{ i18n.ts.confirmWhenRevealingSensitiveMedia }}
						</MkSwitch>
						<MkSelect v-model="draft.displayOfSensitiveAds">
							<template #label>{{ i18n.ts.displayOfSensitiveAds }}</template>
							<option value="hidden">{{ i18n.ts._displayOfSensitiveAds.hidden }}</option>
							<option value="always">{{ i18n.ts._displayOfSensitiveAds.always }}</option>
							<option value="filtered">{{ i18n.ts._displayOfSensitiveAds.filtered }}</option>
						</MkSelect>
					</div>
				</MkFolder>

				<div class="_buttons">
					<MkButton full large primary :disabled="iAmAdult === null" @click="submit">{{ i18n.ts.continue }}</MkButton>
				</div>
			</div>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { computed, reactive, ref, useTemplateRef } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkModal from '@/components/MkModal.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { PREF_DEF } from '@/preferences/def.js';
import { claimAchievement } from '@/utility/achievements.js';
import { getDeviceId, setUserProperties } from '@/utility/tracking-user-properties.js';
import { sensitiveContentConsent, setSensitiveContentConsent } from '@/utility/sensitive-content-consent.js';

const emit = defineEmits<{
	(ev: 'decided', allowed: boolean): void;
	(ev: 'closed'): void;
}>();

const modal = useTemplateRef('modal');

const iAmAdult = ref<boolean | null>(sensitiveContentConsent.value);

const draft = reactive({
	nsfw: PREF_DEF.nsfw.default,
	highlightSensitiveMedia: PREF_DEF.highlightSensitiveMedia.default,
	confirmWhenRevealingSensitiveMedia: PREF_DEF.confirmWhenRevealingSensitiveMedia.default,
	displayOfSensitiveAds: PREF_DEF.displayOfSensitiveAds.default,
} satisfies {
	nsfw: (typeof PREF_DEF)['nsfw']['default'];
	highlightSensitiveMedia: (typeof PREF_DEF)['highlightSensitiveMedia']['default'];
	confirmWhenRevealingSensitiveMedia: (typeof PREF_DEF)['confirmWhenRevealingSensitiveMedia']['default'];
	displayOfSensitiveAds: (typeof PREF_DEF)['displayOfSensitiveAds']['default'];
});

const DECO_CONFIG = {
	tints: {
		teen: {
			'ti-pencil': 'neutral',
			'ti-brush': 'neutral',
			'ti-photo': 'sun',
			'ti-video': 'sun',
			'ti-headphones': 'sky',
			'ti-music': 'sky',
			'ti-device-gamepad': 'sky',
		},
		adult: {
			'ti-hearts': 'pink',
			'ti-pencil': 'pink',
			'ti-brush': 'pink',
			'ti-message-exclamation': 'orange',
			'ti-photo': 'purple',
			'ti-video': 'orange',
			'ti-headphones': 'purple',
			'ti-music': 'purple',
			'ti-device-gamepad': 'purple',
		},
	},
	items: [
		{ top: 5, left: 5, r: -10, size: 16, icon: { teen: 'ti-pencil', adult: 'ti-hearts' } },
		{ top: 8, left: 28, r: 5, size: 14, icon: { teen: 'ti-photo', adult: 'ti-pencil' } },
		{ top: 2, left: 48, r: -5, size: 18, icon: { teen: 'ti-headphones', adult: 'ti-device-gamepad' } },
		{ top: 6, left: 72, r: 10, size: 15, icon: { teen: 'ti-video', adult: 'ti-photo' } },
		{ top: 4, left: 92, r: -8, size: 17, icon: { teen: 'ti-device-gamepad', adult: 'ti-message-exclamation' } },
		{ top: 30, left: 8, r: 15, size: 19, icon: { teen: 'ti-brush', adult: 'ti-headphones' } },
		{ top: 28, left: 32, r: -12, size: 16, icon: { teen: 'ti-music', adult: 'ti-video' } },
		{ top: 32, left: 52, r: 8, size: 20, icon: { teen: 'ti-pencil', adult: 'ti-hearts' } },
		{ top: 25, left: 75, r: -15, size: 14, icon: { teen: 'ti-photo', adult: 'ti-device-gamepad' } },
		{ top: 35, left: 88, r: 5, size: 18, icon: { teen: 'ti-headphones', adult: 'ti-photo' } },
		{ top: 55, left: 5, r: -5, size: 15, icon: { teen: 'ti-video', adult: 'ti-brush' } },
		{ top: 52, left: 25, r: 12, size: 17, icon: { teen: 'ti-device-gamepad', adult: 'ti-music' } },
		{ top: 58, left: 45, r: -10, size: 19, icon: { teen: 'ti-brush', adult: 'ti-hearts' } },
		{ top: 50, left: 68, r: 6, size: 16, icon: { teen: 'ti-music', adult: 'ti-pencil' } },
		{ top: 56, left: 95, r: -8, size: 14, icon: { teen: 'ti-pencil', adult: 'ti-brush' } },
		{ top: 80, left: 12, r: 20, size: 12, icon: { teen: 'ti-photo', adult: 'ti-photo' } },
		{ top: 78, left: 35, r: -20, size: 13, icon: { teen: 'ti-headphones', adult: 'ti-message-exclamation' } },
		{ top: 82, left: 55, r: 15, size: 12, icon: { teen: 'ti-video', adult: 'ti-headphones' } },
		{ top: 75, left: 78, r: -15, size: 13, icon: { teen: 'ti-device-gamepad', adult: 'ti-video' } },
		{ top: 85, left: 85, r: 0, size: 12, icon: { teen: 'ti-brush', adult: 'ti-hearts' } },
	],
} as const;

const decoIcons = computed(() => {
	if (iAmAdult.value === null) return [];

	const mode = iAmAdult.value ? 'adult' : 'teen';
	const fallbackTint = mode === 'adult' ? 'pink' : 'neutral';

	return DECO_CONFIG.items.map((deco, index) => {
		const icon = deco.icon[mode];
		const tint = DECO_CONFIG.tints[mode][icon] ?? fallbackTint;

		return {
			key: index,
			ti: icon,
			style: {
				color: `var(--deco-${tint})`,
				fontSize: `${deco.size}px`,
				left: `${deco.left}%`,
				top: `${deco.top}%`,
				'--r': `${deco.r}deg`,
			},
		};
	});
});

function submit() {
	if (iAmAdult.value === null) return;

	setSensitiveContentConsent(iAmAdult.value);
	const effectiveDisplayOfSensitiveAds = iAmAdult.value ? draft.displayOfSensitiveAds : 'filtered';

	claimAchievement('sensitiveContentConsentResponded');

	if (iAmAdult.value) {
		prefer.commit('nsfw', draft.nsfw);
		prefer.commit('highlightSensitiveMedia', draft.highlightSensitiveMedia);
		prefer.commit('confirmWhenRevealingSensitiveMedia', draft.confirmWhenRevealingSensitiveMedia);
	} else {
		prefer.commit('nsfw', 'respect');
		prefer.commit('highlightSensitiveMedia', false);
		prefer.commit('confirmWhenRevealingSensitiveMedia', false);
	}
	prefer.commit('displayOfSensitiveAds', effectiveDisplayOfSensitiveAds);

	const consentValue = iAmAdult.value === null ? 'unset' : String(iAmAdult.value);
	setUserProperties({
		deviceId: getDeviceId(),
		sensitiveContentConsent: consentValue,
		displayOfSensitiveAds: effectiveDisplayOfSensitiveAds,
	});

	emit('decided', iAmAdult.value);
	modal.value?.close();
}
</script>

<style lang="scss" module>
.root {
	margin: auto;
	box-sizing: border-box;
	width: 100%;
	max-width: 560px;
	overflow: visible;
}

.content {
	padding: 25px;
}

.header {
	display: flex;
	align-items: center;
	gap: 10px;
}

.headerIcon {
	font-size: 40px;
	color: var(--MI_THEME-warn);
}

.headerTitle {
	font-weight: bold;
	font-size: 16px;
}

.ageToggle {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 8px 0 2px 0;
}

.toggleWrapper {
	display: flex;
	justify-content: center;
	width: 100%;
	padding: 0 8px;
	box-sizing: border-box;
	container-type: inline-size;
}

.toggleWrapper:focus-within .toggle {
	outline: 2px solid var(--MI_THEME-focus);
	outline-offset: 2px;
}

.question {
	display: contents;
}

.ageRadio {
	position: absolute;
	left: -99em;
}

.toggle {
	display: flex;
	flex-wrap: nowrap;
	align-items: center;
	justify-content: center;
	gap: 8px clamp(12px, 4vw, 32px);
	position: relative;
	margin: 4px; // focus outline space
	padding: 6px 10px;
	max-width: 100%;
	box-sizing: border-box;
	color: var(--MI_THEME-fg);
	-webkit-tap-highlight-color: transparent;

	// Unknown (center): neutral
	--track-w: clamp(160px, 60vw, 220px);
	--bg: rgba(127, 127, 127, 0.12);
	--bg-border: rgba(0, 0, 0, 0.08);
	--handler-bg: rgba(255, 255, 255, 0.6);
	--handler-fg: var(--MI_THEME-fg);
	--handler-border: rgba(0, 0, 0, 0.08);
	--handler-text-shadow: none;
	--handler-x: calc((var(--track-w) - 64px) / 2);

	// Background icon colors (tinted via TS)
	--deco-neutral: rgba(0, 140, 105, 0.82);
	--deco-sun: rgba(255, 156, 0, 0.9);
	--deco-sky: rgba(0, 125, 255, 0.82);
	--deco-pink: rgba(255, 64, 150, 0.6);
	--deco-orange: rgba(255, 131, 37, 0.6);
	--deco-purple: rgba(148, 90, 255, 0.6);
	--deco-red: rgba(255, 69, 74, 0.6);

	> .before,
	> .after {
		transition: opacity 0.3s ease, color 0.3s ease;
		flex: 1 1 auto;
		text-align: center;
		font-weight: bold;
		font-size: 1.1em;
		opacity: 0.5;
		color: var(--MI_THEME-fg);
		cursor: pointer;
	}

	> .before {
		order: 1;
	}

	> .after {
		order: 3;
	}
}

.stateTeen {
	// Under 18 (left): bright/kid-like (mint + sun yellow + sky blue)
	--bg: #d6ffe0;
	--bg-border: rgba(0, 0, 0, 0.06);
	--handler-bg: #ffcf4a;
	--handler-fg: rgba(32, 18, 0, 0.95);
	--handler-border: rgba(0, 0, 0, 0.1);
	--handler-text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
	--handler-x: 0px;

	> .before {
		opacity: 1;
		color: var(--MI_THEME-accent);
	}
}

.stateAdult {
	// Over 18 (right): warm/alerting (red + orange + pink + purple)
	--bg: #ffd0dc;
	--bg-border: rgba(0, 0, 0, 0.08);
	--handler-bg: #ff4d6d;
	--handler-fg: #fff;
	--handler-border: rgba(255, 255, 255, 0.32);
	--handler-text-shadow: 0 1px 0 rgba(0, 0, 0, 0.25);
	--handler-x: calc(var(--track-w) - 64px);

	--deco-neutral: rgba(255, 163, 200, 0.45);
	--deco-pink: rgba(255, 81, 181, 0.65);
	--deco-orange: rgba(255, 140, 0, 0.65);
	--deco-purple: rgba(178, 117, 255, 0.65);
	--deco-red: rgba(255, 79, 79, 0.65);

	> .after {
		opacity: 1;
		color: var(--MI_THEME-accent);
	}
}

.stateUnknown {
	> .before,
	> .after {
		opacity: 0.5;
		color: inherit;
	}
}

.toggleBg {
	position: relative;
	order: 2;
	flex: 0 0 auto;
	width: var(--track-w);
	height: 64px;
	display: block;
	background: var(--bg);
	border: solid 1px var(--bg-border);
	border-radius: 999px;
	overflow: hidden;
	box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.1);
	transition: background-color 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.ageMarks {
	position: absolute;
	inset: 0;
	display: grid;
	grid-template-columns: 1fr 1fr 1fr;
	align-items: center;
	justify-items: center;
	padding: 0 10px;
	font-weight: bold;
	font-size: 18px;
	color: var(--MI_THEME-fg);
	opacity: 0.55;
	text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
	pointer-events: none;
	z-index: 2;

	> span:nth-child(2) {
		opacity: 0.3;
	}
}

.ageMarkAnswer {
	display: none;
}

.decoLayer {
	position: absolute;
	inset: 0;
	overflow: hidden;
	pointer-events: none;
	z-index: 1;
}

.toggleHandler {
	display: grid;
	place-items: center;
	position: absolute;
	z-index: 3;
	left: 4px;
	top: 50%;
	width: 56px;
	height: 56px;
	transform: translate(var(--handler-x), -50%);
	background: var(--handler-bg);
	border: solid 1px var(--handler-border);
	border-radius: 50%;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.1);
	transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.4s, border-color 0.4s, color 0.4s;
	color: var(--handler-fg);
	text-shadow: var(--handler-text-shadow);
	pointer-events: none;
}

.handlerIconUnder,
.handlerIconOver {
	grid-area: 1 / 1;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0;
	font-size: 20px;
	font-weight: bold;
	transition: opacity 0.3s ease, transform 0.3s ease;

	> i {
		font-size: 1.2em;
	}
}

.handlerIconUnder {
	opacity: 0;
	transform: scale(0.5);
}

.handlerIconOver {
	opacity: 0;
	transform: scale(0.5);
}

.deco {
	position: absolute;
	pointer-events: none;
	transition: color 0.3s;
	transform: rotate(var(--r, 0deg));
	opacity: 0.88;
	filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.18)) drop-shadow(0 1px 0 rgba(0, 0, 0, 0.08));
}

.stateTeen .handlerIconUnder {
	opacity: 1;
	transform: scale(1);
}

.stateAdult .handlerIconOver {
	opacity: 1;
	transform: scale(1);
}

.hitAreas {
	position: absolute;
	inset: 0;
	display: grid;
	grid-template-columns: 1fr 1fr 1fr;
	z-index: 4;
}

.hitArea {
	cursor: pointer;
	display: block;
}

@container (max-width: 360px) {
	.toggle {
		gap: 0;
		padding: 6px 6px;
	}

	.toggle > .before,
	.toggle > .after {
		display: none;
	}

	.ageMarkAge {
		display: none;
	}

	.ageMarkAnswer {
		display: inline;
	}
}
</style>
