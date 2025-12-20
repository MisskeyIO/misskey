<template>
<MkModal
	ref="modal"
	preferType="dialog"
	zPriority="middle"
	hasInteractionWithOtherFocusTrappedEls
	@closed="emit('closed')"
>
	<div class="_panel _shadow" :class="$style.root">
		<div class="_gaps_s" style="padding: 25px;">
			<div style="display: flex; align-items: center;">
				<div :class="$style.headerIcon">
					<i class="ti ti-rating-18-plus"></i>
				</div>
				<div :class="$style.headerTitle">{{ i18n.ts.sensitiveContentConsentTitle }}</div>
			</div>
			<Mfm style="margin: 0.7em 0 1em 0;" :text="i18n.ts.sensitiveContentConsentAreYouOver18" />
			<div class="_gaps_s">
				<div :class="$style.ageToggle">
					<div :class="$style.toggleWrapper">
						<input id="acb" v-model="iAmAdult" class="mk-input-checkbox" type="checkbox" :class="$style.ageCheckbox" />
						<label for="acb" :class="$style.toggle">
							<span :class="$style.before">{{ i18n.ts.no }}</span>
							<span :class="$style.after">{{ i18n.ts.yes }}</span>
							<span :class="$style.toggleBg">
								<span :class="$style.decoLayer" aria-hidden="true">
									<i
										v-for="deco in decoIcons"
										:key="deco.key"
										:class="['ti', deco.ti, $style.deco]"
										:style="deco.style"
									></i>
								</span>
								<span :class="$style.toggleHandler">
									<span :class="$style.handlerIconUnder">
										17↓
									</span>
									<span :class="$style.handlerIconOver">
										18+
									</span>
								</span>
							</span>
						</label>
					</div>
				</div>

				<MkFolder v-if="iAmAdult" :defaultOpen="true">
					<template #icon><i class="ti ti-settings"></i></template>
					<template #label>{{ i18n.ts.displayedContentSettings }}</template>
					<div class="_gaps_s">
						<MkInfo>{{ i18n.ts._initialAccountSetting.theseSettingsCanEditLater }}</MkInfo>
						<MkSelect v-model="draftNsfw">
							<template #label>{{ i18n.ts.displayOfSensitiveMedia }}</template>
							<option value="respect">{{ i18n.ts._displayOfSensitiveMedia.respect }}</option>
							<option value="ignore">{{ i18n.ts._displayOfSensitiveMedia.ignore }}</option>
							<option value="force">{{ i18n.ts._displayOfSensitiveMedia.force }}</option>
						</MkSelect>
						<MkSwitch v-model="draftConfirmWhenRevealingSensitiveMedia">
							{{ i18n.ts.confirmWhenRevealingSensitiveMedia }}
						</MkSwitch>
						<MkSwitch v-model="draftHighlightSensitiveMedia">
							{{ i18n.ts.highlightSensitiveMedia }}
						</MkSwitch>
						<MkSelect v-model="draftDisplayOfSensitiveAds">
							<template #label>{{ i18n.ts.displayOfSensitiveAds }}</template>
							<option value="hidden">{{ i18n.ts._displayOfSensitiveAds.hidden }}</option>
							<option value="always">{{ i18n.ts._displayOfSensitiveAds.always }}</option>
							<option value="filtered">{{ i18n.ts._displayOfSensitiveAds.filtered }}</option>
						</MkSelect>
					</div>
				</MkFolder>

				<div class="_buttons">
					<MkButton full large primary @click="submit">{{ i18n.ts.continue }}</MkButton>
				</div>
			</div>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { computed, ref, useTemplateRef } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkModal from '@/components/MkModal.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { usageReport } from '@/utility/usage-report.js';
import { getSensitiveContentConsent, setSensitiveContentConsent } from '@/utility/sensitive-content-consent.js';

defineProps<{
	trigger: 'media' | 'ad';
}>();

const emit = defineEmits<{
	(ev: 'decided', allowed: boolean): void;
	(ev: 'closed'): void;
}>();

const modal = useTemplateRef('modal');

const iAmAdult = ref<boolean>(getSensitiveContentConsent() ?? false);

const draftNsfw = ref(prefer.s.nsfw);
const draftConfirmWhenRevealingSensitiveMedia = ref(prefer.s.confirmWhenRevealingSensitiveMedia);
const draftHighlightSensitiveMedia = ref(prefer.s.highlightSensitiveMedia);
const draftDisplayOfSensitiveAds = ref(prefer.s.displayOfSensitiveAds);

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
	setSensitiveContentConsent(iAmAdult.value);

	if (iAmAdult.value) {
		prefer.commit('nsfw', draftNsfw.value);
		prefer.commit('confirmWhenRevealingSensitiveMedia', draftConfirmWhenRevealingSensitiveMedia.value);
		prefer.commit('highlightSensitiveMedia', draftHighlightSensitiveMedia.value);
		prefer.commit('displayOfSensitiveAds', draftDisplayOfSensitiveAds.value);
	} else {
		prefer.commit('nsfw', 'force');
		prefer.commit('displayOfSensitiveAds', 'filtered');
	}

	usageReport({
		t: Math.floor(Date.now() / 1000),
		e: 'p',
		i: 'displayOfSensitiveAds',
		a: draftDisplayOfSensitiveAds.value,
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

.headerIcon {
	margin-right: 10px;
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
	display: inline-block;
	text-align: left;
}

.ageCheckbox {
	position: absolute;
	left: -99em;
}

.ageCheckbox:focus-visible + .toggle {
	outline: 2px solid var(--MI_THEME-focus);
	outline-offset: 2px;
}

.toggle {
	cursor: pointer;
	display: inline-block;
	position: relative;
	width: 140px;
	height: 64px;
	margin: 4px; // focus outline space
	color: var(--MI_THEME-fg);
	-webkit-tap-highlight-color: transparent;

	// Under 18 (unchecked): bright/kid-like (mint + sun yellow + sky blue)
	--bg: #d6ffe0;
	--bg-border: rgba(0, 0, 0, 0.06);
	--handler-bg: #ffcf4a;
	--handler-fg: rgba(32, 18, 0, 0.95);
	--handler-border: rgba(0, 0, 0, 0.1);
	--handler-text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
	--handler-x: 0px;

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
		position: absolute;
		top: 22px;
		transition: all 0.3s ease;
		white-space: nowrap;
		font-weight: bold;
		font-size: 1.1em;
		opacity: 0.5;
		color: var(--MI_THEME-fg);
	}

	> .before {
		left: -110px;
	}

	> .after {
		right: -110px;
	}
}

.toggleBg {
	position: absolute;
	inset: 0;
	display: block;
	background: var(--bg);
	border: solid 1px var(--bg-border);
	border-radius: 999px;
	overflow: hidden;
	box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.1);
	transition: background-color 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.decoLayer {
	position: absolute;
	inset: 0;
	overflow: hidden;
	pointer-events: none;
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
	opacity: 1;
	transform: scale(1);
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

.ageCheckbox:checked + .toggle {
	// Over 18 (checked): warm/alerting (red + orange + pink + purple)
	--bg: #ffd0dc;
	--bg-border: rgba(0, 0, 0, 0.08);
	--handler-bg: #ff4d6d;
	--handler-fg: #fff;
	--handler-border: rgba(255, 255, 255, 0.32);
	--handler-text-shadow: 0 1px 0 rgba(0, 0, 0, 0.25);
	--handler-x: 76px;

	--deco-neutral: rgba(255, 163, 200, 0.45);
	--deco-pink: rgba(255, 81, 181, 0.65);
	--deco-orange: rgba(255, 140, 0, 0.65);
	--deco-purple: rgba(178, 117, 255, 0.65);
	--deco-red: rgba(255, 79, 79, 0.65);

	> .before {
		opacity: 0.5;
		color: inherit;
	}

	> .after {
		opacity: 1;
		color: var(--MI_THEME-accent);
	}
}

.ageCheckbox:not(:checked) + .toggle {
	> .before {
		opacity: 1;
		color: var(--MI_THEME-accent);
	}
}

.ageCheckbox:checked + .toggle .handlerIconUnder {
	opacity: 0;
	transform: scale(0.5);
}

.ageCheckbox:checked + .toggle .handlerIconOver {
	opacity: 1;
	transform: scale(1);
}
</style>
