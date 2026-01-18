<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal ref="modal" :preferType="'dialog'" :zPriority="'high'" @click="done(true)" @closed="emit('closed')" @esc="cancel()">
	<div :class="$style.root">
		<div v-if="icon" :class="$style.icon">
			<i :class="icon"></i>
		</div>
		<div
			v-else-if="!input && !select"
			:class="[$style.icon]"
		>
			<MkSystemIcon v-if="type === 'success'" :class="$style.iconInner" style="width: 45px;" type="success"/>
			<MkSystemIcon v-else-if="type === 'error'" :class="$style.iconInner" style="width: 45px;" type="error"/>
			<MkSystemIcon v-else-if="type === 'warning'" :class="$style.iconInner" style="width: 45px;" type="warn"/>
			<MkSystemIcon v-else-if="type === 'info'" :class="$style.iconInner" style="width: 45px;" type="info"/>
			<MkSystemIcon v-else-if="type === 'question'" :class="$style.iconInner" style="width: 45px;" type="question"/>
			<MkLoading v-else-if="type === 'waiting'" :class="$style.iconInner" :em="true"/>
		</div>
		<header v-if="title" :class="$style.title" class="_selectable"><Mfm :text="title"/></header>
		<div v-if="text" :class="$style.text" class="_selectable"><Mfm :text="text"/></div>
		<template v-if="input">
			<MkInput v-if="input.type !== 'textarea'" ref="inputComponent" v-model="inputValue" autofocus :type="input.type || 'text'" :placeholder="input.placeholder || undefined" :autocomplete="input.autocomplete" :min="input.min" :max="input.max" :step="input.step" @keydown="onInputKeydown">
				<template v-if="input.type === 'password'" #prefix><i class="ti ti-lock"></i></template>
				<template #caption>
					<span v-if="okButtonDisabledReason === 'charactersExceeded'" v-text="i18n.tsx._dialog.charactersExceeded({ current: (inputValue as string)?.length ?? 0, max: input.maxLength ?? 'NaN' })"/>
					<span v-else-if="okButtonDisabledReason === 'charactersBelow'" v-text="i18n.tsx._dialog.charactersBelow({ current: (inputValue as string)?.length ?? 0, min: input.minLength ?? 'NaN' })"/>
					<span v-else-if="okButtonDisabledReason === 'numberBelow'" v-text="i18n.tsx._dialog.numberBelow({ current: inputValue ?? 'NaN', min: input.min ?? 'NaN' })"/>
					<span v-else-if="okButtonDisabledReason === 'numberAbove'" v-text="i18n.tsx._dialog.numberAbove({ current: inputValue ?? 'NaN', max: input.max ?? 'NaN' })"/>
					<span v-else-if="okButtonDisabledReason === 'invalid'" v-text="i18n.tsx._dialog.invalid({ current: inputValue ?? 'NaN' })"/>
				</template>
			</MkInput>
			<MkTextarea v-if="input.type === 'textarea'" v-model="inputValue" :placeholder="input.placeholder || undefined" :autocomplete="input.autocomplete">
				<template #label>{{ input.placeholder }}</template>
				<template #caption>
					<span v-if="okButtonDisabledReason === 'charactersExceeded'" v-text="i18n.tsx._dialog.charactersExceeded({ current: (inputValue as string)?.length ?? 0, max: input.maxLength ?? 'NaN' })"/>
					<span v-else-if="okButtonDisabledReason === 'charactersBelow'" v-text="i18n.tsx._dialog.charactersBelow({ current: (inputValue as string)?.length ?? 0, min: input.minLength ?? 'NaN' })"/>
					<span v-else-if="okButtonDisabledReason === 'numberBelow'" v-text="i18n.tsx._dialog.numberBelow({ current: inputValue ?? 'NaN', min: input.min ?? 'NaN' })"/>
					<span v-else-if="okButtonDisabledReason === 'numberAbove'" v-text="i18n.tsx._dialog.numberAbove({ current: inputValue ?? 'NaN', max: input.max ?? 'NaN' })"/>
					<span v-else-if="okButtonDisabledReason === 'invalid'" v-text="i18n.tsx._dialog.invalid({ current: inputValue ?? 'NaN' })"/>
				</template>
			</MkTextarea>
		</template>
		<MkSelect v-if="select" v-model="selectedValue" :items="selectDef" autofocus></MkSelect>
		<MkSwitch v-if="switchLabel" v-model="switchValue" style="display: flex; margin: 1em 0; justify-content: center;">{{ switchLabel }}</MkSwitch>
		<details v-if="details" class="_acrylic" style="margin: 1em 0;">
			<summary>{{ i18n.ts.details }}</summary>
			<div class="_gaps_s" style="text-align: initial;">
				<MkKeyValue v-for="(value, key) in details" :key="key" :value="value">
					<template #key>{{ key }}</template>
					<template #value>{{ value }}</template>
				</MkKeyValue>
			</div>
		</details>
		<div v-if="(showOkButton || showCancelButton) && !actions" :class="$style.buttons">
			<MkButton v-if="showOkButton" data-cy-modal-dialog-ok inline primary rounded :autofocus="!input && !select" :disabled="okDisabled || okButtonDisabledReason != null" @click="ok">{{ okText ?? ((showCancelButton || input || select) ? i18n.ts.ok : i18n.ts.gotIt) }}<span v-if="okDisabled && okWaitInitiated"> ({{ sec }})</span></MkButton>
			<MkButton v-if="showCancelButton || input || select" data-cy-modal-dialog-cancel inline rounded @click="cancel">{{ cancelText ?? i18n.ts.cancel }}</MkButton>
		</div>
		<div v-if="actions" :class="$style.buttons">
			<MkButton v-for="action in actions" :key="action.text" inline rounded :primary="action.primary" :danger="action.danger" @click="() => { action.callback(); modal?.close(); }">{{ action.text }}</MkButton>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { ref, useTemplateRef, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import type { InputHTMLAttributes } from 'vue';
import MkModal from '@/components/MkModal.vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkKeyValue from '@/components/MkKeyValue.vue';
import type { MkSelectItem, OptionValue } from '@/components/MkSelect.vue';
import { useMkSelect } from '@/composables/use-mkselect.js';
import { i18n } from '@/i18n.js';

type Input = {
	type?: 'text' | 'number' | 'password' | 'email' | 'url' | 'date' | 'time' | 'search' | 'datetime-local' | 'textarea';
	placeholder?: string | null;
	autocomplete?: string;
	default: string | number | null;
	minLength?: number;
	maxLength?: number;
	min?: number;
	max?: number;
	step?: InputHTMLAttributes['step'];
};

type Select = {
	items: MkSelectItem[];
	default: OptionValue | null;
};

type Result = string | number | true | null;

const props = withDefaults(defineProps<{
	type?: 'success' | 'error' | 'warning' | 'info' | 'question' | 'waiting';
	icon?: string;
	title?: string | null;
	text?: string | null;
	input?: Input;
	select?: Select;
	switchLabel?: string | null;
	details?: Record<string, string>;
	actions?: {
		text: string;
		primary?: boolean,
		danger?: boolean,
		callback: (...args: unknown[]) => void;
	}[];
	showOkButton?: boolean;
	showCancelButton?: boolean;
	cancelableByBgClick?: boolean;
	okText?: string;
	okWaitInitiate?: 'dialog' | 'input' | 'switch';
	okWaitDuration?: number;
	cancelText?: string;
}>(), {
	type: 'info',
	icon: undefined,
	title: undefined,
	text: undefined,
	input: undefined,
	select: undefined,
	switchLabel: undefined,
	details: undefined,
	actions: undefined,
	showOkButton: true,
	showCancelButton: false,
	cancelableByBgClick: true,
	okText: undefined,
	okWaitInitiate: undefined,
	okWaitDuration: 0,
	cancelText: undefined,
});

const emit = defineEmits<{
	(ev: 'done', v: { canceled: true } | { canceled: false, result: Result, toggle: boolean }): void;
	(ev: 'closed'): void;
}>();

const modal = useTemplateRef('modal');
const inputComponent = useTemplateRef<InstanceType<typeof MkInput>>('inputComponent');

const inputValue = ref<string | number | null>(props.input?.default ?? null);
const switchValue = ref<boolean>(false);

const sec = ref(props.okWaitDuration);
const okWaitInitiated = computed(() => {
	if (props.okWaitInitiate === 'dialog') return true;
	if (props.okWaitInitiate === 'input') return inputValue.value !== null;
	if (props.okWaitInitiate === 'switch') return switchValue.value;
	return false;
});
const okDisabled = computed(() => sec.value > 0);

const okButtonDisabledReason = computed<null | 'charactersExceeded' | 'charactersBelow' | 'numberBelow' | 'numberAbove' | 'invalid'>(() => {
	if (props.input) {
		if (props.input.type === 'number') {
			const rawValue = inputValue.value;
			const numericValue = typeof rawValue === 'number'
				? rawValue
				: rawValue === '' || rawValue == null
					? null
					: Number(rawValue);

			if (numericValue != null && Number.isFinite(numericValue)) {
				if (props.input.min != null && numericValue < props.input.min) {
					return 'numberBelow';
				}
				if (props.input.max != null && numericValue > props.input.max) {
					return 'numberAbove';
				}
			} else if (numericValue != null) {
				return 'invalid';
			}

			if (inputComponent.value && !inputComponent.value.inputEl.validity.valid) {
				return 'invalid';
			}
		}

		if (props.input.minLength) {
			if (inputValue.value == null || (inputValue.value as string).length < props.input.minLength) {
				return 'charactersBelow';
			}
		}
		if (props.input.maxLength) {
			if (inputValue.value && (inputValue.value as string).length > props.input.maxLength) {
				return 'charactersExceeded';
			}
		}
	}

	return null;
});

const {
	def: selectDef,
	model: selectedValue,
} = useMkSelect({
	items: computed(() => props.select?.items ?? []),
	initialValue: props.select?.default ?? null,
});

// overload function を使いたいので lint エラーを無視する
function done(canceled: true): void;
function done(canceled: false, result: Result, toggle: boolean): void; // eslint-disable-line no-redeclare

function done(canceled: boolean, result?: Result, toggle?: boolean ): void { // eslint-disable-line no-redeclare
	emit('done', { canceled, result, toggle } as { canceled: true } | { canceled: false, result: Result, toggle: boolean });
	modal.value?.close();
}

async function ok() {
	if (!props.showOkButton) return;

	const result =
		props.input ? inputValue.value :
		props.select ? selectedValue.value :
		true;
	done(false, result, switchValue.value);
}

function cancel() {
	done(true);
}

function onKeydown(evt: KeyboardEvent) {
	if (evt.key === 'Escape') cancel();
}

function onInputKeydown(evt: KeyboardEvent) {
	if (evt.key === 'Enter' && !okDisabled.value && okButtonDisabledReason.value === null) {
		evt.preventDefault();
		evt.stopPropagation();
		ok();
	}
}

watch(okWaitInitiated, () => {
	sec.value = props.okWaitDuration;
});

onMounted(() => {
	window.document.addEventListener('keydown', onKeydown);

	sec.value = props.okWaitDuration;
	if (sec.value > 0) {
		const waitTimer = window.setInterval(() => {
			if (!okWaitInitiated.value) return;

			if (sec.value < 0) {
				window.clearInterval(waitTimer);
			}
			sec.value = sec.value - 1;
		}, 1000);
	}
});

onBeforeUnmount(() => {
	window.document.removeEventListener('keydown', onKeydown);
});
</script>

<style lang="scss" module>
.root {
	position: relative;
	margin: auto;
	padding: 32px;
	min-width: 320px;
	max-width: 480px;
	box-sizing: border-box;
	text-align: center;
	background: var(--MI_THEME-panel);
	border-radius: 16px;
}

.icon {
	font-size: 24px;

	& + .title {
		margin-top: 8px;
	}
}

.iconInner {
	display: block;
	margin: 0 auto;
}

.title {
	margin: 0 0 8px 0;
	font-weight: bold;
	font-size: 1.1em;

	& + .text {
		margin-top: 8px;
	}
}

.text {
	margin: 16px 0 0 0;
}

.buttons {
	margin-top: 16px;
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
	justify-content: center;
}
</style>
