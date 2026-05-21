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

// Merchant position
const MERCHANT = {
  x: 12,
  y: 4,
  name: "SKIN MERCHANT",
};

//Misc Helpers
function randomFromArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}
function getKeyString(x, y) {
  return `${x}x${y}`;
}

function createName() {
  const prefix = randomFromArray([
    "COOL", "SUPER", "HIP", "SMUG", "COOL", "SILKY", "GOOD", "SAFE", "DEAR", 
    "DAMP", "WARM", "RICH", "LONG", "DARK", "SOFT", "BUFF", "DOPE",
  ]);
  const animal = randomFromArray([
    "BEAR", "DOG", "CAT", "FOX", "LAMB", "LION", "BOAR", "GOAT", "VOLE", 
    "SEAL", "PUMA", "MULE", "BULL", "BIRD", "BUG",
  ]);
  return `${prefix} ${animal}`;
}

function isSolid(x, y) {
  // Check if position is merchant - merchant is not solid
  if (x === MERCHANT.x && y === MERCHANT.y) {
    return false;
  }
  const blockedNextSpace = mapData.blockedSpaces[getKeyString(x, y)];
  return (
    blockedNextSpace ||
    x >= mapData.maxX ||
    x < mapData.minX ||
    y >= mapData.maxY ||
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
    { x: 10, y: 8 }, { x: 8, y: 8 }, { x: 11, y: 4 },
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
  const merchantModal = document.querySelector("#merchant-modal");
  const closeModalBtn = document.querySelector("#close-modal");
  const skinShopList = document.querySelector("#skin-shop-list");
  const merchantMessage = document.querySelector("#merchant-message");
  const playerCoinsDisplay = document.querySelector("#player-coins");

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
        coins: players[playerId].coins + 1,
      });
    }
  }

  function openMerchantModal() {
    renderSkinShop();
    merchantModal.style.display = "flex";
  }

  function closeMerchantModal() {
    merchantModal.style.display = "none";
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
        buttonText = "✓ EQUIPPED";
        buttonDisabled = true;
      } else if (isOwned) {
        buttonText = "EQUIP";
        buttonDisabled = false;
      } else {
        buttonText = `BUY ${price} COINS`;
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
            // Equip owned skin
            playerRef.update({
              color: color,
            });
            merchantMessage.textContent = `✨ Equipped ${color} skin! ✨`;
            setTimeout(() => {
              merchantMessage.textContent = "Welcome! Buy skins with your coins!";
            }, 2000);
            renderSkinShop();
          } else if (playerCoins >= price) {
            // Purchase new skin
            const updatedSkins = { ...purchasedSkins, [color]: true };
            playerRef.update({
              purchasedSkins: updatedSkins,
              coins: playerCoins - price,
              color: color,
            });
            merchantMessage.textContent = `🎉 Purchased ${color} skin for ${price} coins! 🎉`;
            setTimeout(() => {
              merchantMessage.textContent = "Welcome! Buy skins with your coins!";
            }, 2000);
            renderSkinShop();
          } else {
            merchantMessage.textContent = `❌ Not enough coins! Need ${price - playerCoins} more coins. ❌`;
            setTimeout(() => {
              merchantMessage.textContent = "Welcome! Buy skins with your coins!";
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

  function handleArrowPress(xChange = 0, yChange = 0) {
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
    const left = 16 * MERCHANT.x + "px";
    const top = 16 * MERCHANT.y - 4 + "px";
    merchantElement.style.transform = `translate3d(${left}, ${top}, 0)`;
    gameContainer.appendChild(merchantElement);
  }

  function initGame() {
    new KeyPressListener("ArrowUp", () => handleArrowPress(0, -1));
    new KeyPressListener("ArrowDown", () => handleArrowPress(0, 1));
    new KeyPressListener("ArrowLeft", () => handleArrowPress(-1, 0));
    new KeyPressListener("ArrowRight", () => handleArrowPress(1, 0));

    const allPlayersRef = firebase.database().ref(`players`);
    const allCoinsRef = firebase.database().ref(`coins`);

    allPlayersRef.on("value", (snapshot) => {
      players = snapshot.val() || {};
      Object.keys(players).forEach((key) => {
        const characterState = players[key];
        let el = playerElements[key];
        if (el) {
          el.querySelector(".Character_name").innerText = characterState.name;
          el.querySelector(".Character_coins").innerText = characterState.coins;
          el.setAttribute("data-color", characterState.color);
          el.setAttribute("data-direction", characterState.direction);
          const left = 16 * characterState.x + "px";
          const top = 16 * characterState.y - 4 + "px";
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
          <span class="Character_coins">0</span>
        </div>
        <div class="Character_you-arrow"></div>
      `;
      playerElements[addedPlayer.id] = characterElement;
      characterElement.querySelector(".Character_name").innerText = addedPlayer.name;
      characterElement.querySelector(".Character_coins").innerText = addedPlayer.coins;
      characterElement.setAttribute("data-color", addedPlayer.color);
      characterElement.setAttribute("data-direction", addedPlayer.direction);
      const left = 16 * addedPlayer.x + "px";
      const top = 16 * addedPlayer.y - 4 + "px";
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
      const left = 16 * coin.x + "px";
      const top = 16 * coin.y - 4 + "px";
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

    // Change Skin button - opens merchant modal
    if (changeSkinButton) {
      changeSkinButton.addEventListener("click", () => {
        openMerchantModal();
      });
    }

    closeModalBtn.addEventListener("click", closeMerchantModal);
    window.addEventListener("click", (e) => {
      if (e.target === merchantModal) {
        closeMerchantModal();
      }
    });

    createMerchantElement();
    placeCoin();
  }

  firebase.auth().onAuthStateChanged((user) => {
    console.log(user);
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

      // Listen for coin updates to display
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
