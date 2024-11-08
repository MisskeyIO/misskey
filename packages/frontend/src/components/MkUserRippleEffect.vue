<template>
	<div ref="container" :class="$style.root">
		<canvas ref="canvas" :class="$style.canvas"/>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, shallowRef, nextTick, watch, ref } from 'vue';
import { render } from 'buraha';

const props = defineProps<{
	user: Misskey.entities.UserLite;
}>();

const container = shallowRef<HTMLDivElement>();
const canvas = shallowRef<HTMLCanvasElement>();

let width: number;
let height: number;
let maxRadius: number;
let rippleSpeed: number;
let backgroundColor: string;
let animationFrameId: number;
let ctx: CanvasRenderingContext2D | null;
let circles = [];
const isPaused = ref(false);

const image = new Image();
image.src = props.user.profileImage;

const initCanvas = () => {
	const parent = container.value ?? { offsetWidth: 0 };
	const cv = canvas.value ?? { width: 0, height: 0 };
	width = cv.width = parent.offsetWidth;
	height = cv.height = Math.floor(width * 9 / 16);
	ctx = canvas.value?.getContext("2d") ?? null;
	maxRadius = Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2));
	rippleSpeed = maxRadius / 1500;
	backgroundColor = `hsl(${360 * Math.random()},${25 + 70 * Math.random()}%,${85 + 10 * Math.random()}%)`;

	if (!ctx) return;

	drawBackground();
	drawProfileImage();
};

const drawBackground = () => {
	if (!ctx) return;

	if (props.user.avatarBlurhash) {
		render(props.user.avatarBlurhash, canvas.value);
	} else {
		ctx.fillStyle = backgroundColor;
		ctx.fillRect(0, 0, width, height);
	}
};

const drawProfileImage = () => {
	if (!ctx) return;

	const imgSize = Math.min(width, height) / 4; // Profile image size
	const x = width / 2 - imgSize / 2;
	const y = height / 2 - imgSize / 2;

	ctx.save();
	ctx.beginPath();
	ctx.arc(width / 2, height / 2, imgSize / 2, 0, Math.PI * 2);
	ctx.closePath();
	ctx.clip();
	ctx.drawImage(image, x, y, imgSize, imgSize);
	ctx.restore();
};

const easeOutCubic = (time, start, change, duration) => {
	time /= duration;
	time--;
	return change * (time * time * time + 1) + start;
};

const dropBall = (radius) => {
	if (!ctx) return;
	if (isPaused.value) return;

	drawBackground();

	ctx.beginPath();
	ctx.fillStyle = 'black';
	ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
	ctx.closePath();
	ctx.fill();

	drawProfileImage();

	requestAnimationFrame(() => {
		if (radius > 0) {
			dropBall(radius - 1);
		} else {
			animateRipple();
			setInterval(() => {
				if (!isPaused.value) animateRipple();
			}, 2500);
		}
	});
};

const animateRipple  = () => {
	if (!ctx) return;

	circles.forEach((circle) => (circle.radius += rippleSpeed));

	circles.forEach((circle) => {
		if (!ctx) return;

		const currentValue = easeOutCubic(circle.radius, 0, maxRadius, maxRadius);
		ctx.fillStyle = '#ebebeb';
		ctx.lineWidth = 20;
		ctx.shadowBlur = 50 + ((100 / maxRadius) * currentValue);
		ctx.shadowColor = `rgba(0, 0, 0, ${(1 - currentValue / maxRadius) * 0.2}`;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;
		ctx.beginPath();
		ctx.arc(width / 2, height / 2, currentValue, 0, Math.PI * 2);
		ctx.closePath();

		ctx.fill();
	});

	drawProfileImage();

	circles = circles.filter((circle) => circle.radius < maxRadius);

	if (circles.length) {
		requestAnimationFrame(tick);
	}
};

const animate = () => {
	if (isPaused.value || document.visibilityState === 'hidden') return;

	animateRipple();
	drawProfileImage();

	setTimeout(() => {
		animationFrameId = requestAnimationFrame(animate);
	}, 500);
};

const pauseAnimation = () => {
	isPaused.value = true;
	cancelAnimationFrame(animationFrameId);
};

const resumeAnimation = () => {
	isPaused.value = false;
	animationFrameId = requestAnimationFrame(animate);
};

const onResize = () => {
	initCanvas();
	drawProfileImage();
};

onMounted(async () => {
	nextTick().then(() => {
		onResize();
		window.addEventListener("resize", onResize);
	});
});

onUnmounted(() => {
	window.removeEventListener("resize", onResize);
});

watch(
	() => props.profileImage,
	() => {
		image.src = props.profileImage;
		image.onload = () => {
			initCanvas();
			drawProfileImage();
		};
	},
);

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
	border-radius: 8px;
	pointer-events: none;
	z-index: 0;
}

.canvas {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: cover;
}
</style>
