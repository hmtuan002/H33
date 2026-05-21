const mapData = {
  minX: 1,
  maxX: 14,
  minY: 4,
  maxY: 12,
  blockedSpaces: {
    "7x4": true,
    "1x11": true,
    "12x10": true,
    "4x7": true,
    "5x7": true,
    "6x7": true,
    "8x6": true,
    "9x6": true,
    "10x6": true,
    "7x9": true,
    "8x9": true,
    "9x9": true,
  },
};

// Options for Player Colors - these are the purchasable skins
const playerColors = ["blue", "red", "orange", "yellow", "green", "purple"];
const SKIN_PRICES = {
  red: 10,
  orange: 15,
  yellow: 20,
  green: 25,
  purple: 30,
};

// Merchant position - ở bên phải map
const MERCHANT = {
  x: 12,
  y: 4,
  name: "SKIN MERCHANT",
};

// NPC Elder position - ở bên trái map, cách merchant 10 ô
const NPC_ELDER = {
  x: 2,
  y: 5,
  name: "LÃO NHÂN",
};

// Dialogue content for NPC Elder - Giới thiệu về Nón Lá Việt Nam
const DIALOGUE_CONTENT = [
  "🌾 Chào con, ta là Lão Nhân nơi đầu làng...",
  "🌾 Con có biết về chiếc nón lá Việt Nam không?",
  "🌾 Nón lá đã có từ hàng nghìn năm trước, là biểu tượng của người phụ nữ Việt Nam.",
  "🌾 Nón được làm từ lá cọ hoặc lá dừa, khung tre, rất bền và nhẹ.",
  "🌾 Ngày xưa, nón lá che nắng che mưa cho người nông dân trên đồng ruộng.",
  "🌾 Ngày nay, nón lá còn là quà tặng ý nghĩa cho bạn bè quốc tế.",
  "🌾 Hãy giữ gìn và trân trọng văn hóa dân tộc con nhé!",
  "🎋 Chúc con may mắn trên hành trình của mình! 🎋"
];

//Misc Helpers
function randomFromArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getKeyString(x, y) {
  return `${x}x${y}`;
}

function createName() {
  const prefix = randomFromArray([
    "COOL", "SUPER", "HIP", "SMUG", "GOOD", "SAFE", "DEAR", "DARK",
    "WARM", "RICH", "LONG", "SOFT", "BUFF", "DOPE", "PRO", "VIP"
  ]);
  const animal = randomFromArray([
    "BEAR", "DOG", "CAT", "FOX", "LAMB", "LION", "BOAR", "GOAT",
    "SEAL", "PUMA", "MULE", "BULL", "BIRD", "WOLF", "HAWK"
  ]);
  return `${prefix} ${animal}`;
}

function isSolid(x, y) {
  // Check if position is merchant or NPC - they are not solid
  if ((x === MERCHANT.x && y === MERCHANT.y) || (x === NPC_ELDER.x && y === NPC_ELDER.y)) {
    return false;
  }
  const blockedNextSpace = mapData.blockedSpaces[getKeyString(x, y)];
  return (
    blockedNextSpace ||
    x > mapData.maxX ||
    x < mapData.minX ||
    y > mapData.maxY ||
    y < mapData.minY
  );
}

function getRandomSafeSpot() {
  return randomFromArray([
    { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 1, y: 5 }, { x: 2, y: 6 },
    { x: 2, y: 8 }, { x: 2, y: 9 }, { x: 4, y: 8 }, { x: 5, y: 5 },
    { x: 5, y: 8 }, { x: 5, y: 10 }, { x: 5, y: 11 }, { x: 11, y: 7 },
    { x: 12, y: 7 }, { x: 13, y: 7 }, { x: 13, y: 6 }, { x: 13, y: 8 },
    { x: 7, y: 6 }, { x: 7, y: 7 }, { x: 7, y: 8 }, { x: 8, y: 8 },
    { x: 10, y: 8 }, { x: 11, y: 4 },
  ]);
}

function getPurchasedSkinsFromFirebase(skins) {
  return skins || { blue: true };
}

(function () {
  let playerId;
  let playerRef;
  let players = {};
  let playerElements = {};
  let coins = {};
  let coinElements = {};

  const gameContainer = document.querySelector(".game-container");
  const playerNameInput = document.querySelector("#player-name");
  const changeSkinButton = document.querySelector("#change-skin");
  const talkNpcBtn = document.querySelector("#talk-npc-btn");
  const merchantModal = document.querySelector("#merchant-modal");
  const closeModalBtn = document.querySelector("#close-modal");
  const npcModal = document.querySelector("#npc-modal");
  const closeNpcModalBtn = document.querySelector("#close-npc-modal");
  const closeDialogueBtn = document.querySelector("#close-dialogue-btn");
  const nextDialogueBtn = document.querySelector("#next-dialogue-btn");
  const dialogueText = document.querySelector("#dialogue-text");
  const skinShopList = document.querySelector("#skin-shop-list");
  const merchantMessage = document.querySelector("#merchant-message");
  const playerCoinsDisplay = document.querySelector("#player-coins");
  
  // Dialogue state
  let currentDialogueIndex = 0;

  // Hàm chuyển đổi tọa độ game sang pixel (do map scale 3)
  function gameToPixel(x, y) {
    // Mỗi ô là 16px, map scale 3 lần
    // Ô đầu tiên của map là (1,4) tương ứng với pixel (0,0)
    const pixelX = (x - 1) * 16;
    const pixelY = (y - 4) * 16;
    return { x: pixelX, y: pixelY };
  }

  function updatePlayerCoinsDisplay(coins) {
    if (playerCoinsDisplay) {
      playerCoinsDisplay.textContent = coins;
    }
  }

  function placeCoin() {
    const { x, y } = getRandomSafeSpot();
    const coinRef = firebase.database().ref(`coins/${getKeyString(x, y)}`);
    coinRef.set({
      x,
      y,
    });
    const coinTimeouts = [2000, 3000, 4000, 5000];
    setTimeout(() => {
      placeCoin();
    }, randomFromArray(coinTimeouts));
  }

  function attemptGrabCoin(x, y) {
    const key = getKeyString(x, y);
    if (coins[key]) {
      firebase.database().ref(`coins/${key}`).remove();
      playerRef.update({
        coins: (players[playerId]?.coins || 0) + 1,
      });
    }
  }

  // Merchant functions
  function openMerchantModal() {
    renderSkinShop();
    merchantModal.style.display = "flex";
  }

  function closeMerchantModal() {
    merchantModal.style.display = "none";
  }
  
  // NPC Dialogue functions
  function openNpcModal() {
    currentDialogueIndex = 0;
    updateDialogueText();
    npcModal.style.display = "flex";
  }
  
  function closeNpcModal() {
    npcModal.style.display = "none";
    currentDialogueIndex = 0;
  }
  
  function updateDialogueText() {
    if (currentDialogueIndex < DIALOGUE_CONTENT.length) {
      dialogueText.textContent = DIALOGUE_CONTENT[currentDialogueIndex];
      if (currentDialogueIndex === DIALOGUE_CONTENT.length - 1) {
        nextDialogueBtn.textContent = "🏮 Kết thúc 🏮";
      } else {
        nextDialogueBtn.textContent = "➡ Tiếp theo";
      }
    } else {
      closeNpcModal();
    }
  }
  
  function nextDialogue() {
    if (currentDialogueIndex < DIALOGUE_CONTENT.length - 1) {
      currentDialogueIndex++;
      updateDialogueText();
    } else if (currentDialogueIndex === DIALOGUE_CONTENT.length - 1) {
      closeNpcModal();
    }
  }

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
      
      let buttonText = "";
      let buttonDisabled = false;
      
      if (isCurrent) {
        buttonText = "✓ ĐANG DÙNG";
        buttonDisabled = true;
      } else if (isOwned) {
        buttonText = "TRANG BỊ";
        buttonDisabled = false;
      } else {
        buttonText = `MUA ${price} XU`;
        buttonDisabled = false;
      }
      
      skinItem.innerHTML = `
        <div class="skin-preview Character" data-color="${color}" data-direction="right">
          <div class="Character_shadow grid-cell"></div>
          <div class="Character_sprite grid-cell"></div>
        </div>
        <div class="skin-name">${color.toUpperCase()}</div>
        <button class="skin-buy-btn" data-color="${color}" ${buttonDisabled ? "disabled" : ""}>
          ${buttonText}
        </button>
      `;
      
      const actionBtn = skinItem.querySelector(".skin-buy-btn");
      if (!buttonDisabled) {
        actionBtn.addEventListener("click", () => {
          if (isOwned) {
            playerRef.update({
              color: color,
            });
            merchantMessage.textContent = `✨ Đã trang bị da ${color}! ✨`;
            setTimeout(() => {
              merchantMessage.textContent = "Chào mừng! Mua da bằng xu của bạn!";
            }, 2000);
            renderSkinShop();
          } else if (playerCoins >= price) {
            const updatedSkins = { ...purchasedSkins, [color]: true };
            playerRef.update({
              purchasedSkins: updatedSkins,
              coins: playerCoins - price,
              color: color,
            });
            merchantMessage.textContent = `🎉 Đã mua da ${color} với ${price} xu! 🎉`;
            setTimeout(() => {
              merchantMessage.textContent = "Chào mừng! Mua da bằng xu của bạn!";
            }, 2000);
            renderSkinShop();
          } else {
            merchantMessage.textContent = `❌ Không đủ xu! Cần thêm ${price - playerCoins} xu nữa! ❌`;
            setTimeout(() => {
              merchantMessage.textContent = "Chào mừng! Mua da bằng xu của bạn!";
            }, 2000);
          }
        });
      }
      
      skinShopList.appendChild(skinItem);
    });
  }

  function checkMerchantInteraction() {
    const playerData = players[playerId];
    if (playerData && playerData.x === MERCHANT.x && playerData.y === MERCHANT.y) {
      openMerchantModal();
    }
  }
  
  function checkNpcInteraction() {
    const playerData = players[playerId];
    if (playerData && playerData.x === NPC_ELDER.x && playerData.y === NPC_ELDER.y) {
      openNpcModal();
    }
  }

  // Movement handling - supports both keyboard and joystick
  let currentMovement = { x: 0, y: 0 };
  let movementInterval = null;
  let lastMoveTime = 0;
  const MOVE_DELAY = 120;
  
  function processMovement() {
    const now = Date.now();
    if (now - lastMoveTime >= MOVE_DELAY) {
      if (currentMovement.x !== 0 || currentMovement.y !== 0) {
        handleArrowPress(currentMovement.x, currentMovement.y);
        lastMoveTime = now;
      }
    }
  }
  
  function startMovementLoop() {
    if (movementInterval) return;
    movementInterval = setInterval(() => {
      processMovement();
    }, 50);
  }
  
  function stopMovementLoop() {
    if (movementInterval) {
      clearInterval(movementInterval);
      movementInterval = null;
    }
  }
  
  function setMovement(x, y) {
    currentMovement = { x, y };
    if ((x !== 0 || y !== 0) && !movementInterval) {
      startMovementLoop();
    } else if (x === 0 && y === 0 && movementInterval) {
      stopMovementLoop();
    }
  }

  function handleArrowPress(xChange = 0, yChange = 0) {
    if (!players[playerId]) return;
    const newX = players[playerId].x + xChange;
    const newY = players[playerId].y + yChange;
    if (!isSolid(newX, newY)) {
      players[playerId].x = newX;
      players[playerId].y = newY;
      if (xChange === 1) {
        players[playerId].direction = "right";
      }
      if (xChange === -1) {
        players[playerId].direction = "left";
      }
      playerRef.set(players[playerId]);
      attemptGrabCoin(newX, newY);
      checkMerchantInteraction();
      checkNpcInteraction();
    }
  }

  function createMerchantElement() {
    const merchantElement = document.createElement("div");
    merchantElement.classList.add("Character", "grid-cell", "merchant");
    merchantElement.innerHTML = `
      <div class="Character_shadow grid-cell"></div>
      <div class="Character_sprite grid-cell"></div>
      <div class="Character_name-container">
        <span class="Character_name">${MERCHANT.name}</span>
      </div>
    `;
    merchantElement.setAttribute("data-color", "purple");
    merchantElement.setAttribute("data-direction", "right");
    
    // Sử dụng hàm gameToPixel để tính toán vị trí chính xác
    const pixelPos = gameToPixel(MERCHANT.x, MERCHANT.y);
    const left = pixelPos.x + "px";
    const top = pixelPos.y - 4 + "px";
    merchantElement.style.transform = `translate3d(${left}, ${top}, 0)`;
    gameContainer.appendChild(merchantElement);
  }
  
  function createNpcElderElement() {
    const npcElement = document.createElement("div");
    npcElement.classList.add("Character", "grid-cell", "npc-elder");
    npcElement.innerHTML = `
      <div class="Character_shadow grid-cell"></div>
      <div class="Character_sprite grid-cell"></div>
      <div class="Character_name-container">
        <span class="Character_name">${NPC_ELDER.name}</span>
      </div>
    `;
    npcElement.setAttribute("data-color", "green");
    npcElement.setAttribute("data-direction", "right");
    
    // Sử dụng hàm gameToPixel để tính toán vị trí chính xác
    const pixelPos = gameToPixel(NPC_ELDER.x, NPC_ELDER.y);
    const left = pixelPos.x + "px";
    const top = pixelPos.y - 4 + "px";
    npcElement.style.transform = `translate3d(${left}, ${top}, 0)`;
    gameContainer.appendChild(npcElement);
  }

  // Setup mobile controls
  function setupMobileControls() {
    // Joystick
    const joystickBase = document.getElementById("joystick-base");
    const joystickThumb = document.getElementById("joystick-thumb");
    
    if (joystickBase && joystickThumb && typeof Joystick !== 'undefined') {
      new Joystick(joystickBase, joystickThumb, (x, y) => {
        let moveX = 0, moveY = 0;
        if (Math.abs(x) > Math.abs(y)) {
          moveX = x > 0 ? 1 : (x < 0 ? -1 : 0);
        } else {
          moveY = y > 0 ? 1 : (y < 0 ? -1 : 0);
        }
        setMovement(moveX, moveY);
      });
    }
    
    // Touch buttons
    const upBtn = document.getElementById("mobile-up");
    const downBtn = document.getElementById("mobile-down");
    const leftBtn = document.getElementById("mobile-left");
    const rightBtn = document.getElementById("mobile-right");
    
    const addTouchButton = (btn, xMove, yMove) => {
      if (!btn) return;
      btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        setMovement(xMove, yMove);
      });
      btn.addEventListener("touchend", (e) => {
        e.preventDefault();
        setMovement(0, 0);
      });
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        setMovement(xMove, yMove);
      });
      btn.addEventListener("mouseup", (e) => {
        e.preventDefault();
        setMovement(0, 0);
      });
    };
    
    addTouchButton(upBtn, 0, -1);
    addTouchButton(downBtn, 0, 1);
    addTouchButton(leftBtn, -1, 0);
    addTouchButton(rightBtn, 1, 0);
  }

  function initGame() {
    // Keyboard controls - Arrow keys and WASD
    new KeyPressListener("ArrowUp", () => handleArrowPress(0, -1));
    new KeyPressListener("ArrowDown", () => handleArrowPress(0, 1));
    new KeyPressListener("ArrowLeft", () => handleArrowPress(-1, 0));
    new KeyPressListener("ArrowRight", () => handleArrowPress(1, 0));
    
    new KeyPressListener("KeyW", () => handleArrowPress(0, -1));
    new KeyPressListener("KeyS", () => handleArrowPress(0, 1));
    new KeyPressListener("KeyA", () => handleArrowPress(-1, 0));
    new KeyPressListener("KeyD", () => handleArrowPress(1, 0));

    const allPlayersRef = firebase.database().ref(`players`);
    const allCoinsRef = firebase.database().ref(`coins`);

    allPlayersRef.on("value", (snapshot) => {
      players = snapshot.val() || {};
      Object.keys(players).forEach((key) => {
        const characterState = players[key];
        let el = playerElements[key];
        if (el) {
          const nameSpan = el.querySelector(".Character_name");
          const coinsSpan = el.querySelector(".Character_coins");
          if (nameSpan) nameSpan.innerText = characterState.name;
          if (coinsSpan) coinsSpan.innerText = characterState.coins;
          el.setAttribute("data-color", characterState.color);
          el.setAttribute("data-direction", characterState.direction);
          
          const pixelPos = gameToPixel(characterState.x, characterState.y);
          const left = pixelPos.x + "px";
          const top = pixelPos.y - 4 + "px";
          el.style.transform = `translate3d(${left}, ${top}, 0)`;
        }
      });
    });

    allPlayersRef.on("child_added", (snapshot) => {
      const addedPlayer = snapshot.val();
      const characterElement = document.createElement("div");
      characterElement.classList.add("Character", "grid-cell");
      if (addedPlayer.id === playerId) {
        characterElement.classList.add("you");
      }
      characterElement.innerHTML = `
        <div class="Character_shadow grid-cell"></div>
        <div class="Character_sprite grid-cell"></div>
        <div class="Character_name-container">
          <span class="Character_name"></span>
          <span class="Character_coins"></span>
        </div>
        <div class="Character_you-arrow"></div>
      `;
      playerElements[addedPlayer.id] = characterElement;
      const nameSpan = characterElement.querySelector(".Character_name");
      const coinsSpan = characterElement.querySelector(".Character_coins");
      if (nameSpan) nameSpan.innerText = addedPlayer.name;
      if (coinsSpan) coinsSpan.innerText = addedPlayer.coins;
      characterElement.setAttribute("data-color", addedPlayer.color);
      characterElement.setAttribute("data-direction", addedPlayer.direction);
      
      const pixelPos = gameToPixel(addedPlayer.x, addedPlayer.y);
      const left = pixelPos.x + "px";
      const top = pixelPos.y - 4 + "px";
      characterElement.style.transform = `translate3d(${left}, ${top}, 0)`;
      gameContainer.appendChild(characterElement);
    });

    allPlayersRef.on("child_removed", (snapshot) => {
      const removedKey = snapshot.val().id;
      if (playerElements[removedKey]) {
        gameContainer.removeChild(playerElements[removedKey]);
        delete playerElements[removedKey];
      }
    });

    allCoinsRef.on("value", (snapshot) => {
      coins = snapshot.val() || {};
    });

    allCoinsRef.on("child_added", (snapshot) => {
      const coin = snapshot.val();
      const key = getKeyString(coin.x, coin.y);
      coins[key] = true;
      const coinElement = document.createElement("div");
      coinElement.classList.add("Coin", "grid-cell");
      coinElement.innerHTML = `
        <div class="Coin_shadow grid-cell"></div>
        <div class="Coin_sprite grid-cell"></div>
      `;
      const pixelPos = gameToPixel(coin.x, coin.y);
      const left = pixelPos.x + "px";
      const top = pixelPos.y - 4 + "px";
      coinElement.style.transform = `translate3d(${left}, ${top}, 0)`;
      coinElements[key] = coinElement;
      gameContainer.appendChild(coinElement);
    });

    allCoinsRef.on("child_removed", (snapshot) => {
      const { x, y } = snapshot.val();
      const keyToRemove = getKeyString(x, y);
      if (coinElements[keyToRemove]) {
        gameContainer.removeChild(coinElements[keyToRemove]);
        delete coinElements[keyToRemove];
      }
    });

    playerNameInput.addEventListener("change", (e) => {
      const newName = e.target.value || createName();
      playerNameInput.value = newName;
      playerRef.update({
        name: newName,
      });
    });

    if (changeSkinButton) {
      changeSkinButton.addEventListener("click", () => {
        openMerchantModal();
      });
    }
    
    if (talkNpcBtn) {
      talkNpcBtn.addEventListener("click", () => {
        openNpcModal();
      });
    }

    closeModalBtn.addEventListener("click", closeMerchantModal);
    window.addEventListener("click", (e) => {
      if (e.target === merchantModal) {
        closeMerchantModal();
      }
      if (e.target === npcModal) {
        closeNpcModal();
      }
    });
    
    if (closeNpcModalBtn) closeNpcModalBtn.addEventListener("click", closeNpcModal);
    if (closeDialogueBtn) closeDialogueBtn.addEventListener("click", closeNpcModal);
    if (nextDialogueBtn) nextDialogueBtn.addEventListener("click", nextDialogue);

    createMerchantElement();
    createNpcElderElement();
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

      playerRef.set({
        id: playerId,
        name,
        direction: "right",
        color: "blue",
        x,
        y,
        coins: 0,
        purchasedSkins: { blue: true },
      });

      playerRef.on("value", (snapshot) => {
        const data = snapshot.val();
        if (data && playerCoinsDisplay) {
          updatePlayerCoinsDisplay(data.coins);
        }
      });

      playerRef.onDisconnect().remove();
      initGame();
    }
  });

  firebase.auth().signInAnonymously().catch((error) => {
    var errorCode = error.code;
    var errorMessage = error.message;
    console.log(errorCode, errorMessage);
  });
})();
