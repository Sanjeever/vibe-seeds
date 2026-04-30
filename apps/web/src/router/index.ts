import type { RouteRecordRaw } from "vue-router";
import HomeView from "../views/HomeView.vue";
import ShareView from "../views/ShareView.vue";

export const routes: RouteRecordRaw[] = [
  { path: "/", component: HomeView },
  { path: "/share/:shareId", component: ShareView },
];
