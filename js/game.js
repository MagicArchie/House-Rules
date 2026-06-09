/* =========================================================
   HOUSE RULES - MAIN GAME SCRIPT
   File: js/game.js

   Purpose:
   Controls player movement, HUD updates, interaction logic,
   loot collection, elevator use, fortune wheel, slot machines,
   timer, and end-game screens.

   Notes:
   - This file was separated from index.html to keep the HTML clean.
========================================================= */

"use strict";

/* =========================
	1. GAME STATE
========================= */

let playerMoney = 0;
let hasCasinoToken = false;
let currentLootTarget = null;

let timerStarted = false;
let gameEnded = false;
let timeLeft = 600; // 10 minutes
let timerInterval = null;

let playerInsideEscapeZone = false;
let escapeUnlocked = false;

let currentElevatorZone = null;
let elevatorIsMoving = false;
let elevatorZoneBlockedAfterTeleport = null;

let currentFortuneWheel = null;
let fortuneWheelIsSpinning = false;
let casinoTokenUsed = false;

let currentSlotMachine = null;

let escapeUnlockAlertShown = false;
let securityAlertShown = false;
let securityClosingAlertShown = false;

const fortuneResults = [
  { angle: 0, name: "BIG WIN", money: 2500, time: 0, tokenBack: false },
  { angle: 30, name: "REFUND", money: 100, time: 0, tokenBack: false },
  { angle: 60, name: "HOUSE CUT", money: -500, time: 0, tokenBack: false },
  { angle: 90, name: "CURSED PRIZE", money: 3000, time: -45, tokenBack: false },
  { angle: 120, name: "LUCKY PULL", money: 1000, time: 0, tokenBack: false },
  { angle: 150, name: "TIME PENALTY", money: 0, time: -30, tokenBack: false },
  { angle: 180, name: "SMALL WIN", money: 500, time: 0, tokenBack: false },
  { angle: 210, name: "JACKPOT", money: 5000, time: 0, tokenBack: false },
  { angle: 240, name: "SECURITY TAX", money: -1000, time: 0, tokenBack: false },
  { angle: 270, name: "NOTHING", money: 0, time: 0, tokenBack: false },
  { angle: 300, name: "SECOND CHANCE", money: 0, time: 0, tokenBack: true },
  { angle: 330, name: "BAD LUCK", money: -250, time: 0, tokenBack: false },
];

/* =========================
	2. HUD HELPERS
========================= */

let displayedMoney = 0;
let moneyAnimationFrame = null;

function updateMoneyHUD(animate = true) {
  const moneyText = document.querySelector("#money-value");

  if (!moneyText) return;

  if (!animate) {
    displayedMoney = playerMoney;

    moneyText.textContent = "$" + displayedMoney.toLocaleString();

    return;
  }

  animateMoneyHUD(playerMoney);
}

function animateMoneyHUD(targetMoney) {
  const moneyText = document.querySelector("#money-value");

  if (!moneyText) return;

  if (moneyAnimationFrame) {
    cancelAnimationFrame(moneyAnimationFrame);
  }

  const startMoney = displayedMoney;
  const difference = targetMoney - startMoney;
  const duration = 650;
  const startTime = performance.now();

  function animate(currentTime) {
    const progress = Math.min((currentTime - startTime) / duration, 1);

    const easedProgress = 1 - Math.pow(1 - progress, 3);

    displayedMoney = Math.round(startMoney + difference * easedProgress);

    moneyText.textContent = "$" + displayedMoney.toLocaleString();

    if (progress < 1) {
      moneyAnimationFrame = requestAnimationFrame(animate);
    } else {
      displayedMoney = targetMoney;

      moneyText.textContent = "$" + targetMoney.toLocaleString();

      moneyAnimationFrame = null;
    }
  }

  moneyAnimationFrame = requestAnimationFrame(animate);
}

function showGamePopup(type, text) {
  const container = document.querySelector("#game-popup-container");

  if (!container) return;

  const popup = document.createElement("div");

  popup.classList.add("game-popup", "game-popup--" + type);

  popup.textContent = text;

  container.appendChild(popup);

  setTimeout(function () {
    popup.remove();
  }, 1500);
}

function getLootPopupType(itemName) {
  const name = itemName.toLowerCase();

  if (name.includes("cash")) return "cash";
  if (name.includes("gold")) return "gold";
  if (name.includes("diamond")) return "diamond";
  if (name.includes("artifact") || name.includes("mark")) return "mark";
  if (name.includes("token")) return "token";

  return "neutral";
}

function updateTokenHUD() {
  const tokenName = document.querySelector("#token-name");
  const tokenIcon = document.querySelector("#token-icon");
  const tokenPanel = document.querySelector("#token-panel");

  if (!tokenName || !tokenIcon || !tokenPanel) return;

  if (hasCasinoToken) {
    tokenName.innerHTML = "CASINO<br>TOKEN";
    tokenIcon.src = "materials/images/CasinoToken Icon.png";
    tokenPanel.classList.add("hud-panel--active");
  } else {
    tokenName.textContent = "NOT FOUND";
    tokenIcon.src = "materials/images/SecretItem Icon.png";
    tokenPanel.classList.remove("hud-panel--active");
  }
}

function setCasinoTokenUsedHUD() {
  const tokenName = document.querySelector("#token-name");
  const tokenIcon = document.querySelector("#token-icon");
  const tokenPanel = document.querySelector("#token-panel");

  if (!tokenName || !tokenIcon || !tokenPanel) return;

  tokenName.innerHTML = "TOKEN<br>USED";
  tokenIcon.src = "materials/images/CasinoToken Used.png";
  tokenPanel.classList.remove("hud-panel--active");
}

function showInteractionHUD(message) {
  const interactionPanel = document.querySelector("#interaction-panel");
  const interactionName = document.querySelector("#interaction-name");
  const interactionValue = document.querySelector("#interaction-value");
  const interactionAction = document.querySelector("#interaction-action-text");

  if (
    !interactionPanel ||
    !interactionName ||
    !interactionValue ||
    !interactionAction
  )
    return;

  interactionPanel.classList.add("hud-panel--visible");
  interactionName.textContent = message.name;
  interactionValue.textContent = message.value;
  interactionAction.textContent = message.action;
}

function hideInteractionHUD() {
  const interactionPanel = document.querySelector("#interaction-panel");
  const interactionName = document.querySelector("#interaction-name");
  const interactionValue = document.querySelector("#interaction-value");
  const interactionAction = document.querySelector("#interaction-action-text");

  if (
    !interactionPanel ||
    !interactionName ||
    !interactionValue ||
    !interactionAction
  )
    return;

  interactionPanel.classList.remove("hud-panel--visible");
  interactionPanel.classList.remove("hud-panel--escape");
  interactionName.textContent = "No item selected";
  interactionValue.textContent = "";
  interactionAction.textContent = "PRESS E OR CLICK TO INTERACT";

  const interactionIcon = document.querySelector(".hud-interaction-action img");

  if (interactionIcon) {
    interactionIcon.src = "materials/images/Interact.png";
    interactionIcon.classList.remove("hud-interaction-icon--escape");
  }
}

function showEscapePrompt() {
  if (!escapeUnlocked || gameEnded) return;

  showInteractionHUD({
    name: "ESCAPE ROUTE",
    value: "",
    action: "PRESS E TO ESCAPE",
  });

  const interactionPanel = document.querySelector("#interaction-panel");

  if (interactionPanel) {
    interactionPanel.classList.add("hud-panel--escape");
  }

  const interactionIcon = document.querySelector(".hud-interaction-action img");

  if (interactionIcon) {
    interactionIcon.src = "materials/images/E Key.png";
    interactionIcon.classList.add("hud-interaction-icon--escape");
  }
}

function setCrosshairInteractable(isInteractable) {
  const crosshairDot = document.querySelector("#crosshair-dot");
  if (!crosshairDot) return;

  crosshairDot.setAttribute(
    "material",
    isInteractable ? "color: red; shader: flat" : "color: white; shader: flat",
  );
}

function updateMouseHelpHUD() {
  const objectivePanel = document.querySelector(".hud-panel--objective");
  const controlsPanel = document.querySelector(".hud-panel--controls");

  if (!objectivePanel || !controlsPanel) return;

  if (gameEnded) {
    objectivePanel.classList.add("hud-hidden");
    controlsPanel.classList.add("hud-hidden");
    return;
  }

  const mouseIsLocked = document.pointerLockElement === document.body;

  objectivePanel.classList.toggle("hud-hidden", mouseIsLocked);
  controlsPanel.classList.toggle("hud-hidden", mouseIsLocked);
}

/* =========================
	3. TIMER / END GAME
========================= */

function startGameTimer() {
  if (timerStarted || gameEnded) return;

  timerStarted = true;

  timerInterval = setInterval(function () {
    timeLeft--;
    updateTimerHUD();

    if (timeLeft <= 0) {
      endGame("defeat");
    }
  }, 1000);
}

function updateTimerHUD() {
  const timerHUD = document.querySelector("#timer-hud");
  if (!timerHUD) return;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  timerHUD.textContent =
    String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");

  updateTimerColor(timerHUD);
  checkSecurityAlerts();
}

function updateTimerColor(timerHUD) {
  timerHUD.classList.remove("timer-warning", "timer-danger");

  if (timeLeft <= 60) {
    timerHUD.classList.add("timer-danger");
  } else if (timeLeft <= 300) {
    timerHUD.classList.add("timer-warning");
  }
}

function checkSecurityAlerts() {
  if (timeLeft <= 480 && !escapeUnlockAlertShown) {
    escapeUnlockAlertShown = true;

    escapeUnlocked = true;

    [
      "#escape-ring",
      "#escape-cylinder-1",
      "#escape-cylinder-2",
      "#escape-cylinder-3",
    ].forEach((selector) => {
      const element = document.querySelector(selector);

      if (element) {
        element.setAttribute("visible", true);
      }
    });

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

function cutTime(seconds, reasonText = "TIME LOST") {
  if (gameEnded) return;

  timeLeft = Math.max(0, timeLeft - seconds);

  updateTimerHUD();

  animateTimerHit();

  showGamePopup("time-loss", "-" + seconds + " SECONDS");

  if (reasonText) {
    showInteractionHUD({
      name: reasonText,

      value: "-" + seconds + " SECONDS",

      action: "TIME PENALTY",
    });

    setTimeout(function () {
      hideInteractionHUD();
    }, 1500);
  }

  if (timeLeft <= 0) {
    endGame("defeat");
  }
}

function animateTimerHit() {
  const timerHUD = document.querySelector("#timer-hud");

  if (!timerHUD) return;

  timerHUD.classList.remove("timer-hit");

  void timerHUD.offsetWidth;

  timerHUD.classList.add("timer-hit");
}

function endGame(type) {
  if (gameEnded) return;

  gameEnded = true;

  if (timerInterval) {
    clearInterval(timerInterval);
  }

  document.exitPointerLock?.();

  const camera = document.querySelector("#camera");

  if (camera) {
    camera.setAttribute("look-controls", "enabled", false);
  }

  hideInteractionHUD();
  updateMouseHelpHUD();
  setCrosshairInteractable(false);

  const endScreen = document.querySelector("#end-screen");
  const endTitle = document.querySelector("#end-title");
  const endMessage = document.querySelector("#end-message");

  if (!endScreen || !endTitle || !endMessage) return;

  if (type === "victory-money") {
    endTitle.textContent = "YOU ESCAPED";
    endTitle.className = "end-title end-title--victory";
    endMessage.textContent =
      "You got away with $" + playerMoney.toLocaleString();
  }

  if (type === "victory-no-money") {
    endTitle.textContent = "YOU ESCAPED";
    endTitle.className = "end-title end-title--victory";
    endMessage.textContent = "Well, that is sad.";
  }

  if (type === "defeat") {
    endTitle.textContent = "CAUGHT";
    endTitle.className = "end-title end-title--defeat";
    endMessage.textContent =
      "You were caught with $" + playerMoney.toLocaleString();
  }

  endScreen.classList.remove("hud-hidden");
}

/* =========================
	4. PLAYER CONTROLS
========================= */

AFRAME.registerComponent("player-controls-custom", {
  schema: {
    spawnLookY: { type: "number", default: 0 },
  },

  init: function () {
    this.keys = {};
    this.walkSpeed = 16.0;
    this.sprintSpeed = 9.0;
    this.normalHeight = 5.0;
    this.crouchHeight = 4.3;

    this.camera = document.querySelector("#camera");

    this.hitbox = document.querySelector("#player-hitbox");

    this.normalWidth = 1.2;
    this.crouchWidth = 1.0;

    setTimeout(() => {
      const lookControls = this.camera.components["look-controls"];

      if (lookControls) {
        lookControls.yawObject.rotation.y = THREE.MathUtils.degToRad(
          this.data.spawnLookY,
        );

        lookControls.pitchObject.rotation.x = 0;
      }
    }, 100);

    window.addEventListener("keydown", (e) => (this.keys[e.code] = true));
    window.addEventListener("keyup", (e) => (this.keys[e.code] = false));

    document.body.addEventListener("click", () => {
      if (!gameEnded && document.pointerLockElement !== document.body) {
        document.body.requestPointerLock();
      }
    });
  },

  tick: function (time, delta) {
    if (gameEnded) return;

    const dt = delta / 1000;
    const rig = this.el;
    const pos = rig.getAttribute("position");

    const speed =
      this.keys["ShiftLeft"] || this.keys["ShiftRight"]
        ? this.sprintSpeed
        : this.walkSpeed;

    const direction = new THREE.Vector3();

    if (this.keys["KeyW"]) direction.z -= 1;
    if (this.keys["KeyS"]) direction.z += 1;
    if (this.keys["KeyA"]) direction.x -= 1;
    if (this.keys["KeyD"]) direction.x += 1;

    if (direction.length() > 0) {
      direction.normalize();

      const cameraRotation = this.camera.object3D.rotation.y;
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);

      pos.x += direction.x * speed * dt;
      pos.z += direction.z * speed * dt;

      rig.setAttribute("position", pos);
    }

    const targetHeight =
      this.keys["ControlLeft"] || this.keys["ControlRight"]
        ? this.crouchHeight
        : this.normalHeight;

    this.camera.setAttribute("position", `0 ${targetHeight} 0`);

    if (this.hitbox) {
      const isCrouching = this.keys["ControlLeft"] || this.keys["ControlRight"];

      const hitboxHeight = targetHeight;
      const hitboxWidth = isCrouching ? this.crouchWidth : this.normalWidth;

      this.hitbox.setAttribute("height", hitboxHeight);
      this.hitbox.setAttribute("width", hitboxWidth);
      this.hitbox.setAttribute("depth", hitboxWidth);

      this.hitbox.setAttribute("position", {
        x: 0,
        y: hitboxHeight / 2,
        z: 0,
      });
    }
  },
});

/* =========================
	5. INTERACTION / LOOT
========================= */

AFRAME.registerComponent("loot-item", {
  schema: {
    itemname: { type: "string", default: "Loot" },
    unitValue: { type: "number", default: 0 },
    amount: { type: "number", default: 1 },
    keyitem: { type: "boolean", default: false },
  },

  init: function () {
    this.el.classList.add("interactable");

    this.el.querySelectorAll("*").forEach((part) => {
      part.classList.add("interactable");
    });

    this.el.addEventListener("raycaster-intersected", () => {
      if (gameEnded) return;

      currentLootTarget = this.el;
      setCrosshairInteractable(true);

      const totalValue = this.data.unitValue * this.data.amount;

      showInteractionHUD({
        name: this.data.itemname,
        value: this.data.keyitem
          ? "KEY ITEM"
          : "VALUE: $" + totalValue.toLocaleString(),
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

/* =========================
	ESCAPE ZONE
========================= */

AFRAME.registerComponent("escape-zone", {
  tick: function () {
    if (gameEnded || !escapeUnlocked) return;

    const player = document.querySelector("#player");
    if (!player) return;

    const playerPos = player.object3D.position;
    const zonePos = this.el.object3D.position;

    const distance = playerPos.distanceTo(zonePos);
    const inside = distance <= 5.5;

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
	ELEVATOR ZONE
========================= */

AFRAME.registerComponent("elevator-zone", {
  schema: {
    label: { type: "string", default: "ELEVATOR" },
    targetSelector: { type: "string", default: "" },
    targetOffsetX: { type: "number", default: 0 },
    targetOffsetY: { type: "number", default: 0 },
    targetOffsetZ: { type: "number", default: 0 },
    lookY: { type: "number", default: 0 },
    radius: { type: "number", default: 2.2 },
    delay: { type: "number", default: 1200 },
    audioSelector: { type: "string", default: "" },
  },

  init: function () {
    this.playerInside = false;
  },

  tick: function () {
    if (gameEnded || elevatorIsMoving) return;

    const player = document.querySelector("#player");
    if (!player) return;

    const playerPos = player.getAttribute("position");
    const zonePos = this.el.getAttribute("position");

    const dx = playerPos.x - zonePos.x;
    const dz = playerPos.z - zonePos.z;

    const distance = Math.sqrt(dx * dx + dz * dz);
    const inside = distance <= this.data.radius;

    if (inside && !this.playerInside) {
      this.playerInside = true;

      if (elevatorZoneBlockedAfterTeleport === this.el) {
        return;
      }

      currentElevatorZone = this.el;

      showInteractionHUD({
        name: this.data.label,
        value: "ELEVATOR",
        action: "PRESS E TO USE ELEVATOR",
      });
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

  const data = currentElevatorZone.components["elevator-zone"].data;
  const targetZone = document.querySelector(data.targetSelector);

  if (!targetZone) return;

  elevatorIsMoving = true;

  hideInteractionHUD();

  if (data.audioSelector) {
    const audioEntity = document.querySelector(data.audioSelector);

    if (audioEntity && audioEntity.components.sound) {
      audioEntity.components.sound.playSound();
    }
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

        const lookYRadians = THREE.MathUtils.degToRad(data.lookY);

        if (lookControls) {
          lookControls.yawObject.rotation.y = lookYRadians;
          lookControls.pitchObject.rotation.x = 0;
        }

        camera.object3D.rotation.set(0, 0, 0);
      }
    }

    elevatorZoneBlockedAfterTeleport = targetZone;
    currentElevatorZone = null;
    elevatorIsMoving = false;
  }, data.delay);
}

function collectLoot() {
  if (gameEnded || !currentLootTarget) return;

  const data = currentLootTarget.components["loot-item"].data;

  if (data.itemname === "Escape Van") {
    endGame(playerMoney > 0 ? "victory-money" : "victory-no-money");
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
	FORTUNE WHEEL
========================= */

AFRAME.registerComponent("fortune-wheel", {
  schema: {
    wheelSelector: { type: "string", default: "" },
    spinDuration: { type: "number", default: 3500 },
    audioSelector: { type: "string", default: "" },
  },

  init: function () {
    this.el.classList.add("interactable");

    const parts = this.el.querySelectorAll("*");
    parts.forEach((part) => {
      part.classList.add("interactable");
    });

    this.el.addEventListener("raycaster-intersected", () => {
      if (gameEnded || fortuneWheelIsSpinning) return;

      currentFortuneWheel = this.el;
      setCrosshairInteractable(true);

      if (!hasCasinoToken) {
        showInteractionHUD({
          name: "FORTUNE WHEEL",
          value: "CASINO TOKEN REQUIRED",
          action: "FIND A TOKEN TO SPIN",
        });
      } else {
        showInteractionHUD({
          name: "FORTUNE WHEEL",
          value: "READY TO SPIN",
          action: "PRESS E OR CLICK TO SPIN",
        });
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
    showInteractionHUD({
      name: "FORTUNE WHEEL",
      value: "CASINO TOKEN REQUIRED",
      action: "FIND A TOKEN TO SPIN",
    });
    return;
  }

  fortuneWheelIsSpinning = true;

  const data = currentFortuneWheel.components["fortune-wheel"].data;
  const wheel = document.querySelector(data.wheelSelector);

  hasCasinoToken = false;
  casinoTokenUsed = true;
  setCasinoTokenUsedHUD();

  hideInteractionHUD();
  setCrosshairInteractable(false);

  if (data.audioSelector) {
    const audioEntity = document.querySelector(data.audioSelector);

    if (audioEntity && audioEntity.components.sound) {
      audioEntity.components.sound.playSound();
    }
  }

  const resultIndex = Math.floor(Math.random() * fortuneResults.length);
  const result = fortuneResults[resultIndex];

  const baseSpins = 360 * 8;
  const finalRotation = baseSpins + result.angle;

  if (wheel) {
    wheel.setAttribute("animation__spin", {
      property: "rotation",
      to: `0 0 ${finalRotation}`,
      dur: 7000,
      easing: "easeOutQuint",
    });
  }

  setTimeout(function () {
    applyFortuneResult(result);

    fortuneWheelIsSpinning = false;
    currentFortuneWheel = null;
  }, 7200);
}

function applyFortuneResult(result) {
  playerMoney = Math.max(0, playerMoney + result.money);

  if (result.time < 0) {
    cutTime(Math.abs(result.time), result.name);

    if (gameEnded) return;
  }

  if (result.tokenBack) {
    hasCasinoToken = true;
    casinoTokenUsed = false;
    updateTokenHUD();
  }

  updateMoneyHUD();

  let effectText = "";

  if (result.money > 0) {
    effectText = "+$" + result.money.toLocaleString();
  } else if (result.money < 0) {
    effectText = "-$" + Math.abs(result.money).toLocaleString();
  } else if (result.time < 0) {
    effectText = result.time + " SECONDS";
  } else if (result.tokenBack) {
    effectText = "TOKEN RETURNED";
  } else {
    effectText = "NO REWARD";
  }

  showInteractionHUD({
    name: result.name,
    value: effectText,
    action: "FORTUNE WHEEL RESULT",
  });

  setTimeout(function () {
    hideInteractionHUD();
  }, 5000);
}

/* =========================
	SLOT MACHINE
========================= */

const slotMachineBetChoices = [
  { name: "Small Bet Machine", cost: 500 },
  { name: "Standard Machine", cost: 1000 },
  { name: "High Roller Machine", cost: 2500 },
  { name: "VIP Machine", cost: 5000 },
];

const slotSymbols = ["CASH", "GOLD", "DIAMOND", "SKULL"];

AFRAME.registerComponent("slot-machine", {
  schema: {
    leverSelector: { type: "string", default: "" },
    reel1Selector: { type: "string", default: "" },
    reel2Selector: { type: "string", default: "" },
    reel3Selector: { type: "string", default: "" },

    betTextSelector: { type: "string", default: "" },
    statusTextSelector: { type: "string", default: "" },

    audioSelector: { type: "string", default: "" },
  },

  init: function () {
    this.isSpinning = false;

    this.isOperational = Math.random() < 0.6;

    if (this.isOperational) {
      const randomChoice =
        slotMachineBetChoices[
          Math.floor(Math.random() * slotMachineBetChoices.length)
        ];

      this.machineName = randomChoice.name;
      this.cost = randomChoice.cost;
      this.usesRemaining = Math.floor(Math.random() * 10) + 3;
    } else {
      this.machineName = "Slot Machine";
      this.cost = 0;
      this.usesRemaining = 0;
    }

    this.el.classList.add("interactable");

    this.el.querySelectorAll("*").forEach((part) => {
      part.classList.add("interactable");
    });

    this.updateScreens();

    const reel1 = document.querySelector(this.data.reel1Selector);
    const reel2 = document.querySelector(this.data.reel2Selector);
    const reel3 = document.querySelector(this.data.reel3Selector);

    const start1 = Math.floor(Math.random() * 4);
    const start2 = Math.floor(Math.random() * 4);
    const start3 = Math.floor(Math.random() * 4);

    if (reel1) {
      reel1.setAttribute("rotation", `${getSlotSymbolAngle(start1)} 0 0`);
    }

    if (reel2) {
      reel2.setAttribute("rotation", `${getSlotSymbolAngle(start2)} 0 0`);
    }

    if (reel3) {
      reel3.setAttribute("rotation", `${getSlotSymbolAngle(start3)} 0 0`);
    }

    this.el.addEventListener("raycaster-intersected", () => {
      if (gameEnded) return;

      currentSlotMachine = this.el;
      setCrosshairInteractable(true);

      if (!this.isOperational || this.usesRemaining <= 0) {
        showInteractionHUD({
          name: "OUT OF SERVICE",
          value: "THIS MACHINE IS BROKEN",
          action: "",
        });
        return;
      }

      if (playerMoney < this.cost) {
        showInteractionHUD({
          name: this.machineName.toUpperCase(),
          value: "NEED $" + this.cost.toLocaleString(),
          action: "",
        });
        return;
      }

      showInteractionHUD({
        name: this.machineName.toUpperCase(),
        value: "BET $" + this.cost.toLocaleString(),
        action: "PRESS E OR CLICK TO SPIN",
      });
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
    const betText = document.querySelector(this.data.betTextSelector);
    const statusText = document.querySelector(this.data.statusTextSelector);

    if (this.isOperational && this.usesRemaining > 0) {
      if (betText) {
        betText.setAttribute("value", "$" + this.cost.toLocaleString());
      }

      if (statusText) {
        statusText.setAttribute("value", "ACTIVE");
      }
    } else {
      if (betText) {
        betText.setAttribute("value", "");
      }

      if (statusText) {
        statusText.setAttribute("value", "OUT OF SERVICE");
      }
    }
  },
});

function useSlotMachine() {
  if (gameEnded || !currentSlotMachine) return;

  const machine = currentSlotMachine.components["slot-machine"];
  if (!machine || machine.isSpinning) return;

  if (!machine.isOperational || machine.usesRemaining <= 0) return;

  if (playerMoney < machine.cost) {
    showInteractionHUD({
      name: machine.machineName.toUpperCase(),
      value: "NEED $" + machine.cost.toLocaleString(),
      action: "",
    });
    return;
  }

  machine.isSpinning = true;

  playerMoney -= machine.cost;
  updateMoneyHUD();

  hideInteractionHUD();
  setCrosshairInteractable(false);

  if (machine.data.audioSelector) {
    const audioEntity = document.querySelector(machine.data.audioSelector);

    if (audioEntity && audioEntity.components.sound) {
      audioEntity.components.sound.playSound();
    }
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
      lever.setAttribute("animation__down", {
        property: "rotation",
        to: "-60 0 0",
        dur: 300,
        easing: "easeOutQuad",
      });
    }, 20);

    setTimeout(() => {
      lever.removeAttribute("animation__down");

      lever.setAttribute("animation__up", {
        property: "rotation",
        to: "0 0 0",
        dur: 450,
        easing: "easeOutQuad",
      });
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

    setTimeout(() => {
      applySlotResult(machine, results);
    }, 8700);
  }, 500);
}

function spinReel(reel, finalAngle, duration) {
  if (!reel) return;

  reel.setAttribute("animation__spin", {
    property: "rotation",
    to: `${finalAngle} 0 0`,
    dur: duration,
    easing: "easeOutQuint",
  });
}

function getSlotSymbolAngle(symbolValue) {
  return (360 - symbolValue * 90) % 360;
}

function getNextReelRotation(reel, resultValue) {
  if (!reel) return 360 * 6 + getSlotSymbolAngle(resultValue);

  const currentRotation = reel.getAttribute("rotation");
  const currentX = currentRotation ? currentRotation.x : 0;

  const currentAngle = ((currentX % 360) + 360) % 360;
  const targetAngle = getSlotSymbolAngle(resultValue);

  const angleDifference = (targetAngle - currentAngle + 360) % 360;

  const extraSpins = 360 * 6;

  return currentX + extraSpins + angleDifference;
}

function applySlotResult(machine, results) {
  const a = results[0];
  const b = results[1];
  const c = results[2];

  const cost = machine.cost;

  let winnings = 0;
  let resultName = "NO MATCH";
  let actionText = "NO REWARD";

  const skullCount = (a === 3 ? 1 : 0) + (b === 3 ? 1 : 0) + (c === 3 ? 1 : 0);

  if (a === b && b === c) {
    const symbol = slotSymbols[a];

    if (symbol === "CASH") {
      winnings = cost * 2;
      resultName = "TRIPLE CASH";
      actionText = "SLOT RESULT";
    }

    if (symbol === "GOLD") {
      winnings = cost * 3;
      resultName = "TRIPLE GOLD";
      actionText = "SLOT RESULT";
    }

    if (symbol === "DIAMOND") {
      winnings = cost * 5;
      resultName = "TRIPLE DIAMOND";
      actionText = "SLOT RESULT";
    }

    if (symbol === "SKULL") {
      winnings = 0;
      resultName = "TRIPLE SKULL";
      actionText = "TIME PENALTY";

      cutTime(60, "TRIPLE SKULL");
    }
  } else if (skullCount >= 2) {
    winnings = 0;
    resultName = "DOUBLE SKULL";
    actionText = "TIME PENALTY";

    cutTime(30, "DOUBLE SKULL");
  } else if (a === b || a === c || b === c) {
    winnings = cost;
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
    name: resultName,
    value: winnings > 0 ? "+$" + winnings.toLocaleString() : "NO REWARD",
    action: actionText,
  });

  machine.isSpinning = false;
  currentSlotMachine = null;

  setTimeout(() => {
    hideInteractionHUD();
  }, 5000);
}

/* =========================================================
	LASER SECURITY SYSTEM
========================================================= */

AFRAME.registerComponent("security-laser", {
  dependencies: ["raycaster"],

  schema: {
    audioSelector: {
      type: "string",
      default: "",
    },
  },

  init: function () {
    this.el.addEventListener("raycaster-intersection", () => {
      damagePlayerWithLaser(this.data.audioSelector);
    });
  },
});

let laserPenaltyLevel = 0;
let laserCanHitPlayer = true;

function damagePlayerWithLaser(audioSelector) {
  if (gameEnded || !laserCanHitPlayer) return;

  laserCanHitPlayer = false;
  laserPenaltyLevel++;

  const penaltySeconds = 30 * Math.pow(2, laserPenaltyLevel - 1);

  cutTime(penaltySeconds, "LASER DETECTED");

  if (audioSelector) {
    const audioEntity = document.querySelector(audioSelector);

    if (audioEntity && audioEntity.components.sound) {
      audioEntity.components.sound.playSound();
    }
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
	6. STARTUP EVENTS
========================= */

window.addEventListener("click", function () {
  if (gameEnded) return;

  startGameTimer();

  if (currentElevatorZone) {
    useElevatorZone();
    return;
  }

  if (currentFortuneWheel) {
    useFortuneWheel();
    return;
  }

  if (currentSlotMachine) {
    useSlotMachine();
    return;
  }

  collectLoot();
});

window.addEventListener("keydown", function (e) {
  if (gameEnded) return;

  if (e.code === "KeyE") {
    /* ESCAPE */

    if (playerInsideEscapeZone && escapeUnlocked) {
      if (playerMoney > 0) {
        endGame("victory-money");
      } else {
        endGame("victory-no-money");
      }

      return;
    }

    /* ELEVATOR */

    if (currentElevatorZone) {
      useElevatorZone();
      return;
    }

    /* FORTUNE WHEEL */

    if (currentFortuneWheel) {
      useFortuneWheel();
      return;
    }

    /* SLOT MACHINE */

    if (currentSlotMachine) {
      useSlotMachine();
      return;
    }

    /* NORMAL LOOT */

    collectLoot();
  }
});

window.addEventListener("DOMContentLoaded", function () {
  updateMoneyHUD(false);
  updateTokenHUD();
  updateTimerHUD();
  hideInteractionHUD();
  updateMouseHelpHUD();
});

document.addEventListener("pointerlockchange", updateMouseHelpHUD);