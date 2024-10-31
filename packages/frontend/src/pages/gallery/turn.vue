<template>
  <div :key="componentKey" :data-uid="uid">
    <slot />
  </div>
</template>

<script>
import $ from "jquery";
import "../../../src/scripts/turn.js";
import { v4 as uuidv4 } from 'uuid';

export default {
  name: "TurnView",
  data() {
    return {
      uuid: uuidv4(),
      componentKey: 0
    };
  },
  props: {
    options: {
      type: Object,
      default: () => { }
    }
  },
  watch: {
    defaultOptions: {
      handler(val) {
        this.forceRerender(val);
      },
      deep: true
    }
  },
  computed: {
    uid() {
      return `${this.uuid}`;
    },
    selector() {
      return `div[data-uid=${this.uid}]`;
    },
    defaultOptions() {
      return {
        when: {
          turning: (event, page, pageObj) => {
            this.currentPage = page;
          },
          first: () => {
            this.first();
          },
          last: () => {
            this.last();
          }
        },
        ...this.options
      };
    }
  },
  mounted() {
    $(this.selector).turn(this.defaultOptions);
  },
  methods: {
    goTo(page) {
      $(this.selector).turn("page", page);
    },
    first() { },
    last() { },
    forceRerender(val) {
      this.uuid = nanoid();
      this.componentKey += 1;
      this.$nextTick(() => $(this.selector).turn(val));
    }
  }
};
</script>
