/* =========================================================
   HOUSE RULES - MAIN GAME SCRIPT
   File: js/game.js
========================================================= */

"use strict";

/* =========================
   1. DOM CACHE
   Populated once at DOMContentLoaded.
   All HUD functions read from here — no repeated querySelector calls.
========================= */

const DOM = {};

/* =========================
   2. GAME STATE
========================= */

let playerMoney    = 0;
let hasCasinoToken = false;
let currentLootTarget = null;

let timerStarted = false;
let gameEnded    = false;
let timeLeft     = 600; // 10 minutes
let timerInterval = null;

let playerInsideEscapeZone = false;
let escapeUnlocked         = false;

let currentElevatorZone            = null;
let elevatorIsMoving               = false;
let elevatorZoneBlockedAfterTeleport = null;

let currentFortuneWheel   = null;
let fortuneWheelIsSpinning = false;
let casinoTokenUsed        = false;

let currentSlotMachine = null;

let vaultLaserSystemRunning = false;
let vaultLaserTimeouts      = [];

let escapeUnlockAlertShown   = false;
let securityAlertShown       = false;
let securityClosingAlertShown = false;

let laserPenaltyLevel = 0;
let laserCanHitPlayer = true;

let displayedMoney      = 0;
let moneyAnimationFrame = null;

/* =========================
   3. DATA TABLES
========================= */

const fortuneResults = [
  { angle: 0,   name: "BIG WIN",       money:  5000, time:   0, tokenBack: false },
  { angle: 30,  name: "REFUND BONUS",  money:   500, time:   0, tokenBack: false },
  { angle: 60,  name: "HOUSE CUT",     money:  -250, time:   0, tokenBack: false },
  { angle: 90,  name: "CURSED PRIZE",  money:  6000, time: -30, tokenBack: false },
  { angle: 120, name: "LUCKY PULL",    money:  2500, time:   0, tokenBack: false },
  { angle: 150, name: "TIME PENALTY",  money:  1000, time: -20, tokenBack: false },
  { angle: 180, name: "SMALL WIN",     money:  1500, time:   0, tokenBack: false },
  { angle: 210, name: "JACKPOT",       money: 12000, time:   0, tokenBack: false },
  { angle: 240, name: "SECURITY TAX",  money:  -500, time:   0, tokenBack: false },
  { angle: 270, name: "SAFE PRIZE",    money:   750, time:   0, tokenBack: false },
  { angle: 300, name: "SECOND CHANCE", money:  1000, time:   0, tokenBack: true  },
  { angle: 330, name: "BAD LUCK",      money:  -100, time:   0, tokenBack: false },
];

const slotMachineBetChoices = [
  { name: "Small Bet Machine",   cost:  500 },
  { name: "Standard Machine",    cost: 1000 },
  { name: "High Roller Machine", cost: 2500 },
  { name: "VIP Machine",         cost: 5000 },
];

const slotSymbols = ["CASH", "GOLD", "DIAMOND", "SKULL"];

/* =========================
   4. HUD — MONEY
========================= */

function formatMoney(amount) {
  if (amount >= 1000000) return "$" + (amount / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (amount >= 100000)  return "$" + Math.floor(amount / 1000) + "k";
  return "$" + amount.toLocaleString();
}

function updateMoneyHUD(animate = true) {
  if (!DOM.moneyValue) return;

  if (infiniteMoney) {
    DOM.moneyValue.innerHTML = '<span class="hud-inf">∞</span>';
    return;
  }

  if (!animate) {
    displayedMoney = playerMoney;
    DOM.moneyValue.textContent = formatMoney(displayedMoney);
    return;
  }

  animateMoneyHUD(playerMoney);
}

function animateMoneyHUD(targetMoney) {
  if (!DOM.moneyValue) return;

  if (moneyAnimationFrame) cancelAnimationFrame(moneyAnimationFrame);

  const startMoney = displayedMoney;
  const difference = targetMoney - startMoney;
  const duration   = 650;
  const startTime  = performance.now();

  function animate(currentTime) {
    const progress     = Math.min((currentTime - startTime) / duration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    displayedMoney = Math.round(startMoney + difference * easedProgress);
    DOM.moneyValue.textContent = formatMoney(displayedMoney);

    if (progress < 1) {
      moneyAnimationFrame = requestAnimationFrame(animate);
    } else {
      displayedMoney = targetMoney;
      DOM.moneyValue.textContent = formatMoney(targetMoney);
      moneyAnimationFrame = null;
    }
  }

  moneyAnimationFrame = requestAnimationFrame(animate);
}

/* =========================
   5. HUD — POPUPS & CROSSHAIR
========================= */

function showGamePopup(type, text) {
  if (!DOM.popupContainer) return;

  const popup = document.createElement("div");
  popup.classList.add("game-popup", "game-popup--" + type);
  popup.textContent = text;

  DOM.popupContainer.appendChild(popup);

  setTimeout(function () { popup.remove(); }, 1500);
}

function getLootPopupType(itemName) {
  const name = itemName.toLowerCase();

  if (name.includes("cash"))                               return "cash";
  if (name.includes("gold"))                               return "gold";
  if (name.includes("diamond"))                            return "diamond";
  if (name.includes("artifact") || name.includes("mark")) return "mark";
  if (name.includes("token"))                              return "token";

  return "neutral";
}

function setCrosshairInteractable(isInteractable) {
  if (!DOM.crosshairDot) return;

  DOM.crosshairDot.setAttribute(
    "material",
    isInteractable ? "color: red; shader: flat" : "color: white; shader: flat",
  );
}

/* =========================
   6. HUD — TOKEN PANEL
========================= */

function updateTokenHUD() {
  if (!DOM.tokenName || !DOM.tokenIcon || !DOM.tokenPanel) return;

  if (infiniteToken) {
    DOM.tokenName.innerHTML = '<span class="hud-inf">∞</span><br>TOKEN';
    DOM.tokenIcon.src = "materials/images/HUD/CasinoToken Icon.png";
    DOM.tokenPanel.classList.add("hud-panel--active");
    return;
  }

  if (hasCasinoToken) {
    DOM.tokenName.innerHTML = "CASINO<br>TOKEN";
    DOM.tokenIcon.src = "materials/images/HUD/CasinoToken Icon.png";
    DOM.tokenPanel.classList.add("hud-panel--active");
  } else {
    DOM.tokenName.textContent = "NOT FOUND";
    DOM.tokenIcon.src = "materials/images/HUD/SecretItem Icon.png";
    DOM.tokenPanel.classList.remove("hud-panel--active");
  }
}

function setCasinoTokenUsedHUD() {
  if (infiniteToken) return; // never show "used" state during infinite token mode

  if (!DOM.tokenName || !DOM.tokenIcon || !DOM.tokenPanel) return;

  DOM.tokenName.innerHTML = "TOKEN<br>USED";
  DOM.tokenIcon.src = "materials/images/HUD/CasinoToken Used.png";
  DOM.tokenPanel.classList.remove("hud-panel--active");
}

/* =========================
   7. HUD — INTERACTION PANEL
========================= */

function showInteractionHUD(message) {
  if (!DOM.interactionPanel) return;

  DOM.interactionPanel.classList.add("hud-panel--visible");
  DOM.interactionName.textContent   = message.name;
  DOM.interactionValue.textContent  = message.value;
  DOM.interactionAction.textContent = message.action;
}

function hideInteractionHUD() {
  if (!DOM.interactionPanel) return;

  DOM.interactionPanel.classList.remove("hud-panel--visible");
  DOM.interactionPanel.classList.remove("hud-panel--escape");
  DOM.interactionName.textContent   = "No item selected";
  DOM.interactionValue.textContent  = "";
  DOM.interactionAction.textContent = "PRESS E OR CLICK TO INTERACT";

  if (DOM.interactionIcon) {
    DOM.interactionIcon.src = "materials/images/HUD/Interact.png";
    DOM.interactionIcon.classList.remove("hud-interaction-icon--escape");
  }
}

function showEscapePrompt() {
  if (!escapeUnlocked || gameEnded) return;

  showInteractionHUD({ name: "ESCAPE ROUTE", value: "", action: "PRESS E TO ESCAPE" });

  if (DOM.interactionPanel) DOM.interactionPanel.classList.add("hud-panel--escape");

  if (DOM.interactionIcon) {
    DOM.interactionIcon.src = "materials/images/HUD/E Key.png";
    DOM.interactionIcon.classList.add("hud-interaction-icon--escape");
  }
}

/* =========================
   8. HUD — OBJECTIVE / CONTROLS VISIBILITY
========================= */

function updateMouseHelpHUD() {
  if (!DOM.objectivePanel || !DOM.controlsPanel) return;

  if (gameEnded) {
    DOM.objectivePanel.classList.add("hud-hidden");
    DOM.controlsPanel.classList.add("hud-hidden");
    return;
  }

  const mouseIsLocked = document.pointerLockElement === document.body;

  DOM.objectivePanel.classList.toggle("hud-hidden", mouseIsLocked);
  DOM.controlsPanel.classList.toggle("hud-hidden", mouseIsLocked);
}

/* =========================
   9. TIMER
========================= */

function startGameTimer() {
  if (timerStarted || gameEnded) return;

  timerStarted = true;

  timerInterval = setInterval(function () {
    if (!noTimeLimit) timeLeft--;
    updateTimerHUD();

    if (timeLeft <= 0) endGame("defeat");
  }, 1000);
}

function updateTimerHUD() {
  if (!DOM.timerHUD) return;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  DOM.timerHUD.textContent =
    String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");

  updateTimerColor();
  checkSecurityAlerts();
}

function updateTimerColor() {
  if (!DOM.timerHUD) return;

  DOM.timerHUD.classList.remove("timer-warning", "timer-danger");

  if      (timeLeft <= 60)  DOM.timerHUD.classList.add("timer-danger");
  else if (timeLeft <= 300) DOM.timerHUD.classList.add("timer-warning");
}

function animateTimerHit() {
  if (!DOM.timerHUD) return;

  DOM.timerHUD.classList.remove("timer-hit");
  void DOM.timerHUD.offsetWidth; // force reflow so the animation restarts
  DOM.timerHUD.classList.add("timer-hit");
}

function cutTime(seconds, reasonText) {
  if (gameEnded) return;

  timeLeft = Math.max(0, timeLeft - seconds);

  updateTimerHUD();
  animateTimerHit();
  showGamePopup("time-loss", "-" + seconds + " SECONDS");

  if (reasonText) {
    showInteractionHUD({ name: reasonText, value: "-" + seconds + " SECONDS", action: "TIME PENALTY" });
    setTimeout(function () { hideInteractionHUD(); }, 1500);
  }

  if (timeLeft <= 0) endGame("defeat");
}

/* =========================
   10. SECURITY ALERTS
========================= */

function checkSecurityAlerts() {
  if (timeLeft <= 480 && !escapeUnlockAlertShown) {
    escapeUnlockAlertShown = true;
    unlockEscape();
    showGamePopup("token", "ESCAPE ROUTE UNLOCKED");
  }

  if (timeLeft <= 300 && !securityAlertShown) {
    securityAlertShown = true;
    showGamePopup("time-loss", "SECURITY ALERT");
  }

  if (timeLeft <= 120 && !securityClosingAlertShown) {
    securityClosingAlertShown = true;
    showGamePopup("time-loss", "SECURITY CLOSING IN");
  }
}

function unlockEscape() {
  escapeUnlocked = true;

  ["#escape-ring", "#escape-cylinder-1", "#escape-cylinder-2", "#escape-cylinder-3"].forEach(function (sel) {
    const el = document.querySelector(sel);
    if (el) el.setAttribute("visible", true);
  });
}

/* =========================
   11. END GAME
========================= */

function getDynamicEnding(escaped) {
  if (escaped) {
    if (playerMoney === 0)    return { title: "Broke Escape",        text: "You escaped... technically. Unfortunately, you forgot the money." };
    if (playerMoney <= 999)   return { title: "Participation Trophy", text: "The casino spent more cleaning the carpets than you managed to steal." };
    if (playerMoney <= 4999)  return { title: "Small Time Crook",     text: "Not bad. The casino probably won't notice until tomorrow." };
    if (playerMoney <= 9999)  return { title: "Lucky Night",          text: "You got in, got paid, and got out. A rare combination." };
    if (playerMoney <= 24999) return { title: "Professional Gambler", text: "The house doesn't usually lose. Today it made an exception." };
    if (playerMoney <= 49999) return { title: "Casino Nightmare",     text: "Several managers have suddenly become unemployed." };
    if (playerMoney <= 99999) return { title: "High Roller",          text: "The casino would like to politely ask for its money back." };
    return                           { title: "Legend",               text: "The House Always Wins... except for that one time." };
  }

  if (playerMoney === 0)    return { title: "Empty Handed", text: "Caught. Broke. Embarrassing." };
  if (playerMoney <= 9999)  return { title: "Almost Had It", text: "Security thanks you for gathering everything into one convenient pile." };
  if (playerMoney <= 49999) return { title: "So Close",     text: "You were only a few steps away from becoming somebody else's problem." };
  return                           { title: "House Wins",   text: "You beat the odds, robbed the vault, and then remembered the house always wins." };
}

function endGame(type) {
  if (gameEnded) return;

  gameEnded = true;

  if (timerInterval) clearInterval(timerInterval);

  document.exitPointerLock?.();

  if (DOM.camera) DOM.camera.setAttribute("look-controls", "enabled", false);

  hideInteractionHUD();
  updateMouseHelpHUD();
  setCrosshairInteractable(false);

  if (!DOM.endScreen || !DOM.endTitle || !DOM.endMessage) return;

  const escaped = type === "victory";

  if (escaped) {
    DOM.endTitle.textContent   = "YOU ESCAPED";
    DOM.endTitle.className     = "end-title end-title--victory";
    DOM.endMessage.textContent = "You got away with $" + playerMoney.toLocaleString();
  } else {
    DOM.endTitle.textContent   = "CAUGHT";
    DOM.endTitle.className     = "end-title end-title--defeat";
    DOM.endMessage.textContent = "You were caught with $" + playerMoney.toLocaleString();
  }

  const dynamicEnding = getDynamicEnding(escaped);

  if (DOM.endRankTitle) DOM.endRankTitle.textContent = dynamicEnding.title;
  if (DOM.endRankText)  DOM.endRankText.textContent  = '"' + dynamicEnding.text + '"';

  DOM.endScreen.classList.remove("hud-hidden");
}

/* =========================
   12. PLAYER CONTROLS
========================= */

AFRAME.registerComponent("player-controls-custom", {
  schema: {
    spawnLookY: { type: "number", default: 0 },
  },

  init: function () {
    this.keys        = {};
    this.walkSpeed   = 8.0;
    this.sprintSpeed = 12.0;
    this.normalHeight = 5.0;
    this.crouchHeight = 3.3;
    this.normalWidth  = 1.2;
    this.crouchWidth  = 1.0;

    // Reused every tick to avoid creating garbage every frame
    this.direction = new THREE.Vector3();
    this._yAxis    = new THREE.Vector3(0, 1, 0);

    this.camera = document.querySelector("#camera");
    this.hitbox = document.querySelector("#player-hitbox");

    setTimeout(() => {
      const lookControls = this.camera.components["look-controls"];

      if (lookControls) {
        lookControls.yawObject.rotation.y   = THREE.MathUtils.degToRad(this.data.spawnLookY);
        lookControls.pitchObject.rotation.x = 0;
      }
    }, 100);

    window.addEventListener("keydown", (e) => (this.keys[e.code] = true));
    window.addEventListener("keyup",   (e) => (this.keys[e.code] = false));

    document.body.addEventListener("click", () => {
      if (!gameEnded && document.pointerLockElement !== document.body) {
        document.body.requestPointerLock();
      }
    });
  },

  tick: function (time, delta) {
    if (gameEnded) return;

    const dt  = delta / 1000;
    const rig = this.el;
    const pos = rig.getAttribute("position");

    const speed = (this.keys["ShiftLeft"] || this.keys["ShiftRight"])
      ? this.sprintSpeed
      : this.walkSpeed;

    this.direction.set(0, 0, 0);

    if (this.keys["KeyW"]) this.direction.z -= 1;
    if (this.keys["KeyS"]) this.direction.z += 1;
    if (this.keys["KeyA"]) this.direction.x -= 1;
    if (this.keys["KeyD"]) this.direction.x += 1;

    if (this.direction.length() > 0) {
      this.direction.normalize();
      this.direction.applyAxisAngle(this._yAxis, this.camera.object3D.rotation.y);

      pos.x += this.direction.x * speed * dt;
      pos.z += this.direction.z * speed * dt;

      rig.setAttribute("position", pos);
    }

    const isCrouching  = this.keys["ControlLeft"] || this.keys["ControlRight"] || this.keys["KeyC"];
    const targetHeight = isCrouching ? this.crouchHeight : this.normalHeight;
    const hitboxWidth  = isCrouching ? this.crouchWidth  : this.normalWidth;

    this.camera.setAttribute("position", `0 ${targetHeight} 0`);

    if (this.hitbox) {
      this.hitbox.setAttribute("height",   targetHeight);
      this.hitbox.setAttribute("width",    hitboxWidth);
      this.hitbox.setAttribute("depth",    hitboxWidth);
      this.hitbox.setAttribute("position", { x: 0, y: targetHeight / 2, z: 0 });
    }
  },
});

/* =========================
   13. LOOT
========================= */

AFRAME.registerComponent("loot-item", {
  schema: {
    itemname:  { type: "string",  default: "Loot" },
    unitValue: { type: "number",  default: 0 },
    amount:    { type: "number",  default: 1 },
    keyitem:   { type: "boolean", default: false },
  },

  init: function () {
    this.el.classList.add("interactable");
    this.el.querySelectorAll("*").forEach((part) => part.classList.add("interactable"));

    this.el.addEventListener("raycaster-intersected", () => {
      if (gameEnded) return;

      currentLootTarget = this.el;
      setCrosshairInteractable(true);

      const totalValue = this.data.unitValue * this.data.amount;

      showInteractionHUD({
        name:   this.data.itemname,
        value:  this.data.keyitem ? "KEY ITEM" : "VALUE: $" + totalValue.toLocaleString(),
        action: "PRESS E OR CLICK TO COLLECT",
      });
    });

    this.el.addEventListener("raycaster-intersected-cleared", () => {
      if (currentLootTarget === this.el) {
        currentLootTarget = null;
        hideInteractionHUD();
      }

      setCrosshairInteractable(false);
    });
  },
});

function collectLoot() {
  if (gameEnded || !currentLootTarget) return;

  const data = currentLootTarget.components["loot-item"].data;

  if (data.itemname === "Escape Van") {
    endGame("victory");
    return;
  }

  if (data.keyitem) {
    hasCasinoToken = true;
    updateTokenHUD();
    showGamePopup("token", "CASINO TOKEN FOUND");
  } else {
    const lootValue = data.unitValue * data.amount;

    playerMoney += lootValue;
    updateMoneyHUD(true);

    showGamePopup(
      getLootPopupType(data.itemname),
      "+$" + lootValue.toLocaleString() + " " + data.itemname,
    );
  }

  currentLootTarget.remove();
  currentLootTarget = null;

  hideInteractionHUD();
  setCrosshairInteractable(false);
}

/* =========================
   14. ESCAPE ZONE
========================= */

AFRAME.registerComponent("escape-zone", {
  tick: function () {
    if (gameEnded || !escapeUnlocked) return;

    const player = document.querySelector("#player");
    if (!player) return;

    const playerPos = player.object3D.position;
    const zonePos   = this.el.object3D.position;

    // XZ-only distance — consistent with elevator-zone, unaffected by player height
    const dx     = playerPos.x - zonePos.x;
    const dz     = playerPos.z - zonePos.z;
    const inside = Math.sqrt(dx * dx + dz * dz) <= 5.5;

    if (inside && !playerInsideEscapeZone) {
      playerInsideEscapeZone = true;
      showEscapePrompt();
    }

    if (!inside && playerInsideEscapeZone) {
      playerInsideEscapeZone = false;
      hideInteractionHUD();
    }
  },
});

/* =========================
   15. ELEVATOR
========================= */

AFRAME.registerComponent("elevator-zone", {
  schema: {
    label:          { type: "string", default: "ELEVATOR" },
    targetSelector: { type: "string", default: "" },
    targetOffsetX:  { type: "number", default: 0 },
    targetOffsetY:  { type: "number", default: 0 },
    targetOffsetZ:  { type: "number", default: 0 },
    lookY:          { type: "number", default: 0 },
    radius:         { type: "number", default: 2.2 },
    delay:          { type: "number", default: 1200 },
    audioSelector:  { type: "string", default: "" },
  },

  init: function () {
    this.playerInside = false;
  },

  tick: function () {
    if (gameEnded || elevatorIsMoving) return;

    const player = document.querySelector("#player");
    if (!player) return;

    const playerPos = player.getAttribute("position");
    const zonePos   = this.el.getAttribute("position");

    const dx     = playerPos.x - zonePos.x;
    const dz     = playerPos.z - zonePos.z;
    const inside = Math.sqrt(dx * dx + dz * dz) <= this.data.radius;

    if (inside && !this.playerInside) {
      this.playerInside = true;

      if (elevatorZoneBlockedAfterTeleport === this.el) return;

      currentElevatorZone = this.el;

      showInteractionHUD({ name: this.data.label, value: "ELEVATOR", action: "PRESS E TO USE ELEVATOR" });
    }

    if (!inside && this.playerInside) {
      this.playerInside = false;

      if (elevatorZoneBlockedAfterTeleport === this.el) {
        elevatorZoneBlockedAfterTeleport = null;
      }

      if (currentElevatorZone === this.el) {
        currentElevatorZone = null;
        hideInteractionHUD();
      }
    }
  },
});

function useElevatorZone() {
  if (gameEnded || elevatorIsMoving || !currentElevatorZone) return;

  const data       = currentElevatorZone.components["elevator-zone"].data;
  const targetZone = document.querySelector(data.targetSelector);

  if (!targetZone) return;

  elevatorIsMoving = true;

  hideInteractionHUD();

  if (data.audioSelector) {
    const audioEntity = document.querySelector(data.audioSelector);
    if (audioEntity && audioEntity.components.sound) audioEntity.components.sound.playSound();
  }

  setTimeout(function () {
    const player = document.querySelector("#player");

    if (player) {
      const targetPos = targetZone.object3D.position;

      player.setAttribute("position", {
        x: targetPos.x + data.targetOffsetX,
        y: targetPos.y + data.targetOffsetY,
        z: targetPos.z + data.targetOffsetZ,
      });

      const camera = document.querySelector("#camera");

      if (camera) {
        const lookControls = camera.components["look-controls"];

        if (lookControls) {
          lookControls.yawObject.rotation.y   = THREE.MathUtils.degToRad(data.lookY);
          lookControls.pitchObject.rotation.x = 0;
        }

        camera.object3D.rotation.set(0, 0, 0);
      }
    }

    elevatorZoneBlockedAfterTeleport = targetZone;
    currentElevatorZone = null;
    elevatorIsMoving    = false;

    if (data.targetSelector === "#vault-elevator-zone")  startVaultLaserSystem();
    if (data.targetSelector === "#casino-elevator-zone") stopVaultLaserSystem();

  }, data.delay);
}

/* =========================
   16. VAULT LASER SYSTEM
========================= */

const vaultLaserDoors = {
  door1: ["#laser-01", "#laser-02", "#laser-03", "#laser-04", "#laser-05"],
  door2: ["#laser-06", "#laser-07", "#laser-08", "#laser-09", "#laser-10"],
  door3: ["#laser-11", "#laser-12", "#laser-13", "#laser-14", "#laser-15"],
  door4: ["#laser-16", "#laser-17", "#laser-18", "#laser-19", "#laser-20"],
};

const vaultLaserPairs = [
  ["door1", "door2"],
  ["door3", "door4"],
];

const vaultLaserSettings = {
  openTimeMin:   1200,
  openTimeMax:   2600,
  closedWaitMin:  900,
  closedWaitMax:  1900,
};

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setLaserDoorActive(doorName, active) {
  const laserSelectors = vaultLaserDoors[doorName];
  if (!laserSelectors) return;

  laserSelectors.forEach(function (selector) {
    const laser = document.querySelector(selector);
    if (!laser) return;

    laser.setAttribute("visible", active);

    const raycasterEntity = laser.querySelector("[raycaster]");
    if (raycasterEntity) raycasterEntity.setAttribute("raycaster", "enabled", active);
  });
}

function closeAllVaultLaserDoors() {
  Object.keys(vaultLaserDoors).forEach(function (doorName) { setLaserDoorActive(doorName, true); });
}

function openLaserDoor(doorName)  { setLaserDoorActive(doorName, false); }
function closeLaserDoor(doorName) { setLaserDoorActive(doorName, true);  }

function clearVaultLaserTimeouts() {
  vaultLaserTimeouts.forEach(clearTimeout);
  vaultLaserTimeouts = [];
}

function runVaultLaserPair(pair) {
  if (!vaultLaserSystemRunning || gameEnded) return;

  const doorA = pair[0];
  const doorB = pair[1];

  closeLaserDoor(doorA);
  closeLaserDoor(doorB);

  const chosenDoor     = Math.random() < 0.5 ? doorA : doorB;
  const openTime       = randomBetween(vaultLaserSettings.openTimeMin, vaultLaserSettings.openTimeMax);
  const waitBeforeOpen = randomBetween(vaultLaserSettings.closedWaitMin, vaultLaserSettings.closedWaitMax);

  const openTimeout = setTimeout(function () {
    if (!vaultLaserSystemRunning || gameEnded) return;

    openLaserDoor(chosenDoor);

    const closeTimeout = setTimeout(function () {
      if (!vaultLaserSystemRunning || gameEnded) return;

      closeLaserDoor(chosenDoor);
      runVaultLaserPair(pair);
    }, openTime);

    vaultLaserTimeouts.push(closeTimeout);
  }, waitBeforeOpen);

  vaultLaserTimeouts.push(openTimeout);
}

function startVaultLaserSystem() {
  if (vaultLaserSystemRunning || gameEnded) return;

  vaultLaserSystemRunning = true;

  closeAllVaultLaserDoors();
  vaultLaserPairs.forEach(runVaultLaserPair);
}

function stopVaultLaserSystem() {
  vaultLaserSystemRunning = false;
  laserPenaltyLevel = 0; // reset escalating hit counter when leaving the vault

  clearVaultLaserTimeouts();
  closeAllVaultLaserDoors();
}

/* =========================
   17. LASER SECURITY COMPONENT
========================= */

AFRAME.registerComponent("security-laser", {
  dependencies: ["raycaster"],

  schema: {
    audioSelector: { type: "string", default: "" },
  },

  init: function () {
    this.el.addEventListener("raycaster-intersection", () => {
      damagePlayerWithLaser(this.data.audioSelector);
    });
  },
});

function damagePlayerWithLaser(audioSelector) {
  if (gameEnded || !laserCanHitPlayer) return;

  laserCanHitPlayer = false;
  laserPenaltyLevel++;

  const penaltySeconds = 30 * Math.pow(2, laserPenaltyLevel - 1);

  cutTime(penaltySeconds, "LASER DETECTED");

  if (audioSelector) {
    const audioEntity = document.querySelector(audioSelector);
    if (audioEntity && audioEntity.components.sound) audioEntity.components.sound.playSound();
  }

  if (timeLeft <= 0) {
    endGame("defeat");
    return;
  }

  setTimeout(function () {
    hideInteractionHUD();
    laserCanHitPlayer = true;
  }, 1500);
}

/* =========================
   18. FORTUNE WHEEL
========================= */

AFRAME.registerComponent("fortune-wheel", {
  schema: {
    wheelSelector: { type: "string", default: "" },
    spinDuration:  { type: "number", default: 7000 }, // also controls animation duration
    audioSelector: { type: "string", default: "" },
  },

  init: function () {
    this.el.classList.add("interactable");
    this.el.querySelectorAll("*").forEach((part) => part.classList.add("interactable"));

    this.el.addEventListener("raycaster-intersected", () => {
      if (gameEnded || fortuneWheelIsSpinning) return;

      currentFortuneWheel = this.el;
      setCrosshairInteractable(true);

      if (!hasCasinoToken) {
        showInteractionHUD({ name: "FORTUNE WHEEL", value: "CASINO TOKEN REQUIRED", action: "FIND A TOKEN TO SPIN" });
      } else {
        showInteractionHUD({ name: "FORTUNE WHEEL", value: "READY TO SPIN", action: "PRESS E OR CLICK TO SPIN" });
      }
    });

    this.el.addEventListener("raycaster-intersected-cleared", () => {
      if (currentFortuneWheel === this.el) {
        currentFortuneWheel = null;
        hideInteractionHUD();
      }

      setCrosshairInteractable(false);
    });
  },
});

function useFortuneWheel() {
  if (gameEnded || fortuneWheelIsSpinning || !currentFortuneWheel) return;

  if (!hasCasinoToken) {
    showInteractionHUD({ name: "FORTUNE WHEEL", value: "CASINO TOKEN REQUIRED", action: "FIND A TOKEN TO SPIN" });
    return;
  }

  fortuneWheelIsSpinning = true;
  hasCasinoToken  = infiniteToken ? true : false;
  casinoTokenUsed = infiniteToken ? false : true;

  if (infiniteToken) {
    updateTokenHUD();      // keep the ∞ TOKEN display
  } else {
    setCasinoTokenUsedHUD();
  }
  hideInteractionHUD();
  setCrosshairInteractable(false);

  const data  = currentFortuneWheel.components["fortune-wheel"].data;
  const wheel = document.querySelector(data.wheelSelector);

  if (data.audioSelector) {
    const audioEntity = document.querySelector(data.audioSelector);
    if (audioEntity && audioEntity.components.sound) audioEntity.components.sound.playSound();
  }

  const result    = fortuneResults[Math.floor(Math.random() * fortuneResults.length)];
  const baseSpins = 360 * 8;

  if (wheel) {
    const currentRotation = wheel.getAttribute("rotation") || { x: 0, y: 0, z: 0 };
    const currentZ        = currentRotation.z || 0;
    const normalizedZ     = ((currentZ % 360) + 360) % 360;
    const angleToResult   = ((result.angle - normalizedZ) + 360) % 360;
    const finalRotation   = currentZ + baseSpins + angleToResult;

    wheel.removeAttribute("animation__spin");
    wheel.setAttribute("animation__spin", {
      property: "rotation",
      to:       `0 0 ${finalRotation}`,
      dur:      data.spinDuration,
      easing:   "easeOutQuint",
    });
  }

  setTimeout(function () {
    applyFortuneResult(result);
    fortuneWheelIsSpinning = false;
    currentFortuneWheel    = null;
  }, data.spinDuration + 200);
}

function applyFortuneResult(result) {
  if (!infiniteMoney || result.money > 0) {
    playerMoney = Math.max(0, playerMoney + result.money);
  }

  if (result.time < 0) {
    cutTime(Math.abs(result.time), result.name);
    if (gameEnded) return;
  }

  if (result.tokenBack) {
    hasCasinoToken  = true;
    casinoTokenUsed = false;
    updateTokenHUD();
  }

  updateMoneyHUD();

  let effectText = "";

  if      (result.money > 0)  effectText = "+$" + result.money.toLocaleString();
  else if (result.money < 0)  effectText = "-$" + Math.abs(result.money).toLocaleString();
  else if (result.time < 0)   effectText = result.time + " SECONDS";
  else if (result.tokenBack)  effectText = "TOKEN RETURNED";
  else                        effectText = "NO REWARD";

  showInteractionHUD({ name: result.name, value: effectText, action: "FORTUNE WHEEL RESULT" });

  setTimeout(function () { hideInteractionHUD(); }, 5000);
}

/* =========================
   19. SLOT MACHINE
========================= */

AFRAME.registerComponent("slot-machine", {
  schema: {
    leverSelector:      { type: "string", default: "" },
    reel1Selector:      { type: "string", default: "" },
    reel2Selector:      { type: "string", default: "" },
    reel3Selector:      { type: "string", default: "" },
    betTextSelector:    { type: "string", default: "" },
    statusTextSelector: { type: "string", default: "" },
    audioSelector:      { type: "string", default: "" },
  },

  init: function () {
    this.isSpinning    = false;
    this.isOperational = Math.random() < 0.6;

    if (this.isOperational) {
      const randomChoice = slotMachineBetChoices[Math.floor(Math.random() * slotMachineBetChoices.length)];
      this.machineName   = randomChoice.name;
      this.cost          = randomChoice.cost;
      this.usesRemaining = Math.floor(Math.random() * 10) + 3;
    } else {
      this.machineName   = "Slot Machine";
      this.cost          = 0;
      this.usesRemaining = 0;
    }

    this.el.classList.add("interactable");
    this.el.querySelectorAll("*").forEach((part) => part.classList.add("interactable"));

    this.updateScreens();

    const reel1 = document.querySelector(this.data.reel1Selector);
    const reel2 = document.querySelector(this.data.reel2Selector);
    const reel3 = document.querySelector(this.data.reel3Selector);

    if (reel1) reel1.setAttribute("rotation", `${getSlotSymbolAngle(Math.floor(Math.random() * 4))} 0 0`);
    if (reel2) reel2.setAttribute("rotation", `${getSlotSymbolAngle(Math.floor(Math.random() * 4))} 0 0`);
    if (reel3) reel3.setAttribute("rotation", `${getSlotSymbolAngle(Math.floor(Math.random() * 4))} 0 0`);

    this.el.addEventListener("raycaster-intersected", () => {
      if (gameEnded) return;

      currentSlotMachine = this.el;
      setCrosshairInteractable(true);

      if (!this.isOperational || this.usesRemaining <= 0) {
        showInteractionHUD({ name: "OUT OF SERVICE", value: "THIS MACHINE IS BROKEN", action: "" });
        return;
      }

      if (playerMoney < this.cost) {
        showInteractionHUD({ name: this.machineName.toUpperCase(), value: "NEED $" + this.cost.toLocaleString(), action: "" });
        return;
      }

      showInteractionHUD({ name: this.machineName.toUpperCase(), value: "BET $" + this.cost.toLocaleString(), action: "PRESS E OR CLICK TO SPIN" });
    });

    this.el.addEventListener("raycaster-intersected-cleared", () => {
      if (currentSlotMachine === this.el) {
        currentSlotMachine = null;
        hideInteractionHUD();
      }

      setCrosshairInteractable(false);
    });
  },

  updateScreens: function () {
    const betText    = document.querySelector(this.data.betTextSelector);
    const statusText = document.querySelector(this.data.statusTextSelector);

    if (this.isOperational && this.usesRemaining > 0) {
      if (betText)    betText.setAttribute("value",    "$" + this.cost.toLocaleString());
      if (statusText) statusText.setAttribute("value", "ACTIVE");
    } else {
      if (betText)    betText.setAttribute("value",    "");
      if (statusText) statusText.setAttribute("value", "OUT OF SERVICE");
    }
  },
});

function useSlotMachine() {
  if (gameEnded || !currentSlotMachine) return;

  const machine = currentSlotMachine.components["slot-machine"];
  if (!machine || machine.isSpinning)                      return;
  if (!machine.isOperational || machine.usesRemaining <= 0) return;

  if (playerMoney < machine.cost) {
    showInteractionHUD({ name: machine.machineName.toUpperCase(), value: "NEED $" + machine.cost.toLocaleString(), action: "" });
    return;
  }

  machine.isSpinning = true;

  if (!infiniteMoney) playerMoney -= machine.cost;
  updateMoneyHUD();

  hideInteractionHUD();
  setCrosshairInteractable(false);

  if (machine.data.audioSelector) {
    const audioEntity = document.querySelector(machine.data.audioSelector);
    if (audioEntity && audioEntity.components.sound) audioEntity.components.sound.playSound();
  }

  const lever = document.querySelector(machine.data.leverSelector);
  const reel1 = document.querySelector(machine.data.reel1Selector);
  const reel2 = document.querySelector(machine.data.reel2Selector);
  const reel3 = document.querySelector(machine.data.reel3Selector);

  if (lever) {
    lever.removeAttribute("animation__down");
    lever.removeAttribute("animation__up");
    lever.setAttribute("rotation", "0 0 0");

    setTimeout(() => {
      lever.setAttribute("animation__down", { property: "rotation", to: "-60 0 0", dur: 300, easing: "easeOutQuad" });
    }, 20);

    setTimeout(() => {
      lever.removeAttribute("animation__down");
      lever.setAttribute("animation__up", { property: "rotation", to: "0 0 0", dur: 450, easing: "easeOutQuad" });
    }, 420);
  }

  setTimeout(() => {
    const results = [
      Math.floor(Math.random() * 4),
      Math.floor(Math.random() * 4),
      Math.floor(Math.random() * 4),
    ];

    spinReel(reel1, getNextReelRotation(reel1, results[0]), 4000);
    spinReel(reel2, getNextReelRotation(reel2, results[1]), 6000);
    spinReel(reel3, getNextReelRotation(reel3, results[2]), 8500);

    setTimeout(() => applySlotResult(machine, results), 8700);
  }, 500);
}

function spinReel(reel, finalAngle, duration) {
  if (!reel) return;

  reel.setAttribute("animation__spin", {
    property: "rotation",
    to:       `${finalAngle} 0 0`,
    dur:      duration,
    easing:   "easeOutQuint",
  });
}

function getSlotSymbolAngle(symbolValue) {
  return (360 - symbolValue * 90) % 360;
}

function getNextReelRotation(reel, resultValue) {
  if (!reel) return 360 * 6 + getSlotSymbolAngle(resultValue);

  const currentRotation = reel.getAttribute("rotation");
  const currentX        = currentRotation ? currentRotation.x : 0;
  const currentAngle    = ((currentX % 360) + 360) % 360;
  const targetAngle     = getSlotSymbolAngle(resultValue);
  const angleDifference = (targetAngle - currentAngle + 360) % 360;

  return currentX + (360 * 6) + angleDifference;
}

function applySlotResult(machine, results) {
  const [a, b, c] = results;
  const cost = machine.cost;

  let winnings   = 0;
  let resultName = "NO MATCH";
  let actionText = "NO REWARD";

  const skullCount = [a, b, c].filter((r) => r === 3).length;

  if (a === b && b === c) {
    const symbol = slotSymbols[a];

    if (symbol === "CASH")    { winnings = cost * 2; resultName = "TRIPLE CASH";    actionText = "SLOT RESULT"; }
    if (symbol === "GOLD")    { winnings = cost * 3; resultName = "TRIPLE GOLD";    actionText = "SLOT RESULT"; }
    if (symbol === "DIAMOND") { winnings = cost * 5; resultName = "TRIPLE DIAMOND"; actionText = "SLOT RESULT"; }

    if (symbol === "SKULL") {
      resultName = "TRIPLE SKULL";
      actionText = "TIME PENALTY";
      cutTime(60, "TRIPLE SKULL");
    }

  } else if (skullCount >= 2) {
    resultName = "DOUBLE SKULL";
    actionText = "TIME PENALTY";
    cutTime(30, "DOUBLE SKULL");

  } else if (a === b || a === c || b === c) {
    winnings   = cost;
    resultName = "TWO MATCH";
    actionText = "BET REFUNDED";
  }

  playerMoney += winnings;
  updateMoneyHUD();

  machine.usesRemaining--;

  if (machine.usesRemaining <= 0) {
    machine.isOperational = false;
    machine.updateScreens();
    actionText = "MACHINE OUT OF SERVICE";
  }

  showInteractionHUD({
    name:   resultName,
    value:  winnings > 0 ? "+$" + winnings.toLocaleString() : "NO REWARD",
    action: actionText,
  });

  machine.isSpinning = false;
  currentSlotMachine = null;

  setTimeout(() => hideInteractionHUD(), 5000);
}

/* =========================
   20. ADMIN PANEL
========================= */

let adminPanelOpen = false;
let infiniteMoney  = false;
let noTimeLimit    = false;
let infiniteToken  = false;
let storedMoney    = 0; // saves playerMoney when infinite money is toggled on

function createAdminPanel() {
  const panel = document.createElement("div");
  panel.id = "admin-panel";
  panel.innerHTML = `
    <div id="admin-header">
      ADMIN CONSOLE
      <span id="admin-close">[ \` TO CLOSE ]</span>
    </div>
    <div id="admin-flags"></div>
    <div id="admin-log"></div>
    <div id="admin-input-row">
      <span class="admin-prompt">&gt;</span>
      <input id="admin-input" type="text" autocomplete="off" spellcheck="false" placeholder="type a command..." />
    </div>
  `;
  document.body.appendChild(panel);

  const input = panel.querySelector("#admin-input");

  input.addEventListener("keydown", function (e) {
    e.stopPropagation(); // prevent WASD / E from firing while typing
    if (e.code === "Enter") {
      processAdminCommand(input.value.trim());
      input.value = "";
    }
  });
}

function toggleAdminPanel() {
  adminPanelOpen = !adminPanelOpen;

  const panel = document.querySelector("#admin-panel");
  if (!panel) return;

  if (adminPanelOpen) {
    panel.classList.add("admin-panel--visible");
    document.exitPointerLock?.();
    setTimeout(() => panel.querySelector("#admin-input")?.focus(), 50);
    updateAdminFlags();
  } else {
    panel.classList.remove("admin-panel--visible");
  }
}

function adminLog(text, type = "info") {
  const log = document.querySelector("#admin-log");
  if (!log) return;

  const line = document.createElement("div");
  line.className  = "admin-log-line admin-log--" + type;
  line.textContent = text;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function updateAdminFlags() {
  const flags = document.querySelector("#admin-flags");
  if (!flags) return;

  const active = [
    infiniteMoney ? "[$] INFINITE MONEY" : null,
    noTimeLimit   ? "[T] NO TIME LIMIT"  : null,
    infiniteToken ? "[*] INFINITE TOKEN" : null,
  ].filter(Boolean);

  flags.textContent = active.length ? active.join("   ") : "no active cheats";
}

function processAdminCommand(raw) {
  if (!raw) return;

  const parts = raw.toLowerCase().split(/\s+/);
  const cmd   = parts[0];

  adminLog("> " + raw, "input");

  /* ---- help ---- */
  if (cmd === "help") {
    adminLog("money +/-<amount>  — add or subtract money",     "info");
    adminLog("time  +/-<amount>  — add or subtract seconds",   "info");
    adminLog("infinitemoney      — toggle infinite money",      "info");
    adminLog("notimelimit        — toggle no time limit",       "info");
    adminLog("infinitetoken      — toggle infinite token",      "info");
    return;
  }

  /* ---- money <amount> ---- */
  if (cmd === "money") {
    const amount = parseInt(parts[1], 10);
    if (isNaN(amount)) { adminLog("invalid amount — example: money +5000", "error"); return; }

    playerMoney = Math.max(0, playerMoney + amount);
    updateMoneyHUD(true);
    adminLog(
      (amount >= 0 ? "+" : "") + "$" + Math.abs(amount).toLocaleString() +
      "  →  $" + playerMoney.toLocaleString(),
      "success",
    );
    return;
  }

  /* ---- time <seconds> ---- */
  if (cmd === "time") {
    const seconds = parseInt(parts[1], 10);
    if (isNaN(seconds)) { adminLog("invalid amount — example: time +60", "error"); return; }

    timeLeft = Math.max(0, timeLeft + seconds);
    updateTimerHUD();
    adminLog(
      (seconds >= 0 ? "+" : "") + seconds + "s  →  " +
      String(Math.floor(timeLeft / 60)).padStart(2, "0") + ":" +
      String(timeLeft % 60).padStart(2, "0"),
      "success",
    );
    return;
  }

  /* ---- infinitemoney ---- */
  if (cmd === "infinitemoney") {
    infiniteMoney = !infiniteMoney;

    if (infiniteMoney) {
      storedMoney = playerMoney; // save current money to restore later
    } else {
      playerMoney = storedMoney; // restore money from before infinite was on
    }

    updateMoneyHUD(false);
    adminLog("infinite money: " + (infiniteMoney ? "ON  (saved $" + storedMoney.toLocaleString() + ")" : "OFF  (restored $" + playerMoney.toLocaleString() + ")"), infiniteMoney ? "success" : "warn");
    updateAdminFlags();
    return;
  }

  /* ---- notimelimit ---- */
  if (cmd === "notimelimit") {
    noTimeLimit = !noTimeLimit;
    adminLog("no time limit: " + (noTimeLimit ? "ON" : "OFF"), noTimeLimit ? "success" : "warn");
    updateAdminFlags();
    return;
  }

  /* ---- infinitetoken ---- */
  if (cmd === "infinitetoken") {
    infiniteToken = !infiniteToken;

    if (infiniteToken) {
      hasCasinoToken  = true;
      casinoTokenUsed = false;
    } else {
      hasCasinoToken  = true;  // keep one token when turning off
      casinoTokenUsed = false;
    }

    updateTokenHUD();
    adminLog("infinite token: " + (infiniteToken ? "ON" : "OFF  (1 token kept)"), infiniteToken ? "success" : "warn");
    updateAdminFlags();
    return;
  }

  adminLog("unknown command: " + cmd + "  (type 'help')", "error");
}

/* =========================
   21. INPUT EVENTS
========================= */

window.addEventListener("click", function () {
  if (gameEnded || adminPanelOpen) return;

  startGameTimer();

  if (currentElevatorZone) { useElevatorZone(); return; }
  if (currentFortuneWheel) { useFortuneWheel(); return; }
  if (currentSlotMachine)  { useSlotMachine();  return; }

  collectLoot();
});

window.addEventListener("keydown", function (e) {
  if (e.code === "Backquote") { toggleAdminPanel(); return; }
  if (adminPanelOpen || gameEnded || e.code !== "KeyE") return;

  if (playerInsideEscapeZone && escapeUnlocked) { endGame("victory"); return; }

  if (currentElevatorZone) { useElevatorZone(); return; }
  if (currentFortuneWheel) { useFortuneWheel(); return; }
  if (currentSlotMachine)  { useSlotMachine();  return; }

  collectLoot();
});

/* =========================
   21. STARTUP
========================= */

window.addEventListener("DOMContentLoaded", function () {
  initLoadingScreen();

  DOM.moneyValue        = document.querySelector("#money-value");
  DOM.timerHUD          = document.querySelector("#timer-hud");
  DOM.interactionPanel  = document.querySelector("#interaction-panel");
  DOM.interactionName   = document.querySelector("#interaction-name");
  DOM.interactionValue  = document.querySelector("#interaction-value");
  DOM.interactionAction = document.querySelector("#interaction-action-text");
  DOM.interactionIcon   = document.querySelector(".hud-interaction-action img");
  DOM.tokenName         = document.querySelector("#token-name");
  DOM.tokenIcon         = document.querySelector("#token-icon");
  DOM.tokenPanel        = document.querySelector("#token-panel");
  DOM.objectivePanel    = document.querySelector(".hud-panel--objective");
  DOM.controlsPanel     = document.querySelector(".hud-panel--controls");
  DOM.popupContainer    = document.querySelector("#game-popup-container");
  DOM.crosshairDot      = document.querySelector("#crosshair-dot");
  DOM.endScreen         = document.querySelector("#end-screen");
  DOM.endTitle          = document.querySelector("#end-title");
  DOM.endMessage        = document.querySelector("#end-message");
  DOM.endRankTitle      = document.querySelector("#end-rank-title");
  DOM.endRankText       = document.querySelector("#end-rank-text");
  DOM.camera            = document.querySelector("#camera");

  updateMoneyHUD(false);
  updateTokenHUD();
  updateTimerHUD();
  hideInteractionHUD();
  updateMouseHelpHUD();
  createAdminPanel();
});

document.addEventListener("pointerlockchange", updateMouseHelpHUD);

/* =========================
   23. LOADING SCREEN
========================= */

function initLoadingScreen() {
  // Asset downloads drive 0–80% of the bar.
  // model-loaded events (geometry actually on screen) drive 80–100%.
  // The screen only hides once every gltf-model entity has rendered.

  const assetEls      = Array.from(document.querySelectorAll("a-asset-item, a-assets audio"));
  const modelEntities = Array.from(document.querySelectorAll("[gltf-model]"));

  const totalAssets = assetEls.length;
  const totalModels = modelEntities.length;

  let loadedAssets = 0;
  let loadedModels = 0;
  let alreadyHidden = false;

  function updateBar() {
    const assetPct = totalAssets > 0 ? (loadedAssets / totalAssets) * 80 : 80;
    const modelPct = totalModels > 0 ? (loadedModels / totalModels) * 20 : 20;
    setLoadingProgress(Math.min(Math.round(assetPct + modelPct), 99));
  }

  function onAssetDone() {
    loadedAssets = Math.min(loadedAssets + 1, totalAssets);
    updateBar();
  }

  function onModelDone() {
    loadedModels = Math.min(loadedModels + 1, totalModels);
    updateBar();

    if (loadedModels >= totalModels && !alreadyHidden) {
      alreadyHidden = true;
      setLoadingProgress(100);
      setTimeout(hideLoadingScreen, 600);
    }
  }

  assetEls.forEach(function (asset) {
    if (asset.hasLoaded) {
      onAssetDone();
    } else {
      asset.addEventListener("loaded", onAssetDone, { once: true });
      asset.addEventListener("error",  onAssetDone, { once: true });
    }
  });

  modelEntities.forEach(function (entity) {
    entity.addEventListener("model-loaded", onModelDone, { once: true });
    entity.addEventListener("model-error",  onModelDone, { once: true });
  });

  // Hard fallback: force-hide after 60 s in case something never fires
  setTimeout(function () {
    if (!alreadyHidden) {
      alreadyHidden = true;
      setLoadingProgress(100);
      hideLoadingScreen();
    }
  }, 60000);
}

function setLoadingProgress(pct) {
  const bar  = document.querySelector("#loading-bar-fill");
  const text = document.querySelector("#loading-percent");

  if (bar)  bar.style.width   = pct + "%";
  if (text) text.textContent  = pct + "%";
}

function hideLoadingScreen() {
  const screen = document.querySelector("#loading-screen");
  if (!screen) return;

  screen.classList.add("loading-screen--hidden");
  setTimeout(function () { screen.remove(); }, 650);
}

// Force the WebGL context to release GPU memory before the page unloads.
// Without this, refreshing holds two copies of all GLB/texture data in VRAM
// simultaneously, which causes the "Out of Memory" crash on lower-RAM machines.
window.addEventListener("beforeunload", function () {
  const scene = document.querySelector("a-scene");
  if (scene && scene.renderer) {
    scene.renderer.forceContextLoss();
    scene.renderer.dispose();
  }
});
