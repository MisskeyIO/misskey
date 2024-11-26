<template>
<div ref="container" :class="$style.root">
</div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, shallowRef, nextTick, ref } from 'vue';
import * as Misskey from 'misskey-js';
import * as THREE from 'three';

const props = defineProps<{
	user: Misskey.entities.UserLite;
	audioEl: HTMLAudioElement | undefined;
	analyser: AnalyserNode | undefined;
}>();

const container = shallowRef<HTMLDivElement>();

const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }`;

const fragmentShader = `
        precision mediump float;
        uniform float time;
        uniform float enableAudio;
        uniform sampler2D tAudioData;
        uniform vec2 resolution;
        uniform sampler2D uTex;
        uniform sampler2D uMask;
        varying vec2 vUv;

        const float PI  = 3.141592653589793;
        const float PI2 = PI * 2.;
        const float oneStep = 0.125;
        const float minSize = 0.35;
        const float speed1 = 7.0;
        const float speed2 = 8.0;

        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233)))* 43758.5453123);
        }

        float noise(in vec2 st) {
            vec2 i = floor(st);
            vec2 f = fract(st);
            float a = random(i);
            float b = random(i + vec2(1.0, 0.0));
            float c = random(i + vec2(0.0, 1.0));
            float d = random(i + vec2(1.0, 1.0));
            vec2 u = f*f*(3.0-2.0*f);
            return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        float circle(vec2 uv, float audioA, float audioB, float angle, float oneStep, float minSize) {
            float ratioInStep = fract(angle / oneStep);
            float size = max(mix(audioA, audioB, ratioInStep), 0.0);

            return step(length(uv), smoothstep(0.1, 0.7, pow(sin(ratioInStep - 0.5), 2.0) + 0.5) * smoothstep(0.2, 1.0, (size)) + minSize );

            // return step(length(uv), smoothstep(0.1, 0.65, pow(sin(ratioInStep - 0.5), 2.0) + 0.5) * smoothstep(0.1, 1.0, (abs(sin(size))) * 1.0 ));
            // return step(length(uv),(abs(sin(size)) * 0.85 + minSize));
        }

        float stepValue(float value, float stepSize) {
            return floor(value / stepSize) * stepSize;
        }

        void main() {
            vec2 uv = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);
            vec2 texUv = uv / 0.8 + 0.5;

            // ベクトルから角度を取得して正規化
            float angleBase = (atan(uv.y, uv.x) + PI) / PI2; // 0.0 ~ 1.0

            // ビジュアライザ
            float shape = 0.0;
            float angle = 0.0;

            for (int i = 0; i < int(2); i++) {
                // 回転
                if (i == 1) {
                    angle = fract(angleBase + (sin(time / 1000.0 * speed1) + 1.0));
                } else {
                    angle = fract(angleBase - (sin(time / 1000.0 * speed2) + 1.0));
                }

                if (enableAudio < 0.1) {
                    // 再生前の状態
                } else {
                    // 再生中の状態
                    // 分解能ごとに丸めた角度を取得
                    float roundedAngle = stepValue(angle, oneStep);

                    // 音声解析情報
                    // 両端が極値になって固定化されるので逆順をミックス
                    float audio1a = texture2D(tAudioData, vec2(roundedAngle, 0.0)).r;
                    float audio2a = texture2D(tAudioData, vec2(1.0 - roundedAngle, 0.0)).r;
                    float audioA = mix(audio1a, audio2a, 0.5);

                    float audio1b = texture2D(tAudioData, vec2(roundedAngle + oneStep, 0.0)).r;
                    float audio2b = texture2D(tAudioData, vec2(1.0 - roundedAngle - oneStep), 0.0).r;
                    float audioB = mix(audio1b, audio2b, 0.5);

                    shape += circle(uv, audioA, audioB, angle, oneStep, minSize * enableAudio);
                }
            }

            // プロフィール画像と円形クリップ
            vec3 profileTex = texture2D(uTex, texUv).rgb;
            vec3 maskTex = texture2D(uMask, texUv).rgb;

            // 背景色をピックアップしてミックス
            vec3 pickColor1 = texture2D(uTex, vec2(0.3, 0.3)).rgb;
            vec3 pickColor2 = texture2D(uTex, vec2(0.7, 0.7)).rgb;
            vec3 pickColor = mix(pickColor1, pickColor2, 0.5);

            // 背景と各レイヤーを合成
            vec3 backColor = mix(vec3(shape), pickColor, 0.9);
            vec3 mixedTex = backColor;
            if (texUv.x >= 0. && texUv.x <= 1. && texUv.y >= 0. && texUv.y <= 1.) {
               mixedTex = mix(profileTex, backColor, maskTex.r);
            }

            gl_FragColor = vec4(mixedTex, 1.0);
        }
`;

const isPaused = ref(true);
const fftSize = 64;

let scene, camera, renderer, width, height, uniforms, texture, maskTexture;

const initWebGL = () => {
	const parent = container.value ?? { offsetWidth: 0 };
	width = parent.offsetWidth;
	height = Math.floor(width * 9 / 16);

	scene = new THREE.Scene();
	camera = new THREE.OrthographicCamera();
	camera.left = width / -2;
	camera.right = width / 2;
	camera.top = height / 2;
	camera.bottom = height / -2;
	camera.updateProjectionMatrix();

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(width, height);

	container.value.appendChild(renderer.domElement);

	if (props.analyser) props.analyser.fftSize = fftSize;

	const loader = new THREE.TextureLoader();
	texture = loader.load(props.user.avatarUrl);
	maskTexture = loader.load('/client-assets/circlemask.png');

	uniforms = {
		enableAudio: { value: 0 },
		uTex: { value: texture },
		tAudioData: { value: new THREE.DataTexture(new Uint8Array(fftSize / 2), fftSize / 2, 1, THREE.RedFormat) },
		uMask: { value: maskTexture },
		time: { value: 0 },
		resolution: { value: new THREE.Vector2(width, height) },
	};

	const material = new THREE.ShaderMaterial({
		uniforms: uniforms,
		vertexShader: vertexShader,
		fragmentShader: fragmentShader,
	});

	const geometry = new THREE.PlaneGeometry(2, 2);
	const mesh = new THREE.Mesh(geometry, material);
	scene.add(mesh);

	renderer.setAnimationLoop(animate);
};

let data;
const audioVisualizerPlay = () => {
	if (props.analyser) {
		data = new Uint8Array(props.analyser.frequencyBinCount);
		props.analyser.getByteFrequencyData(data);
		uniforms.tAudioData.value = new THREE.DataTexture(data, fftSize / 2, 1, THREE.RedFormat);
		uniforms.tAudioData.value.needsUpdate = true;
	}
};

const animate = () => {
	uniforms.time.value += 0.1;
	audioVisualizerPlay();
	renderer.render(scene, camera);
};

const pauseAnimation = () => {
	isPaused.value = true;
	setEnableAudio(0);
};

const resumeAnimation = () => {
	isPaused.value = false;
	setEnableAudio(1);
};

let targetValue = 0;
let currentValue = 0;
const step = 0.05;

const updateEnableAudio = () => {
	if (currentValue < targetValue) {
		currentValue = Math.min(currentValue + step, targetValue);
	} else if (currentValue > targetValue) {
		currentValue = Math.max(currentValue - step, targetValue);
	}
	uniforms.enableAudio.value = currentValue;

	if (currentValue !== targetValue) {
		requestAnimationFrame(updateEnableAudio);
	}
};

const setEnableAudio = (value: number) => {
	targetValue = value;
	requestAnimationFrame(updateEnableAudio);
};

const onResize = () => {
	const parent = container.value ?? { offsetWidth: 0 };
	width = parent.offsetWidth;
	height = Math.floor(width * 9 / 16);
	camera.left = width / -2;
	camera.right = width / 2;
	camera.top = height / 2;
	camera.bottom = height / -2;
	camera.updateProjectionMatrix();
	renderer.setSize(width, height);
	uniforms.resolution.value.set(width, height);
};

onMounted(async () => {
	nextTick().then(() => {
		initWebGL();
		window.addEventListener('resize', onResize);
	});
});

onUnmounted(() => {
	if (renderer) {
		renderer.dispose();
	}
});

defineExpose({
	pauseAnimation,
	resumeAnimation,
});
</script>

<style lang="scss" module>
.root {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
}
</style>
