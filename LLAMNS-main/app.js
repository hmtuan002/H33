const mapData = {
  minX: 1, maxX: 14,
  minY: 4, maxY: 12,
  blockedSpaces: {
    "7x4": true, "1x11": true, "12x10": true,
    "4x7": true, "5x7": true, "6x7": true,
    "8x6": true, "9x6": true, "10x6": true,
    "7x9": true, "8x9": true, "9x9": true,
  },
};

const playerColors = ["blue", "red", "orange", "yellow", "green", "purple"];
const SKIN_PRICES = { red: 10, orange: 15, yellow: 20, green: 25, purple: 30 };

const MERCHANT = { x: 12, y: 4, name: "THƯƠNG NHÂN" };
const NPC_ELDER = { x: 2, y: 10, name: "LÃO NHÂN" };

const DIALOGUE_CONTENT = [
  "Chào con! Ta là người giữ gìn truyền thống làng nghề nón lá Việt Nam.",
  "Con có biết chiếc nón lá Việt Nam đã có từ hàng nghìn năm trước không?",
  "Nón lá là biểu tượng đẹp đẽ của người phụ nữ Việt Nam qua bao thế hệ.",
  "Nón được làm từ lá cọ hoặc lá dừa, khung tre được uốn khéo léo, rất bền và nhẹ.",
  "Ngày xưa, nón lá che nắng che mưa cho người nông dân trên đồng ruộng.",
  "Người đội nón lá khi đi chợ, khi làm đồng, khi tham gia lễ hội truyền thống.",
  "Ngày nay, nón lá còn là món quà ý nghĩa dành tặng cho bạn bè quốc tế.",
  "Mỗi chiếc nón lá chứa đựng tâm huyết của người nghệ nhân làng nghề.",
  "Hãy giữ gìn và trân trọng văn hóa dân tộc Việt Nam con nhé!",
  "Chúc con luôn may mắn và thành công trên hành trình của mình! 🌾🌾🌾"
];

// ========= CAMERA SETTINGS =========
// Scale factor — how big 1 game pixel appears on screen
const CAMERA_SCALE = 4;
// Tile size in game units
const TILE = 16;

function randomFromArray(array) { return array[Math.floor(Math.random() * array.length)]; }
function getKeyString(x, y) { return `${x}x${y}`; }

function createName() {
  const prefix = randomFromArray(["COOL","SUPER","HIP","SMUG","SILKY","GOOD","SAFE","DEAR","DAMP","WARM","RICH","LONG","DARK","SOFT","BUFF","DOPE"]);
  const animal = randomFromArray(["BEAR","DOG","CAT","FOX","LAMB","LION","BOAR","GOAT","VOLE","SEAL","PUMA","MULE","BULL","BIRD","BUG"]);
  return `${prefix} ${animal}`;
}

function isSolid(x, y) {
  if ((x === MERCHANT.x && y === MERCHANT.y) || (x === NPC_ELDER.x && y === NPC_ELDER.y)) return false;
  const blocked = mapData.blockedSpaces[getKeyString(x, y)];
  return blocked || x >= mapData.maxX || x < mapData.minX || y >= mapData.maxY || y < mapData.minY;
}

function getRandomSafeSpot() {
  return randomFromArray([
    {x:1,y:4},{x:2,y:4},{x:1,y:5},{x:2,y:6},{x:2,y:8},{x:2,y:9},
    {x:4,y:8},{x:5,y:5},{x:5,y:8},{x:5,y:10},{x:5,y:11},
    {x:11,y:7},{x:12,y:7},{x:13,y:7},{x:13,y:6},{x:13,y:8},
    {x:7,y:6},{x:7,y:7},{x:7,y:8},{x:8,y:8},{x:10,y:8},{x:11,y:4},
  ]);
}

function getPurchasedSkinsFromFirebase(skins) { return skins || { blue: true }; }

(function () {
  let playerId, playerRef;
  let players = {}, playerElements = {};
  let coins = {}, coinElements = {};

  const gameContainer = document.querySelector(".game-container");
  const playerNameInput = document.querySelector("#player-name");
  const merchantModal = document.querySelector("#merchant-modal");
  const closeModalBtn = document.querySelector("#close-modal");
  const skinShopList = document.querySelector("#skin-shop-list");
  const merchantMessage = document.querySelector("#merchant-message");
  const playerCoinsDisplay = document.querySelector("#player-coins");
  const coordDisplay = document.querySelector("#coord-display");

  // Pokémon dialogue elements
  const npcDialogueBox = document.querySelector("#npc-dialogue-box");
  const pokeText = document.querySelector("#poke-text");
  const pokeInner = document.querySelector("#poke-inner");

  let currentDialogueIndex = 0;
  let isInDialogue = false;
  let merchantCreated = false, npcCreated = false;

  // ========= CAMERA =========
  function updateCamera() {
    const player = players[playerId];
    if (!player) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Player center in scaled pixels
    const px = (player.x * TILE + TILE / 2) * CAMERA_SCALE;
    const py = (player.y * TILE + TILE / 2) * CAMERA_SCALE;
    // Translate so player is at viewport center
    const tx = vw / 2 - px;
    const ty = vh / 2 - py;
    gameContainer.style.transform = `translate(${tx}px, ${ty}px) scale(${CAMERA_SCALE})`;
  }

  // ========= COIN / PLAYER UI =========
  function updatePlayerCoinsDisplay(c) {
    if (playerCoinsDisplay) playerCoinsDisplay.textContent = c;
  }

  function updateCoordDisplay() {
    const player = players[playerId];
    if (player && coordDisplay) coordDisplay.innerHTML = `📍 X: ${player.x} | Y: ${player.y}`;
  }

  function placeCoin() {
    const { x, y } = getRandomSafeSpot();
    firebase.database().ref(`coins/${getKeyString(x, y)}`).set({ x, y });
    setTimeout(placeCoin, randomFromArray([2000, 3000, 4000, 5000]));
  }

  function attemptGrabCoin(x, y) {
    const key = getKeyString(x, y);
    if (coins[key]) {
      firebase.database().ref(`coins/${key}`).remove();
      playerRef.update({ coins: players[playerId].coins + 1 });
    }
  }

  // ========= MERCHANT MODAL =========
  function openMerchantModal() {
    renderSkinShop();
    merchantModal.style.display = "flex";
  }
  function closeMerchantModal() { merchantModal.style.display = "none"; }

  // ========= POKÉMON DIALOGUE =========
  function openNpcDialogue() {
    currentDialogueIndex = 0;
    isInDialogue = true;
    showDialogueLine();
    npcDialogueBox.style.display = "block";
    // Space/Enter also advances
    document.addEventListener("keydown", onDialogueKey);
    npcDialogueBox.addEventListener("click", advanceDialogue);
  }

  function closeNpcDialogue() {
    npcDialogueBox.style.display = "none";
    isInDialogue = false;
    currentDialogueIndex = 0;
    document.removeEventListener("keydown", onDialogueKey);
    npcDialogueBox.removeEventListener("click", advanceDialogue);
  }

  function onDialogueKey(e) {
    if (e.code === "Space" || e.code === "Enter" || e.code === "KeyZ") {
      e.preventDefault();
      advanceDialogue();
    }
    if (e.code === "Escape") closeNpcDialogue();
  }

  function showDialogueLine() {
    if (currentDialogueIndex < DIALOGUE_CONTENT.length) {
      pokeText.textContent = DIALOGUE_CONTENT[currentDialogueIndex];
      const isLast = currentDialogueIndex === DIALOGUE_CONTENT.length - 1;
      pokeInner.classList.toggle("last-line", isLast);
    }
  }

  function advanceDialogue() {
    if (currentDialogueIndex < DIALOGUE_CONTENT.length - 1) {
      currentDialogueIndex++;
      showDialogueLine();
    } else {
      closeNpcDialogue();
    }
  }

  // ========= SKIN SHOP =========
  function renderSkinShop() {
    const playerData = players[playerId];
    if (!playerData) return;
    const purchasedSkins = getPurchasedSkinsFromFirebase(playerData.purchasedSkins);
    const currentSkin = playerData.color;
    const playerCoins = playerData.coins;
    skinShopList.innerHTML = "";

    playerColors.forEach((color) => {
      const isOwned = purchasedSkins[color] === true;
      const isCurrent = currentSkin === color;
      const price = SKIN_PRICES[color] || 0;
      const skinItem = document.createElement("div");
      skinItem.className = "skin-item";
      skinItem.setAttribute("data-color", color);
      let buttonText = isCurrent ? "✓ ĐANG DÙNG" : (isOwned ? "SỬ DỤNG" : `MUA ${price} XU`);
      let buttonDisabled = isCurrent;
      skinItem.innerHTML = `
        <div class="skin-preview Character" data-color="${color}" data-direction="right">
          <div class="Character_shadow grid-cell"></div>
          <div class="Character_sprite grid-cell"></div>
        </div>
        <div class="skin-name">${color.toUpperCase()}</div>
        <button class="skin-buy-btn" data-color="${color}" ${buttonDisabled ? "disabled" : ""}>${buttonText}</button>
      `;
      const actionBtn = skinItem.querySelector(".skin-buy-btn");
      if (!buttonDisabled) {
        actionBtn.addEventListener("click", () => {
          if (isOwned) {
            playerRef.update({ color });
            merchantMessage.textContent = `✨ Đã trang bị skin ${color}! ✨`;
            setTimeout(() => { merchantMessage.textContent = "Chào mừng! Mua skin bằng xu của bạn!"; }, 2000);
            renderSkinShop();
          } else if (playerCoins >= price) {
            playerRef.update({ purchasedSkins: { ...purchasedSkins, [color]: true }, coins: playerCoins - price, color });
            merchantMessage.textContent = `🎉 Đã mua skin ${color} với giá ${price} xu! 🎉`;
            setTimeout(() => { merchantMessage.textContent = "Chào mừng! Mua skin bằng xu của bạn!"; }, 2000);
            renderSkinShop();
          } else {
            merchantMessage.textContent = `❌ Không đủ xu! Cần thêm ${price - playerCoins} xu. ❌`;
            setTimeout(() => { merchantMessage.textContent = "Chào mừng! Mua skin bằng xu của bạn!"; }, 2000);
          }
        });
      }
      skinShopList.appendChild(skinItem);
    });
  }

  // ========= INTERACTION CHECKS =========
  function checkMerchantInteraction() {
    const p = players[playerId];
    if (p && p.x === MERCHANT.x && p.y === MERCHANT.y) openMerchantModal();
  }
  function checkNpcInteraction() {
    const p = players[playerId];
    if (p && p.x === NPC_ELDER.x && p.y === NPC_ELDER.y) openNpcDialogue();
  }

  // ========= MOVEMENT =========
  let currentMovement = { x: 0, y: 0 };
  let movementInterval = null;

  function processMovement() {
    if (currentMovement.x !== 0 || currentMovement.y !== 0) handleArrowPress(currentMovement.x, currentMovement.y);
  }
  function startMovementLoop() {
    if (movementInterval) return;
    movementInterval = setInterval(processMovement, 300);
  }
  function stopMovementLoop() {
    if (movementInterval) { clearInterval(movementInterval); movementInterval = null; }
  }
  function setMovement(x, y) {
    currentMovement = { x, y };
    if ((x !== 0 || y !== 0) && !movementInterval) startMovementLoop();
    else if (x === 0 && y === 0 && movementInterval) stopMovementLoop();
  }

  function handleArrowPress(xChange = 0, yChange = 0) {
    if (!players[playerId]) return;
    if (isInDialogue) { advanceDialogue(); return; }
    const newX = players[playerId].x + xChange;
    const newY = players[playerId].y + yChange;
    if (!isSolid(newX, newY)) {
      players[playerId].x = newX;
      players[playerId].y = newY;
      updateCoordDisplay();
      if (xChange === 1) players[playerId].direction = "right";
      if (xChange === -1) players[playerId].direction = "left";
      if (xChange === 0) players[playerId].direction = "right";
      playerRef.set(players[playerId]);
      attemptGrabCoin(newX, newY);
      checkMerchantInteraction();
      checkNpcInteraction();
      updateCamera();
    }
  }

  // ========= NPC / MERCHANT ELEMENTS =========
  function createMerchantElement() {
    const old = document.querySelector(".merchant");
    if (old) old.remove();
    const el = document.createElement("div");
    el.classList.add("Character", "grid-cell", "merchant");
    el.innerHTML = `
      <div class="Character_shadow grid-cell"></div>
      <div class="Character_sprite grid-cell"></div>
      <div class="Character_name-container"><span class="Character_name">${MERCHANT.name}</span></div>
    `;
    el.setAttribute("data-color", "purple");
    el.setAttribute("data-direction", "right");
    el.style.transform = `translate3d(${16 * MERCHANT.x}px, ${16 * MERCHANT.y - 4}px, 0)`;
    el.style.position = "absolute";
    el.style.left = "0"; el.style.top = "0";
    gameContainer.appendChild(el);
    merchantCreated = true;
  }

  function createNpcElderElement() {
    const old = document.querySelector(".npc-elder");
    if (old) old.remove();
    const el = document.createElement("div");
    el.classList.add("Character", "grid-cell", "npc-elder");
    el.innerHTML = `
      <div class="Character_shadow grid-cell"></div>
      <div class="Character_sprite grid-cell"></div>
      <div class="Character_name-container"><span class="Character_name">${NPC_ELDER.name}</span></div>
    `;
    el.setAttribute("data-color", "green");
    el.setAttribute("data-direction", "right");
    el.style.transform = `translate3d(${16 * NPC_ELDER.x}px, ${16 * NPC_ELDER.y - 4}px, 0)`;
    el.style.position = "absolute";
    el.style.left = "0"; el.style.top = "0";
    gameContainer.appendChild(el);
    npcCreated = true;
  }

  // ========= MOBILE CONTROLS =========
  function setupMobileControls() {
    const joystickBase = document.getElementById("joystick-base");
    const joystickThumb = document.getElementById("joystick-thumb");
    if (joystickBase && joystickThumb) {
      new Joystick(joystickBase, joystickThumb, (x, y) => {
        let mx = 0, my = 0;
        if (Math.abs(x) > Math.abs(y)) mx = x > 0 ? 1 : (x < 0 ? -1 : 0);
        else my = y > 0 ? 1 : (y < 0 ? -1 : 0);
        setMovement(mx, my);
      });
    }
  }

  // ========= INIT =========
  function initGame() {
    new KeyPressListener("ArrowUp",    () => handleArrowPress(0, -1));
    new KeyPressListener("ArrowDown",  () => handleArrowPress(0, 1));
    new KeyPressListener("ArrowLeft",  () => handleArrowPress(-1, 0));
    new KeyPressListener("ArrowRight", () => handleArrowPress(1, 0));
    new KeyPressListener("KeyW", () => handleArrowPress(0, -1));
    new KeyPressListener("KeyS", () => handleArrowPress(0, 1));
    new KeyPressListener("KeyA", () => handleArrowPress(-1, 0));
    new KeyPressListener("KeyD", () => handleArrowPress(1, 0));

    const allPlayersRef = firebase.database().ref(`players`);
    const allCoinsRef   = firebase.database().ref(`coins`);

    allPlayersRef.on("value", (snapshot) => {
      players = snapshot.val() || {};
      Object.keys(players).forEach((key) => {
        const s = players[key];
        let el = playerElements[key];
        if (el) {
          el.querySelector(".Character_name").innerText = s.name;
          el.querySelector(".Character_coins").innerText = s.coins;
          el.setAttribute("data-color", s.color);
          el.setAttribute("data-direction", s.direction);
          el.style.transform = `translate3d(${16 * s.x}px, ${16 * s.y - 4}px, 0)`;
        }
      });
      updateCoordDisplay();
      updateCamera();
    });

    allPlayersRef.on("child_added", (snapshot) => {
      const p = snapshot.val();
      const el = document.createElement("div");
      el.classList.add("Character", "grid-cell");
      if (p.id === playerId) el.classList.add("you");
      el.innerHTML = `
        <div class="Character_shadow grid-cell"></div>
        <div class="Character_sprite grid-cell"></div>
        <div class="Character_name-container">
          <span class="Character_name"></span>
          <span class="Character_coins">0</span>
        </div>
        <div class="Character_you-arrow"></div>
      `;
      playerElements[p.id] = el;
      el.querySelector(".Character_name").innerText = p.name;
      el.querySelector(".Character_coins").innerText = p.coins;
      el.setAttribute("data-color", p.color);
      el.setAttribute("data-direction", p.direction);
      el.style.transform = `translate3d(${16 * p.x}px, ${16 * p.y - 4}px, 0)`;
      gameContainer.appendChild(el);
      updateCamera();
    });

    allPlayersRef.on("child_removed", (snapshot) => {
      const removedKey = snapshot.val().id;
      if (playerElements[removedKey]) {
        gameContainer.removeChild(playerElements[removedKey]);
        delete playerElements[removedKey];
      }
    });

    allCoinsRef.on("value", (snapshot) => { coins = snapshot.val() || {}; });

    allCoinsRef.on("child_added", (snapshot) => {
      const coin = snapshot.val();
      const key = getKeyString(coin.x, coin.y);
      coins[key] = true;
      const el = document.createElement("div");
      el.classList.add("Coin", "grid-cell");
      el.innerHTML = `<div class="Coin_shadow grid-cell"></div><div class="Coin_sprite grid-cell"></div>`;
      el.style.transform = `translate3d(${16 * coin.x}px, ${16 * coin.y - 4}px, 0)`;
      coinElements[key] = el;
      gameContainer.appendChild(el);
    });

    allCoinsRef.on("child_removed", (snapshot) => {
      const { x, y } = snapshot.val();
      const key = getKeyString(x, y);
      if (coinElements[key]) { gameContainer.removeChild(coinElements[key]); delete coinElements[key]; }
    });

    playerNameInput.addEventListener("change", (e) => {
      const newName = e.target.value || createName();
      playerNameInput.value = newName;
      playerRef.update({ name: newName });
    });

    closeModalBtn.addEventListener("click", closeMerchantModal);
    window.addEventListener("click", (e) => {
      if (e.target === merchantModal) closeMerchantModal();
    });

    // Camera update on resize
    window.addEventListener("resize", updateCamera);

    setTimeout(() => {
      if (!merchantCreated) createMerchantElement();
      if (!npcCreated) createNpcElderElement();
    }, 100);

    placeCoin();
    setupMobileControls();
  }

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      playerId = user.uid;
      playerRef = firebase.database().ref(`players/${playerId}`);
      const name = createName();
      playerNameInput.value = name;
      const { x, y } = getRandomSafeSpot();
      playerRef.set({ id: playerId, name, direction: "right", color: "blue", x, y, coins: 0, purchasedSkins: { blue: true } });
      playerRef.on("value", (snapshot) => {
        const data = snapshot.val();
        if (data && playerCoinsDisplay) updatePlayerCoinsDisplay(data.coins);
        updateCoordDisplay();
      });
      playerRef.onDisconnect().remove();
      initGame();
    }
  });

  firebase.auth().signInAnonymously().catch((err) => console.log(err.code, err.message));
})();
