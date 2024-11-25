let gameList = [];
let gameIdsToScrape = [];
let pointsBudget = 0;

// Load the game list from storage and mark added games
async function loadGameList() {
  const result = await chrome.storage.local.get(['gameList']);
  gameList = result.gameList || [];
  gameList.forEach(savedGame => {
    markGiveawayAsAdded(savedGame.id);
  });
}

// Mark giveaways as added
function markGiveawayAsAdded(gameId) {
  const giveawayRows = document.querySelectorAll('.giveaway__row-outer-wrap');
  giveawayRows.forEach(row => {
    if (row.getAttribute('data-game-id') === gameId) {
      const addButton = row.querySelector('button');
      if (addButton) {
        addButton.disabled = true;
        addButton.textContent = 'Added';
        addButton.classList.remove('sidebar__entry-insert');
        addButton.classList.add("sidebar__entry-delete")
      }
    }
  });
}

// Inject 'Add to List' buttons into each giveaway row
function injectAddButtons() {
  const giveawayRows = document.querySelectorAll('.giveaway__row-outer-wrap');
  giveawayRows.forEach(row => {
    row.classList.add("rows-custom")
    const innerWrap = row.querySelector('.giveaway__row-inner-wrap');
    innerWrap.classList.add("inner-rows-custom")
    const gameId = row.getAttribute('data-game-id');
    const gameNameElement = row.querySelector('.giveaway__heading__name');
    const gameName = gameNameElement?.textContent;
    const gameLink = gameNameElement?.getAttribute('href');

    if (!row.classList.contains('is-faded') && gameId && gameName && gameLink && !isGameInList(gameId)) {
      const addButton = createAddButton(gameId, gameName, gameLink);
      row.appendChild(addButton);
    }
  });
}

// Create 'Add to List' button
function createAddButton(gameId, gameName, gameLink) {
  const addButton = document.createElement('button');
  addButton.textContent = 'Add to List';
  addButton.classList.add('add-to-list-button', 'sidebar__entry-insert', 'rows-custom');

  addButton.addEventListener('click', () => {
    gameList.push({ id: gameId, name: gameName, link: gameLink });
    saveGameList();
    addButton.disabled = true;
    addButton.textContent = 'Added';
    addButton.classList.remove('sidebar__entry-insert');
    addButton.classList.add("sidebar__entry-delete")
    markGiveawayAsAdded(gameId);
  });

  return addButton;
}

// Save updated game list to storage
async function saveGameList() {
  await chrome.storage.local.set({ gameList });
  console.log('Game list saved!');
}

// Check if the game is already in the list
function isGameInList(gameId) {
  return gameList.some(game => game.id === gameId);
}

// Scrape points budget from the page
function getPointsBudget() {
  const pointsElement = document.querySelector('.nav__points');
  return pointsElement ? parseInt(pointsElement.textContent, 10) : 0;
}

// Scrape all giveaways across multiple pages
async function scrapeAllGiveaways(gameIds, pointsBudget, page = 1, accumulatedGiveaways = []) {
  const url = `https://www.steamgifts.com/giveaways/search?page=${page}`;
  try {
    const response = await fetch(url);
    const html = await response.text();
    const giveaways = await processGiveawaysPage(html, gameIds, pointsBudget, page, accumulatedGiveaways);
    return giveaways;
  } catch (error) {
    console.error('Error scraping pages:', error);
  }
}

// Process a page of giveaways
async function processGiveawaysPage(html, gameIds, pointsBudget, page, accumulatedGiveaways) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const giveawayRows = doc.querySelectorAll('.giveaway__row-outer-wrap');
  giveawayRows.forEach(row => {
    const gameId = row.getAttribute('data-game-id');
    const gameNameElement = row.querySelector('.giveaway__heading__name');
    const gameLink = gameNameElement?.getAttribute('href');
    const gameCostElements = row.querySelectorAll('.giveaway__heading__thin');
    const lastThinElement = gameCostElements[gameCostElements.length - 1];
    const gameCost = lastThinElement ? parseInt(lastThinElement.textContent.replace(/\((\d+)P\)/, '$1')) : null;
    const innerWrap = row.querySelector('.giveaway__row-inner-wrap');
    
    if (gameIds.includes(gameId) && !innerWrap.classList.contains('is-faded')) {
      pointsBudget = Number(pointsBudget) - Number(gameCost)
      if (pointsBudget >= 0) {
        accumulatedGiveaways.push({ id: gameId, name: gameNameElement.textContent, link: gameLink, cost: gameCost });
      }
    }
  });

  const nextPageLink = [...doc.querySelectorAll('.pagination__navigation a')].find(link => link.textContent.trim() === 'Next');
  if (nextPageLink) {
    return scrapeAllGiveaways(gameIds, pointsBudget, page + 1, accumulatedGiveaways);
  } else {
    await processGiveawayEntries(accumulatedGiveaways);
    return accumulatedGiveaways;
  }
}

// Process each giveaway entry
async function processGiveawayEntries(giveaways) {
  for (const giveaway of giveaways) {
    const giveawayPageUrl = `https://www.steamgifts.com${giveaway.link}`;
    await chrome.runtime.sendMessage({ action: 'openGiveawayTab', giveawayPageUrl, giveawayCost: giveaway.cost });
  }
  console.log('Finished entering all giveaways');
}

// Listen for incoming messages
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'enterGiveaways') {
    pointsBudget = getPointsBudget();
    await scrapeAllGiveaways(message.gameIds, pointsBudget);
    sendResponse({ status: 'success' });
  } else if (message.action === 'enterGiveaway') {
    document.querySelector('.sidebar__entry-insert').click();
    sendResponse({ status: 'success' });
  }
});

// Initialization
loadGameList();
injectAddButtons();