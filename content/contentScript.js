let gameList = [];
let gameIdsToScrape = [];
let pointsBudget = 0;

async function loadGameList() {
  const result = await chrome.storage.local.get(['gameList']);
  gameList = result.gameList || [];
  gameList.forEach(savedGame => {
    markGiveawayAsAdded(savedGame.id);
  });
}

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

function injectEnterGiveawayBtn() {
  const nav = document.getElementsByClassName('nav__left-container');
  const addButton = document.createElement('button');
  addButton.textContent = 'Enter Giveaways';
  addButton.classList.add('nav__button');
  addButton.addEventListener('click', async () => {
    pointsBudget = getPointsBudget();
    const response = await scrapeAllGiveaways(gameList.map(game => game.id), pointsBudget);
    if (response) {
      console.log('Giveaway entry process completed successfully.');
    }
  });
  nav[0].appendChild(addButton);
}

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

async function saveGameList() {
  await chrome.storage.local.set({ gameList });
  console.log('Game list saved!');
}

function isGameInList(gameId) {
  return gameList.some(game => game.id === gameId);
}

function getPointsBudget() {
  const pointsElement = document.querySelector('.nav__points');
  return pointsElement ? parseInt(pointsElement.textContent, 10) : 0;
}

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

async function processGiveawayEntries(giveaways) {
  for (const giveaway of giveaways) {
    const giveawayPageUrl = `https://www.steamgifts.com${giveaway.link}`;
    await chrome.runtime.sendMessage({ action: 'openGiveawayTab', giveawayPageUrl, giveawayCost: giveaway.cost });
  }
  console.log('Finished entering all giveaways');
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'enterGiveaways') {
    pointsBudget = getPointsBudget();
    await scrapeAllGiveaways(message.gameIds, pointsBudget);
    sendResponse({ status: 'success' });
  } else if (message.action === 'enterGiveaway') {
    const entryButton = document.querySelector('.sidebar__entry-insert');
    if (entryButton) {
      entryButton.click();
      sendResponse({ status: 'success' });
    } else {
      sendResponse({ status: 'failure', error: 'Entry button not found' });
    }
  }
});

loadGameList();
injectAddButtons();
injectEnterGiveawayBtn();