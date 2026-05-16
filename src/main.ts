import { DinoOutpostGame } from "./app/Game";
import "./ui/styles.css";

const canvas = document.querySelector<HTMLCanvasElement>("#gameCanvas");
const hudRoot = document.querySelector<HTMLElement>("#hud");

if (!canvas || !hudRoot) {
  throw new Error("Dino Outpost failed to find the canvas or HUD root.");
}

const game = new DinoOutpostGame(canvas, hudRoot);
game.boot();
